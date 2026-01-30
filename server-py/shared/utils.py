import re
import hashlib
import time
import logging
import threading
from datetime import datetime
from typing import Optional, Tuple, Dict, List
import pytz

from .constants import COMPILED_SKIP_PATTERNS, get_needs_reply

KST = pytz.timezone("Asia/Seoul")
logger = logging.getLogger(__name__)

# 동적 패턴 캐시 (DB에서 학습된 패턴)
_dynamic_patterns_cache: Dict = {
    "patterns": {},       # Dict[str, List[re.Pattern]]
    "loaded_at": 0.0,
    "ttl": 300,           # 5분
}
_dynamic_patterns_lock = threading.Lock()

# 정규식 안전성 제한
_MAX_REGEX_LENGTH = 200
_MAX_DYNAMIC_PATTERNS = 100


def classify_sender(sender_name: str) -> Tuple[str, Optional[str]]:
    """
    Classify sender as staff or customer based on naming convention.

    Staff patterns:
    - [모션랩스_이름] (with brackets)
    - 모션랩스_이름 (without brackets)
    - Known staff names (e.g., 한기훈)

    Returns:
        tuple: (sender_type, staff_member_name)
        - ('staff', '이우진') for [모션랩스_이우진] or 모션랩스_이우진
        - ('customer', None) for regular names
    """
    # Known staff members with non-standard naming
    KNOWN_STAFF = {'한기훈'}
    if sender_name in KNOWN_STAFF:
        return "staff", sender_name

    # Pattern with brackets: [모션랩스_이름]
    pattern_with_brackets = r"^\[모션랩스_(.+)\]$"
    match = re.match(pattern_with_brackets, sender_name)
    if match:
        return "staff", match.group(1)

    # Pattern without brackets: 모션랩스_이름
    pattern_without_brackets = r"^모션랩스_(.+)$"
    match = re.match(pattern_without_brackets, sender_name)
    if match:
        return "staff", match.group(1)

    return "customer", None


def get_bucket_ts(ts: datetime) -> datetime:
    """
    Get 10-second bucket timestamp for deduplication.

    Example:
        10:42:15 -> 10:42:10
        10:42:25 -> 10:42:20
    """
    if ts.tzinfo is None:
        ts = KST.localize(ts)

    # Truncate to minute and add 10-second bucket
    minute_start = ts.replace(second=0, microsecond=0)
    bucket_offset = (ts.second // 10) * 10
    return minute_start.replace(second=bucket_offset)


def hash_text(chat_room: str, sender_name: str, text: str) -> str:
    """
    Generate SHA256 hash for message deduplication.

    Args:
        chat_room: Chat room name
        sender_name: Sender name
        text: Message text

    Returns:
        SHA256 hex digest
    """
    content = f"{chat_room}|{sender_name}|{text}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def get_kst_now() -> datetime:
    """Get current time in KST timezone."""
    return datetime.now(KST)


def calculate_sla_remaining_sec(first_inbound_at: Optional[datetime], first_response_sec: Optional[int], sla_minutes: int = 20) -> Optional[int]:
    """
    Calculate remaining SLA time in seconds.

    Args:
        first_inbound_at: First customer message timestamp
        first_response_sec: Response time if already responded
        sla_minutes: SLA threshold in minutes (default 20)

    Returns:
        Remaining seconds (negative if breached), or None if not applicable
    """
    if first_inbound_at is None or first_response_sec is not None:
        return None

    now = get_kst_now()
    if first_inbound_at.tzinfo is None:
        first_inbound_at = KST.localize(first_inbound_at)

    elapsed = (now - first_inbound_at).total_seconds()
    threshold = sla_minutes * 60
    return int(threshold - elapsed)


# LLM escalation keywords
ESCALATE_KEYWORDS = [
    "오류", "먹통", "전체", "안됨", "장애",
    "환불", "해지", "클레임", "긴급", "급해",
    "안되요", "작동", "고장", "문제"
]


def should_escalate_to_sonnet(text: str, haiku_confidence: Optional[float] = None) -> bool:
    """
    Determine if message should be classified with Sonnet instead of Haiku.

    Args:
        text: Message text
        haiku_confidence: Confidence score from Haiku (if already classified)

    Returns:
        True if should escalate to Sonnet
    """
    # Keyword matching
    text_lower = text.lower()
    for keyword in ESCALATE_KEYWORDS:
        if keyword in text_lower:
            return True

    # Low confidence from Haiku
    if haiku_confidence is not None and haiku_confidence < 0.65:
        return True

    return False


def _is_safe_regex(pattern_str: str) -> bool:
    """정규식 안전성 검사 - ReDoS 방지"""
    if len(pattern_str) > _MAX_REGEX_LENGTH:
        return False
    # 중첩 반복자 패턴 거부 (예: (a+)+, (a*)*)
    if re.search(r'\([^)]*[+*][^)]*\)[+*]', pattern_str):
        return False
    # 역참조 거부
    if re.search(r'\\[1-9]', pattern_str):
        return False
    return True


def load_dynamic_patterns() -> Dict[str, List[re.Pattern]]:
    """
    DB에서 승인된 skip_llm 패턴을 로드하여 컴파일된 정규식으로 반환.
    5분 TTL 캐시 적용. 스레드 안전. ReDoS 방지.
    """
    global _dynamic_patterns_cache

    current_time = time.time()

    # 캐시가 유효하면 반환 (락 불필요)
    # NOTE: TOCTOU 가능하나, Python GIL + dict 단일 할당 원자성으로 실질적 안전.
    # 최악의 경우 불필요한 DB 리프레시 1회 발생 (허용 가능).
    if (_dynamic_patterns_cache["patterns"] and
        current_time - _dynamic_patterns_cache["loaded_at"] < _dynamic_patterns_cache["ttl"]):
        return _dynamic_patterns_cache["patterns"]

    # 캐시 미스 - 락으로 동시 리프레시 방지
    if not _dynamic_patterns_lock.acquire(blocking=False):
        # 다른 스레드가 리프레시 중 → stale 캐시 반환 (요청 차단 방지)
        return _dynamic_patterns_cache.get("patterns", {})

    db = None
    try:
        from .database import SessionLocal
        from .models import PatternApplicationLog

        db = SessionLocal()
        approved_patterns = db.query(PatternApplicationLog).filter(
            PatternApplicationLog.status == "approved",
            PatternApplicationLog.pattern_type == "skip_llm",
        ).limit(_MAX_DYNAMIC_PATTERNS).all()

        compiled: Dict[str, List[re.Pattern]] = {}
        skipped = 0
        for p in approved_patterns:
            data = p.pattern_data or {}
            regex_str = data.get("pattern", "")
            intent = data.get("intent", "acknowledgment")

            if not regex_str:
                continue

            if not _is_safe_regex(regex_str):
                logger.warning(f"[DynamicPattern] Rejected unsafe regex: '{regex_str[:50]}...'")
                skipped += 1
                continue

            try:
                compiled_re = re.compile(regex_str, re.IGNORECASE)
                compiled.setdefault(intent, []).append(compiled_re)
            except re.error as e:
                logger.warning(f"[DynamicPattern] Invalid regex '{regex_str}': {e}")
                skipped += 1

        # 원자적 캐시 교체
        _dynamic_patterns_cache["patterns"] = compiled
        _dynamic_patterns_cache["loaded_at"] = current_time

        if compiled or skipped:
            total = sum(len(v) for v in compiled.values())
            logger.info(f"[DynamicPattern] Loaded {total} patterns from DB (skipped {skipped})")

        return compiled

    except Exception as e:
        logger.error(f"[DynamicPattern] Failed to load: {e}")
        return _dynamic_patterns_cache.get("patterns", {})
    finally:
        if db is not None:
            db.close()
        _dynamic_patterns_lock.release()


def match_skip_pattern(text: str) -> Tuple[bool, Optional[str]]:
    """
    Check if message matches a skip pattern and return the matched intent.

    Static (하드코딩) 패턴을 먼저 체크한 후,
    DB에서 학습된 동적 패턴을 추가로 체크합니다.

    Args:
        text: Message text

    Returns:
        (matched, intent):
        - (True, "acknowledgment") if matched acknowledgment pattern
        - (True, "reaction") if matched reaction pattern
        - (False, None) if no match
    """
    text_stripped = text.strip()

    # 1. 정적 패턴 (하드코딩) 체크
    for intent, patterns in COMPILED_SKIP_PATTERNS.items():
        for pattern in patterns:
            if pattern.match(text_stripped):
                return True, intent

    # 2. 동적 패턴 (DB 학습) 체크 - fullmatch로 전체 일치만 허용
    dynamic = load_dynamic_patterns()
    for intent, patterns in dynamic.items():
        for pattern in patterns:
            if pattern.fullmatch(text_stripped):
                return True, intent

    return False, None


# Legacy function for backward compatibility
def should_skip_llm(text: str) -> bool:
    """
    Check if message should skip LLM classification.
    
    DEPRECATED: Use match_skip_pattern() instead to get the intent.
    """
    matched, _ = match_skip_pattern(text)
    return matched

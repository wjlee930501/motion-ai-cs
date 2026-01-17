import re
import hashlib
from datetime import datetime
from typing import Optional, Tuple
import pytz

KST = pytz.timezone("Asia/Seoul")


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


# Skip LLM classification for simple messages (acknowledgments that don't need reply)
SKIP_LLM_PATTERNS = [
    # 감사 표현
    r"^(아\s*)?네?\s*감사합니다[.!~]*$",
    r"^감사드려요[.!~]*$",
    r"^감사해요[.!~]*$",
    r"^고마워요[.!~]*$",
    r"^고맙습니다[.!~]*$",
    # 확인/동의 표현
    r"^(아\s*)?(네|넵|넹|네네)[.!~]*$",
    r"^알겠습니다[.!~]*$",
    r"^알겠어요[.!~]*$",
    r"^확인했습니다[.!~]*$",
    r"^확인했어요[.!~]*$",
    r"^확인됐습니다[.!~]*$",
    # 짧은 응답
    r"^ㅇㅇ$",
    r"^ㅋㅋ+$",
    r"^ㅎㅎ+$",
    r"^ㅇㅋ$",
    r"^오키$",
    r"^오케이$",
    r"^ok$",
]


def should_skip_llm(text: str) -> bool:
    """
    Check if message should skip LLM classification (simple greetings/acknowledgments).
    """
    text_stripped = text.strip()
    for pattern in SKIP_LLM_PATTERNS:
        if re.match(pattern, text_stripped, re.IGNORECASE):
            return True
    return False

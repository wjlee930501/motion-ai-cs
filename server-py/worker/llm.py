"""
LLM Classification using Claude API

학습 결과(CSUnderstanding)를 분류에 반영하여 needs_reply 판단 정확도 개선
"""

import json
import re
from typing import Optional

from shared.config import get_settings
from shared.utils import should_escalate_to_sonnet, match_skip_pattern
from shared.constants import get_needs_reply, build_intent_prompt_section, build_needs_reply_guide
from shared.database import get_db
from shared.models import CSUnderstanding, ClassificationFeedback, ClinicProfile

settings = get_settings()

# CSUnderstanding 캐시 (메모리)
_cs_understanding_cache = {
    "version": 0,
    "text": None,
    "loaded_at": None
}

# 분류 수정 규칙 캐시
_correction_rules_cache = {
    "rules_text": None,
    "loaded_at": None,
}

# Lazy import anthropic
_client = None


def get_anthropic_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def get_cs_understanding_context() -> Optional[str]:
    """
    최신 CSUnderstanding을 로드하여 분류 컨텍스트로 활용
    5분 캐시 적용
    """
    import time
    global _cs_understanding_cache

    current_time = time.time()
    cache_ttl = 300  # 5분

    # 캐시가 유효하면 반환
    if (_cs_understanding_cache["text"] is not None and
        _cs_understanding_cache["loaded_at"] is not None and
        current_time - _cs_understanding_cache["loaded_at"] < cache_ttl):
        return _cs_understanding_cache["text"]

    # DB에서 최신 이해 로드
    try:
        db = next(get_db())
        understanding = db.query(CSUnderstanding).order_by(
            CSUnderstanding.version.desc()
        ).first()
        db.close()

        if understanding:
            _cs_understanding_cache["version"] = understanding.version
            _cs_understanding_cache["text"] = understanding.understanding_text
            _cs_understanding_cache["loaded_at"] = current_time
            return understanding.understanding_text
    except Exception as e:
        print(f"[LLM] Failed to load CSUnderstanding: {e}")

    return None


def get_correction_rules_context() -> Optional[str]:
    """
    운영자 수정 패턴을 로드하여 분류 프롬프트에 주입할 규칙 생성.
    5분 캐시 적용. DB corrections + CSUnderstanding misclassification_learnings 병합.
    """
    import time
    from datetime import datetime, timedelta
    from sqlalchemy import func as sa_func
    global _correction_rules_cache

    current_time = time.time()
    cache_ttl = 300  # 5분

    if (_correction_rules_cache["rules_text"] is not None and
        _correction_rules_cache["loaded_at"] is not None and
        current_time - _correction_rules_cache["loaded_at"] < cache_ttl):
        return _correction_rules_cache["rules_text"]

    try:
        db = next(get_db())

        # 1. DB에서 최근 30일 수정 패턴 집계
        cutoff = datetime.utcnow() - timedelta(days=30)
        correction_patterns = (
            db.query(
                ClassificationFeedback.original_intent,
                ClassificationFeedback.corrected_intent,
                sa_func.count().label("cnt"),
            )
            .filter(
                ClassificationFeedback.corrected_intent.isnot(None),
                ClassificationFeedback.corrected_at >= cutoff,
            )
            .group_by(
                ClassificationFeedback.original_intent,
                ClassificationFeedback.corrected_intent,
            )
            .order_by(sa_func.count().desc())
            .limit(15)
            .all()
        )

        # 2. CSUnderstanding에서 misclassification_learnings 로드
        misclass_learnings = []
        understanding = db.query(CSUnderstanding).order_by(
            CSUnderstanding.version.desc()
        ).first()
        if understanding and understanding.key_insights:
            misclass_learnings = understanding.key_insights.get("misclassification_learnings", [])

        db.close()

        # 3. 병합 (DB corrections 우선, dedup by from→to pair)
        seen_pairs = set()
        rules = []

        for row in correction_patterns:
            pair = (row.original_intent, row.corrected_intent)
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                rules.append(f'- "{row.original_intent}" → "{row.corrected_intent}" (수정 {row.cnt}건)')

        for learning in misclass_learnings:
            orig = learning.get("original_intent", "")
            corrected = learning.get("corrected_intent", "")
            if orig and corrected and (orig, corrected) not in seen_pairs:
                seen_pairs.add((orig, corrected))
                lesson = learning.get("lesson", "")
                suffix = f": {lesson}" if lesson else ""
                rules.append(f'- "{orig}" → "{corrected}"{suffix}')

        if not rules:
            _correction_rules_cache["rules_text"] = None
            _correction_rules_cache["loaded_at"] = current_time
            return None

        rules_text = (
            "\n---\n"
            "[분류 수정 규칙 - 반드시 참고]\n"
            "다음은 운영자가 수정한 분류 패턴입니다:\n"
            + "\n".join(rules)
            + "\n\n위 패턴에 해당하는 메시지는 수정된 intent로 분류하세요.\n"
            "---\n"
        )

        _correction_rules_cache["rules_text"] = rules_text
        _correction_rules_cache["loaded_at"] = current_time
        return rules_text

    except Exception as e:
        print(f"[LLM] Failed to load correction rules: {e}")
        return None


def get_recent_conversation_context(chat_room: str, limit: int = 5) -> list[dict]:
    """
    최근 메시지 맥락을 조회하여 분류 정확도 향상
    
    Args:
        chat_room: 채팅방 이름
        limit: 조회할 메시지 수 (기본 5개)
    
    Returns:
        최근 메시지 리스트 [{"sender_type": "customer", "text": "..."}, ...]
    """
    try:
        db = next(get_db())
        from shared.models import MessageEvent
        
        recent_events = db.query(MessageEvent).filter(
            MessageEvent.chat_room == chat_room
        ).order_by(
            MessageEvent.received_at.desc()
        ).limit(limit + 1).all()  # +1 because current message might be included
        
        db.close()
        
        if not recent_events or len(recent_events) <= 1:
            return []
        
        # 현재 메시지 제외하고 역순으로 반환 (시간순)
        context = []
        for event in reversed(recent_events[1:]):  # Skip the most recent (current)
            context.append({
                "sender_type": event.sender_type,
                "text": event.text_raw[:100] if event.text_raw else ""
            })
        
        return context
        
    except Exception as e:
        print(f"[LLM] Failed to load conversation context: {e}")
        return []


def _get_clinic_hint(chat_room: str) -> str:
    """병원 프로파일이 있으면 분류 시 참고 힌트 반환"""
    try:
        db = next(get_db())
        profile = db.query(ClinicProfile).filter(ClinicProfile.clinic_key == chat_room).first()
        db.close()

        if not profile or not profile.profile_label:
            return ""

        labels = {"demanding": "까다로운 편", "friendly": "우호적인 편", "neutral": "보통"}
        label_kr = labels.get(profile.profile_label, "")
        if not label_kr:
            return ""

        return f"고객 성향: {label_kr} (불만비율 {float(profile.complaint_ratio or 0):.0%})\n"
    except Exception:
        return ""


def build_classification_prompt(base_prompt: str) -> str:
    """
    기본 프롬프트에 수정 규칙 + CSUnderstanding 컨텍스트를 추가.
    수정 규칙이 먼저 오고, 학습된 패턴이 뒤에 온다 (구체적 규칙 우선).
    """
    correction_rules = get_correction_rules_context()
    cs_context = get_cs_understanding_context()

    additions = ""

    # 수정 규칙을 먼저 추가 (구체적, 액션 가능한 규칙)
    if correction_rules:
        additions += correction_rules

    # 학습된 CS 패턴을 뒤에 추가 (일반적 컨텍스트)
    if cs_context:
        additions += f"""
---
[학습된 CS 패턴 - 분류 시 참고]
{cs_context[:2000]}
---

위 학습된 패턴을 참고하여 메시지를 분류하세요. 특히 needs_reply 판단 시:
- 학습된 패턴에서 "답변 불필요" 또는 "단순 응답"으로 분류된 유형은 needs_reply=false
- 학습된 패턴에서 "문의", "요청", "불만"으로 분류된 유형은 needs_reply=true
"""

    return base_prompt + additions if additions else base_prompt


# System prompts
# Topic 목록 (상수)
TOPIC_LIST = """Topic 목록:
- 발송/전송 문제
- 예약 관련
- 결제/정산
- 기능 문의
- 오류/장애
- 계정/로그인
- 리뷰 관련
- 기타 문의
- 인사/감사"""


def build_event_classification_system() -> str:
    """동적으로 분류 시스템 프롬프트 생성 (Single Source of Truth)"""
    intent_section = build_intent_prompt_section()
    needs_reply_guide = build_needs_reply_guide()
    
    return f"""당신은 병원 CS 메시지 분류 전문가입니다.
카카오톡 메시지를 분석하여 JSON 형식으로 분류 결과를 반환합니다.

분류 기준:
- topic: 메시지의 주제 (아래 목록 중 선택)
- urgency: 긴급도 (critical/high/medium/low)
- sentiment: 감정 (positive/neutral/negative/angry)
- intent: 의도 (아래 목록 중 선택)
- needs_reply: 답변이 필요한 메시지인지 (true/false)
- summary: 핵심 내용 1줄 요약 (20자 이내)
- confidence: 분류 확신도 (0.0~1.0)

{intent_section}

{TOPIC_LIST}

{needs_reply_guide}

반드시 유효한 JSON만 출력하세요. 설명 없이 JSON만 출력합니다."""


# 프롬프트 캐싱 (모듈 로드 시 1회 생성)
EVENT_CLASSIFICATION_SYSTEM = build_event_classification_system()


TICKET_SUMMARY_SYSTEM = """당신은 병원 CS 티켓 요약 전문가입니다.
대화 내역을 분석하여 관리자가 빠르게 상황을 파악할 수 있도록 요약합니다.

출력 형식 (JSON):
- summary: 핵심 상황 2~3줄 (bullet point, • 사용)
- next_action: 다음 조치 권장 1줄
- overall_urgency: 전체 긴급도 (critical/high/medium/low)

반드시 유효한 JSON만 출력하세요. 설명 없이 JSON만 출력합니다."""


def parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling potential markdown code blocks"""
    # Remove markdown code blocks if present
    text = text.strip()
    if text.startswith("```"):
        # Find the end of code block
        lines = text.split("\n")
        json_lines = []
        in_block = False
        for line in lines:
            if line.startswith("```"):
                in_block = not in_block
                continue
            if in_block or not line.startswith("```"):
                json_lines.append(line)
        text = "\n".join(json_lines)

    # Try to parse JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in text
        match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {}


def classify_event(
    chat_room: str,
    sender_type: str,
    text: str,
    force_sonnet: bool = False
) -> tuple[dict, str]:
    """
    Classify a single message event.

    Args:
        chat_room: Chat room name
        sender_type: 'staff' or 'customer'
        text: Message text
        force_sonnet: Force use of Sonnet model

    Returns:
        tuple: (classification_result, model_used)
    """
    # Skip simple messages - 패턴 매칭으로 빠르게 처리
    matched, matched_intent = match_skip_pattern(text)
    if matched and matched_intent:
        return {
            "topic": "인사/감사",
            "urgency": "low",
            "sentiment": "positive" if matched_intent == "acknowledgment" else "neutral",
            "intent": matched_intent,  # 실제 매칭된 intent 사용 (acknowledgment, reaction 등)
            "needs_reply": get_needs_reply(matched_intent),  # constants에서 일관되게 가져옴
            "summary": text[:20],
            "confidence": 1.0
        }, "skip"

    # Determine model
    if force_sonnet or should_escalate_to_sonnet(text):
        model = settings.anthropic_model_escalate
    else:
        model = settings.anthropic_model_default

    client = get_anthropic_client()

    # P2: 최근 대화 맥락 조회
    conversation_context = get_recent_conversation_context(chat_room)
    
    context_str = ""
    if conversation_context:
        context_lines = []
        for msg in conversation_context:
            sender_label = "고객" if msg["sender_type"] == "customer" else "직원"
            context_lines.append(f"  [{sender_label}] {msg['text']}")
        context_str = "\n이전 대화 맥락 (최근 " + str(len(conversation_context)) + "개):\n" + "\n".join(context_lines) + "\n"

    # 병원 성향 컨텍스트 (프로파일이 있으면 참고 정보 제공)
    clinic_hint = _get_clinic_hint(chat_room)

    user_prompt = f"""채팅방: {chat_room}
발신자 유형: {sender_type}
{clinic_hint}{context_str}
현재 메시지: {text}

위 메시지를 분석하여 JSON으로 반환하세요. 이전 대화 맥락이 있다면 참고하여 의도와 긴급도를 판단하세요."""

    # 학습된 CS 패턴을 프롬프트에 반영
    system_prompt = build_classification_prompt(EVENT_CLASSIFICATION_SYSTEM)

    try:
        response = client.messages.create(
            model=model,
            max_tokens=500,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )

        result = parse_json_response(response.content[0].text)

        # Validate required fields
        if not all(k in result for k in ["topic", "urgency", "confidence"]):
            # Fallback
            result = {
                "topic": "기타 문의",
                "urgency": "medium",
                "sentiment": "neutral",
                "intent": "other",
                "needs_reply": True,  # Safe default - don't miss real customer inquiries
                "summary": text[:20],
                "confidence": 0.5
            }

        # Ensure needs_reply is set - intent 기반으로 검증
        if "needs_reply" not in result:
            intent = result.get("intent", "other")
            result["needs_reply"] = get_needs_reply(intent)

        # Re-escalate if low confidence and was Haiku
        if model == settings.anthropic_model_default:
            confidence = result.get("confidence", 1.0)
            if confidence < 0.65:
                return classify_event(chat_room, sender_type, text, force_sonnet=True)

        return result, model

    except Exception as e:
        # Fallback on error
        return {
            "topic": "기타 문의",
            "urgency": "medium",
            "sentiment": "neutral",
            "intent": "other",
            "needs_reply": True,  # Safe default - don't miss real customer inquiries
            "summary": text[:20],
            "confidence": 0.3,
            "error": str(e)
        }, "error"


def summarize_ticket(clinic_key: str, events: list[dict]) -> tuple[dict, str]:
    """
    Generate ticket summary from events.

    Args:
        clinic_key: Clinic identifier
        events: List of event dicts with 'sender_type', 'text', 'time'

    Returns:
        tuple: (summary_result, model_used)
    """
    if not events:
        return {
            "summary": "• 메시지 없음",
            "next_action": "추가 정보 필요",
            "overall_urgency": "low"
        }, "skip"

    client = get_anthropic_client()
    model = settings.anthropic_model_escalate  # Always use Sonnet for summaries

    formatted_events = "\n".join([
        f"[{e.get('time', '')}] {e.get('sender_type', 'unknown')}: {e.get('text', '')}"
        for e in events
    ])

    user_prompt = f"""채팅방: {clinic_key}

대화 내역:
{formatted_events}

위 대화를 분석하여 JSON으로 반환하세요."""

    try:
        response = client.messages.create(
            model=model,
            max_tokens=500,
            system=TICKET_SUMMARY_SYSTEM,
            messages=[{"role": "user", "content": user_prompt}]
        )

        result = parse_json_response(response.content[0].text)

        # Validate required fields
        if not all(k in result for k in ["summary", "next_action", "overall_urgency"]):
            result = {
                "summary": "• 요약 생성 실패",
                "next_action": "수동 확인 필요",
                "overall_urgency": "medium"
            }

        return result, model

    except Exception as e:
        return {
            "summary": f"• 요약 오류: {str(e)[:50]}",
            "next_action": "수동 확인 필요",
            "overall_urgency": "medium",
            "error": str(e)
        }, "error"


# Urgency to priority mapping
URGENCY_TO_PRIORITY = {
    "critical": "urgent",
    "high": "high",
    "medium": "normal",
    "low": "low"
}

PRIORITY_ORDER = ["low", "normal", "high", "urgent"]


def get_priority_from_urgency(urgency: str) -> str:
    """Convert LLM urgency to ticket priority"""
    return URGENCY_TO_PRIORITY.get(urgency, "normal")


def should_upgrade_priority(current: str, new: str) -> bool:
    """Check if new priority is higher than current"""
    try:
        return PRIORITY_ORDER.index(new) > PRIORITY_ORDER.index(current)
    except ValueError:
        return False

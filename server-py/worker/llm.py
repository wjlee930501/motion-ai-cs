"""
LLM Classification using Claude API

학습 결과(CSUnderstanding)를 분류에 반영하여 needs_reply 판단 정확도 개선
"""

import json
import re
from typing import Optional

from shared.config import get_settings
from shared.utils import should_escalate_to_sonnet, should_skip_llm
from shared.database import get_db
from shared.models import CSUnderstanding

settings = get_settings()

# CSUnderstanding 캐시 (메모리)
_cs_understanding_cache = {
    "version": 0,
    "text": None,
    "loaded_at": None
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

def build_classification_prompt(base_prompt: str) -> str:
    """
    기본 프롬프트에 CSUnderstanding 컨텍스트를 추가
    """
    cs_context = get_cs_understanding_context()

    if not cs_context:
        return base_prompt

    # CSUnderstanding에서 핵심 패턴 추출하여 추가
    context_addition = f"""

---
[학습된 CS 패턴 - 분류 시 참고]
{cs_context[:2000]}
---

위 학습된 패턴을 참고하여 메시지를 분류하세요. 특히 needs_reply 판단 시:
- 학습된 패턴에서 "답변 불필요" 또는 "단순 응답"으로 분류된 유형은 needs_reply=false
- 학습된 패턴에서 "문의", "요청", "불만"으로 분류된 유형은 needs_reply=true
"""

    return base_prompt + context_addition


# System prompts
EVENT_CLASSIFICATION_SYSTEM = """당신은 병원 CS 메시지 분류 전문가입니다.
카카오톡 메시지를 분석하여 JSON 형식으로 분류 결과를 반환합니다.

분류 기준:
- topic: 메시지의 주제 (아래 목록 중 선택)
- urgency: 긴급도 (critical/high/medium/low)
- sentiment: 감정 (positive/neutral/negative/angry)
- intent: 의도 (아래 4가지 중 선택)
- needs_reply: 답변이 필요한 메시지인지 (true/false)
- summary: 핵심 내용 1줄 요약 (20자 이내)
- confidence: 분류 확신도 (0.0~1.0)

Intent (의도) - 14가지 중 선택:

[답변 필요 - needs_reply=true]
- inquiry_status: 상태/진행 확인 문의 (예: "발송됐나요?", "처리됐나요?", "언제 되나요?")
- request_action: 작업 요청 (예: "해주세요", "부탁드립니다", "진행해주세요")
- request_change: 변경/수정 요청 (예: "수정해주세요", "변경 부탁드립니다", "취소해주세요")
- complaint: 불만/클레임 (예: "왜 안 되는 거죠?", "문제가 있어요", "이게 뭐예요")
- question_how: 방법/사용법 문의 (예: "어떻게 해요?", "방법이 뭐예요?")
- question_when: 일정/시간 문의 (예: "언제 가능해요?", "시간이 어떻게 되나요?")
- follow_up: 이전 요청에 대한 추가 정보 제공 (예: "아까 말씀드린 건 이거예요", "추가로 보내드려요")

[답변 불필요 - needs_reply=false]
- provide_info: 정보/자료 제공 (예: "사진 보내드립니다", "자료입니다", 파일 전송)
- acknowledgment: 확인/동의 (예: "네", "알겠습니다", "확인했습니다", "감사합니다")
- greeting: 인사 (예: "안녕하세요", "수고하세요")
- internal_discussion: 병원 스태프끼리 대화 (예: "과장님 이거 확인해주세요", "내가 할게", 스태프 간 호칭 사용)
- reaction: 단순 리액션 (예: "ㅎㅎ", "ㅋㅋ", "👍", "ㅇㅇ", 이모지만 있는 경우)
- confirmation_received: 직원 안내 완료 후 고객 확인 (예: 직원이 "보내드렸습니다" 후 → "감사합니다!", "알겠습니다~")
- other: 위에 해당하지 않는 기타

Topic 목록:
- 발송/전송 문제
- 예약 관련
- 결제/정산
- 기능 문의
- 오류/장애
- 계정/로그인
- 리뷰 관련
- 기타 문의
- 인사/감사

needs_reply 판단 기준:
- true: inquiry_status, request_action, request_change, complaint, question_how, question_when, follow_up (답변 필요)
- false: provide_info, acknowledgment, greeting, internal_discussion, reaction, confirmation_received, other (답변 불필요)
- 맥락 고려: 이전 대화 흐름을 보고 판단. 특히:
  * 고객 메시지가 연속되고 스태프 간 호칭/업무 지시가 있으면 → internal_discussion
  * 직원이 안내 완료 후 고객의 "감사", "알겠습니다" → confirmation_received
  * 판단이 애매하면 needs_reply=true (응대 누락 방지 우선)

반드시 유효한 JSON만 출력하세요. 설명 없이 JSON만 출력합니다."""


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
    # Skip simple messages (greetings, acknowledgments - no reply needed)
    if should_skip_llm(text):
        return {
            "topic": "인사/감사",
            "urgency": "low",
            "sentiment": "neutral",
            "intent": "other",
            "needs_reply": False,  # Simple acknowledgments don't need a reply
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

    user_prompt = f"""채팅방: {chat_room}
발신자 유형: {sender_type}
{context_str}
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
                "needs_reply": True,  # Assume needs reply if classification failed
                "summary": text[:20],
                "confidence": 0.5
            }

        # Ensure needs_reply is set (default to True if not provided by LLM)
        if "needs_reply" not in result:
            result["needs_reply"] = True

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
            "needs_reply": True,  # Assume needs reply if error occurred
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

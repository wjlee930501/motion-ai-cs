"""
LLM Classification using Claude API
"""

import os
import sys
import json
import re
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.config import get_settings
from shared.utils import should_escalate_to_sonnet, should_skip_llm

settings = get_settings()

# Lazy import anthropic
_client = None


def get_anthropic_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


# System prompts
EVENT_CLASSIFICATION_SYSTEM = """당신은 병원 CS 메시지 분류 전문가입니다.
카카오톡 메시지를 분석하여 JSON 형식으로 분류 결과를 반환합니다.

분류 기준:
- topic: 메시지의 주제 (아래 목록 중 선택)
- urgency: 긴급도 (critical/high/medium/low)
- sentiment: 감정 (positive/neutral/negative/angry)
- intent: 의도 (support_request/complaint/inquiry/feedback/greeting/other)
- summary: 핵심 내용 1줄 요약 (20자 이내)
- confidence: 분류 확신도 (0.0~1.0)

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
    # Skip simple messages
    if should_skip_llm(text):
        return {
            "topic": "인사/감사",
            "urgency": "low",
            "sentiment": "neutral",
            "intent": "greeting",
            "summary": text[:20],
            "confidence": 1.0
        }, "skip"

    # Determine model
    if force_sonnet or should_escalate_to_sonnet(text):
        model = settings.anthropic_model_escalate
    else:
        model = settings.anthropic_model_default

    client = get_anthropic_client()

    user_prompt = f"""채팅방: {chat_room}
발신자 유형: {sender_type}
메시지: {text}

위 메시지를 분석하여 JSON으로 반환하세요."""

    try:
        response = client.messages.create(
            model=model,
            max_tokens=500,
            system=EVENT_CLASSIFICATION_SYSTEM,
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
                "intent": "inquiry",
                "summary": text[:20],
                "confidence": 0.5
            }

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
            "intent": "inquiry",
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

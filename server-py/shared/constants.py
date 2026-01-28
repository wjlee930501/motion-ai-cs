"""
CS Intelligence 상수 정의

모든 Intent, 패턴, needs_reply 매핑을 중앙에서 관리
LLM 프롬프트와 코드 로직의 일관성 보장
"""

import re
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class IntentDefinition:
    """Intent 정의"""

    name: str
    needs_reply: bool
    description_ko: str
    examples: List[str]


# ============================================
# Intent 정의 (Single Source of Truth)
# ============================================

INTENTS: Dict[str, IntentDefinition] = {
    # 답변 필요 (needs_reply=True)
    "inquiry_status": IntentDefinition(
        name="inquiry_status",
        needs_reply=True,
        description_ko="상태/진행 확인 문의",
        examples=["발송됐나요?", "처리됐나요?", "언제 되나요?"],
    ),
    "request_action": IntentDefinition(
        name="request_action",
        needs_reply=True,
        description_ko="작업 요청",
        examples=["해주세요", "부탁드립니다", "진행해주세요"],
    ),
    "request_change": IntentDefinition(
        name="request_change",
        needs_reply=True,
        description_ko="변경/수정 요청",
        examples=["수정해주세요", "변경 부탁드립니다", "취소해주세요"],
    ),
    "complaint": IntentDefinition(
        name="complaint",
        needs_reply=True,
        description_ko="불만/클레임",
        examples=["왜 안 되는 거죠?", "문제가 있어요", "이게 뭐예요"],
    ),
    "question_how": IntentDefinition(
        name="question_how",
        needs_reply=True,
        description_ko="방법/사용법 문의",
        examples=["어떻게 해요?", "방법이 뭐예요?"],
    ),
    "question_when": IntentDefinition(
        name="question_when",
        needs_reply=True,
        description_ko="일정/시간 문의",
        examples=["언제 가능해요?", "시간이 어떻게 되나요?"],
    ),
    "follow_up": IntentDefinition(
        name="follow_up",
        needs_reply=True,
        description_ko="이전 요청에 대한 추가 정보 제공",
        examples=["아까 말씀드린 건 이거예요", "추가로 보내드려요"],
    ),
    # 답변 불필요 (needs_reply=False)
    "provide_info": IntentDefinition(
        name="provide_info",
        needs_reply=False,
        description_ko="정보/자료 제공",
        examples=["사진 보내드립니다", "자료입니다", "파일 전송"],
    ),
    "acknowledgment": IntentDefinition(
        name="acknowledgment",
        needs_reply=False,
        description_ko="확인/동의",
        examples=["네", "알겠습니다", "확인했습니다", "감사합니다"],
    ),
    "greeting": IntentDefinition(
        name="greeting",
        needs_reply=False,
        description_ko="인사",
        examples=["안녕하세요", "수고하세요"],
    ),
    "internal_discussion": IntentDefinition(
        name="internal_discussion",
        needs_reply=False,
        description_ko="병원 스태프끼리 대화",
        examples=["과장님 이거 확인해주세요", "내가 할게", "스태프 간 호칭 사용"],
    ),
    "reaction": IntentDefinition(
        name="reaction",
        needs_reply=False,
        description_ko="단순 리액션",
        examples=["ㅎㅎ", "ㅋㅋ", "👍", "ㅇㅇ", "이모지만 있는 경우"],
    ),
    "confirmation_received": IntentDefinition(
        name="confirmation_received",
        needs_reply=False,
        description_ko="직원 안내 완료 후 고객 확인",
        examples=["직원이 '보내드렸습니다' 후 → '감사합니다!', '알겠습니다~'"],
    ),
    "other": IntentDefinition(
        name="other",
        needs_reply=False,
        description_ko="위에 해당하지 않는 기타",
        examples=[],
    ),
}


# ============================================
# Skip LLM 패턴 (Intent별 그룹화)
# ============================================

SKIP_LLM_PATTERNS: Dict[str, List[str]] = {
    "acknowledgment": [
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
    ],
    "reaction": [
        r"^ㅇㅇ$",
        r"^ㅋㅋ+$",
        r"^ㅎㅎ+$",
        r"^ㅇㅋ$",
        r"^오키$",
        r"^오케이$",
        r"^ok$",
    ],
}

# 정규표현식 미리 컴파일 (성능 최적화)
COMPILED_SKIP_PATTERNS: Dict[str, List[re.Pattern]] = {
    intent: [re.compile(p, re.IGNORECASE) for p in patterns]
    for intent, patterns in SKIP_LLM_PATTERNS.items()
}


# ============================================
# Helper Functions
# ============================================


def get_needs_reply(intent: str) -> bool:
    """Intent에 따른 needs_reply 값 반환"""
    if intent in INTENTS:
        return INTENTS[intent].needs_reply
    print(f"[WARN] Unknown intent: {intent}, defaulting to needs_reply=True")
    return True


def get_intents_needing_reply() -> List[str]:
    """답변 필요한 intent 목록"""
    return [name for name, defn in INTENTS.items() if defn.needs_reply]


def get_intents_not_needing_reply() -> List[str]:
    """답변 불필요한 intent 목록"""
    return [name for name, defn in INTENTS.items() if not defn.needs_reply]


def build_intent_prompt_section() -> str:
    """LLM 프롬프트용 Intent 섹션 동적 생성"""
    lines = [f"Intent (의도) - {len(INTENTS)}가지 중 선택:", ""]

    # 답변 필요
    lines.append("[답변 필요 - needs_reply=true]")
    for name, defn in INTENTS.items():
        if defn.needs_reply:
            examples = ", ".join(f'"{e}"' for e in defn.examples[:3])
            lines.append(f"- {name}: {defn.description_ko} (예: {examples})")

    lines.append("")

    # 답변 불필요
    lines.append("[답변 불필요 - needs_reply=false]")
    for name, defn in INTENTS.items():
        if not defn.needs_reply:
            examples = (
                ", ".join(f'"{e}"' for e in defn.examples[:3]) if defn.examples else ""
            )
            if examples:
                lines.append(f"- {name}: {defn.description_ko} (예: {examples})")
            else:
                lines.append(f"- {name}: {defn.description_ko}")

    return "\n".join(lines)


def build_needs_reply_guide() -> str:
    need_reply = get_intents_needing_reply()
    no_reply = get_intents_not_needing_reply()

    return f"""needs_reply 판단 기준:
- true: {", ".join(need_reply)} (답변 필요)
- false: {", ".join(no_reply)} (답변 불필요)
- 맥락 고려: 이전 대화 흐름을 보고 판단. 특히:
  * 고객 메시지가 연속되고 스태프 간 호칭/업무 지시가 있으면 → internal_discussion
  * 직원이 안내 완료 후 고객의 "감사", "알겠습니다" → confirmation_received
  * 판단이 애매하면 needs_reply=true (응대 누락 방지 우선)"""


TEMPLATE_CATEGORIES = ["인사", "안내", "문제해결", "마무리", "기타"]

TICKET_STATUSES = ["onboarding", "stable", "churn_risk", "important"]

TICKET_PRIORITIES = ["low", "normal", "high", "urgent"]

USER_ROLES = ["admin", "member"]

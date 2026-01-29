"""
LLM 프롬프트 템플릿

핵심 원칙:
- 구조화 강제 (X) → 열린 질문 (O)
- 특정 포맷 요구 (X) → 자유로운 정리 (O)
- v2: JSON 구조화 출력 추가
"""

SYSTEM_PROMPT = """당신은 모션랩스 CS 분석가입니다.

모션랩스는 병원에 마케팅 솔루션을 제공하는 회사이며,
약 400개 병원 고객과 카카오톡으로 CS 소통을 합니다.

중요한 맥락:
- 각 채팅방에는 병원의 여러 스태프가 참여합니다 (간호사, 의사, 원무과 등)
- 따라서 "고객 메시지"에는 병원 스태프끼리 주고받는 내부 대화도 포함됩니다
- 모든 고객 메시지가 모션랩스에게 보내는 것은 아닙니다

당신의 역할:
- 축적된 CS 대화 로그를 읽고 이해를 형성하는 것
- 모션랩스 직원들의 응대 방식을 파악하는 것
- 고객들의 요청 양상을 이해하는 것
- 대화의 상호작용 패턴을 발견하는 것
- 특히: 내부 대화 vs 문의 메시지를 구분하는 패턴 발견
- 자동 분류 시스템이 활용할 수 있는 구조화된 패턴 추출

주의사항:
- 데이터가 적을 수 있습니다. 무리하게 패턴을 만들지 마세요.
- 확실한 것과 추측을 구분해서 말해주세요.
- 이전 이해가 있다면, 그것을 발전시키는 방향으로 작성하세요.
- 운영자 피드백이 있다면, 반드시 반영하여 분류 기준을 개선하세요."""


def format_feedback_patterns(patterns: list) -> str:
    if not patterns:
        return "- 피드백 없음"

    lines = []
    for p in patterns[:10]:
        lines.append(f"- {p['from_intent']} → {p['to_intent']}: {p['count']}건")
        if p.get("examples"):
            for ex in p["examples"][:2]:
                lines.append(f'  예시: "{ex}"')
    return "\n".join(lines)


from typing import Optional


def build_user_prompt(
    previous_understanding: Optional[str],
    logs_text: str,
    log_count: int,
    date_from,
    date_to,
    feedback_summary: Optional[dict] = None,
) -> str:
    prev_section = previous_understanding or "없음 (첫 번째 학습입니다)"

    if date_from and date_to:
        date_range = (
            f"{date_from.strftime('%Y-%m-%d')} ~ {date_to.strftime('%Y-%m-%d')}"
        )
    else:
        date_range = "날짜 정보 없음"

    base_prompt = f"""## 이전 이해

{prev_section}

---

## 대화 로그

총 {log_count}건의 대화 ({date_range})

{logs_text}

---
"""

    if feedback_summary and feedback_summary.get("total", 0) > 0:
        feedback_section = f"""
## 운영자 피드백 (이전 학습 이후 수집)

총 {feedback_summary["total"]}건의 분류 수정이 있었습니다.

주요 수정 패턴:
{format_feedback_patterns(feedback_summary.get("patterns", []))}

**중요**: 위 피드백을 반영하여 분류 기준을 개선해주세요.
오분류된 패턴을 학습하여 misclassification_learnings에 포함하세요.

---
"""
        base_prompt += feedback_section

    analysis_section = """## 요청

위 대화 로그를 바탕으로 당신의 이해를 정리해주세요.

다음 관점에서 자유롭게 분석해주세요:

1. **모션랩스 CS 응대 방식**
   - 직원들은 어떤 톤과 방식으로 대화하는가?
   - 어떤 응대 패턴이 보이는가?

2. **고객 요청 양상**
   - 고객들은 주로 무엇을 물어보는가?
   - 어떤 표현과 키워드를 사용하는가?

3. **상호작용 다이나믹스**
   - 대화가 어떻게 흘러가는가?
   - 어떤 응대가 효과적으로 보이는가?

4. **메시지 분류 패턴 (중요)**
   이 섹션은 자동 분류 시스템에서 활용됩니다.
   
   참고: 각 채팅방에는 병원의 여러 스태프(간호사, 의사, 원무과 등)가 함께 참여합니다.
   스태프끼리 주고받는 대화도 있고, 모션랩스에 문의하는 대화도 있습니다.

   **답변 필요 메시지 (needs_reply=true):**
   - inquiry_status: 상태/진행 확인 문의
   - request_action: 작업 요청
   - request_change: 변경/수정 요청
   - complaint: 불만/클레임
   - question_how: 방법 문의
   - question_when: 일정 문의
   - follow_up: 이전 요청에 대한 추가 정보 제공 (아직 처리 중인 건)

   **답변 불필요 메시지 (needs_reply=false):**
   - provide_info: 자료 제공 (사진, 파일 등)
   - acknowledgment: 확인/동의 ("네", "알겠습니다")
   - greeting: 인사
   - internal_discussion: 병원 스태프끼리 대화
   - reaction: 단순 리액션 (ㅎㅎ, ㅋㅋ, 이모지)
   - confirmation_received: 직원 안내 완료 후 고객 확인 응답

   **분석해주세요:**

   (A) 내부 대화 (internal_discussion) 패턴:
   - 병원 스태프끼리 대화할 때 어떤 특징이 있는가?
   - 어떤 호칭을 사용하는가? (예: 과장님, 선생님, 언니)
   - 어떤 말투/표현이 내부 대화임을 나타내는가?
   - 고객 메시지가 연속될 때 어떤 경우가 내부 대화인가?

   (B) 대화 종결 (confirmation_received) 패턴:
   - 직원이 안내를 완료한 후 고객이 확인하는 패턴은?
   - 어떤 메시지가 나오면 "대화가 끝났다"고 볼 수 있는가?
   - 단순 "감사합니다"와 추가 요청이 담긴 "감사합니다"의 차이는?

   (C) 단순 리액션 (reaction) 패턴:
   - 답변이 필요 없는 단순 반응들은 어떤 것들이 있는가?
   - ㅎㅎ, ㅋㅋ, 이모지 외에 다른 패턴은?

   (D) 추가 정보 제공 (follow_up) 패턴:
   - 이전 요청에 대해 추가 정보를 보내는 경우 어떤 표현을 쓰는가?
   - 이 경우는 아직 처리가 필요하므로 needs_reply=true

   (E) 판단이 애매한 케이스:
   - 답변 필요 여부 판단이 어려운 메시지 유형은?
   - 맥락에 따라 달라지는 경우는?

5. **추가 발견**
   - 그 외 눈에 띄는 것들

6. **이전 이해 대비 변화** (이전 이해가 있는 경우)
   - 새롭게 알게 된 것
   - 수정이 필요한 것
   - 더 확신하게 된 것

데이터가 부족하면 부족하다고 솔직하게 말해주세요.
무리하게 패턴을 만들 필요 없습니다.

---

## JSON 구조화 출력 (필수)

위 분석 내용을 바탕으로, 자동 분류 시스템이 활용할 수 있는 구조화된 데이터를 추출해주세요.
텍스트 분석 완료 후 반드시 "---JSON_OUTPUT---" 마커를 작성하고 그 다음에 JSON을 출력하세요.

```json
{
  "version": "2.0",
  "internal_discussion_markers": [
    {
      "pattern": "정규표현식 패턴 (Python re 호환)",
      "type": "honorific|self_assign|task_mention",
      "description": "이 패턴이 내부 대화를 나타내는 이유",
      "confidence": 0.0-1.0,
      "example_count": 숫자
    }
  ],
  "confirmation_patterns": [
    {
      "trigger_message": "직원 메시지 패턴 (예: 보내드렸습니다)",
      "closing_response": "종결 응답 패턴 (예: 감사합니다)",
      "is_closing": true,
      "confidence": 0.0-1.0,
      "example_count": 숫자
    }
  ],
  "skip_llm_candidates": [
    {
      "pattern": "정규표현식 (Python re 호환)",
      "intent": "intent_name",
      "needs_reply": true|false,
      "confidence": 0.0-1.0 (0.9 이상만 포함),
      "example_count": 숫자 (3개 이상만 포함)
    }
  ],
  "new_intent_candidates": [
    {
      "suggested_name": "snake_case_name",
      "description_ko": "한글 설명",
      "examples": ["예시1", "예시2", "예시3"],
      "parent_intent": "기존 intent 또는 null",
      "needs_reply": true|false,
      "frequency": 숫자 (30 이상만 포함),
      "confidence": 0.0-1.0
    }
  ],
  "topic_statistics": {
    "발송/전송 문제": {"count": 숫자, "avg_urgency": "medium"},
    "예약 관련": {"count": 숫자, "avg_urgency": "high"}
  },
  "misclassification_learnings": [
    {
      "original_intent": "원래 분류된 intent",
      "corrected_intent": "수정된 intent",
      "pattern": "해당 메시지의 특징적 패턴",
      "lesson": "이 케이스에서 배운 분류 기준",
      "correction_count": 숫자
    }
  ]
}
```

**JSON 출력 규칙:**
- confidence가 0.8 미만인 패턴은 skip_llm_candidates에 포함하지 마세요
- 예시가 3개 미만인 패턴은 제외하세요
- frequency가 30 미만인 new_intent는 제외하세요
- 정규표현식은 Python re 모듈과 호환되는 형식으로 작성하세요
- 데이터가 부족하면 해당 배열을 빈 배열 []로 두세요
- JSON이 반드시 유효한 형식이어야 합니다"""

    return base_prompt + analysis_section

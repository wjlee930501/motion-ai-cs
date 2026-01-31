"""
직원 응답 품질 분석 프롬프트

평가 기준 4가지:
1. 전문성 (Professionalism) — 정확한 정보
2. 친절도 (Friendliness) — 공감적 톤
3. 적시성 (Timeliness) — 빠른 응답
4. 완결성 (Completeness) — 문제 완전 해결
"""

from typing import Optional


SYSTEM_PROMPT = """당신은 모션랩스 CS 품질 분석가입니다.

모션랩스는 병원에 마케팅 솔루션을 제공하는 회사이며,
약 400개 병원 고객과 카카오톡으로 CS 소통을 합니다.

당신의 역할:
- 직원들의 응답 품질을 객관적으로 평가하는 것
- 우수한 응답 패턴(베스트 프랙티스)을 추출하는 것
- 재사용 가능한 응답 템플릿을 추천하는 것
- 개선이 필요한 영역을 파악하는 것

평가 기준 (각 1-10점):
1. 전문성 (Professionalism): 정확한 정보 제공, 업무 지식 수준
2. 친절도 (Friendliness): 공감적 톤, 예의바른 표현, 고객 배려
3. 적시성 (Timeliness): 응답 속도 (60초 이내=우수, 5분 이내=양호, 20분 이상=개선필요)
4. 완결성 (Completeness): 문제 완전 해결, 추가 안내 포함 여부

주의사항:
- 데이터가 적을 수 있습니다. 무리하게 평가하지 마세요.
- 응답 텍스트 스니펫만 보이므로 전체 맥락을 추측하여 평가하세요.
- 직원 간 비교보다는 개별 강점/약점에 집중하세요.
- 개선 권장사항은 구체적이고 실행 가능해야 합니다."""


def build_user_prompt(
    logs_text: str,
    response_count: int,
    staff_count: int,
    date_from,
    date_to,
) -> str:
    if date_from and date_to:
        date_range = f"{date_from.strftime('%Y-%m-%d')} ~ {date_to.strftime('%Y-%m-%d')}"
    else:
        date_range = "날짜 정보 없음"

    return f"""## 분석 대상

직원 {staff_count}명의 응답 {response_count}건 ({date_range})

{logs_text}

---

## 요청

위 직원 응답 데이터를 바탕으로 품질 분석을 수행해주세요.

### 1. 직원별 분석
각 직원에 대해:
- 4가지 평가 기준별 점수 (1-10)
- 주요 강점 (2-3개)
- 개선 필요 영역 (1-2개)
- 가장 모범적인 응답 사례 (있다면)

### 2. 베스트 프랙티스
전체 직원 중 우수한 응답 패턴을 추출해주세요:
- 어떤 유형의 문의에 어떻게 응답하는 것이 효과적인가?
- 고객 만족도를 높이는 표현/패턴은?

### 3. 개선 권장사항
- 전체적으로 개선이 필요한 영역
- 구체적이고 실행 가능한 개선 방안

### 4. 응답 템플릿 추천
자주 발생하는 문의 유형에 대한 재사용 가능한 응답 템플릿을 제안해주세요.

데이터가 부족하면 부족하다고 솔직하게 말해주세요.

---

## JSON 구조화 출력 (필수)

텍스트 분석 완료 후 반드시 "---JSON_INSIGHTS---" 마커를 작성하고 그 다음에 JSON을 출력하세요.

```json
{{
  "staff_insights": [
    {{
      "staff_member": "직원 이름",
      "scores": {{
        "professionalism": 1-10,
        "friendliness": 1-10,
        "timeliness": 1-10,
        "completeness": 1-10
      }},
      "strengths": ["강점1", "강점2"],
      "weaknesses": ["약점1"],
      "best_response": "모범 응답 예시 (있다면)" 또는 null
    }}
  ],
  "best_practices": [
    {{
      "category": "문의 유형",
      "pattern": "우수 응답 패턴 설명",
      "example": "구체적 예시"
    }}
  ],
  "improvement_areas": [
    {{
      "area": "개선 영역",
      "current_issue": "현재 문제점",
      "recommendation": "구체적 개선 방안"
    }}
  ],
  "response_templates": [
    {{
      "title": "템플릿 제목",
      "category": "문의 유형",
      "template": "재사용 가능한 응답 템플릿 텍스트"
    }}
  ]
}}
```

**JSON 출력 규칙:**
- staff_insights에는 분석한 모든 직원을 포함하세요
- 점수는 정수 (1-10)
- 데이터가 부족한 직원은 점수에 null 사용 가능
- JSON이 반드시 유효한 형식이어야 합니다"""

# LLM Classification Spec

## 1. 모델 라우팅

| 조건 | 모델 |
|------|------|
| 기본 | Claude Haiku |
| 에스컬레이션 | Claude Sonnet |

### 에스컬레이션 조건

```python
ESCALATE_KEYWORDS = [
    '오류', '먹통', '전체', '안됨', '장애', 
    '환불', '해지', '클레임', '긴급', '급해',
    '안되요', '작동', '고장', '문제'
]

def should_escalate(text: str, haiku_confidence: float = None) -> bool:
    """
    Sonnet으로 에스컬레이션 여부 판단
    """
    # 1. 키워드 매칭
    text_lower = text.lower()
    for keyword in ESCALATE_KEYWORDS:
        if keyword in text_lower:
            return True
    
    # 2. Haiku confidence 낮음
    if haiku_confidence and haiku_confidence < 0.65:
        return True
    
    return False
```

---

## 2. Event Classification (메시지 단위)

### Input

```python
{
    "chat_room": "강남A내과 단톡",
    "sender_type": "customer",
    "text_raw": "어제 보낸 문자 아직 안 나갔는데요?"
}
```

### System Prompt

```
당신은 병원 CS 메시지 분류 전문가입니다.
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
```

### User Prompt

```
채팅방: {chat_room}
발신자 유형: {sender_type}
메시지: {text_raw}

위 메시지를 분석하여 JSON으로 반환하세요.
```

### Expected Output

```json
{
  "topic": "발송/전송 문제",
  "urgency": "medium",
  "sentiment": "neutral",
  "intent": "support_request",
  "summary": "문자 발송 지연 확인 요청",
  "confidence": 0.85
}
```

---

## 3. Ticket Summary (티켓 단위)

### Trigger 조건

티켓 요약 갱신 시점:
1. 티켓에 새 이벤트 3개 이상 추가됨
2. urgency가 high 또는 critical인 이벤트 도착
3. 수동 요청

### Input

```python
{
    "clinic_key": "강남A내과 단톡",
    "events": [
        {
            "sender_type": "customer",
            "text": "어제 보낸 문자 아직 안 나갔는데요?",
            "time": "10:42"
        },
        {
            "sender_type": "staff",
            "text": "확인해보겠습니다",
            "time": "10:45"
        },
        {
            "sender_type": "customer", 
            "text": "빨리 해주세요 환자들이 기다려요",
            "time": "10:50"
        }
    ]
}
```

### System Prompt

```
당신은 병원 CS 티켓 요약 전문가입니다.
대화 내역을 분석하여 관리자가 빠르게 상황을 파악할 수 있도록 요약합니다.

출력 형식:
- summary: 핵심 상황 2~3줄 (bullet point)
- next_action: 다음 조치 권장 1줄
- overall_urgency: 전체 긴급도 (critical/high/medium/low)
```

### User Prompt

```
채팅방: {clinic_key}

대화 내역:
{formatted_events}

위 대화를 분석하여 JSON으로 반환하세요.
```

### Expected Output

```json
{
  "summary": "• 문자 발송 지연 문의\n• 환자 대기 중으로 긴급 요청\n• 직원 확인 중이나 추가 응대 필요",
  "next_action": "발송 로그 확인 후 예상 발송 시점 안내 필요",
  "overall_urgency": "high"
}
```

---

## 4. Implementation

### API 호출

```python
import anthropic

client = anthropic.Anthropic()

def classify_event(event: MessageEvent) -> dict:
    """
    메시지 분류
    """
    model = "claude-3-haiku-20240307"
    
    # 에스컬레이션 체크
    if should_escalate(event.text_raw):
        model = "claude-3-5-sonnet-20241022"
    
    response = client.messages.create(
        model=model,
        max_tokens=500,
        system=EVENT_CLASSIFICATION_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": EVENT_CLASSIFICATION_USER_PROMPT.format(
                    chat_room=event.chat_room,
                    sender_type=event.sender_type,
                    text_raw=event.text_raw
                )
            }
        ]
    )
    
    # JSON 파싱
    result = parse_json_response(response.content[0].text)
    
    # Haiku confidence 낮으면 Sonnet 재시도
    if model.startswith("claude-3-haiku") and result.get("confidence", 1) < 0.65:
        return classify_event_with_sonnet(event)
    
    return result


def summarize_ticket(ticket: Ticket, events: list[MessageEvent]) -> dict:
    """
    티켓 요약 생성
    """
    formatted_events = "\n".join([
        f"[{e.received_at.strftime('%H:%M')}] {e.sender_type}: {e.text_raw}"
        for e in events
    ])
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",  # 요약은 항상 Sonnet
        max_tokens=500,
        system=TICKET_SUMMARY_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": TICKET_SUMMARY_USER_PROMPT.format(
                    clinic_key=ticket.clinic_key,
                    formatted_events=formatted_events
                )
            }
        ]
    )
    
    return parse_json_response(response.content[0].text)
```

---

## 5. 비용 제어

### 예상 사용량 (일 기준)

| 항목 | 수량 | 모델 | 토큰 |
|------|------|------|------|
| 메시지 분류 | ~2000건 | Haiku 90% | ~200 토큰/건 |
| 메시지 분류 | ~200건 | Sonnet 10% | ~200 토큰/건 |
| 티켓 요약 | ~100건 | Sonnet | ~500 토큰/건 |

### 월 예상 비용

```
Haiku:  2000 × 30 × 200 = 12M tokens → ~$3
Sonnet: 300 × 30 × 300 = 2.7M tokens → ~$10

총: ~$15/월
```

### 비용 절감 옵션

1. **캐싱**: 동일 메시지 패턴은 캐시 활용
2. **배치 처리**: 실시간 필요 없는 요약은 배치로
3. **Skip 조건**: 인사말("감사합니다", "네") 등은 LLM 호출 생략

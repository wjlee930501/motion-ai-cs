# SLA & Slack Alert

## 1. SLA 정책

| 항목 | 값 |
|------|-----|
| 응답 기한 | **20분** |
| 기준 시점 | 고객 메시지 수신 시점 (`first_inbound_at`) |
| 완료 조건 | 직원 첫 응답 발생 (`first_response_sec IS NOT NULL`) |
| breach 판정 | 20분 경과 && 응답 없음 |

---

## 2. SLA 체크 로직

### Worker에서 주기적 실행 (1분마다)

```python
from datetime import datetime, timedelta
import pytz

SLA_THRESHOLD_MINUTES = 20
KST = pytz.timezone('Asia/Seoul')

def check_sla_breaches():
    """
    SLA 초과 티켓 찾아서 breach 처리 및 Slack 알림
    """
    now = datetime.now(KST)
    threshold = now - timedelta(minutes=SLA_THRESHOLD_MINUTES)
    
    # SLA 초과 대상: new 상태 + 응답 없음 + 20분 경과 + 아직 breach 아님
    breached_tickets = db.query(Ticket).filter(
        Ticket.status == 'new',
        Ticket.first_response_sec.is_(None),
        Ticket.first_inbound_at <= threshold,
        Ticket.sla_breached == False
    ).all()
    
    for ticket in breached_tickets:
        # breach 처리
        ticket.sla_breached = True
        ticket.sla_alerted_at = now
        save_ticket(ticket)
        
        # Slack 알림 발송
        send_sla_alert(ticket)
```

### 개별 이벤트 처리 시 SLA 체크

```python
def check_sla_on_event(ticket: Ticket, event: MessageEvent):
    """
    새 이벤트 처리 후 SLA 상태 체크
    """
    now = datetime.now(KST)
    
    # 직원 응답이면 SLA breach 해제
    if event.sender_type == 'staff':
        ticket.sla_breached = False
        return
    
    # 고객 문의인데 이미 20분 경과했으면 즉시 breach
    if ticket.first_inbound_at:
        elapsed = now - ticket.first_inbound_at
        if elapsed > timedelta(minutes=SLA_THRESHOLD_MINUTES):
            if not ticket.sla_breached:
                ticket.sla_breached = True
                ticket.sla_alerted_at = now
                save_ticket(ticket)
                send_sla_alert(ticket)
```

---

## 3. Slack 알림

### 환경 변수
```
SLACK_WEBHOOK_URL=your-slack-webhook-url-here
SLA_THRESHOLD_MINUTES=20
```

### 알림 발송 함수

```python
import httpx

def send_sla_alert(ticket: Ticket):
    """
    SLA 초과 시 Slack 알림 발송
    """
    webhook_url = os.getenv('SLACK_WEBHOOK_URL')
    if not webhook_url:
        logger.error("SLACK_WEBHOOK_URL not configured")
        return
    
    # 최근 고객 메시지 조회
    latest_event = get_latest_customer_event(ticket.ticket_id)
    customer_message = latest_event.text_raw[:100] if latest_event else "(메시지 없음)"
    
    # 경과 시간 계산
    elapsed_minutes = int((datetime.now(KST) - ticket.first_inbound_at).total_seconds() / 60)
    
    # 대시보드 링크
    dashboard_url = f"{os.getenv('DASHBOARD_URL')}/tickets/{ticket.ticket_id}"
    
    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 SLA 초과 알림",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*채팅방:*\n{ticket.clinic_key}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*대기 시간:*\n{elapsed_minutes}분 경과"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*고객 문의:*\n> {customer_message}"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "대시보드에서 확인",
                            "emoji": True
                        },
                        "url": dashboard_url,
                        "style": "primary"
                    }
                ]
            }
        ]
    }
    
    try:
        response = httpx.post(webhook_url, json=payload, timeout=10)
        
        # 알림 로그 저장
        log = SlaAlertLog(
            ticket_id=ticket.ticket_id,
            alert_type='slack',
            sent_at=datetime.now(KST),
            response_status=response.status_code,
            error_message=None if response.is_success else response.text
        )
        save_alert_log(log)
        
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")
        log = SlaAlertLog(
            ticket_id=ticket.ticket_id,
            alert_type='slack',
            sent_at=datetime.now(KST),
            response_status=None,
            error_message=str(e)
        )
        save_alert_log(log)
```

---

## 4. Slack 메시지 예시

```
┌─────────────────────────────────────────┐
│  🚨 SLA 초과 알림                        │
├─────────────────────────────────────────┤
│  채팅방:           대기 시간:            │
│  강남A내과 단톡    22분 경과             │
├─────────────────────────────────────────┤
│  고객 문의:                              │
│  > 어제 보낸 문자 아직 안 나갔는데요?    │
├─────────────────────────────────────────┤
│  [대시보드에서 확인]                     │
└─────────────────────────────────────────┘
```

---

## 5. SLA 관련 대시보드 표시

### 티켓 목록에서

```typescript
interface TicketListItem {
  ticket_id: string;
  clinic_key: string;
  status: string;
  sla_breached: boolean;
  sla_remaining_sec: number | null;  // 음수면 초과
}

// SLA 남은 시간 계산 (API 응답에 포함)
function calculateSlaRemaining(ticket: Ticket): number | null {
  if (!ticket.first_inbound_at || ticket.first_response_sec) {
    return null;  // SLA 대상 아님
  }
  
  const elapsed = Date.now() - new Date(ticket.first_inbound_at).getTime();
  const threshold = 20 * 60 * 1000;  // 20분
  return Math.floor((threshold - elapsed) / 1000);
}
```

### UI 표시

```
┌──────────────────┬────────┬──────────┬─────────────┐
│ 채팅방          │ 상태   │ 우선순위 │ SLA         │
├──────────────────┼────────┼──────────┼─────────────┤
│ 강남A내과 단톡  │ 🔴 new │ high     │ ⚠️ -2분     │
│ 서초B정형외과   │ 🟡 진행│ normal   │ 12분 남음   │
│ 송파C내과       │ 🟢 완료│ normal   │ -           │
└──────────────────┴────────┴──────────┴─────────────┘
```

**SLA 표시 규칙:**
- 양수: "N분 남음" (초록색)
- 10분 이하: "N분 남음" (노란색)
- 음수: "⚠️ -N분" (빨간색, breach)
- 응답 완료: "-" (표시 안 함)

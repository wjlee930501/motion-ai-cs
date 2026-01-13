# Ticketing Algorithm

## 1. 기본 개념

### clinic_key
- v1에서는 `clinic_key = chat_room` (채팅방명 그대로 사용)
- 별도 매핑 테이블 없음

### 티켓 상태 (status)
| 상태 | 설명 |
|------|------|
| new | 고객 문의 접수, 아직 응답 없음 |
| in_progress | 직원이 응답 시작 |
| waiting | 고객 추가 응답 대기 |
| done | 처리 완료 |

### 우선순위 (priority)
| 우선순위 | 설명 |
|----------|------|
| low | 낮음 |
| normal | 보통 (기본값) |
| high | 높음 |
| urgent | 긴급 |

---

## 2. 이벤트 처리 알고리즘

### 2.1 Customer 메시지 수신 시

```python
def handle_customer_event(event: MessageEvent):
    clinic_key = event.chat_room
    
    # 1. 해당 병원의 열린 티켓 찾기
    open_ticket = find_open_ticket(
        clinic_key=clinic_key,
        statuses=['new', 'in_progress', 'waiting']
    )
    
    if open_ticket:
        # 2a. 기존 티켓에 연결
        link_event_to_ticket(open_ticket.ticket_id, event.event_id)
        
        # 3. 티켓 정보 갱신
        open_ticket.last_inbound_at = event.received_at
        
        # 4. 상태가 waiting이면 다시 new로 (재문의)
        if open_ticket.status == 'waiting':
            open_ticket.status = 'new'
            open_ticket.sla_breached = False  # SLA 리셋
            open_ticket.first_inbound_at = event.received_at  # SLA 기준 시점 리셋
        
        save_ticket(open_ticket)
    else:
        # 2b. 새 티켓 생성
        new_ticket = Ticket(
            ticket_id=uuid4(),
            clinic_key=clinic_key,
            status='new',
            priority='normal',
            first_inbound_at=event.received_at,
            last_inbound_at=event.received_at,
            sla_breached=False
        )
        save_ticket(new_ticket)
        link_event_to_ticket(new_ticket.ticket_id, event.event_id)
```

### 2.2 Staff 메시지 수신 시

```python
def handle_staff_event(event: MessageEvent):
    clinic_key = event.chat_room
    
    # 1. 해당 병원의 열린 티켓 찾기
    open_ticket = find_open_ticket(
        clinic_key=clinic_key,
        statuses=['new', 'in_progress', 'waiting']
    )
    
    if not open_ticket:
        # 엣지케이스: 직원이 먼저 메시지 보낸 경우
        # 티켓 생성하되, 고객 문의 없음으로 표시
        open_ticket = Ticket(
            ticket_id=uuid4(),
            clinic_key=clinic_key,
            status='in_progress',
            priority='normal',
            first_inbound_at=None,  # 고객 문의 없음
            last_outbound_at=event.received_at,
            sla_breached=False
        )
        save_ticket(open_ticket)
    
    # 2. 이벤트 연결
    link_event_to_ticket(open_ticket.ticket_id, event.event_id)
    
    # 3. 응답 시간 계산 (첫 응답인 경우)
    if open_ticket.first_response_sec is None and open_ticket.first_inbound_at:
        response_time = event.received_at - open_ticket.first_inbound_at
        open_ticket.first_response_sec = int(response_time.total_seconds())
    
    # 4. 티켓 정보 갱신
    open_ticket.last_outbound_at = event.received_at
    
    # 5. 상태 전이
    if open_ticket.status == 'new':
        open_ticket.status = 'in_progress'
    
    save_ticket(open_ticket)
```

---

## 3. 티켓 조회 로직

### 열린 티켓 찾기
```python
def find_open_ticket(clinic_key: str, statuses: list[str]) -> Ticket | None:
    """
    해당 병원의 가장 최근 열린 티켓 반환
    """
    return db.query(Ticket).filter(
        Ticket.clinic_key == clinic_key,
        Ticket.status.in_(statuses)
    ).order_by(
        Ticket.updated_at.desc()
    ).first()
```

### 티켓 목록 조회
```python
def list_tickets(
    status: list[str] = None,
    priority: list[str] = None,
    clinic_key: str = None,
    sla_breached: bool = None,
    page: int = 1,
    limit: int = 20
) -> tuple[list[Ticket], int]:
    """
    필터링된 티켓 목록과 총 개수 반환
    """
    query = db.query(Ticket)
    
    if status:
        query = query.filter(Ticket.status.in_(status))
    if priority:
        query = query.filter(Ticket.priority.in_(priority))
    if clinic_key:
        query = query.filter(Ticket.clinic_key == clinic_key)
    if sla_breached is not None:
        query = query.filter(Ticket.sla_breached == sla_breached)
    
    total = query.count()
    tickets = query.order_by(
        Ticket.sla_breached.desc(),  # SLA breach 먼저
        Ticket.priority.desc(),       # 우선순위 높은 것
        Ticket.updated_at.desc()      # 최신 것
    ).offset((page - 1) * limit).limit(limit).all()
    
    return tickets, total
```

---

## 4. 티켓 상태 전이 다이어그램

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │
[고객 문의] ──▶ [ new ] ──직원응답──▶ [ in_progress ] │
                    │                       │        │
                    │                       │        │
                    │                       ▼        │
                    │               [ waiting ] ─────┘
                    │                       │    (고객 재문의)
                    │                       │
                    │                       ▼
                    └─────────────────▶ [ done ]
                      (수동 완료)         (수동 완료)
```

**전이 규칙:**
1. `new` → `in_progress`: 직원 첫 응답 시 자동
2. `in_progress` → `waiting`: 수동 변경 (추가 확인 필요 시)
3. `waiting` → `new`: 고객 재문의 시 자동
4. 모든 상태 → `done`: 수동 변경만 가능

---

## 5. Priority 자동 조정 (LLM 기반)

LLM이 urgency를 판단하면 priority 자동 조정:

```python
def adjust_priority_from_llm(ticket: Ticket, llm_urgency: str):
    urgency_to_priority = {
        'critical': 'urgent',
        'high': 'high',
        'medium': 'normal',
        'low': 'low'
    }
    
    new_priority = urgency_to_priority.get(llm_urgency, 'normal')
    
    # 기존보다 높은 경우만 업그레이드
    priority_order = ['low', 'normal', 'high', 'urgent']
    if priority_order.index(new_priority) > priority_order.index(ticket.priority):
        ticket.priority = new_priority
        save_ticket(ticket)
```

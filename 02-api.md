# API Specification

## 1. Ingest API (Android → Server)

인증: Device Key 기반 (사용자 인증 없음)

### Headers
```
X-DEVICE-KEY: <shared_secret>
```

### POST /v1/events
카카오톡 메시지 수신

**Request:**
```json
{
  "device_id": "android-001",
  "package": "com.kakao.talk",
  "chat_room": "강남A내과 단톡",
  "sender_name": "원장님",
  "text": "어제 보낸 문자 아직 안 나갔는데요?",
  "received_at": "2026-01-13T10:42:10+09:00",
  "notification_id": "optional-string",
  "metadata": {
    "title": "카카오톡",
    "subtext": "3",
    "is_group": true
  }
}
```

**Response:**
```json
{
  "ok": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "deduped": false
}
```

**Dedup Rule:**
- text_hash = sha256(chat_room + sender_name + text)
- dedup window = 10 seconds bucket
- unique constraint on (text_hash, bucket_ts)

### POST /v1/heartbeat
Android 디바이스 상태 체크

**Request:**
```json
{
  "device_id": "android-001",
  "ts": "2026-01-13T10:45:00+09:00"
}
```

**Response:**
```json
{
  "ok": true
}
```

---

## 2. Dashboard API (Web → Server)

인증: JWT Bearer Token

### Auth Endpoints

#### POST /auth/login
**Request:**
```json
{
  "email": "admin",
  "password": "1234"
}
```

**Response:**
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "admin",
    "name": "관리자"
  }
}
```

### User Management

#### POST /v1/users (관리자 전용)
**Request:**
```json
{
  "email": "cs_kim",
  "password": "password123",
  "name": "김민수"
}
```

**Response:**
```json
{
  "ok": true,
  "user": {
    "id": 2,
    "email": "cs_kim",
    "name": "김민수"
  }
}
```

#### GET /v1/users
**Response:**
```json
{
  "ok": true,
  "users": [
    { "id": 1, "email": "admin", "name": "관리자" },
    { "id": 2, "email": "cs_kim", "name": "김민수" }
  ]
}
```

#### DELETE /v1/users/{user_id}
**Response:**
```json
{
  "ok": true
}
```

### Ticket Endpoints

#### GET /v1/tickets
**Query Params:**
- status: new, in_progress, waiting, done (comma separated)
- priority: low, normal, high, urgent
- clinic_key: 채팅방명
- sla_breached: true/false
- page: 1
- limit: 20

**Response:**
```json
{
  "ok": true,
  "tickets": [
    {
      "ticket_id": "uuid",
      "clinic_key": "강남A내과 단톡",
      "status": "new",
      "priority": "high",
      "topic_primary": "발송/전송 문제",
      "summary_latest": "문자 발송 지연 문의",
      "first_inbound_at": "2026-01-13T10:42:10+09:00",
      "last_inbound_at": "2026-01-13T10:42:10+09:00",
      "sla_breached": true,
      "sla_remaining_sec": -120
    }
  ],
  "total": 45,
  "page": 1
}
```

#### GET /v1/tickets/{ticket_id}
**Response:**
```json
{
  "ok": true,
  "ticket": {
    "ticket_id": "uuid",
    "clinic_key": "강남A내과 단톡",
    "status": "new",
    "priority": "high",
    "topic_primary": "발송/전송 문제",
    "summary_latest": "문자 발송 지연 문의",
    "next_action": "발송 로그 확인 필요",
    "first_inbound_at": "2026-01-13T10:42:10+09:00",
    "first_response_sec": null,
    "last_inbound_at": "2026-01-13T10:42:10+09:00",
    "last_outbound_at": null,
    "sla_breached": true,
    "created_at": "2026-01-13T10:42:10+09:00",
    "updated_at": "2026-01-13T10:42:10+09:00"
  }
}
```

#### PATCH /v1/tickets/{ticket_id}
**Request:**
```json
{
  "status": "in_progress",
  "priority": "normal",
  "next_action": "발송 로그 확인 후 회신 예정"
}
```

**Response:**
```json
{
  "ok": true,
  "ticket": { ... }
}
```

#### GET /v1/tickets/{ticket_id}/events
**Response:**
```json
{
  "ok": true,
  "events": [
    {
      "event_id": "uuid",
      "sender_name": "원장님",
      "sender_type": "customer",
      "text_raw": "어제 보낸 문자 아직 안 나갔는데요?",
      "received_at": "2026-01-13T10:42:10+09:00"
    },
    {
      "event_id": "uuid",
      "sender_name": "[모션랩스_이우진]",
      "sender_type": "staff",
      "staff_member": "이우진",
      "text_raw": "확인해보겠습니다!",
      "received_at": "2026-01-13T10:45:30+09:00"
    }
  ]
}
```

### Dashboard Metrics

#### GET /v1/metrics/overview
**Response:**
```json
{
  "ok": true,
  "metrics": {
    "today_inbound": 127,
    "sla_breached_count": 3,
    "urgent_count": 5,
    "open_tickets": 23,
    "avg_response_sec": 542
  }
}
```

#### GET /v1/clinics/health
**Response:**
```json
{
  "ok": true,
  "clinics": [
    {
      "clinic_key": "강남A내과 단톡",
      "today_inbound": 12,
      "sla_breached": 1,
      "urgent_count": 2,
      "open_tickets": 3
    }
  ]
}
```

---

## 3. Error Response Format

모든 에러는 동일 포맷:

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**Error Codes:**
- UNAUTHORIZED: 인증 실패
- FORBIDDEN: 권한 없음
- NOT_FOUND: 리소스 없음
- VALIDATION_ERROR: 요청 데이터 오류
- DUPLICATE: 중복 데이터
- INTERNAL_ERROR: 서버 오류

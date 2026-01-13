# MotionLabs KakaoTalk CS Intelligence System v1.0

## 목표
카카오톡 단톡방(약 400개) CS를 누락 없이 수집하고, 20분 내 미응답 건을 실시간 감지하여 Slack 알림 발송

## Non-Goals (v1에서 하지 않는 것)
- 카카오톡 자동 발송(자동 응답)
- 카카오톡 원문 첨부파일 저장/미디어 다운로드
- 담당자 성과 비교/랭킹
- 카톡 외 채널 통합
- 리비짓 DB 연동
- 개인정보 마스킹

## 시스템 특성
| 항목 | 내용 |
|------|------|
| 시스템 성격 | 독립 백오피스 툴 |
| 사용자 | 모션랩스 내부 전용 (CS팀 + 본사) |
| 데이터 보존 | 영구보관 |
| 핵심 기능 | 20분 SLA 초과 시 Slack 알림 |

## Monorepo Structure
```
repo-root/
├── android-collector/          # Android APK
├── server/
│   ├── ingest-api/             # FastAPI: /events, /heartbeat
│   ├── worker/                 # Pub/Sub subscriber: LLM classify + SLA check
│   ├── dashboard-api/          # FastAPI: auth + ticket/query endpoints
│   └── shared/                 # pydantic schemas, db models, utils
├── web-dashboard/              # Next.js SPA
├── infra/
│   ├── gcp/                    # terraform or gcloud scripts
│   └── docker/                 # dockerfiles, compose for local dev
└── docs/
```

## Tech Stack (v1 Fixed)
| 영역 | 기술 |
|------|------|
| Server | Python 3.11 + FastAPI |
| Database | PostgreSQL 15+ (Cloud SQL) |
| Queue | GCP Pub/Sub |
| Web | Next.js |
| Auth | JWT (email/password) |
| Infra | Docker + gcloud CLI |

## Data Flow
```
1) Android receives KakaoTalk notification
   ↓
2) Android POST /events to ingest-api
   ↓
3) ingest-api validates + dedup → inserts message_event → publishes Pub/Sub
   ↓
4) worker pulls event → calls LLM (Haiku/Sonnet) → checks SLA
   ↓
5) worker writes llm_annotation → updates/creates ticket
   ↓
6) SLA breach detected → Slack alert
   ↓
7) dashboard-api serves tickets/events to web-dashboard
```

## Sender Classification (Naming Rule)
직원 닉네임 규칙: `[모션랩스_이름]`

정규식: `^\[모션랩스_.+\]`

| sender_name | sender_type | staff_member |
|-------------|-------------|--------------|
| `[모션랩스_이우진]` | staff | 이우진 |
| `원장님` | customer | null |
| `김간호사` | customer | null |

파싱 로직:
```python
import re

def classify_sender(sender_name: str):
    pattern = r'^\[모션랩스_(.+)\]$'
    match = re.match(pattern, sender_name)
    if match:
        return 'staff', match.group(1)
    return 'customer', None
```

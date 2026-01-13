# MotionLabs KakaoTalk CS Intelligence System v1.0

카카오톡 단톡방 CS 메시지를 수집하고, 20분 내 미응답 건을 실시간 감지하여 Slack 알림을 발송하는 시스템입니다.

## 시스템 구성

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Android APK    │────▶│   Ingest API    │────▶│   PostgreSQL    │
│ (ChatLoggerBot) │     │  (FastAPI:8001) │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │     Worker      │◀─────────────┤
                        │ (LLM + SLA)     │              │
                        └────────┬────────┘              │
                                 │                       │
                                 ▼                       │
                        ┌─────────────────┐              │
                        │     Slack       │              │
                        │   (알림 발송)    │              │
                        └─────────────────┘              │
                                                         │
┌─────────────────┐     ┌─────────────────┐              │
│  Web Dashboard  │◀────│  Dashboard API  │◀─────────────┘
│   (React:3000)  │     │  (FastAPI:8000) │
└─────────────────┘     └─────────────────┘
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Python 3.11 + FastAPI |
| Database | PostgreSQL 15+ |
| Frontend | React 18 + TypeScript + Vite |
| LLM | Claude Haiku (기본) / Sonnet (에스컬레이션) |
| Infra | Docker + Docker Compose |

## 빠른 시작

### 1. 환경 설정

```bash
# 프로젝트 클론
cd /path/to/ai-cs

# 환경 변수 설정
cp server-py/.env.example server-py/.env

# .env 파일 편집 - API 키 설정
# - ANTHROPIC_API_KEY: Claude API 키
# - SLACK_WEBHOOK_URL: Slack Webhook URL
```

### 2. 서비스 시작

```bash
# 개발 서버 시작
./start-dev.sh

# 또는 수동으로
docker-compose -f docker-compose.dev.yml up --build
```

### 3. 접속

- **Web Dashboard**: http://localhost:3000
- **Dashboard API**: http://localhost:8000/docs (Swagger)
- **Ingest API**: http://localhost:8001/docs (Swagger)
- **초기 계정**: admin / 1234

## 프로젝트 구조

```
ai-cs/
├── server-py/                 # Python FastAPI 백엔드
│   ├── ingest_api/           # 이벤트 수집 API (Android → Server)
│   ├── dashboard_api/        # 대시보드 API (Web → Server)
│   ├── worker/               # 백그라운드 워커 (LLM + SLA)
│   └── shared/               # 공통 모듈 (DB, 스키마, 유틸)
│
├── ChatLoggerWeb/            # React 웹 대시보드
│   └── src/
│       ├── pages/            # 페이지 컴포넌트
│       ├── services/         # API 서비스
│       └── stores/           # Zustand 상태 관리
│
├── ChatLoggerBot/            # Android 수집 앱 (Kotlin)
│
├── docker-compose.dev.yml    # 로컬 개발용 Docker Compose
└── 0x-*.md                   # 설계 문서
```

## API 엔드포인트

### Ingest API (8001)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /v1/events | 카카오톡 메시지 수신 |
| POST | /v1/heartbeat | 디바이스 상태 체크 |

### Dashboard API (8000)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /auth/login | 로그인 |
| GET | /v1/tickets | 티켓 목록 |
| GET | /v1/tickets/{id} | 티켓 상세 |
| PATCH | /v1/tickets/{id} | 티켓 수정 |
| GET | /v1/tickets/{id}/events | 티켓 메시지 내역 |
| GET | /v1/metrics/overview | 대시보드 지표 |
| GET | /v1/clinics/health | 병원별 상태 |
| GET/POST/DELETE | /v1/users | 사용자 관리 |

## 핵심 기능

### 1. 메시지 수집
- Android 앱이 카카오톡 알림을 캡처하여 서버로 전송
- 10초 단위 중복 제거 (text_hash + bucket_ts)

### 2. 티켓 관리
- 고객 메시지 → 자동 티켓 생성
- 직원 응답 → 티켓 상태 전이 (new → in_progress)
- 상태: new, in_progress, waiting, done

### 3. LLM 분류
- Claude Haiku: 기본 분류 (빠름, 저비용)
- Claude Sonnet: 에스컬레이션 (복잡한 문의)
- 분류 결과: topic, urgency, sentiment, intent, summary

### 4. SLA 관리
- **20분 규칙**: 고객 문의 후 20분 내 응답 필요
- SLA 초과 시 자동 Slack 알림 발송

### 5. 직원 식별
- 닉네임 패턴: `[모션랩스_이름]`
- 예: `[모션랩스_이우진]` → staff, 이우진

## 개발 가이드

### 로컬 개발

```bash
# Python 환경 (백엔드)
cd server-py
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Dashboard API 실행
uvicorn dashboard_api.main:app --reload --port 8000

# Ingest API 실행
uvicorn ingest_api.main:app --reload --port 8001

# Worker 실행
python -m worker.main
```

```bash
# React 환경 (프론트엔드)
cd ChatLoggerWeb
npm install
npm run dev
```

### 로그 확인

```bash
# 전체 로그
docker-compose -f docker-compose.dev.yml logs -f

# 특정 서비스 로그
docker-compose -f docker-compose.dev.yml logs -f dashboard-api
docker-compose -f docker-compose.dev.yml logs -f worker
```

### 데이터베이스

```bash
# PostgreSQL 접속
docker-compose -f docker-compose.dev.yml exec postgres psql -U csuser -d csdb

# 테이블 확인
\dt

# 티켓 조회
SELECT * FROM ticket ORDER BY created_at DESC LIMIT 10;
```

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 연결 문자열 | postgresql://csuser:localpass@localhost:5432/csdb |
| JWT_SECRET | JWT 서명 키 | (필수 설정) |
| DEVICE_KEY | Android 인증 키 | local-dev-key |
| ANTHROPIC_API_KEY | Claude API 키 | (필수 설정) |
| SLACK_WEBHOOK_URL | Slack Webhook URL | (선택) |
| SLA_THRESHOLD_MINUTES | SLA 기준 시간(분) | 20 |

## v1 Acceptance Criteria

- [x] Android → ingest-api → DB 저장 동작
- [x] 고객 메시지 → 티켓 자동 생성
- [x] 직원 응답 → 티켓 상태 변경
- [x] 20분 미응답 → Slack 알림 발송
- [x] 메시지 LLM 분류 동작
- [x] 대시보드 로그인 (admin/1234)
- [x] 티켓 목록 조회/필터링
- [x] 티켓 상세 + 메시지 타임라인 표시
- [x] 사용자 추가 기능

## 문서

- [00-index.md](./00-index.md) - 프로젝트 개요
- [01-architecture.md](./01-architecture.md) - 시스템 구조
- [02-api.md](./02-api.md) - API 스펙
- [03-db.sql](./03-db.sql) - DB 스키마
- [04-ticketing.md](./04-ticketing.md) - 티켓 알고리즘
- [05-sla-alert.md](./05-sla-alert.md) - SLA 규칙
- [06-llm.md](./06-llm.md) - LLM 분류
- [07-deploy.md](./07-deploy.md) - 배포 가이드

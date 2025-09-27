# ChatLogger Stage 2 - CS Request Management System

## 🎯 Phase 2 완료

Stage 2에서는 KakaoTalk 메시지를 자동으로 분류하고 CS 요청을 관리하는 시스템을 구축했습니다.

## ✨ 새로운 기능

### 1. 메시지 자동 분류
- **GPT API 연동**: OpenAI GPT-3.5를 사용한 지능형 메시지 분류
- **내부 멤버 필터링**: 모션랩스 직원 메시지 자동 제외
- **요청 유형 분류**:
  - 계약/결제
  - 계정/기능문의
  - 오류신고
  - 콘텐츠요청
  - 일정/세팅변경
  - 불만/컴플레인
  - 기타
- **긴급도 판단**: low / normal / high
- **신뢰도 점수**: 0.0 ~ 1.0

### 2. 요청 기록 대시보드
- **실시간 요청 목록**: WebSocket을 통한 실시간 업데이트
- **필터링 기능**: 상태, 긴급도, 유형, 담당자별 필터
- **상태 관리**: 미처리 → 진행중 → 완료
- **담당자 할당**: CS 팀원 배정 기능
- **상세 보기**: 원본 메시지 + 대화 맥락 제공

### 3. KPI 모니터링
- 오늘 신규 요청 수
- 긴급 요청 비율
- 미처리 요청 수
- 요청 유형별 통계

### 4. 응답 템플릿
- 자주 사용하는 응답 템플릿 관리
- 카테고리별 분류
- 사용 횟수 추적

### 5. 자동 알림 & 리포트
- **긴급 알림**: urgency=high 요청 시 즉시 Slack 알림
- **일일 리포트**: 매일 오전 9시 24시간 요약
- **주간 리포트**: 매주 월요일 주간 성과 분석
- **미처리 알림**: 1시간 이상 미처리 긴급 요청 알림

## 🛠️ 기술 스택 추가

### Backend Server (Node.js)
- Express.js - REST API 서버
- Socket.io - WebSocket 통신
- OpenAI SDK - GPT API 연동
- node-cron - 스케줄러
- pg - PostgreSQL 클라이언트

### Database Schema
```sql
-- request_items 테이블
- id: UUID
- message_id: 원본 메시지 참조
- room_id: 채팅방 참조
- is_request: 요청 여부
- request_type: 요청 유형
- urgency: 긴급도
- confidence: 신뢰도
- status: 처리 상태
- assignee: 담당자
- notes: 처리 메모
```

## 📦 설치 및 실행

### 환경 변수 설정
```bash
# .env 파일 생성
export OPENAI_API_KEY="your-openai-api-key"
export SLACK_WEBHOOK_URL="your-slack-webhook-url"
```

### Stage 2 배포
```bash
# 전체 시스템 배포
./deploy-stage2.sh
```

### 개별 서비스 실행

#### Server 실행
```bash
cd server
npm install
npm start
```

#### Worker 실행
```bash
cd server
npm run worker
```

#### Scheduler 실행
```bash
cd server
npm run scheduler
```

## 🌐 API Endpoints

### Requests API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/requests` | 요청 목록 조회 |
| GET | `/api/v1/requests/:id` | 요청 상세 조회 |
| PATCH | `/api/v1/requests/:id` | 요청 상태/담당자 변경 |
| POST | `/api/v1/requests/reprocess/:id` | 재분류 요청 |
| GET | `/api/v1/requests/stats` | 요청 통계 |

### Templates API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/templates` | 템플릿 목록 |
| POST | `/api/v1/templates` | 템플릿 생성 |
| PATCH | `/api/v1/templates/:id` | 템플릿 수정 |
| DELETE | `/api/v1/templates/:id` | 템플릿 삭제 |

### Statistics API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/stats/overview` | 전체 통계 |
| GET | `/api/v1/stats/daily` | 일별 통계 |
| GET | `/api/v1/stats/by-type` | 유형별 통계 |
| GET | `/api/v1/stats/response-times` | 응답 시간 분석 |

## 📊 WebSocket Events

### Client → Server
- `subscribe:requests` - 요청 업데이트 구독

### Server → Client
- `request.created` - 새 요청 생성
- `request.updated` - 요청 업데이트

## 🔧 설정 가이드

### GPT API 설정
1. [OpenAI Platform](https://platform.openai.com)에서 API 키 생성
2. 환경 변수에 설정: `OPENAI_API_KEY`
3. 월 사용량 한도 설정 권장

### Slack Webhook 설정
1. Slack 워크스페이스에서 Incoming Webhook 앱 추가
2. 채널 선택 및 Webhook URL 생성
3. 환경 변수에 설정: `SLACK_WEBHOOK_URL`

### 내부 멤버 관리
```sql
-- 내부 멤버 추가
INSERT INTO internal_members (name, department)
VALUES ('김철수', 'CS');

-- 내부 멤버 비활성화
UPDATE internal_members
SET is_active = false
WHERE name = '김철수';
```

## 🚨 모니터링 및 디버깅

### 로그 확인
```bash
# Server 로그
docker-compose logs -f chatlogger-server

# 전체 로그
docker-compose logs -f

# 로그 파일 위치
server/logs/combined.log
server/logs/error.log
```

### 데이터베이스 직접 접근
```bash
# PostgreSQL 접속
docker exec -it chatlogger-db psql -U chatlogger -d chatlogger

# 요청 통계 확인
SELECT * FROM request_stats;

# 미처리 긴급 요청 확인
SELECT * FROM request_items
WHERE urgency = 'high' AND status = '미처리'
ORDER BY created_at DESC;
```

### Health Check
```bash
# Server health
curl http://localhost:4000/health

# Android API health
curl http://localhost:8080/health

# Database health
docker exec chatlogger-db pg_isready
```

## 📈 성능 최적화

### 메시지 분류 최적화
- 배치 처리: 5초마다 최대 100건 처리
- 재시도 로직: 실패 시 fallback 분류
- 7일 이상 오래된 메시지 제외

### 데이터베이스 최적화
- 인덱스 추가: room_id, status, type, created_at
- View 활용: request_stats
- Connection pooling: 최대 20개 연결

### 프론트엔드 최적화
- React Query 캐싱
- 10초 자동 새로고침
- WebSocket 실시간 업데이트

## 🔒 보안 고려사항

1. **API 키 관리**
   - 환경 변수 사용
   - .env 파일 git ignore
   - Production에서 secret manager 사용

2. **데이터베이스 보안**
   - 강력한 비밀번호 설정
   - 네트워크 격리
   - 정기 백업

3. **CORS 설정**
   - 허용된 origin만 접근
   - 인증 헤더 검증

## 🎯 Stage 3 예정 기능

- **AI 자동 응답**: GPT를 활용한 자동 응답 생성
- **감정 분석**: 고객 감정 상태 파악
- **SLA 관리**: 응답 시간 목표 설정 및 추적
- **멀티 채널 지원**: 카카오톡 외 다른 채널 통합
- **고급 분석**: 고객별, 병원별 상세 분석
- **팀 협업**: 내부 메모, 인계 기능

## 📝 트러블슈팅

### GPT API 오류
- API 키 확인
- 사용량 한도 확인
- 네트워크 연결 확인

### WebSocket 연결 실패
- 포트 4000 방화벽 확인
- CORS 설정 확인
- 서버 로그 확인

### 메시지 분류 안됨
- internal_members 테이블 확인
- GPT API 응답 확인
- Worker 프로세스 상태 확인

## 📞 지원

내부 프로젝트 문의: MotionLabs 개발팀

---
*Last Updated: 2025-09-27*
*Version: 2.0.0*
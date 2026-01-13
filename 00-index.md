# MotionLabs KakaoTalk CS Intelligence System v1.0

## Implementation Spec Documents

Claude Code 작업 시 아래 순서대로 참조하세요.

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | [01-architecture.md](./01-architecture.md) | 시스템 구조, 폴더 구조, 기술 스택 |
| 2 | [02-api.md](./02-api.md) | REST API 스펙 (요청/응답 JSON) |
| 3 | [03-db.sql](./03-db.sql) | PostgreSQL 스키마 DDL |
| 4 | [04-ticketing.md](./04-ticketing.md) | 티켓 생성/상태 전이 알고리즘 |
| 5 | [05-sla-alert.md](./05-sla-alert.md) | SLA 20분 규칙, Slack 알림 |
| 6 | [06-llm.md](./06-llm.md) | LLM 분류 프롬프트, 모델 라우팅 |
| 7 | [07-deploy.md](./07-deploy.md) | GCP 배포, Docker, 환경변수 |

---

## Quick Reference

### 핵심 결정 사항

| 항목 | 결정 |
|------|------|
| 시스템 성격 | 독립 백오피스 툴 (리비짓 DB 연동 없음) |
| 사용자 | 모션랩스 내부 전용 (CS팀 + 본사) |
| 데이터 보존 | 영구보관, 마스킹 없음 |
| SLA 기준 | **20분** 초과 시 Slack 알림 |
| 초기 계정 | admin / 1234 |
| 추가 계정 | 관리자 대시보드에서 생성 |

### 기술 스택

| 영역 | 선택 |
|------|------|
| Server | Python 3.11 + FastAPI |
| Database | PostgreSQL 15+ |
| Queue | GCP Pub/Sub |
| Web | Next.js |
| LLM | Claude Haiku (기본) / Sonnet (에스컬레이션) |
| Infra | Docker + GCP Cloud Run |

### 직원 식별 규칙

```
닉네임 패턴: [모션랩스_이름]
정규식: ^\[모션랩스_.+\]$

예시:
- [모션랩스_이우진] → staff, 이우진
- 원장님 → customer
```

---

## v1 Acceptance Criteria

- [ ] Android → ingest-api → DB 저장 동작
- [ ] 고객 메시지 → 티켓 자동 생성
- [ ] 직원 응답 → 티켓 상태 변경
- [ ] 20분 미응답 → Slack 알림 발송
- [ ] 메시지 LLM 분류 동작
- [ ] 대시보드 로그인 (admin/1234)
- [ ] 티켓 목록 조회/필터링
- [ ] 티켓 상세 + 메시지 타임라인 표시
- [ ] 사용자 추가 기능

---

## Non-Goals (v1에서 제외)

- 카카오톡 자동 발송
- 첨부파일/미디어 저장
- 담당자 성과 랭킹
- 타 채널 통합
- 개인정보 마스킹
- 리비짓 DB 연동

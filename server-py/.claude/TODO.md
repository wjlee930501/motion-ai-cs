# Pending Work

## [HIGH] Phase 2: 직원 응답 LLM 분석 추가

**상태**: 대기 (데이터 수집 중)
**선행 조건**: `staff_response_log` 테이블에 데이터가 충분히 쌓인 후 (최소 1~2주)
**생성일**: 2026-01-31

### 배경
Phase 1 (2026-01-31 완료)에서 직원 응답 패턴 수집 인프라를 구축함:
- `StaffResponseLog` 모델/테이블 생성
- Worker에서 직원 메시지마다 응답 컨텍스트 자동 수집
- Dashboard API에 `/v1/staff/response-stats`, `/v1/staff/response-log` 엔드포인트 추가

### Phase 2 작업 범위
1. **직원 응답 품질/톤 분석** — LLM으로 응답의 전문성, 친절도, 정확도 평가
2. **직원별 강점/약점 인사이트** — 어떤 유형의 질문에 잘/못 대응하는지
3. **베스트 답변 패턴 추출** — 높은 평가를 받은 응답에서 템플릿 자동 추천
4. **대시보드 직원 성과 차트** — 시각화 컴포넌트 추가

### 관련 파일
- `server-py/shared/models.py` — `StaffResponseLog` 모델
- `server-py/worker/main.py` — `record_staff_response()` 수집 함수
- `server-py/dashboard_api/main.py` — `/v1/staff/*` 엔드포인트
- `server-py/shared/schemas.py` — Staff response 스키마

### 확인 방법
데이터 충분한지 확인: `SELECT COUNT(*) FROM staff_response_log;` → 최소 100건 이상이면 시작 가능

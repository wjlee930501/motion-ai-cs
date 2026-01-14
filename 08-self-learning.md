# Self-Learning System Spec

## 1. 개요

매일 오전 1시(KST)에 당일 CS 대화 로그를 분석하여 MotionLabs의 CS 패턴과 고객 요청 패턴을 자동으로 학습하고 데이터베이스화하는 시스템.

---

## 2. 학습 목표

### 2.1 CS 응대 패턴 학습
- 직원들의 응대 방식 및 톤
- 문제 유형별 해결 프로세스
- 성공적인 응대 사례 (빠른 해결, 고객 만족)
- 에스컬레이션 기준 및 처리 방식

### 2.2 고객 요청 패턴 학습
- 자주 발생하는 문의 유형
- 시간대별/요일별 문의 패턴
- 긴급 문의 키워드 및 표현
- 고객 감정 변화 패턴

---

## 3. 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Scheduler (Cron)                      │
│                   매일 01:00 KST 실행                      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Daily Log Collector                         │
│         당일 00:00~23:59 대화 로그 수집                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              LLM Pattern Analyzer                        │
│         Claude Sonnet으로 패턴 분석                       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Knowledge Database                          │
│         학습된 패턴 저장 및 버전 관리                      │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 데이터베이스 스키마

### 4.1 CS 패턴 테이블

```sql
CREATE TABLE cs_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(50) NOT NULL,  -- 'response', 'escalation', 'resolution'
    category VARCHAR(100) NOT NULL,      -- 문의 카테고리
    pattern_description TEXT NOT NULL,   -- 패턴 설명
    example_messages JSONB,              -- 예시 메시지들
    recommended_response TEXT,           -- 권장 응대 방식
    confidence FLOAT DEFAULT 0.0,        -- 패턴 신뢰도
    occurrence_count INT DEFAULT 1,      -- 발생 횟수
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cs_patterns_type ON cs_patterns(pattern_type);
CREATE INDEX idx_cs_patterns_category ON cs_patterns(category);
```

### 4.2 고객 요청 패턴 테이블

```sql
CREATE TABLE customer_request_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(100) NOT NULL,  -- 요청 유형
    keywords JSONB NOT NULL,             -- 관련 키워드들
    typical_expressions JSONB,           -- 자주 사용되는 표현
    urgency_indicators JSONB,            -- 긴급도 지표
    sentiment_trend VARCHAR(20),         -- 감정 트렌드
    resolution_time_avg INTERVAL,        -- 평균 해결 시간
    occurrence_count INT DEFAULT 1,
    peak_hours JSONB,                    -- 피크 시간대
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_request_patterns_type ON customer_request_patterns(request_type);
```

### 4.3 학습 이력 테이블

```sql
CREATE TABLE learning_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_date DATE NOT NULL,
    tickets_analyzed INT,
    messages_analyzed INT,
    new_patterns_found INT,
    patterns_updated INT,
    summary TEXT,
    raw_analysis JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learning_history_date ON learning_history(learning_date);
```

---

## 5. LLM 분석 프롬프트

### 5.1 System Prompt

```
당신은 MotionLabs CS 데이터 분석 전문가입니다.
하루치 CS 대화 로그를 분석하여 다음을 추출합니다:

1. CS 응대 패턴
   - 직원들의 효과적인 응대 방식
   - 문제 유형별 해결 프로세스
   - 에스컬레이션 기준

2. 고객 요청 패턴
   - 자주 발생하는 문의 유형과 키워드
   - 긴급 문의 표현 패턴
   - 시간대별 문의 특성

3. 개선 인사이트
   - 응대 시간이 긴 케이스 분석
   - 반복되는 문제점
   - 자동화 가능한 응대

JSON 형식으로 구조화하여 반환하세요.
```

### 5.2 분석 Output 형식

```json
{
  "analysis_date": "2025-01-14",
  "summary": {
    "total_tickets": 45,
    "total_messages": 312,
    "avg_resolution_time": "18분"
  },
  "cs_patterns": [
    {
      "pattern_type": "response",
      "category": "발송/전송 문제",
      "description": "문자 발송 지연 시 발송 로그 확인 후 예상 시간 안내",
      "example": "확인해보니 현재 발송 대기 중이며, 약 10분 내 발송 예정입니다.",
      "confidence": 0.85
    }
  ],
  "customer_patterns": [
    {
      "request_type": "발송 지연 문의",
      "keywords": ["안 나감", "발송", "문자", "언제"],
      "typical_expressions": ["어제 보낸 문자 아직 안 나갔는데요?"],
      "urgency_indicators": ["급해", "환자", "기다려"],
      "peak_hours": [10, 11, 14, 15]
    }
  ],
  "insights": [
    {
      "type": "improvement",
      "description": "발송 상태 실시간 조회 기능 추가 시 문의 30% 감소 예상"
    }
  ]
}
```

---

## 6. 구현

### 6.1 스케줄러 (server-py/worker/learning_job.py)

```python
import asyncio
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")

@scheduler.scheduled_job(CronTrigger(hour=1, minute=0))
async def daily_learning_job():
    """
    매일 01:00 KST에 실행되는 학습 작업
    """
    yesterday = datetime.now() - timedelta(days=1)

    # 1. 당일 대화 로그 수집
    logs = await collect_daily_logs(yesterday)

    # 2. LLM 분석
    analysis = await analyze_with_llm(logs)

    # 3. 패턴 DB 업데이트
    await update_pattern_database(analysis)

    # 4. 학습 이력 저장
    await save_learning_history(analysis)

    print(f"[Learning] {yesterday.date()} 학습 완료")
```

### 6.2 로그 수집기

```python
async def collect_daily_logs(date: datetime) -> list:
    """
    특정 날짜의 모든 대화 로그 수집
    """
    start = date.replace(hour=0, minute=0, second=0)
    end = date.replace(hour=23, minute=59, second=59)

    query = """
        SELECT
            t.id as ticket_id,
            t.clinic_key,
            t.status,
            t.resolved_at,
            e.sender_type,
            e.text_raw,
            e.received_at,
            e.classification
        FROM tickets t
        JOIN events e ON e.ticket_id = t.id
        WHERE e.received_at BETWEEN :start AND :end
        ORDER BY t.id, e.received_at
    """

    return await db.fetch_all(query, {"start": start, "end": end})
```

### 6.3 패턴 업데이트 로직

```python
async def update_pattern_database(analysis: dict):
    """
    분석 결과를 패턴 DB에 반영
    - 기존 패턴: occurrence_count 증가, confidence 업데이트
    - 신규 패턴: 새로 추가
    """
    for pattern in analysis["cs_patterns"]:
        existing = await find_similar_pattern(pattern)

        if existing:
            # 기존 패턴 업데이트
            await db.execute("""
                UPDATE cs_patterns
                SET occurrence_count = occurrence_count + 1,
                    confidence = (confidence + :new_conf) / 2,
                    last_seen_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
            """, {"id": existing.id, "new_conf": pattern["confidence"]})
        else:
            # 신규 패턴 추가
            await db.execute("""
                INSERT INTO cs_patterns
                (pattern_type, category, pattern_description,
                 recommended_response, confidence)
                VALUES (:type, :cat, :desc, :resp, :conf)
            """, pattern)
```

---

## 7. 활용 방안

### 7.1 자동 응답 제안
학습된 CS 패턴을 기반으로 직원에게 응답 템플릿 제안

### 7.2 신규 직원 온보딩
축적된 패턴 데이터로 CS 가이드라인 자동 생성

### 7.3 이상 탐지
평소 패턴과 다른 문의 급증 시 알림

### 7.4 리포트 자동화
주간/월간 CS 트렌드 리포트 자동 생성

---

## 8. 비용 추정

| 항목 | 수량 | 모델 | 토큰 | 비용/일 |
|------|------|------|------|---------|
| 일간 분석 | 1회 | Sonnet | ~10K | ~$0.03 |

월 예상 비용: **~$1**

---

## 9. 향후 확장

- [ ] 실시간 학습 (배치 → 스트리밍)
- [ ] 멀티 테넌트 지원 (병원별 패턴 분리)
- [ ] A/B 테스트 (응답 제안 효과 측정)
- [ ] RAG 연동 (학습 데이터 기반 응답 생성)

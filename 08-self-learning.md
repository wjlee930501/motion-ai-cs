# 08. Self-Learning System Spec

## 1. 개요

### 1.1 목적

CS 대화 로그를 주기적으로 LLM에게 읽히며, 모션랩스의 CS 응대 방식과 고객 요청 양상에 대한 **이해를 점진적으로 형성**하는 시스템.

### 1.2 핵심 철학

```
패턴 추출 (X)  →  이해 형성 (O)
구조화 강제 (X)  →  자유로운 분석 (O)
한 번에 완성 (X)  →  점진적 심화 (O)
```

현재 단계에서는 데이터가 충분하지 않다. 복잡한 패턴 테이블이나 분류 체계를 미리 설계하는 것은 시기상조. LLM이 축적된 대화를 반복적으로 읽으며 스스로 이해를 형성하도록 한다.

### 1.3 단계별 로드맵

| 단계 | 목표 | 현재 |
|------|------|------|
| **1단계** | 학습 루프 구축 - LLM이 이해를 형성 | ← 여기 |
| **2단계** | 이해의 구조화 및 리파이닝 | |
| **3단계** | 반자동화 - AI 제안 → 사람 승인 | |
| **4단계** | 완전 자동화 | |

---

## 2. 학습 대상

### 2.1 본질: 상호작용 패턴

학습의 핵심은 개별 메시지가 아니라 **대화의 인과관계**다.

```
고객이 A라고 함 → 직원이 B라고 응답 → 고객이 C로 반응
         ↓
    이 흐름 자체가 학습 대상
```

### 2.2 이해하고자 하는 것

**모션랩스 CS 응대 방식**
- 직원들은 어떤 톤으로 대화하는가?
- 문제 상황에서 어떻게 대응하는가?
- 어떤 응대가 고객을 만족시키는가?
- 에스컬레이션은 어떤 상황에서 발생하는가?

**고객 요청 양상**
- 고객들은 주로 무엇을 물어보는가?
- 어떤 표현을 사용하는가?
- 긴급한 상황은 어떻게 표현되는가?
- 불만족 신호는 무엇인가?

**상호작용 다이나믹스**
- 어떤 응대가 대화를 빨리 종결시키는가?
- 어떤 응대가 대화를 길어지게 하는가?
- 오해가 발생하는 패턴은?
- 성공적인 문제 해결 흐름은?

---

## 3. 학습 루프 아키텍처

### 3.1 전체 흐름

```
┌─────────────────────────────────────────────────────────┐
│                  데이터 축적 (상시)                       │
│            카카오톡 메시지 → message_event 테이블          │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Learning Cycle (3일 주기)                   │
│                                                         │
│  1. 전체 대화 로그 수집                                   │
│  2. 이전 이해(understanding) 로드                        │
│  3. LLM에게 열린 질문으로 분석 요청                        │
│  4. 새로운 이해 저장                                      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Understanding 누적                          │
│                                                         │
│  v1: "아직 데이터가 적어서 패턴 파악 어려움..."             │
│  v2: "발송 관련 문의가 많고, 직원들은..."                  │
│  v3: "이전 이해에 추가로, 결제 문의 패턴 발견..."           │
│  ...                                                    │
│  vN: 점점 깊어지는 이해                                   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 주기 설정

| 설정 | 값 | 이유 |
|------|-----|------|
| 실행 주기 | 3일 | 충분한 새 데이터 축적 + 비용 효율 |
| 실행 시간 | 매주 월/목 02:00 KST | 새벽 시간대, 시스템 부하 최소 |
| 분석 범위 | 전체 누적 데이터 | 맥락 유지를 위해 전체 읽기 |

### 3.3 왜 전체 데이터를 매번 읽는가?

```
[방식 A: 증분 분석]
새 데이터만 분석 → 이전 패턴과 merge
문제: 맥락 단절, 패턴 충돌, 복잡한 merge 로직

[방식 B: 전체 분석] ← 채택
매번 전체 읽기 → 새로운 이해 형성
장점: 맥락 유지, 단순함, LLM이 스스로 종합
단점: 토큰 비용 (but 현재 데이터량에서는 무시 가능)
```

데이터가 많아지면 윈도우 방식(최근 N일)으로 전환 검토.

---

## 4. 데이터베이스 스키마

### 4.1 이해 저장 테이블

```sql
-- LLM이 형성한 이해를 버전별로 저장
CREATE TABLE cs_understanding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL,                    -- 이해 버전 (1, 2, 3...)
    created_at TIMESTAMP DEFAULT NOW(),

    -- 분석 메타데이터
    logs_analyzed_count INT,                 -- 분석한 로그 수
    logs_date_from TIMESTAMP,                -- 로그 시작 일시
    logs_date_to TIMESTAMP,                  -- 로그 종료 일시

    -- LLM 이해 내용
    understanding_text TEXT NOT NULL,        -- 자유 형식의 이해

    -- 선택적 구조화 (LLM이 자연스럽게 정리한 경우)
    key_insights JSONB,                      -- 핵심 인사이트 (있으면)

    -- LLM 메타
    model_used VARCHAR(50),                  -- 사용된 모델
    prompt_tokens INT,
    completion_tokens INT
);

CREATE INDEX idx_cs_understanding_version ON cs_understanding(version DESC);
CREATE INDEX idx_cs_understanding_created ON cs_understanding(created_at DESC);
```

### 4.2 학습 실행 이력

```sql
-- 학습 사이클 실행 기록
CREATE TABLE learning_execution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_at TIMESTAMP DEFAULT NOW(),

    status VARCHAR(20) NOT NULL,             -- 'success', 'failed', 'partial'

    -- 실행 정보
    trigger_type VARCHAR(20),                -- 'scheduled', 'manual'
    duration_seconds INT,

    -- 결과 요약
    understanding_version INT,               -- 생성된 이해 버전
    error_message TEXT,                      -- 실패 시 에러

    FOREIGN KEY (understanding_version) REFERENCES cs_understanding(version)
);
```

### 4.3 마이그레이션

```sql
-- migrations/004_self_learning.sql

-- 기존 테이블 삭제 (이전 스펙 기반)
DROP TABLE IF EXISTS cs_patterns CASCADE;
DROP TABLE IF EXISTS customer_request_patterns CASCADE;
DROP TABLE IF EXISTS learning_history CASCADE;

-- 새 테이블 생성
CREATE TABLE cs_understanding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    logs_analyzed_count INT,
    logs_date_from TIMESTAMP,
    logs_date_to TIMESTAMP,
    understanding_text TEXT NOT NULL,
    key_insights JSONB,
    model_used VARCHAR(50),
    prompt_tokens INT,
    completion_tokens INT
);

CREATE TABLE learning_execution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) NOT NULL,
    trigger_type VARCHAR(20),
    duration_seconds INT,
    understanding_version INT,
    error_message TEXT
);

CREATE INDEX idx_cs_understanding_version ON cs_understanding(version DESC);
CREATE INDEX idx_cs_understanding_created ON cs_understanding(created_at DESC);
CREATE INDEX idx_learning_execution_at ON learning_execution(executed_at DESC);
```

---

## 5. LLM 프롬프트 설계

### 5.1 핵심 원칙

```
구조화 강제 (X)  →  열린 질문 (O)
특정 포맷 요구 (X)  →  자유로운 정리 (O)
```

### 5.2 System Prompt

```
당신은 모션랩스 CS 분석가입니다.

모션랩스는 병원에 마케팅 솔루션을 제공하는 회사이며,
약 400개 병원 고객과 카카오톡으로 CS 소통을 합니다.

당신의 역할:
- 축적된 CS 대화 로그를 읽고 이해를 형성하는 것
- 모션랩스 직원들의 응대 방식을 파악하는 것
- 고객들의 요청 양상을 이해하는 것
- 대화의 상호작용 패턴을 발견하는 것

주의사항:
- 데이터가 적을 수 있습니다. 무리하게 패턴을 만들지 마세요.
- 확실한 것과 추측을 구분해서 말해주세요.
- 이전 이해가 있다면, 그것을 발전시키는 방향으로 작성하세요.
```

### 5.3 User Prompt 템플릿

```
## 이전 이해

{previous_understanding or "없음 (첫 번째 학습입니다)"}

---

## 대화 로그

총 {log_count}건의 대화 ({date_from} ~ {date_to})

{conversation_logs}

---

## 요청

위 대화 로그를 바탕으로 당신의 이해를 정리해주세요.

다음 관점에서 자유롭게 분석해주세요:

1. **모션랩스 CS 응대 방식**
   - 직원들은 어떤 톤과 방식으로 대화하는가?
   - 어떤 응대 패턴이 보이는가?

2. **고객 요청 양상**
   - 고객들은 주로 무엇을 물어보는가?
   - 어떤 표현과 키워드를 사용하는가?

3. **상호작용 다이나믹스**
   - 대화가 어떻게 흘러가는가?
   - 어떤 응대가 효과적으로 보이는가?

4. **추가 발견**
   - 그 외 눈에 띄는 것들

5. **이전 이해 대비 변화** (이전 이해가 있는 경우)
   - 새롭게 알게 된 것
   - 수정이 필요한 것
   - 더 확신하게 된 것

데이터가 부족하면 부족하다고 솔직하게 말해주세요.
무리하게 패턴을 만들 필요 없습니다.
```

### 5.4 대화 로그 포맷

```
### 채팅방: {chat_room_name}
### 기간: {first_message_time} ~ {last_message_time}

[{timestamp}] {sender_type}: {message}
[{timestamp}] {sender_type}: {message}
...

---

### 채팅방: {next_chat_room}
...
```

예시:
```
### 채팅방: 모션랩스 - A성형외과
### 기간: 2025-01-13 09:30 ~ 2025-01-13 10:15

[09:30] customer: 안녕하세요, 문자 발송이 안되고 있는 것 같아요
[09:32] staff: 안녕하세요! 확인해보겠습니다. 어떤 캠페인 문자인가요?
[09:33] customer: 1월 신년 이벤트 문자요
[09:35] staff: 확인했습니다. 현재 발송 대기열에 있고 10분 내로 발송될 예정입니다.
[09:36] customer: 네 감사합니다!

---

### 채팅방: 모션랩스 - B피부과
...
```

---

## 6. 구현

### 6.1 파일 구조

```
server-py/
├── worker/
│   ├── main.py              # 기존 worker
│   ├── llm.py               # 기존 LLM 클라이언트
│   └── learning/
│       ├── __init__.py
│       ├── scheduler.py     # 학습 스케줄러
│       ├── collector.py     # 로그 수집기
│       ├── analyzer.py      # LLM 분석기
│       └── prompts.py       # 프롬프트 템플릿
```

### 6.2 스케줄러 (scheduler.py)

```python
import asyncio
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .collector import collect_all_logs
from .analyzer import analyze_and_save

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


def setup_learning_scheduler():
    """학습 스케줄러 설정 - 월/목 02:00 실행"""

    scheduler.add_job(
        run_learning_cycle,
        CronTrigger(day_of_week='mon,thu', hour=2, minute=0),
        id='learning_cycle',
        name='CS Understanding Learning Cycle',
        replace_existing=True
    )

    scheduler.start()
    print("[Learning] Scheduler started - runs Mon/Thu at 02:00 KST")


async def run_learning_cycle(trigger_type: str = "scheduled"):
    """
    학습 사이클 실행

    1. 전체 대화 로그 수집
    2. 이전 이해 로드
    3. LLM 분석 실행
    4. 새 이해 저장
    5. 실행 이력 기록
    """

    start_time = datetime.now()
    print(f"[Learning] Starting learning cycle at {start_time}")

    try:
        # 1. 로그 수집
        logs, log_meta = await collect_all_logs()

        if log_meta['count'] == 0:
            print("[Learning] No logs to analyze, skipping")
            return

        # 2. 분석 및 저장
        result = await analyze_and_save(logs, log_meta)

        # 3. 실행 이력 기록
        duration = (datetime.now() - start_time).seconds
        await save_execution_history(
            status='success',
            trigger_type=trigger_type,
            duration_seconds=duration,
            understanding_version=result['version']
        )

        print(f"[Learning] Completed in {duration}s - Understanding v{result['version']}")

    except Exception as e:
        print(f"[Learning] Failed: {e}")
        await save_execution_history(
            status='failed',
            trigger_type=trigger_type,
            error_message=str(e)
        )
        raise


async def run_learning_cycle_manual():
    """수동 실행용"""
    await run_learning_cycle(trigger_type="manual")
```

### 6.3 로그 수집기 (collector.py)

```python
from datetime import datetime
from shared.database import database


async def collect_all_logs() -> tuple[str, dict]:
    """
    전체 대화 로그를 채팅방별로 그룹화하여 수집

    Returns:
        logs_text: 포맷된 로그 텍스트
        meta: 메타데이터 (count, date_from, date_to)
    """

    query = """
        SELECT
            chat_room,
            sender_type,
            text_raw,
            received_at
        FROM message_event
        WHERE text_raw IS NOT NULL
        ORDER BY chat_room, received_at
    """

    rows = await database.fetch_all(query)

    if not rows:
        return "", {'count': 0, 'date_from': None, 'date_to': None}

    # 채팅방별로 그룹화
    rooms = {}
    for row in rows:
        room = row['chat_room'] or 'Unknown'
        if room not in rooms:
            rooms[room] = []
        rooms[room].append(row)

    # 텍스트 포맷팅
    logs_text = format_logs_by_room(rooms)

    # 메타데이터
    meta = {
        'count': len(rows),
        'date_from': min(r['received_at'] for r in rows),
        'date_to': max(r['received_at'] for r in rows)
    }

    return logs_text, meta


def format_logs_by_room(rooms: dict) -> str:
    """채팅방별로 로그 포맷팅"""

    parts = []

    for room_name, messages in rooms.items():
        first_time = messages[0]['received_at']
        last_time = messages[-1]['received_at']

        header = f"### 채팅방: {room_name}\n"
        header += f"### 기간: {first_time.strftime('%Y-%m-%d %H:%M')} ~ {last_time.strftime('%Y-%m-%d %H:%M')}\n\n"

        lines = []
        for msg in messages:
            time_str = msg['received_at'].strftime('%H:%M')
            sender = msg['sender_type'] or 'unknown'
            text = msg['text_raw'].replace('\n', ' ')[:200]  # 긴 메시지 truncate
            lines.append(f"[{time_str}] {sender}: {text}")

        parts.append(header + '\n'.join(lines))

    return '\n\n---\n\n'.join(parts)
```

### 6.4 분석기 (analyzer.py)

```python
from anthropic import AsyncAnthropic
from shared.database import database
from shared.config import settings
from .prompts import SYSTEM_PROMPT, build_user_prompt

client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def analyze_and_save(logs_text: str, log_meta: dict) -> dict:
    """
    LLM 분석 실행 및 결과 저장
    """

    # 1. 이전 이해 로드
    previous = await get_latest_understanding()

    # 2. 프롬프트 구성
    user_prompt = build_user_prompt(
        previous_understanding=previous['text'] if previous else None,
        logs_text=logs_text,
        log_count=log_meta['count'],
        date_from=log_meta['date_from'],
        date_to=log_meta['date_to']
    )

    # 3. LLM 호출
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )

    understanding_text = response.content[0].text

    # 4. 새 버전 번호
    new_version = (previous['version'] + 1) if previous else 1

    # 5. 저장
    await database.execute("""
        INSERT INTO cs_understanding
        (version, logs_analyzed_count, logs_date_from, logs_date_to,
         understanding_text, model_used, prompt_tokens, completion_tokens)
        VALUES (:version, :count, :date_from, :date_to,
                :text, :model, :prompt_tokens, :completion_tokens)
    """, {
        'version': new_version,
        'count': log_meta['count'],
        'date_from': log_meta['date_from'],
        'date_to': log_meta['date_to'],
        'text': understanding_text,
        'model': 'claude-sonnet-4-20250514',
        'prompt_tokens': response.usage.input_tokens,
        'completion_tokens': response.usage.output_tokens
    })

    return {
        'version': new_version,
        'understanding': understanding_text
    }


async def get_latest_understanding() -> dict | None:
    """가장 최근 이해 조회"""

    row = await database.fetch_one("""
        SELECT version, understanding_text as text, created_at
        FROM cs_understanding
        ORDER BY version DESC
        LIMIT 1
    """)

    return dict(row) if row else None
```

### 6.5 프롬프트 (prompts.py)

```python
SYSTEM_PROMPT = """당신은 모션랩스 CS 분석가입니다.

모션랩스는 병원에 마케팅 솔루션을 제공하는 회사이며,
약 400개 병원 고객과 카카오톡으로 CS 소통을 합니다.

당신의 역할:
- 축적된 CS 대화 로그를 읽고 이해를 형성하는 것
- 모션랩스 직원들의 응대 방식을 파악하는 것
- 고객들의 요청 양상을 이해하는 것
- 대화의 상호작용 패턴을 발견하는 것

주의사항:
- 데이터가 적을 수 있습니다. 무리하게 패턴을 만들지 마세요.
- 확실한 것과 추측을 구분해서 말해주세요.
- 이전 이해가 있다면, 그것을 발전시키는 방향으로 작성하세요."""


def build_user_prompt(
    previous_understanding: str | None,
    logs_text: str,
    log_count: int,
    date_from,
    date_to
) -> str:

    prev_section = previous_understanding or "없음 (첫 번째 학습입니다)"
    date_range = f"{date_from.strftime('%Y-%m-%d')} ~ {date_to.strftime('%Y-%m-%d')}"

    return f"""## 이전 이해

{prev_section}

---

## 대화 로그

총 {log_count}건의 대화 ({date_range})

{logs_text}

---

## 요청

위 대화 로그를 바탕으로 당신의 이해를 정리해주세요.

다음 관점에서 자유롭게 분석해주세요:

1. **모션랩스 CS 응대 방식**
   - 직원들은 어떤 톤과 방식으로 대화하는가?
   - 어떤 응대 패턴이 보이는가?

2. **고객 요청 양상**
   - 고객들은 주로 무엇을 물어보는가?
   - 어떤 표현과 키워드를 사용하는가?

3. **상호작용 다이나믹스**
   - 대화가 어떻게 흘러가는가?
   - 어떤 응대가 효과적으로 보이는가?

4. **추가 발견**
   - 그 외 눈에 띄는 것들

5. **이전 이해 대비 변화** (이전 이해가 있는 경우)
   - 새롭게 알게 된 것
   - 수정이 필요한 것
   - 더 확신하게 된 것

데이터가 부족하면 부족하다고 솔직하게 말해주세요.
무리하게 패턴을 만들 필요 없습니다."""
```

---

## 7. API 엔드포인트

### 7.1 이해 조회

```
GET /api/learning/understanding

Response:
{
  "version": 3,
  "created_at": "2025-01-15T02:15:00",
  "logs_analyzed_count": 1523,
  "understanding_text": "...",
  "previous_versions": [
    {"version": 2, "created_at": "..."},
    {"version": 1, "created_at": "..."}
  ]
}
```

### 7.2 특정 버전 조회

```
GET /api/learning/understanding/{version}
```

### 7.3 수동 학습 실행

```
POST /api/learning/run

Response:
{
  "status": "started",
  "message": "Learning cycle started"
}
```

### 7.4 실행 이력 조회

```
GET /api/learning/history

Response:
{
  "executions": [
    {
      "executed_at": "2025-01-15T02:00:00",
      "status": "success",
      "trigger_type": "scheduled",
      "duration_seconds": 45,
      "understanding_version": 3
    },
    ...
  ]
}
```

---

## 8. 비용 추정

### 현재 단계 (데이터 적음)

| 항목 | 빈도 | 토큰 | 비용 |
|------|------|------|------|
| 학습 사이클 | 주 2회 | ~20K input, ~2K output | ~$0.07/회 |
| **월 예상** | 8회 | - | **~$0.60** |

### 데이터 증가 시 (6개월 후 예상)

| 항목 | 빈도 | 토큰 | 비용 |
|------|------|------|------|
| 학습 사이클 | 주 2회 | ~100K input, ~4K output | ~$0.35/회 |
| **월 예상** | 8회 | - | **~$2.80** |

토큰이 너무 많아지면 최근 N일 윈도우 방식으로 전환.

---

## 9. 모니터링

### 9.1 헬스 체크 항목

- [ ] 학습 스케줄러 정상 동작 여부
- [ ] 마지막 성공 실행 시간
- [ ] 연속 실패 횟수
- [ ] 토큰 사용량 추이

### 9.2 알림 조건

| 조건 | 알림 |
|------|------|
| 학습 실패 2회 연속 | Slack 알림 |
| 7일 이상 학습 미실행 | Slack 알림 |
| 토큰 사용량 급증 (2배 이상) | Slack 알림 |

---

## 10. 향후 확장 (2단계 이후)

현재 단계가 안정화되면 고려할 사항들:

### 10.1 이해의 구조화 (2단계)
- LLM 이해를 기반으로 패턴 테이블 자동 생성
- 신뢰도 점수 도입
- 사람이 검증/수정할 수 있는 인터페이스

### 10.2 활용 (3단계)
- 응답 제안 시스템
- 신규 직원 온보딩 가이드 자동 생성
- 이상 탐지 (평소와 다른 패턴)

### 10.3 자동화 (4단계)
- 간단한 문의 자동 응답
- 에스컬레이션 자동 판단
- A/B 테스트

---

## 11. 체크리스트

### 구현 전

- [ ] 마이그레이션 스크립트 실행 (004_self_learning.sql)
- [ ] ANTHROPIC_API_KEY 환경변수 확인
- [ ] Slack 웹훅 설정 (알림용)

### 구현 후

- [ ] 수동 실행 테스트
- [ ] 스케줄러 동작 확인
- [ ] 이해 조회 API 테스트
- [ ] 모니터링 대시보드 연동

# CS 학습 시스템 v2 상세 설계서

> 작성일: 2026-01-28
> 버전: 1.0
> 상태: Draft

---

## 1. 개요

### 1.1 배경

현재 CS 학습 시스템은 대화 로그를 분석하여 `understanding_text`라는 자유 텍스트를 생성합니다.
이 텍스트는 LLM 분류 시 참조되지만, 비정형 데이터라 활용도가 제한적입니다.

### 1.2 목표

1. **구조화된 패턴 추출**: 학습 결과를 JSON으로 구조화하여 시스템 자동 반영
2. **피드백 루프**: 운영자 수정 사항을 다음 학습에 반영
3. **Skip LLM 패턴 자동화**: 확실한 패턴은 LLM 호출 없이 처리
4. **Intent 진화**: 새로운 문의 유형 자동 감지 및 제안

### 1.3 범위

| 포함 | 제외 |
|------|------|
| 학습 프롬프트 개선 | 병원별 맞춤 패턴 (Phase 2) |
| key_insights JSON 활성화 | 템플릿 자동 추천 (Phase 2) |
| 피드백 테이블 및 API | 대시보드 시각화 (Phase 2) |
| Skip LLM 패턴 자동 갱신 | |
| Intent 후보 제안 시스템 | |

---

## 2. 시스템 아키텍처

### 2.1 현재 구조

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Collector  │ ──▶ │  Analyzer   │ ──▶ │   Storage   │
│  (로그수집)  │     │  (LLM분석)   │     │ (CSUnder.)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐            │
                    │  Classifier │ ◀──────────┘
                    │  (실시간)    │   understanding_text
                    └─────────────┘   (비정형 참조)
```

### 2.2 개선 구조

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Collector  │ ──▶ │  Analyzer   │ ──▶ │   Storage   │
│  (로그수집)  │     │  (LLM분석)   │     │ (CSUnder.)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │           ┌──────┴──────┐
       ▼                   ▼           ▼             ▼
┌─────────────┐     ┌─────────────┐  [JSON]     [Text]
│  Feedback   │ ──▶ │  Pattern    │  key_insights  understanding_text
│  Collector  │     │  Extractor  │
└─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │           ┌─────────────┐     ┌─────────────┐
       │           │  Pattern    │ ──▶ │  constants  │
       │           │  Applier    │     │  .py 갱신   │
       │           └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  Classifier │ ◀── key_insights (구조화된 패턴)
│  (실시간)    │ ◀── SKIP_LLM_PATTERNS (자동 갱신)
└─────────────┘ ◀── feedback (오분류 학습)
```

---

## 3. 데이터 모델

### 3.1 기존 테이블 수정

#### CSUnderstanding (수정)

```sql
-- 기존 컬럼 유지
-- key_insights 컬럼 활성화 (기존 nullable JSON)

-- key_insights 스키마 정의
{
  "version": "2.0",
  "generated_at": "2026-01-28T02:00:00Z",
  
  -- 1. 내부 대화 마커
  "internal_discussion_markers": [
    {
      "pattern": "과장님|선생님|언니|오빠",
      "type": "honorific",
      "description": "병원 내부 호칭",
      "confidence": 0.95,
      "example_count": 127
    },
    {
      "pattern": "내가 할게|제가 처리할게요",
      "type": "self_assign",
      "description": "업무 자체 할당",
      "confidence": 0.88,
      "example_count": 45
    }
  ],
  
  -- 2. 대화 종결 패턴
  "confirmation_patterns": [
    {
      "trigger_message": "보내드렸습니다|발송완료",
      "closing_response": "감사합니다|알겠습니다",
      "is_closing": true,
      "confidence": 0.92,
      "example_count": 89
    }
  ],
  
  -- 3. Skip LLM 후보 패턴
  "skip_llm_candidates": [
    {
      "pattern": "^넵+$",
      "intent": "acknowledgment",
      "needs_reply": false,
      "confidence": 0.99,
      "example_count": 234
    },
    {
      "pattern": "^ㅇㅋ$",
      "intent": "reaction", 
      "needs_reply": false,
      "confidence": 0.97,
      "example_count": 156
    }
  ],
  
  -- 4. 새 Intent 후보
  "new_intent_candidates": [
    {
      "suggested_name": "request_resend",
      "description_ko": "재발송 요청",
      "examples": ["재발송 부탁드립니다", "다시 보내주세요"],
      "parent_intent": "request_action",
      "needs_reply": true,
      "frequency": 89,
      "confidence": 0.85
    }
  ],
  
  -- 5. Topic별 통계
  "topic_statistics": {
    "발송/전송 문제": { "count": 345, "avg_urgency": "medium" },
    "예약 관련": { "count": 234, "avg_urgency": "high" },
    "결제/정산": { "count": 123, "avg_urgency": "medium" }
  },
  
  -- 6. 오분류 학습 (피드백 기반)
  "misclassification_learnings": [
    {
      "original_intent": "acknowledgment",
      "corrected_intent": "follow_up",
      "pattern": "네 그리고 추가로",
      "lesson": "'네'로 시작하지만 추가 요청이 있는 경우 follow_up",
      "correction_count": 12
    }
  ]
}
```

### 3.2 신규 테이블

#### classification_feedback (신규)

```sql
CREATE TABLE classification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 원본 분류 정보
  event_id UUID NOT NULL REFERENCES message_event(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  
  -- 원본 LLM 분류 결과
  original_intent TEXT NOT NULL,
  original_needs_reply BOOLEAN NOT NULL,
  original_topic TEXT,
  original_confidence DECIMAL(3,2),
  
  -- 수정된 분류
  corrected_intent TEXT,
  corrected_needs_reply BOOLEAN,
  corrected_topic TEXT,
  
  -- 메타데이터
  feedback_type TEXT NOT NULL DEFAULT 'correction',  -- correction, confirmation, rejection
  corrected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 학습 반영 여부
  applied_to_version INTEGER,  -- 어느 학습 버전에 반영되었는지
  
  -- 인덱스
  CONSTRAINT ck_feedback_type CHECK (feedback_type IN ('correction', 'confirmation', 'rejection'))
);

CREATE INDEX ix_feedback_event ON classification_feedback(event_id);
CREATE INDEX ix_feedback_corrected_at ON classification_feedback(corrected_at);
CREATE INDEX ix_feedback_not_applied ON classification_feedback(applied_to_version) WHERE applied_to_version IS NULL;
```

#### pattern_application_log (신규)

```sql
CREATE TABLE pattern_application_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 어느 학습에서 추출되었는지
  understanding_version INTEGER NOT NULL,
  
  -- 패턴 정보
  pattern_type TEXT NOT NULL,  -- skip_llm, internal_marker, confirmation, new_intent
  pattern_data JSONB NOT NULL,
  
  -- 적용 상태
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, applied
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  
  -- 적용 결과
  application_result JSONB,  -- 성공/실패 상세
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ck_pattern_type CHECK (pattern_type IN ('skip_llm', 'internal_marker', 'confirmation', 'new_intent')),
  CONSTRAINT ck_pattern_status CHECK (status IN ('pending', 'approved', 'rejected', 'applied'))
);

CREATE INDEX ix_pattern_status ON pattern_application_log(status);
CREATE INDEX ix_pattern_version ON pattern_application_log(understanding_version);
```

---

## 4. API 설계

### 4.1 피드백 API

#### POST /v1/feedback/classification

운영자가 분류 결과를 수정할 때 호출

```typescript
// Request
{
  "event_id": "uuid",
  "corrected_intent": "follow_up",        // optional
  "corrected_needs_reply": true,          // optional
  "corrected_topic": "발송/전송 문제"      // optional
}

// Response
{
  "ok": true,
  "feedback": {
    "id": "uuid",
    "event_id": "uuid",
    "original_intent": "acknowledgment",
    "corrected_intent": "follow_up",
    "feedback_type": "correction",
    "corrected_at": "2026-01-28T10:30:00Z"
  }
}
```

#### GET /v1/feedback/statistics

피드백 통계 조회

```typescript
// Response
{
  "ok": true,
  "statistics": {
    "total_feedback": 156,
    "pending_application": 45,
    "applied": 111,
    "by_type": {
      "correction": 89,
      "confirmation": 67
    },
    "top_corrections": [
      {
        "from": "acknowledgment",
        "to": "follow_up",
        "count": 23
      },
      {
        "from": "reaction",
        "to": "acknowledgment", 
        "count": 12
      }
    ]
  }
}
```

### 4.2 패턴 관리 API

#### GET /v1/patterns/pending

승인 대기 중인 패턴 목록

```typescript
// Response
{
  "ok": true,
  "patterns": [
    {
      "id": "uuid",
      "understanding_version": 15,
      "pattern_type": "skip_llm",
      "pattern_data": {
        "pattern": "^넵+$",
        "intent": "acknowledgment",
        "confidence": 0.99,
        "example_count": 234
      },
      "status": "pending",
      "created_at": "2026-01-28T02:15:00Z"
    }
  ]
}
```

#### POST /v1/patterns/{pattern_id}/approve

패턴 승인 (관리자 전용)

```typescript
// Response
{
  "ok": true,
  "pattern": {
    "id": "uuid",
    "status": "approved",
    "reviewed_by": 1,
    "reviewed_at": "2026-01-28T10:30:00Z"
  }
}
```

#### POST /v1/patterns/apply

승인된 패턴을 시스템에 적용

```typescript
// Response
{
  "ok": true,
  "applied": {
    "skip_llm_patterns": 3,
    "constants_updated": true,
    "applied_at": "2026-01-28T10:35:00Z"
  }
}
```

### 4.3 학습 API 확장

#### GET /v1/learning/insights

구조화된 인사이트 조회

```typescript
// Response
{
  "ok": true,
  "version": 15,
  "insights": {
    "internal_discussion_markers": [...],
    "confirmation_patterns": [...],
    "skip_llm_candidates": [...],
    "new_intent_candidates": [...],
    "topic_statistics": {...},
    "misclassification_learnings": [...]
  }
}
```

---

## 5. 학습 프로세스 개선

### 5.1 개선된 학습 프롬프트

```python
# prompts.py 수정

SYSTEM_PROMPT_V2 = """당신은 모션랩스 CS 분석가입니다.

[기존 시스템 프롬프트 유지]

추가 역할:
- 분석 결과를 구조화된 JSON으로도 출력
- 피드백 데이터를 학습에 반영
- 새로운 패턴 발견 시 명시적으로 제안
"""

def build_user_prompt_v2(
    previous_understanding: str | None,
    logs_text: str,
    log_count: int,
    date_from,
    date_to,
    feedback_summary: dict | None = None  # 신규
) -> str:
    """개선된 사용자 프롬프트"""
    
    # 기존 프롬프트 유지
    base_prompt = build_user_prompt(...)
    
    # 피드백 섹션 추가
    if feedback_summary:
        feedback_section = f"""
## 운영자 피드백 (이전 학습 이후 수집)

총 {feedback_summary['total']}건의 분류 수정이 있었습니다.

주요 수정 패턴:
{format_feedback_patterns(feedback_summary['patterns'])}

위 피드백을 반영하여 분류 기준을 개선해주세요.
"""
        base_prompt += feedback_section
    
    # JSON 출력 요청 추가
    json_request = """

---

## JSON 출력 요청

위 분석 내용을 바탕으로, 다음 JSON도 함께 출력해주세요.
텍스트 분석 후 "---JSON_OUTPUT---" 마커 다음에 JSON을 출력하세요.

```json
{
  "version": "2.0",
  "internal_discussion_markers": [
    {
      "pattern": "정규표현식 패턴",
      "type": "honorific|self_assign|task_mention",
      "description": "설명",
      "confidence": 0.0-1.0,
      "example_count": 숫자
    }
  ],
  "confirmation_patterns": [
    {
      "trigger_message": "직원 메시지 패턴",
      "closing_response": "종결 응답 패턴",
      "is_closing": true|false,
      "confidence": 0.0-1.0
    }
  ],
  "skip_llm_candidates": [
    {
      "pattern": "정규표현식",
      "intent": "intent_name",
      "needs_reply": true|false,
      "confidence": 0.0-1.0,
      "example_count": 숫자
    }
  ],
  "new_intent_candidates": [
    {
      "suggested_name": "snake_case_name",
      "description_ko": "한글 설명",
      "examples": ["예시1", "예시2"],
      "parent_intent": "기존 intent 또는 null",
      "needs_reply": true|false,
      "frequency": 숫자,
      "confidence": 0.0-1.0
    }
  ],
  "topic_statistics": {
    "토픽명": { "count": 숫자, "avg_urgency": "level" }
  },
  "misclassification_learnings": [
    {
      "original_intent": "원래 분류",
      "corrected_intent": "수정된 분류",
      "pattern": "해당 패턴",
      "lesson": "학습 내용"
    }
  ]
}
```

주의사항:
- confidence가 0.8 미만인 패턴은 skip_llm_candidates에 포함하지 마세요
- 정규표현식은 Python re 모듈 호환 형식으로 작성하세요
- 예시가 3개 미만인 패턴은 제외하세요
"""
    
    return base_prompt + json_request
```

### 5.2 학습 결과 파싱

```python
# analyzer.py 수정

def parse_learning_output(llm_output: str) -> tuple[str, dict]:
    """
    LLM 출력에서 텍스트와 JSON 분리
    
    Returns:
        (understanding_text, key_insights)
    """
    
    if "---JSON_OUTPUT---" in llm_output:
        parts = llm_output.split("---JSON_OUTPUT---")
        understanding_text = parts[0].strip()
        
        try:
            json_str = parts[1].strip()
            # 마크다운 코드 블록 제거
            if json_str.startswith("```"):
                json_str = json_str.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
            
            key_insights = json.loads(json_str)
            
            # 스키마 검증
            validate_key_insights(key_insights)
            
            return understanding_text, key_insights
            
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"Failed to parse key_insights: {e}")
            return understanding_text, None
    
    return llm_output, None


def validate_key_insights(insights: dict) -> bool:
    """key_insights JSON 스키마 검증"""
    
    required_keys = [
        "internal_discussion_markers",
        "confirmation_patterns", 
        "skip_llm_candidates",
        "new_intent_candidates"
    ]
    
    for key in required_keys:
        if key not in insights:
            raise ValidationError(f"Missing required key: {key}")
    
    # 각 패턴의 confidence 범위 검증
    for pattern in insights.get("skip_llm_candidates", []):
        if not 0 <= pattern.get("confidence", 0) <= 1:
            raise ValidationError("confidence must be between 0 and 1")
    
    return True
```

### 5.3 패턴 자동 적용

```python
# pattern_applier.py (신규)

import re
from typing import List, Dict
from shared.constants import SKIP_LLM_PATTERNS, COMPILED_SKIP_PATTERNS

class PatternApplier:
    """학습된 패턴을 시스템에 적용"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def extract_and_save_patterns(
        self, 
        understanding_version: int,
        key_insights: dict
    ) -> List[dict]:
        """
        key_insights에서 패턴 추출 후 승인 대기 상태로 저장
        """
        patterns_to_save = []
        
        # 1. Skip LLM 후보 추출
        for candidate in key_insights.get("skip_llm_candidates", []):
            if candidate.get("confidence", 0) >= 0.9:  # 높은 확신도만
                patterns_to_save.append({
                    "pattern_type": "skip_llm",
                    "pattern_data": candidate
                })
        
        # 2. 내부 대화 마커 추출
        for marker in key_insights.get("internal_discussion_markers", []):
            if marker.get("confidence", 0) >= 0.85:
                patterns_to_save.append({
                    "pattern_type": "internal_marker",
                    "pattern_data": marker
                })
        
        # 3. 새 Intent 후보 추출
        for intent in key_insights.get("new_intent_candidates", []):
            if intent.get("frequency", 0) >= 30:  # 최소 30건 이상
                patterns_to_save.append({
                    "pattern_type": "new_intent",
                    "pattern_data": intent
                })
        
        # DB 저장
        for pattern in patterns_to_save:
            log = PatternApplicationLog(
                understanding_version=understanding_version,
                pattern_type=pattern["pattern_type"],
                pattern_data=pattern["pattern_data"],
                status="pending"
            )
            self.db.add(log)
        
        self.db.commit()
        return patterns_to_save
    
    def apply_approved_patterns(self) -> dict:
        """
        승인된 패턴을 constants.py에 적용
        """
        approved = self.db.query(PatternApplicationLog).filter(
            PatternApplicationLog.status == "approved"
        ).all()
        
        results = {
            "skip_llm_added": 0,
            "errors": []
        }
        
        for pattern in approved:
            try:
                if pattern.pattern_type == "skip_llm":
                    self._apply_skip_llm_pattern(pattern.pattern_data)
                    results["skip_llm_added"] += 1
                
                pattern.status = "applied"
                pattern.applied_at = datetime.utcnow()
                
            except Exception as e:
                results["errors"].append({
                    "pattern_id": str(pattern.id),
                    "error": str(e)
                })
        
        self.db.commit()
        return results
    
    def _apply_skip_llm_pattern(self, pattern_data: dict):
        """
        Skip LLM 패턴을 런타임에 추가
        (constants.py 파일 수정 대신 DB 기반 동적 로딩)
        """
        intent = pattern_data["intent"]
        regex = pattern_data["pattern"]
        
        # 정규식 유효성 검증
        try:
            compiled = re.compile(regex, re.IGNORECASE)
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {e}")
        
        # 런타임 패턴에 추가
        if intent not in SKIP_LLM_PATTERNS:
            SKIP_LLM_PATTERNS[intent] = []
        
        if regex not in SKIP_LLM_PATTERNS[intent]:
            SKIP_LLM_PATTERNS[intent].append(regex)
            COMPILED_SKIP_PATTERNS[intent].append(compiled)
```

---

## 6. 피드백 수집 플로우

### 6.1 UI 변경점

#### TicketDetail.tsx 수정

```tsx
// 메시지 버블에 피드백 버튼 추가

interface MessageBubbleProps {
  event: TicketEvent;
  onFeedback?: (eventId: string, feedback: FeedbackData) => void;
}

function MessageBubble({ event, onFeedback }: MessageBubbleProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  
  return (
    <div className="message-bubble">
      {/* 기존 메시지 내용 */}
      <div className="message-content">...</div>
      
      {/* LLM 분류 결과 표시 (고객 메시지만) */}
      {event.sender_type === 'customer' && event.llm_classification && (
        <div className="classification-badge">
          <span className="intent">{event.llm_classification.intent}</span>
          <span className="needs-reply">
            {event.llm_classification.needs_reply ? '답변필요' : '완료'}
          </span>
          
          {/* 피드백 버튼 */}
          <button 
            onClick={() => setShowFeedback(true)}
            className="feedback-btn"
          >
            <PencilIcon className="w-3 h-3" />
          </button>
        </div>
      )}
      
      {/* 피드백 모달 */}
      {showFeedback && (
        <FeedbackModal
          event={event}
          onSubmit={(data) => {
            onFeedback?.(event.id, data);
            setShowFeedback(false);
          }}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}
```

#### FeedbackModal.tsx (신규)

```tsx
interface FeedbackModalProps {
  event: TicketEvent;
  onSubmit: (data: FeedbackData) => void;
  onClose: () => void;
}

function FeedbackModal({ event, onSubmit, onClose }: FeedbackModalProps) {
  const [intent, setIntent] = useState(event.llm_classification?.intent);
  const [needsReply, setNeedsReply] = useState(event.llm_classification?.needs_reply);
  
  const intents = [
    { value: 'inquiry_status', label: '상태 확인 문의', needsReply: true },
    { value: 'request_action', label: '작업 요청', needsReply: true },
    { value: 'request_change', label: '변경 요청', needsReply: true },
    { value: 'complaint', label: '불만/클레임', needsReply: true },
    { value: 'question_how', label: '방법 문의', needsReply: true },
    { value: 'question_when', label: '일정 문의', needsReply: true },
    { value: 'follow_up', label: '추가 정보 제공', needsReply: true },
    { value: 'provide_info', label: '자료 제공', needsReply: false },
    { value: 'acknowledgment', label: '확인/동의', needsReply: false },
    { value: 'greeting', label: '인사', needsReply: false },
    { value: 'internal_discussion', label: '내부 대화', needsReply: false },
    { value: 'reaction', label: '단순 리액션', needsReply: false },
    { value: 'confirmation_received', label: '종결 확인', needsReply: false },
  ];
  
  return (
    <div className="feedback-modal">
      <h3>분류 수정</h3>
      
      <div className="original">
        <p>원본 메시지: {event.text_raw}</p>
        <p>현재 분류: {event.llm_classification?.intent}</p>
      </div>
      
      <div className="correction">
        <label>올바른 Intent</label>
        <select value={intent} onChange={(e) => {
          setIntent(e.target.value);
          // 자동으로 needs_reply 설정
          const selected = intents.find(i => i.value === e.target.value);
          if (selected) setNeedsReply(selected.needsReply);
        }}>
          {intents.map(i => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </select>
        
        <label>답변 필요 여부</label>
        <div className="toggle">
          <button 
            className={needsReply ? 'active' : ''} 
            onClick={() => setNeedsReply(true)}
          >
            필요
          </button>
          <button 
            className={!needsReply ? 'active' : ''} 
            onClick={() => setNeedsReply(false)}
          >
            불필요
          </button>
        </div>
      </div>
      
      <div className="actions">
        <button onClick={onClose}>취소</button>
        <button onClick={() => onSubmit({ 
          corrected_intent: intent, 
          corrected_needs_reply: needsReply 
        })}>
          저장
        </button>
      </div>
    </div>
  );
}
```

---

## 7. 연구실(Lab) UI 확장

### 7.1 새로운 탭 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  연구실                                                [학습 실행] │
├─────────────────────────────────────────────────────────────────┤
│  [이해] [인사이트] [패턴관리] [피드백] [히스토리]                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  (탭별 콘텐츠)                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 인사이트 탭

```tsx
function InsightsTab({ insights }: { insights: KeyInsights }) {
  return (
    <div className="insights-tab">
      {/* 내부 대화 마커 */}
      <section>
        <h3>내부 대화 감지 패턴</h3>
        <div className="pattern-list">
          {insights.internal_discussion_markers.map(marker => (
            <PatternCard
              key={marker.pattern}
              pattern={marker.pattern}
              type={marker.type}
              confidence={marker.confidence}
              examples={marker.example_count}
            />
          ))}
        </div>
      </section>
      
      {/* Skip LLM 후보 */}
      <section>
        <h3>자동 분류 후보</h3>
        <p className="description">
          LLM 호출 없이 자동 분류 가능한 패턴들입니다.
        </p>
        <div className="pattern-list">
          {insights.skip_llm_candidates.map(candidate => (
            <SkipLLMCard
              key={candidate.pattern}
              pattern={candidate.pattern}
              intent={candidate.intent}
              confidence={candidate.confidence}
              status={getPatternStatus(candidate.pattern)}
            />
          ))}
        </div>
      </section>
      
      {/* 새 Intent 제안 */}
      <section>
        <h3>새로운 Intent 제안</h3>
        <div className="intent-suggestions">
          {insights.new_intent_candidates.map(intent => (
            <IntentSuggestionCard
              key={intent.suggested_name}
              name={intent.suggested_name}
              description={intent.description_ko}
              examples={intent.examples}
              frequency={intent.frequency}
              confidence={intent.confidence}
            />
          ))}
        </div>
      </section>
      
      {/* Topic 통계 */}
      <section>
        <h3>Topic별 통계</h3>
        <TopicChart data={insights.topic_statistics} />
      </section>
    </div>
  );
}
```

### 7.3 패턴 관리 탭

```tsx
function PatternManagementTab() {
  const { data: pendingPatterns } = useQuery('pendingPatterns', fetchPendingPatterns);
  const approveMutation = useMutation(approvePattern);
  const rejectMutation = useMutation(rejectPattern);
  const applyMutation = useMutation(applyPatterns);
  
  return (
    <div className="pattern-management">
      <div className="header">
        <h3>승인 대기 패턴</h3>
        <button 
          onClick={() => applyMutation.mutate()}
          disabled={!hasApprovedPatterns}
        >
          승인된 패턴 적용
        </button>
      </div>
      
      <div className="pending-list">
        {pendingPatterns?.map(pattern => (
          <PendingPatternCard
            key={pattern.id}
            pattern={pattern}
            onApprove={() => approveMutation.mutate(pattern.id)}
            onReject={() => rejectMutation.mutate(pattern.id)}
          />
        ))}
      </div>
      
      <div className="applied-patterns">
        <h3>적용된 패턴</h3>
        <AppliedPatternsList />
      </div>
    </div>
  );
}
```

---

## 8. 배포 계획

### 8.1 Phase 1 (Week 1-2)

| 작업 | 담당 | 예상 시간 |
|------|------|----------|
| DB 마이그레이션 (신규 테이블) | Backend | 2h |
| 학습 프롬프트 v2 | Backend | 4h |
| 학습 결과 파싱 로직 | Backend | 4h |
| 피드백 API | Backend | 4h |
| 피드백 UI (FeedbackModal) | Frontend | 6h |
| 테스트 | QA | 4h |

### 8.2 Phase 2 (Week 3-4)

| 작업 | 담당 | 예상 시간 |
|------|------|----------|
| 패턴 관리 API | Backend | 4h |
| 패턴 자동 적용 로직 | Backend | 6h |
| 연구실 UI 확장 | Frontend | 8h |
| 인사이트 시각화 | Frontend | 6h |
| 통합 테스트 | QA | 4h |

### 8.3 Phase 3 (Week 5+)

| 작업 | 담당 | 예상 시간 |
|------|------|----------|
| 병원별 맞춤 패턴 | Backend | 8h |
| 템플릿 자동 추천 | Full-stack | 8h |
| 대시보드 통계 강화 | Frontend | 6h |

---

## 9. 모니터링 및 성공 지표

### 9.1 KPI

| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|----------|
| needs_reply 정확도 | 측정 안 됨 | 95%+ | 피드백 수정률 |
| Skip LLM 비율 | ~5% | 30%+ | LLM 호출 로그 |
| 평균 응답 시간 | - | -10% | 분류 완료까지 시간 |
| 운영자 수정 횟수 | - | -50% | 피드백 테이블 |

### 9.2 알림

- 학습 실패 시 Slack 알림
- 새 Intent 후보 발견 시 알림
- 피드백 누적 100건 도달 시 학습 권장 알림

---

## 10. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| LLM JSON 파싱 실패 | 중 | 텍스트만 저장, 재시도 로직 |
| 잘못된 패턴 적용 | 높음 | 관리자 승인 필수, 롤백 기능 |
| 피드백 품질 저하 | 중 | 관리자만 피드백 가능 |
| 과도한 Skip LLM | 중 | confidence 임계값 조정 |

---

## 부록 A: 마이그레이션 스크립트

```sql
-- migrations/add_learning_v2_tables.sql

-- 1. classification_feedback 테이블
CREATE TABLE IF NOT EXISTS classification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES message_event(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  original_intent TEXT NOT NULL,
  original_needs_reply BOOLEAN NOT NULL,
  original_topic TEXT,
  original_confidence DECIMAL(3,2),
  corrected_intent TEXT,
  corrected_needs_reply BOOLEAN,
  corrected_topic TEXT,
  feedback_type TEXT NOT NULL DEFAULT 'correction',
  corrected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_to_version INTEGER,
  CONSTRAINT ck_feedback_type CHECK (feedback_type IN ('correction', 'confirmation', 'rejection'))
);

CREATE INDEX IF NOT EXISTS ix_feedback_event ON classification_feedback(event_id);
CREATE INDEX IF NOT EXISTS ix_feedback_corrected_at ON classification_feedback(corrected_at);
CREATE INDEX IF NOT EXISTS ix_feedback_not_applied ON classification_feedback(applied_to_version) 
  WHERE applied_to_version IS NULL;

-- 2. pattern_application_log 테이블
CREATE TABLE IF NOT EXISTS pattern_application_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  understanding_version INTEGER NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  application_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pattern_type CHECK (pattern_type IN ('skip_llm', 'internal_marker', 'confirmation', 'new_intent')),
  CONSTRAINT ck_pattern_status CHECK (status IN ('pending', 'approved', 'rejected', 'applied'))
);

CREATE INDEX IF NOT EXISTS ix_pattern_status ON pattern_application_log(status);
CREATE INDEX IF NOT EXISTS ix_pattern_version ON pattern_application_log(understanding_version);

-- 3. message_event에 llm_classification 컬럼 확인
-- (이미 존재할 수 있음)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'message_event' AND column_name = 'llm_classification'
  ) THEN
    ALTER TABLE message_event ADD COLUMN llm_classification JSONB;
  END IF;
END $$;
```

---

## 부록 B: key_insights JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "version",
    "internal_discussion_markers",
    "confirmation_patterns",
    "skip_llm_candidates",
    "new_intent_candidates"
  ],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+$"
    },
    "internal_discussion_markers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern", "type", "confidence"],
        "properties": {
          "pattern": { "type": "string" },
          "type": { 
            "type": "string",
            "enum": ["honorific", "self_assign", "task_mention"]
          },
          "description": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "example_count": { "type": "integer", "minimum": 0 }
        }
      }
    },
    "skip_llm_candidates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern", "intent", "needs_reply", "confidence"],
        "properties": {
          "pattern": { "type": "string" },
          "intent": { "type": "string" },
          "needs_reply": { "type": "boolean" },
          "confidence": { "type": "number", "minimum": 0.8, "maximum": 1 },
          "example_count": { "type": "integer", "minimum": 3 }
        }
      }
    },
    "new_intent_candidates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["suggested_name", "description_ko", "needs_reply", "frequency"],
        "properties": {
          "suggested_name": { 
            "type": "string",
            "pattern": "^[a-z_]+$"
          },
          "description_ko": { "type": "string" },
          "examples": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 2
          },
          "parent_intent": { "type": ["string", "null"] },
          "needs_reply": { "type": "boolean" },
          "frequency": { "type": "integer", "minimum": 30 },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    }
  }
}
```

---

## 문서 끝

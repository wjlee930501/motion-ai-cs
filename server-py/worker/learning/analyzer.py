"""
LLM 분석기

이전 이해를 로드하고 새로운 이해를 형성하여 저장.
자동 승인, 정확도 추적, Slack 알림 포함.
"""

import json
import logging
import re
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from anthropic import Anthropic

from shared.config import get_settings
from shared.models import (
    CSUnderstanding,
    LearningExecution,
    ClassificationFeedback,
    PatternApplicationLog,
    MessageEvent,
    LLMAnnotation,
)
from .prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)
settings = get_settings()

_client: Optional[Anthropic] = None


def get_anthropic_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def get_feedback_summary(
    db: Session, since_version: Optional[int] = None
) -> Dict[str, Any]:
    """이전 학습 이후 수집된 피드백 요약"""
    query = db.query(ClassificationFeedback).filter(
        ClassificationFeedback.corrected_intent.isnot(None)
    )

    if since_version:
        query = query.filter(
            (ClassificationFeedback.applied_to_version.is_(None))
            | (ClassificationFeedback.applied_to_version > since_version)
        )

    feedbacks = query.all()

    if not feedbacks:
        return {"total": 0, "patterns": []}

    pattern_counts: Dict[str, Dict] = {}
    for fb in feedbacks:
        key = f"{fb.original_intent}→{fb.corrected_intent}"
        if key not in pattern_counts:
            pattern_counts[key] = {
                "from_intent": fb.original_intent,
                "to_intent": fb.corrected_intent,
                "count": 0,
                "examples": [],
            }
        pattern_counts[key]["count"] += 1

    patterns = sorted(pattern_counts.values(), key=lambda x: x["count"], reverse=True)

    return {"total": len(feedbacks), "patterns": patterns[:10]}


def parse_learning_output(llm_output: str) -> Tuple[str, Optional[Dict]]:
    """LLM 출력에서 텍스트와 JSON 분리"""

    if "---JSON_OUTPUT---" not in llm_output:
        return llm_output, None

    parts = llm_output.split("---JSON_OUTPUT---")
    understanding_text = parts[0].strip()

    if len(parts) < 2:
        return understanding_text, None

    try:
        json_str = parts[1].strip()

        if json_str.startswith("```"):
            lines = json_str.split("\n")
            start_idx = 1
            end_idx = len(lines)
            for i, line in enumerate(lines):
                if i > 0 and line.strip().startswith("```"):
                    end_idx = i
                    break
            json_str = "\n".join(lines[start_idx:end_idx])
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()

        key_insights = json.loads(json_str)

        if validate_key_insights(key_insights):
            return understanding_text, key_insights
        else:
            logger.warning("key_insights validation failed")
            return understanding_text, None

    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse key_insights JSON: {e}")
        return understanding_text, None
    except Exception as e:
        logger.warning(f"Unexpected error parsing key_insights: {e}")
        return understanding_text, None


def validate_key_insights(insights: Dict) -> bool:
    """key_insights JSON 스키마 검증"""
    required_keys = [
        "internal_discussion_markers",
        "confirmation_patterns",
        "skip_llm_candidates",
        "new_intent_candidates",
    ]

    for key in required_keys:
        if key not in insights:
            logger.warning(f"Missing required key in key_insights: {key}")
            return False
        if not isinstance(insights[key], list):
            logger.warning(f"key_insights[{key}] must be a list")
            return False

    for pattern in insights.get("skip_llm_candidates", []):
        conf = pattern.get("confidence", 0)
        if not isinstance(conf, (int, float)) or not 0 <= conf <= 1:
            logger.warning(f"Invalid confidence in skip_llm_candidates: {conf}")
            return False

        regex = pattern.get("pattern", "")
        try:
            re.compile(regex)
        except re.error as e:
            logger.warning(f"Invalid regex pattern: {regex} - {e}")
            return False

    return True


def extract_and_save_patterns(
    db: Session, understanding_version: int, key_insights: Dict
) -> List[Dict]:
    """key_insights에서 패턴 추출 후 저장. 고신뢰도 skip_llm 패턴은 자동 승인."""
    patterns_to_save = []
    auto_approved_count = 0

    for candidate in key_insights.get("skip_llm_candidates", []):
        if (
            candidate.get("confidence", 0) >= 0.9
            and candidate.get("example_count", 0) >= 3
        ):
            # 고신뢰도(≥0.95) + 충분한 예시(≥5) → 자동 승인 후보
            is_auto = (
                candidate.get("confidence", 0) >= 0.95
                and candidate.get("example_count", 0) >= 5
            )

            # 자동 승인 안전 검사: 너무 넓은 패턴 거부
            if is_auto:
                pattern_str = candidate.get("pattern", "")
                # 최소 길이 미달, 와일드카드만 있는 패턴, 빈 패턴 → 수동 검토로 전환
                if (
                    len(pattern_str) < 3
                    or pattern_str in (".*", ".+", "^.*$", "^.+$")
                    or not pattern_str
                ):
                    logger.warning(
                        f"Auto-approval rejected for overly broad pattern: '{pattern_str}'"
                    )
                    is_auto = False

            patterns_to_save.append({
                "pattern_type": "skip_llm",
                "pattern_data": candidate,
                "auto_approved": is_auto,
            })
            if is_auto:
                auto_approved_count += 1

    for marker in key_insights.get("internal_discussion_markers", []):
        if marker.get("confidence", 0) >= 0.85:
            patterns_to_save.append(
                {"pattern_type": "internal_marker", "pattern_data": marker, "auto_approved": False}
            )

    for pattern in key_insights.get("confirmation_patterns", []):
        if pattern.get("confidence", 0) >= 0.85:
            patterns_to_save.append(
                {"pattern_type": "confirmation", "pattern_data": pattern, "auto_approved": False}
            )

    for intent in key_insights.get("new_intent_candidates", []):
        if intent.get("frequency", 0) >= 30 and intent.get("confidence", 0) >= 0.7:
            patterns_to_save.append(
                {"pattern_type": "new_intent", "pattern_data": intent, "auto_approved": False}
            )

    now = datetime.utcnow()
    for pattern in patterns_to_save:
        is_auto = pattern.get("auto_approved", False)
        log = PatternApplicationLog(
            understanding_version=understanding_version,
            pattern_type=pattern["pattern_type"],
            pattern_data=pattern["pattern_data"],
            status="approved" if is_auto else "pending",
            auto_approved=is_auto,
            reviewed_at=now if is_auto else None,
        )
        db.add(log)

    if patterns_to_save:
        db.commit()
        logger.info(
            f"Saved {len(patterns_to_save)} patterns "
            f"({auto_approved_count} auto-approved, "
            f"{len(patterns_to_save) - auto_approved_count} pending review)"
        )

    return patterns_to_save


def calculate_accuracy_metrics(
    db: Session, since_version: int
) -> Optional[Dict[str, Any]]:
    """
    특정 버전 이후 분류된 이벤트의 정확도를 계산.

    correction_rate = 실제 수정된 이벤트 수 / 해당 기간 분류된 이벤트 수
    accuracy = 1 - correction_rate

    corrections는 event_id 기준으로 LLMAnnotation과 같은 범위에서 계산.
    """
    try:
        # 해당 버전의 CSUnderstanding 생성 시점 조회
        understanding = db.query(CSUnderstanding).filter(
            CSUnderstanding.version == since_version
        ).first()

        if not understanding or not understanding.created_at:
            return None

        since_date = understanding.created_at

        # 다음 버전이 있으면 그 시점까지만 측정 (버전 간 구간 한정)
        next_understanding = db.query(CSUnderstanding).filter(
            CSUnderstanding.version == since_version + 1
        ).first()
        until_date = next_understanding.created_at if next_understanding else None

        # 해당 구간에 분류된 이벤트 수 (target_type='event')
        classified_query = db.query(func.count(LLMAnnotation.id)).filter(
            LLMAnnotation.target_type == "event",
            LLMAnnotation.created_at >= since_date,
        )
        if until_date:
            classified_query = classified_query.filter(
                LLMAnnotation.created_at < until_date
            )
        total_classified = classified_query.scalar() or 0

        if total_classified == 0:
            return None

        # 같은 구간에서 이벤트 분류에 대한 피드백 수정 건수
        corrections_query = db.query(
            func.count(ClassificationFeedback.id)
        ).filter(
            ClassificationFeedback.corrected_at >= since_date,
            ClassificationFeedback.feedback_type == "correction",
        )
        if until_date:
            corrections_query = corrections_query.filter(
                ClassificationFeedback.corrected_at < until_date
            )
        corrections = corrections_query.scalar() or 0

        correction_rate = corrections / total_classified
        accuracy = 1.0 - correction_rate

        return {
            "total_classified": total_classified,
            "corrections": corrections,
            "correction_rate": round(correction_rate, 4),
            "accuracy": round(max(accuracy, 0.0), 4),  # 음수 방지 (corrections > classified 가능)
        }

    except Exception as e:
        logger.error(f"Failed to calculate accuracy metrics: {e}")
        return None


def send_learning_slack_notification(
    version: int,
    logs_analyzed: int,
    auto_approved_count: int,
    pending_count: int,
    accuracy_data: Optional[Dict] = None,
    prev_accuracy: Optional[float] = None,
) -> None:
    """학습 완료 후 Slack 웹훅으로 요약 전송"""
    webhook_url = settings.slack_webhook_url
    if not webhook_url:
        logger.info("[Slack] No webhook URL configured, skipping notification")
        return

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"🧠 학습 완료 - v{version}",
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*분석 메시지:*\n{logs_analyzed:,}건"},
                {"type": "mrkdwn", "text": f"*자동승인 패턴:*\n{auto_approved_count}개"},
                {"type": "mrkdwn", "text": f"*수동승인 대기:*\n{pending_count}개"},
            ],
        },
    ]

    if accuracy_data:
        accuracy_pct = f"{accuracy_data['accuracy'] * 100:.1f}%"
        accuracy_text = f"*이전 버전 정확도:*\n{accuracy_pct}"
        if prev_accuracy is not None:
            diff = accuracy_data["accuracy"] - prev_accuracy
            arrow = "📈" if diff > 0 else "📉" if diff < 0 else "➡️"
            accuracy_text += f" ({arrow} {diff * 100:+.1f}%p)"
        blocks.append({
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": accuracy_text},
                {"type": "mrkdwn", "text": f"*수정 건수:*\n{accuracy_data['corrections']}건"},
            ],
        })

    try:
        resp = httpx.post(
            webhook_url,
            json={"blocks": blocks},
            timeout=10.0,
        )
        if resp.status_code == 200:
            logger.info(f"[Slack] Learning notification sent for v{version}")
        else:
            logger.warning(f"[Slack] Webhook returned {resp.status_code}")
    except Exception as e:
        logger.error(f"[Slack] Failed to send notification: {e}")


def analyze_and_save(
    db: Session, logs_text: str, log_meta: Dict[str, Any]
) -> Dict[str, Any]:
    """LLM 분석 실행 및 결과 저장"""

    previous = get_latest_understanding(db)
    previous_text = previous.understanding_text if previous else None
    previous_version = previous.version if previous else 0

    logger.info(f"Previous understanding: v{previous_version}")

    feedback_summary = get_feedback_summary(db, previous_version)
    if feedback_summary["total"] > 0:
        logger.info(f"Including {feedback_summary['total']} feedback items in learning")

    user_prompt = build_user_prompt(
        previous_understanding=previous_text,
        logs_text=logs_text,
        log_count=log_meta["count"],
        date_from=log_meta["date_from"],
        date_to=log_meta["date_to"],
        feedback_summary=feedback_summary if feedback_summary["total"] > 0 else None,
        total_available=log_meta.get("total_available"),
        rooms_included=log_meta.get("rooms_included"),
    )

    client = get_anthropic_client()

    logger.info("Calling LLM for understanding formation...")
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    if not response.content or not hasattr(response.content[0], 'text'):
        raise ValueError("LLM returned empty or non-text response")
    raw_output = response.content[0].text
    understanding_text, key_insights = parse_learning_output(raw_output)

    new_version = previous_version + 1

    # 이전 버전 정확도 계산
    accuracy_data = None
    prev_accuracy_score = None
    if previous_version > 0:
        accuracy_data = calculate_accuracy_metrics(db, previous_version)
        if accuracy_data:
            # 이전 버전의 accuracy_score 업데이트
            prev_understanding = db.query(CSUnderstanding).filter(
                CSUnderstanding.version == previous_version
            ).first()
            if prev_understanding:
                prev_accuracy_score = float(prev_understanding.accuracy_score) if prev_understanding.accuracy_score else None
                prev_understanding.accuracy_score = accuracy_data["accuracy"]
                db.commit()
                logger.info(
                    f"Updated v{previous_version} accuracy: {accuracy_data['accuracy']:.4f} "
                    f"({accuracy_data['corrections']}/{accuracy_data['total_classified']} corrections)"
                )

    new_understanding = CSUnderstanding(
        version=new_version,
        logs_analyzed_count=log_meta["count"],
        logs_date_from=log_meta["date_from"],
        logs_date_to=log_meta["date_to"],
        understanding_text=understanding_text,
        key_insights=key_insights,
        model_used="claude-sonnet-4-20250514",
        prompt_tokens=response.usage.input_tokens,
        completion_tokens=response.usage.output_tokens,
    )
    db.add(new_understanding)
    db.commit()

    auto_approved_count = 0
    pending_pattern_count = 0
    if key_insights:
        patterns_saved = extract_and_save_patterns(db, new_version, key_insights)
        auto_approved_count = sum(1 for p in patterns_saved if p.get("auto_approved"))
        pending_pattern_count = len(patterns_saved) - auto_approved_count
        logger.info(f"Extracted {len(patterns_saved)} patterns from key_insights")

        # auto_approved_patterns_count 업데이트
        new_understanding.auto_approved_patterns_count = auto_approved_count
        db.commit()

    if feedback_summary["total"] > 0:
        db.query(ClassificationFeedback).filter(
            ClassificationFeedback.applied_to_version.is_(None)
        ).update({ClassificationFeedback.applied_to_version: new_version})
        db.commit()
        logger.info(
            f"Marked {feedback_summary['total']} feedbacks as applied to v{new_version}"
        )

    logger.info(
        f"Saved understanding v{new_version} "
        f"(tokens: {response.usage.input_tokens} in, {response.usage.output_tokens} out)"
    )

    # Slack 알림 전송
    send_learning_slack_notification(
        version=new_version,
        logs_analyzed=log_meta["count"],
        auto_approved_count=auto_approved_count,
        pending_count=pending_pattern_count,
        accuracy_data=accuracy_data,
        prev_accuracy=prev_accuracy_score,
    )

    return {
        "version": new_version,
        "understanding": understanding_text,
        "key_insights": key_insights,
        "feedback_applied": feedback_summary["total"],
        "auto_approved_patterns": auto_approved_count,
        "accuracy": accuracy_data,
    }


def get_latest_understanding(db: Session) -> Optional[CSUnderstanding]:
    return db.query(CSUnderstanding).order_by(CSUnderstanding.version.desc()).first()


def save_execution_history(
    db: Session,
    status: str,
    trigger_type: str,
    duration_seconds: int = None,
    understanding_version: int = None,
    error_message: str = None,
) -> LearningExecution:
    execution = LearningExecution(
        status=status,
        trigger_type=trigger_type,
        duration_seconds=duration_seconds,
        understanding_version=understanding_version,
        error_message=error_message,
    )
    db.add(execution)
    db.commit()

    return execution

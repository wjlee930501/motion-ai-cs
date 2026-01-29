"""
LLM 분석기

이전 이해를 로드하고 새로운 이해를 형성하여 저장.
"""

import json
import logging
import re
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
    """key_insights에서 패턴 추출 후 승인 대기 상태로 저장"""
    patterns_to_save = []

    for candidate in key_insights.get("skip_llm_candidates", []):
        if (
            candidate.get("confidence", 0) >= 0.9
            and candidate.get("example_count", 0) >= 3
        ):
            patterns_to_save.append(
                {"pattern_type": "skip_llm", "pattern_data": candidate}
            )

    for marker in key_insights.get("internal_discussion_markers", []):
        if marker.get("confidence", 0) >= 0.85:
            patterns_to_save.append(
                {"pattern_type": "internal_marker", "pattern_data": marker}
            )

    for pattern in key_insights.get("confirmation_patterns", []):
        if pattern.get("confidence", 0) >= 0.85:
            patterns_to_save.append(
                {"pattern_type": "confirmation", "pattern_data": pattern}
            )

    for intent in key_insights.get("new_intent_candidates", []):
        if intent.get("frequency", 0) >= 30 and intent.get("confidence", 0) >= 0.7:
            patterns_to_save.append(
                {"pattern_type": "new_intent", "pattern_data": intent}
            )

    for pattern in patterns_to_save:
        log = PatternApplicationLog(
            understanding_version=understanding_version,
            pattern_type=pattern["pattern_type"],
            pattern_data=pattern["pattern_data"],
            status="pending",
        )
        db.add(log)

    if patterns_to_save:
        db.commit()
        logger.info(f"Saved {len(patterns_to_save)} patterns for review")

    return patterns_to_save


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
    )

    client = get_anthropic_client()

    logger.info("Calling LLM for understanding formation...")
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_output = response.content[0].text
    understanding_text, key_insights = parse_learning_output(raw_output)

    new_version = previous_version + 1

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

    if key_insights:
        patterns_saved = extract_and_save_patterns(db, new_version, key_insights)
        logger.info(f"Extracted {len(patterns_saved)} patterns from key_insights")

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

    return {
        "version": new_version,
        "understanding": understanding_text,
        "key_insights": key_insights,
        "feedback_applied": feedback_summary["total"],
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

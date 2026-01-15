"""
LLM 분석기

이전 이해를 로드하고 새로운 이해를 형성하여 저장.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from anthropic import Anthropic

from shared.config import get_settings
from shared.models import CSUnderstanding, LearningExecution
from .prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)
settings = get_settings()

# LLM 클라이언트 (lazy init)
_client: Optional[Anthropic] = None


def get_anthropic_client() -> Anthropic:
    """Anthropic 클라이언트 lazy init"""
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def analyze_and_save(
    db: Session,
    logs_text: str,
    log_meta: Dict[str, Any]
) -> Dict[str, Any]:
    """
    LLM 분석 실행 및 결과 저장

    Returns:
        dict with 'version' and 'understanding'
    """

    # 1. 이전 이해 로드
    previous = get_latest_understanding(db)
    previous_text = previous.understanding_text if previous else None
    previous_version = previous.version if previous else 0

    logger.info(f"Previous understanding: v{previous_version}")

    # 2. 프롬프트 구성
    user_prompt = build_user_prompt(
        previous_understanding=previous_text,
        logs_text=logs_text,
        log_count=log_meta['count'],
        date_from=log_meta['date_from'],
        date_to=log_meta['date_to']
    )

    # 3. LLM 호출
    client = get_anthropic_client()

    logger.info("Calling LLM for understanding formation...")
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )

    understanding_text = response.content[0].text

    # 4. 새 버전 번호
    new_version = previous_version + 1

    # 5. 저장
    new_understanding = CSUnderstanding(
        version=new_version,
        logs_analyzed_count=log_meta['count'],
        logs_date_from=log_meta['date_from'],
        logs_date_to=log_meta['date_to'],
        understanding_text=understanding_text,
        model_used='claude-sonnet-4-20250514',
        prompt_tokens=response.usage.input_tokens,
        completion_tokens=response.usage.output_tokens
    )
    db.add(new_understanding)
    db.commit()

    logger.info(f"Saved understanding v{new_version} "
                f"(tokens: {response.usage.input_tokens} in, {response.usage.output_tokens} out)")

    return {
        'version': new_version,
        'understanding': understanding_text
    }


def get_latest_understanding(db: Session) -> Optional[CSUnderstanding]:
    """가장 최근 이해 조회"""
    return db.query(CSUnderstanding).order_by(
        CSUnderstanding.version.desc()
    ).first()


def save_execution_history(
    db: Session,
    status: str,
    trigger_type: str,
    duration_seconds: int = None,
    understanding_version: int = None,
    error_message: str = None
) -> LearningExecution:
    """실행 이력 저장"""

    execution = LearningExecution(
        status=status,
        trigger_type=trigger_type,
        duration_seconds=duration_seconds,
        understanding_version=understanding_version,
        error_message=error_message
    )
    db.add(execution)
    db.commit()

    return execution

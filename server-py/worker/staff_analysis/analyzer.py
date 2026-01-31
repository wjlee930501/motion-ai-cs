"""
직원 응답 품질 LLM 분석기

staff_response_log 데이터를 LLM으로 분석하여
직원별 품질 평가, 베스트 프랙티스, 개선 권장사항 제공.
"""

import json
import logging
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from anthropic import Anthropic

from shared.config import get_settings
from shared.models import StaffResponseAnalysis, StaffAnalysisExecution
from .prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)
settings = get_settings()

_client: Optional[Anthropic] = None


def get_anthropic_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def get_latest_analysis(db: Session) -> Optional[StaffResponseAnalysis]:
    return (
        db.query(StaffResponseAnalysis)
        .order_by(StaffResponseAnalysis.version.desc())
        .first()
    )


def parse_analysis_output(llm_output: str) -> Tuple[str, Optional[Dict]]:
    """LLM 출력에서 텍스트와 JSON 분리"""
    if "---JSON_INSIGHTS---" not in llm_output:
        return llm_output, None

    parts = llm_output.split("---JSON_INSIGHTS---")
    analysis_text = parts[0].strip()

    if len(parts) < 2:
        return analysis_text, None

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

        insights = json.loads(json_str)

        if validate_insights(insights):
            return analysis_text, insights
        else:
            logger.warning("[StaffAnalysis] Insights validation failed")
            return analysis_text, None

    except json.JSONDecodeError as e:
        logger.warning(f"[StaffAnalysis] Failed to parse insights JSON: {e}")
        return analysis_text, None
    except Exception as e:
        logger.warning(f"[StaffAnalysis] Unexpected error parsing insights: {e}")
        return analysis_text, None


def validate_insights(insights: Dict) -> bool:
    """insights JSON 스키마 검증"""
    required_keys = [
        "staff_insights",
        "best_practices",
        "improvement_areas",
        "response_templates",
    ]

    for key in required_keys:
        if key not in insights:
            logger.warning(f"[StaffAnalysis] Missing required key: {key}")
            return False
        if not isinstance(insights[key], list):
            logger.warning(f"[StaffAnalysis] insights[{key}] must be a list")
            return False

    # Validate staff_insights entries
    for item in insights.get("staff_insights", []):
        if "staff_member" not in item:
            logger.warning("[StaffAnalysis] staff_insights item missing staff_member")
            return False
        if "scores" not in item:
            logger.warning("[StaffAnalysis] staff_insights item missing scores")
            return False

    return True


def send_staff_analysis_slack_notification(
    version: int,
    responses_analyzed: int,
    staff_count: int,
    insights: Optional[Dict] = None,
) -> None:
    """분석 완료 후 Slack 웹훅으로 요약 전송"""
    webhook_url = settings.slack_webhook_url
    if not webhook_url:
        logger.info("[Slack] No webhook URL configured, skipping staff analysis notification")
        return

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"📊 직원 응답 분석 완료 - v{version}",
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*분석 응답:*\n{responses_analyzed:,}건"},
                {"type": "mrkdwn", "text": f"*분석 직원:*\n{staff_count}명"},
            ],
        },
    ]

    # Add top performers if available
    if insights and insights.get("staff_insights"):
        staff_summaries = []
        for si in insights["staff_insights"][:5]:
            scores = si.get("scores", {})
            avg_score = sum(
                v for v in scores.values() if isinstance(v, (int, float))
            ) / max(len([v for v in scores.values() if isinstance(v, (int, float))]), 1)
            staff_summaries.append(f"• {si['staff_member']}: 평균 {avg_score:.1f}점")

        if staff_summaries:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*직원별 평균 점수:*\n" + "\n".join(staff_summaries),
                },
            })

    try:
        resp = httpx.post(webhook_url, json={"blocks": blocks}, timeout=10.0)
        if resp.status_code == 200:
            logger.info(f"[Slack] Staff analysis notification sent for v{version}")
        else:
            logger.warning(f"[Slack] Webhook returned {resp.status_code}")
    except Exception as e:
        logger.error(f"[Slack] Failed to send staff analysis notification: {e}")


def save_execution_history(
    db: Session,
    status: str,
    trigger_type: str,
    duration_seconds: int = None,
    analysis_version: int = None,
    error_message: str = None,
) -> StaffAnalysisExecution:
    execution = StaffAnalysisExecution(
        status=status,
        trigger_type=trigger_type,
        duration_seconds=duration_seconds,
        analysis_version=analysis_version,
        error_message=error_message,
    )
    db.add(execution)
    db.commit()
    return execution


def analyze_and_save(
    db: Session, logs_text: str, log_meta: Dict[str, Any]
) -> Dict[str, Any]:
    """LLM 분석 실행 및 결과 저장"""

    previous = get_latest_analysis(db)
    previous_version = previous.version if previous else 0

    logger.info(f"[StaffAnalysis] Previous analysis: v{previous_version}")

    user_prompt = build_user_prompt(
        logs_text=logs_text,
        response_count=log_meta["count"],
        staff_count=log_meta["staff_count"],
        date_from=log_meta["date_from"],
        date_to=log_meta["date_to"],
    )

    client = get_anthropic_client()

    logger.info("[StaffAnalysis] Calling LLM for staff response analysis...")
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    if not response.content or not hasattr(response.content[0], "text"):
        raise ValueError("LLM returned empty or non-text response")

    raw_output = response.content[0].text
    analysis_text, insights = parse_analysis_output(raw_output)

    new_version = previous_version + 1

    new_analysis = StaffResponseAnalysis(
        version=new_version,
        responses_analyzed_count=log_meta["count"],
        date_from=log_meta["date_from"],
        date_to=log_meta["date_to"],
        staff_members_analyzed=log_meta["staff_count"],
        analysis_text=analysis_text,
        insights=insights,
        model_used="claude-sonnet-4-20250514",
        prompt_tokens=response.usage.input_tokens,
        completion_tokens=response.usage.output_tokens,
    )
    db.add(new_analysis)
    db.commit()

    logger.info(
        f"[StaffAnalysis] Saved analysis v{new_version} "
        f"(tokens: {response.usage.input_tokens} in, {response.usage.output_tokens} out)"
    )

    # Slack 알림 전송
    send_staff_analysis_slack_notification(
        version=new_version,
        responses_analyzed=log_meta["count"],
        staff_count=log_meta["staff_count"],
        insights=insights,
    )

    return {
        "version": new_version,
        "analysis_text": analysis_text,
        "insights": insights,
    }

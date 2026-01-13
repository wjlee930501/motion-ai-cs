"""
Slack notification utilities
"""

import os
import sys
from datetime import datetime
from typing import Optional, Tuple

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.config import get_settings
from shared.utils import get_kst_now

settings = get_settings()


def send_sla_alert(
    ticket_id: str,
    clinic_key: str,
    customer_message: str,
    elapsed_minutes: int
) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Send SLA breach alert to Slack.

    Args:
        ticket_id: Ticket UUID
        clinic_key: Chat room / clinic name
        customer_message: Latest customer message (truncated to 100 chars)
        elapsed_minutes: Minutes elapsed since first inbound

    Returns:
        tuple: (success, status_code, error_message)
    """
    webhook_url = settings.slack_webhook_url
    if not webhook_url:
        return False, None, "SLACK_WEBHOOK_URL not configured"

    dashboard_url = f"{settings.dashboard_url}/tickets/{ticket_id}"

    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 SLA 초과 알림",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*채팅방:*\n{clinic_key}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*대기 시간:*\n{elapsed_minutes}분 경과"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*고객 문의:*\n> {customer_message[:100]}"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "대시보드에서 확인",
                            "emoji": True
                        },
                        "url": dashboard_url,
                        "style": "primary"
                    }
                ]
            }
        ]
    }

    try:
        response = httpx.post(webhook_url, json=payload, timeout=10)
        if response.is_success:
            return True, response.status_code, None
        else:
            return False, response.status_code, response.text

    except Exception as e:
        return False, None, str(e)


def send_urgent_ticket_alert(
    ticket_id: str,
    clinic_key: str,
    customer_message: str,
    urgency: str
) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Send urgent ticket alert to Slack.
    """
    webhook_url = settings.slack_webhook_url
    if not webhook_url:
        return False, None, "SLACK_WEBHOOK_URL not configured"

    dashboard_url = f"{settings.dashboard_url}/tickets/{ticket_id}"

    emoji = "🔴" if urgency == "critical" else "🟠"

    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} 긴급 문의 접수",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*채팅방:*\n{clinic_key}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*긴급도:*\n{urgency.upper()}"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*문의 내용:*\n> {customer_message[:200]}"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "바로 확인하기",
                            "emoji": True
                        },
                        "url": dashboard_url,
                        "style": "danger"
                    }
                ]
            }
        ]
    }

    try:
        response = httpx.post(webhook_url, json=payload, timeout=10)
        if response.is_success:
            return True, response.status_code, None
        else:
            return False, response.status_code, response.text

    except Exception as e:
        return False, None, str(e)

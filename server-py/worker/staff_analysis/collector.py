"""
직원 응답 로그 수집기

staff_response_log 테이블에서 지난 7일간 데이터를 수집.
토큰 제한을 위한 지능적 샘플링 포함.
"""

import logging
from datetime import datetime, timedelta
from typing import Tuple, Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from shared.models import StaffResponseLog
from shared.utils import get_kst_now

logger = logging.getLogger(__name__)

# 토큰 제한을 고려한 메시지 수 제한
MAX_TOTAL_RESPONSES = 500  # 전체 최대 수집 건수
MAX_PER_STAFF = 30  # 직원당 최대 건수 (다양성 보장)
COLLECTION_DAYS = 7  # 수집 기간 (일)


def collect_staff_responses(
    db: Session,
    days: int = COLLECTION_DAYS,
    max_responses: int = MAX_TOTAL_RESPONSES,
    max_per_staff: int = MAX_PER_STAFF,
) -> Tuple[str, Dict[str, Any]]:
    """
    직원 응답 로그를 직원별로 그룹화하여 수집 (토큰 제한 적용)

    - 지난 N일간 데이터
    - 직원당 최대 max_per_staff건 (다양성 보장)
    - 전체 최대 max_responses건
    - 활발한 직원 우선 수집

    Returns:
        logs_text: 포맷된 로그 텍스트
        meta: 메타데이터 (count, date_from, date_to, staff_count)
    """
    now = get_kst_now()
    since = now - timedelta(days=days)

    # 직원별 응답 수 파악
    staff_counts = (
        db.query(
            StaffResponseLog.staff_member,
            func.count(StaffResponseLog.id).label("cnt"),
        )
        .filter(StaffResponseLog.created_at >= since)
        .group_by(StaffResponseLog.staff_member)
        .all()
    )

    total_available = sum(sc.cnt for sc in staff_counts)
    staff_count = len(staff_counts)

    logger.info(f"[StaffAnalysis] Found {total_available} responses from {staff_count} staff members (last {days} days)")

    # 직원별로 최근 응답 수집 (활발한 직원 우선)
    staff_responses: Dict[str, List[StaffResponseLog]] = {}
    total_collected = 0

    sorted_staff = sorted(staff_counts, key=lambda x: x.cnt, reverse=True)

    for staff_info in sorted_staff:
        staff_name = staff_info.staff_member
        remaining_budget = max_responses - total_collected
        if remaining_budget <= 0:
            break

        staff_limit = min(max_per_staff, remaining_budget)

        responses = (
            db.query(StaffResponseLog)
            .filter(
                StaffResponseLog.staff_member == staff_name,
                StaffResponseLog.created_at >= since,
            )
            .order_by(StaffResponseLog.created_at.desc())
            .limit(staff_limit)
            .all()
        )

        # 시간순 정렬 복원
        responses = sorted(responses, key=lambda r: r.created_at or datetime.min)

        if responses:
            staff_responses[staff_name] = responses
            total_collected += len(responses)

    if not staff_responses:
        return "", {
            "count": 0,
            "total_available": 0,
            "staff_count": 0,
            "date_from": None,
            "date_to": None,
        }

    # 텍스트 포맷팅
    logs_text = format_staff_responses(staff_responses)

    # 메타데이터
    all_responses = [r for responses in staff_responses.values() for r in responses]
    all_times = [r.created_at for r in all_responses if r.created_at]

    meta = {
        "count": total_collected,
        "total_available": total_available,
        "staff_count": len(staff_responses),
        "date_from": min(all_times) if all_times else None,
        "date_to": max(all_times) if all_times else None,
    }

    logger.info(
        f"[StaffAnalysis] Collected {total_collected}/{total_available} responses "
        f"from {len(staff_responses)}/{staff_count} staff members"
    )

    return logs_text, meta


def format_staff_responses(staff_responses: Dict[str, List[StaffResponseLog]]) -> str:
    """직원별로 응답 로그 포맷팅"""
    parts = []

    for staff_name, responses in staff_responses.items():
        header = f"### 직원: {staff_name} ({len(responses)}건)\n\n"

        lines = []
        for r in responses:
            date_str = r.created_at.strftime("%m/%d %H:%M") if r.created_at else "??/??"
            intent = r.customer_intent or "unknown"
            customer_text = (r.customer_text_snippet or "").replace("\n", " ")[:80]
            response_text = (r.response_text_snippet or "").replace("\n", " ")[:150]
            delay = f"{r.response_delay_sec}초" if r.response_delay_sec is not None else "N/A"

            lines.append(
                f"[{date_str}] 고객({intent}): {customer_text} → 직원 응답: {response_text} (지연: {delay})"
            )

        parts.append(header + "\n".join(lines))

    return "\n\n---\n\n".join(parts)

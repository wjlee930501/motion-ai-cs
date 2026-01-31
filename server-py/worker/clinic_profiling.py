"""
병원(고객) 프로파일링 — 성향 분석 및 누적

LLMAnnotation + Ticket 데이터를 기반으로 각 병원의 응대 성향을 분석하고
ClinicProfile 테이블에 저장한다.

학습 사이클 종료 후 또는 독립 스케줄로 실행.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from shared.database import SessionLocal
from shared.models import (
    Ticket,
    LLMAnnotation,
    TicketEventLink,
    MessageEvent,
    ClinicProfile,
    TopicKnowledge,
    StaffResponseLog,
)

logger = logging.getLogger(__name__)

# 성향 레이블 기준
DEMANDING_THRESHOLD = 0.6  # complaint_ratio >= 0.15 OR urgency_avg >= 0.6
FRIENDLY_THRESHOLD = 0.7   # sentiment_avg >= 0.7 AND complaint_ratio < 0.05

# Sentiment 값을 0~1 점수로 변환
SENTIMENT_SCORES = {
    "positive": 1.0,
    "neutral": 0.5,
    "negative": 0.2,
    "angry": 0.0,
}

# Urgency 값을 0~1 점수로 변환
URGENCY_SCORES = {
    "low": 0.0,
    "medium": 0.33,
    "high": 0.66,
    "critical": 1.0,
}

# Complaint intents
COMPLAINT_INTENTS = {"complaint", "follow_up"}

# Escalation intents (재촉, 반복 문의)
ESCALATION_INTENTS = {"follow_up", "inquiry_status"}


def compute_clinic_profiles(db: Session) -> int:
    """
    모든 병원의 프로파일을 계산/갱신한다.

    Returns: 갱신된 프로파일 수
    """
    # 1. 활성 병원 목록 (최근 90일 이내 활동)
    cutoff = datetime.utcnow() - timedelta(days=90)
    active_clinics = (
        db.query(Ticket.clinic_key)
        .filter(Ticket.updated_at >= cutoff)
        .group_by(Ticket.clinic_key)
        .all()
    )

    updated_count = 0
    for (clinic_key,) in active_clinics:
        try:
            _compute_single_clinic(db, clinic_key, cutoff)
            updated_count += 1
        except Exception as e:
            logger.error(f"[ClinicProfile] Failed for {clinic_key}: {e}")

    db.commit()
    logger.info(f"[ClinicProfile] Updated {updated_count} clinic profiles")
    return updated_count


def _compute_single_clinic(db: Session, clinic_key: str, cutoff: datetime):
    """단일 병원 프로파일 계산"""

    # 1. 해당 병원의 고객 메시지 annotation 조회
    annotations = (
        db.query(LLMAnnotation)
        .join(TicketEventLink, TicketEventLink.event_id == LLMAnnotation.target_id)
        .join(Ticket, Ticket.ticket_id == TicketEventLink.ticket_id)
        .filter(
            Ticket.clinic_key == clinic_key,
            LLMAnnotation.target_type == "event",
            LLMAnnotation.created_at >= cutoff,
        )
        .all()
    )

    if not annotations:
        return

    total = len(annotations)

    # 2. Sentiment 평균
    sentiment_scores = []
    for a in annotations:
        if a.sentiment and a.sentiment in SENTIMENT_SCORES:
            sentiment_scores.append(SENTIMENT_SCORES[a.sentiment])
    sentiment_avg = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0.5

    # 3. Complaint 비율
    complaint_count = sum(1 for a in annotations if a.intent in COMPLAINT_INTENTS)
    complaint_ratio = complaint_count / total

    # 4. Urgency 평균
    urgency_scores = []
    for a in annotations:
        if a.urgency and a.urgency in URGENCY_SCORES:
            urgency_scores.append(URGENCY_SCORES[a.urgency])
    urgency_avg = sum(urgency_scores) / len(urgency_scores) if urgency_scores else 0.33

    # 5. Escalation 경향 (재촉/상태문의 비율)
    escalation_count = sum(1 for a in annotations if a.intent in ESCALATION_INTENTS)
    escalation_tendency = escalation_count / total

    # 6. Recontact rate (해결 후 재문의 비율)
    tickets = (
        db.query(Ticket)
        .filter(Ticket.clinic_key == clinic_key, Ticket.updated_at >= cutoff)
        .all()
    )
    total_tickets = len(tickets)
    unresolved_tickets = sum(1 for t in tickets if t.resolution_status == "unresolved")
    recontact_rate = unresolved_tickets / total_tickets if total_tickets > 0 else 0

    # 7. Profile label
    profile_label = _determine_label(sentiment_avg, complaint_ratio, urgency_avg, escalation_tendency)

    # 8. Upsert
    profile = db.query(ClinicProfile).filter(ClinicProfile.clinic_key == clinic_key).first()
    if not profile:
        profile = ClinicProfile(clinic_key=clinic_key)
        db.add(profile)

    profile.sentiment_avg = round(sentiment_avg, 2)
    profile.complaint_ratio = round(complaint_ratio, 2)
    profile.urgency_avg = round(urgency_avg, 2)
    profile.escalation_tendency = round(escalation_tendency, 2)
    profile.recontact_rate = round(recontact_rate, 2)
    profile.profile_label = profile_label
    profile.total_interactions = total
    profile.total_tickets = total_tickets
    profile.last_analyzed_at = datetime.utcnow()


def _determine_label(sentiment_avg: float, complaint_ratio: float,
                     urgency_avg: float, escalation_tendency: float) -> str:
    """성향 레이블 결정"""
    # Demanding: 불만 비율 높거나 긴급도 높거나 재촉 많음
    demanding_score = (
        (1 if complaint_ratio >= 0.15 else 0) +
        (1 if urgency_avg >= 0.6 else 0) +
        (1 if escalation_tendency >= 0.15 else 0) +
        (1 if sentiment_avg < 0.35 else 0)
    )
    if demanding_score >= 2:
        return "demanding"

    # Friendly: 감정 긍정적이고 불만 적음
    if sentiment_avg >= FRIENDLY_THRESHOLD and complaint_ratio < 0.05:
        return "friendly"

    return "neutral"


def evaluate_response_highlights(db: Session) -> int:
    """
    우수 응대 자동 하이라이트.

    기준 (모두 충족 시):
    - 1~2회 내 해결 (response_position <= 2, 해당 ticket이 resolved)
    - 빠른 응답 (response_delay_sec < 180초)
    - 아직 하이라이트 안 된 응답

    Returns: 하이라이트된 응대 수
    """
    from shared.models import StaffResponseLog

    cutoff = datetime.utcnow() - timedelta(days=30)

    # 아직 하이라이트 안 된 응답 중 resolved ticket에 연결된 것
    candidates = (
        db.query(StaffResponseLog)
        .join(Ticket, Ticket.ticket_id == StaffResponseLog.ticket_id)
        .filter(
            StaffResponseLog.is_highlighted == False,
            StaffResponseLog.created_at >= cutoff,
            StaffResponseLog.response_position <= 2,
            StaffResponseLog.response_delay_sec.isnot(None),
            StaffResponseLog.response_delay_sec < 180,
            Ticket.resolution_status == "resolved",
        )
        .limit(100)
        .all()
    )

    highlighted = 0
    for resp in candidates:
        reasons = []
        if resp.response_position == 1:
            reasons.append("1회 응대 해결")
        else:
            reasons.append("2회 내 해결")
        if resp.response_delay_sec < 60:
            reasons.append("초고속 응답")
        elif resp.response_delay_sec < 180:
            reasons.append("빠른 응답")
        reasons.append("고객 문제 해결됨")

        resp.is_highlighted = True
        resp.highlight_reason = " + ".join(reasons)
        highlighted += 1

    if highlighted > 0:
        db.commit()
        logger.info(f"[Highlight] Marked {highlighted} excellent responses")

    return highlighted


def extract_topic_knowledge(db: Session) -> int:
    """
    해결된 대화에서 토픽별 지식 추출.

    resolved 티켓에서 토픽별로:
    - 가장 흔한 고객 문의 패턴 (customer_text_snippet)
    - 해결에 성공한 직원 응답 패턴 (response_text_snippet)
    - 해결률, 발생 횟수

    Returns: 갱신된 토픽 지식 수
    """
    cutoff = datetime.utcnow() - timedelta(days=90)

    # 토픽별 통계
    topic_stats = (
        db.query(
            Ticket.topic_primary,
            func.count(Ticket.ticket_id).label("total"),
            func.count(Ticket.ticket_id)
            .filter(Ticket.resolution_status == "resolved")
            .label("resolved"),
        )
        .filter(
            Ticket.topic_primary.isnot(None),
            Ticket.updated_at >= cutoff,
        )
        .group_by(Ticket.topic_primary)
        .having(func.count(Ticket.ticket_id) >= 3)
        .all()
    )

    updated = 0
    for row in topic_stats:
        topic = row.topic_primary
        total = row.total
        resolved = row.resolved
        resolution_rate = round(resolved / total, 2) if total > 0 else 0

        # 해결된 티켓에서 대표 대화 추출 (직원 응답 중 가장 흔한 패턴)
        representative = (
            db.query(StaffResponseLog)
            .join(Ticket, Ticket.ticket_id == StaffResponseLog.ticket_id)
            .filter(
                Ticket.topic_primary == topic,
                Ticket.resolution_status == "resolved",
                StaffResponseLog.response_position == 1,
                StaffResponseLog.customer_text_snippet.isnot(None),
                StaffResponseLog.response_text_snippet.isnot(None),
                StaffResponseLog.created_at >= cutoff,
            )
            .order_by(StaffResponseLog.response_delay_sec.asc())
            .limit(3)
            .all()
        )

        if not representative:
            continue

        # 대표 대화 구성
        pattern_parts = []
        resolution_parts = []
        example_lines = []
        for resp in representative:
            if resp.customer_text_snippet:
                pattern_parts.append(resp.customer_text_snippet)
            if resp.response_text_snippet:
                resolution_parts.append(resp.response_text_snippet)
            example_lines.append(
                f"[고객] {resp.customer_text_snippet or '(없음)'}\n"
                f"[직원] {resp.response_text_snippet or '(없음)'}"
            )

        pattern_summary = " / ".join(pattern_parts[:3]) if pattern_parts else ""
        resolution_summary = " / ".join(resolution_parts[:3]) if resolution_parts else ""
        example_conversation = "\n---\n".join(example_lines[:3])

        # Upsert
        existing = (
            db.query(TopicKnowledge)
            .filter(TopicKnowledge.topic == topic)
            .first()
        )
        if existing:
            existing.pattern_summary = pattern_summary
            existing.resolution_summary = resolution_summary
            existing.example_conversation = example_conversation
            existing.occurrence_count = total
            existing.resolution_success_rate = resolution_rate
        else:
            knowledge = TopicKnowledge(
                topic=topic,
                pattern_summary=pattern_summary,
                resolution_summary=resolution_summary,
                example_conversation=example_conversation,
                occurrence_count=total,
                resolution_success_rate=resolution_rate,
            )
            db.add(knowledge)

        updated += 1

    if updated > 0:
        db.commit()
        logger.info(f"[TopicKnowledge] Updated {updated} topic entries")

    return updated


def run_clinic_profiling():
    """독립 실행용 진입점 — 프로파일링 + 하이라이트 + 토픽 지식"""
    db = SessionLocal()
    try:
        count = compute_clinic_profiles(db)
        logger.info(f"[ClinicProfile] Completed: {count} profiles updated")

        highlight_count = evaluate_response_highlights(db)
        logger.info(f"[Highlight] Completed: {highlight_count} responses highlighted")

        topic_count = extract_topic_knowledge(db)
        logger.info(f"[TopicKnowledge] Completed: {topic_count} topics updated")

        return count
    except Exception as e:
        logger.error(f"[ClinicProfile] Failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

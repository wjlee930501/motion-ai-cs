import uuid
import os
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    Numeric,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, CHAR
from .database import Base, DATABASE_URL


# Custom UUID type that works with SQLite
class GUID(TypeDecorator):
    """Platform-independent GUID type."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return value
        else:
            return str(value) if isinstance(value, uuid.UUID) else value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        elif isinstance(value, uuid.UUID):
            return value
        else:
            return uuid.UUID(value)


# Use JSON for SQLite, JSON for PostgreSQL
def get_json_type():
    """Returns JSON type compatible with current database."""
    return JSON


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(Text, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    role = Column(Text, nullable=False, default="member")  # admin, member
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


class MessageEvent(Base):
    __tablename__ = "message_event"

    event_id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    device_id = Column(Text, nullable=False)
    chat_room = Column(Text, nullable=False)
    sender_name = Column(Text, nullable=False)
    sender_type = Column(Text, nullable=False)  # 'staff' or 'customer'
    staff_member = Column(Text, nullable=True)
    direction = Column(Text, nullable=False)  # 'inbound' or 'outbound'
    text_raw = Column(Text, nullable=False)
    text_hash = Column(Text, nullable=False)
    bucket_ts = Column(DateTime(timezone=True), nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=False)
    metadata_json = Column(JSON, nullable=True)
    ingest_status = Column(Text, nullable=False, default="received")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    ticket_links = relationship("TicketEventLink", back_populates="event")
    annotations = relationship(
        "LLMAnnotation",
        primaryjoin="and_(MessageEvent.event_id==foreign(LLMAnnotation.target_id), "
        "LLMAnnotation.target_type=='event')",
        viewonly=True,
    )

    __table_args__ = (
        CheckConstraint("sender_type IN ('staff', 'customer')", name="ck_sender_type"),
        CheckConstraint("direction IN ('inbound', 'outbound')", name="ck_direction"),
        Index("ux_message_event_dedup_v2", "text_hash", "bucket_ts", unique=True),
        Index("ix_message_event_room_time", "chat_room", "received_at"),
        Index("ix_message_event_sender_type_time", "sender_type", "received_at"),
        Index("ix_message_event_created", "created_at"),
    )


class Ticket(Base):
    __tablename__ = "ticket"

    ticket_id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    clinic_key = Column(Text, nullable=False)
    status = Column(
        Text, nullable=False, default="onboarding"
    )  # onboarding, stable, churn_risk, important
    priority = Column(
        Text, nullable=False, default="normal"
    )  # low, normal, high, urgent
    topic_primary = Column(Text, nullable=True)
    summary_latest = Column(Text, nullable=True)
    next_action = Column(Text, nullable=True)
    first_inbound_at = Column(DateTime(timezone=True), nullable=True)
    first_response_sec = Column(Integer, nullable=True)
    last_inbound_at = Column(DateTime(timezone=True), nullable=True)
    last_outbound_at = Column(DateTime(timezone=True), nullable=True)
    last_message_sender = Column(Text, nullable=True)  # 마지막 메시지 발송자 이름
    intent = Column(Text, nullable=True)  # 고객 메시지 의도 (질문/요청/자료전송/기타)
    needs_reply = Column(
        Boolean, nullable=False, default=True
    )  # 답변이 필요한 상태인지 (LLM 판단 기반)
    sla_breached = Column(Boolean, nullable=False, default=False)
    sla_alerted_at = Column(DateTime(timezone=True), nullable=True)
    # 해결 추적
    resolution_status = Column(
        Text, nullable=True
    )  # resolved, unresolved, escalated (null = 미결정)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    event_links = relationship(
        "TicketEventLink", back_populates="ticket", cascade="all, delete-orphan"
    )
    alerts = relationship(
        "SLAAlertLog", back_populates="ticket", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('onboarding', 'stable', 'churn_risk', 'important')",
            name="ck_ticket_status",
        ),
        CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')", name="ck_ticket_priority"
        ),
        Index("ix_ticket_clinic_status", "clinic_key", "status"),
        Index("ix_ticket_status", "status"),
        Index(
            "ix_ticket_sla_breached",
            "sla_breached",
            postgresql_where="sla_breached = TRUE",
        ),
        Index("ix_ticket_updated", "updated_at"),
        Index("ix_ticket_first_inbound", "first_inbound_at"),
        Index("ix_ticket_resolution", "resolution_status"),
    )


class TicketEventLink(Base):
    __tablename__ = "ticket_event_link"

    ticket_id = Column(
        GUID(), ForeignKey("ticket.ticket_id", ondelete="CASCADE"), primary_key=True
    )
    event_id = Column(
        GUID(),
        ForeignKey("message_event.event_id", ondelete="CASCADE"),
        primary_key=True,
    )
    link_type = Column(Text, nullable=False, default="append")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    ticket = relationship("Ticket", back_populates="event_links")
    event = relationship("MessageEvent", back_populates="ticket_links")


class LLMAnnotation(Base):
    __tablename__ = "llm_annotation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_type = Column(Text, nullable=False)  # 'event' or 'ticket'
    target_id = Column(GUID(), nullable=False)
    model = Column(Text, nullable=False)
    topic = Column(Text, nullable=True)
    urgency = Column(Text, nullable=True)
    sentiment = Column(Text, nullable=True)
    intent = Column(Text, nullable=True)
    needs_reply = Column(Boolean, nullable=True)  # 답변이 필요한 메시지인지
    summary = Column(Text, nullable=True)
    confidence = Column(Numeric, nullable=True)
    raw_response = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "target_type IN ('event', 'ticket')", name="ck_llm_target_type"
        ),
        Index("ix_llm_target", "target_type", "target_id"),
        Index("ix_llm_created", "created_at"),
    )


class DeviceHeartbeat(Base):
    __tablename__ = "device_heartbeat"

    device_id = Column(Text, primary_key=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class SLAAlertLog(Base):
    __tablename__ = "sla_alert_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(
        GUID(), ForeignKey("ticket.ticket_id", ondelete="CASCADE"), nullable=False
    )
    alert_type = Column(Text, nullable=False, default="slack")
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    response_status = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    ticket = relationship("Ticket", back_populates="alerts")

    __table_args__ = (Index("ix_sla_alert_ticket", "ticket_id"),)


class CSUnderstanding(Base):
    """LLM이 형성한 CS 이해를 버전별로 저장"""

    __tablename__ = "cs_understanding"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    version = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # 분석 메타데이터
    logs_analyzed_count = Column(Integer, nullable=True)
    logs_date_from = Column(DateTime(timezone=True), nullable=True)
    logs_date_to = Column(DateTime(timezone=True), nullable=True)

    # LLM 이해 내용
    understanding_text = Column(Text, nullable=False)
    key_insights = Column(JSON, nullable=True)  # 선택적 구조화

    # LLM 메타
    model_used = Column(Text, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)

    # 정확도 추적
    accuracy_score = Column(Numeric, nullable=True)  # 1 - correction_rate
    auto_approved_patterns_count = Column(Integer, nullable=True, default=0)

    __table_args__ = (
        Index("ix_cs_understanding_version", "version"),
        Index("ix_cs_understanding_created", "created_at"),
    )


class LearningExecution(Base):
    """학습 사이클 실행 기록"""

    __tablename__ = "learning_execution"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    executed_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    status = Column(Text, nullable=False)  # success, failed, partial
    trigger_type = Column(Text, nullable=True)  # scheduled, manual
    duration_seconds = Column(Integer, nullable=True)
    understanding_version = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('success', 'failed', 'partial')", name="ck_learning_status"
        ),
        Index("ix_learning_execution_at", "executed_at"),
    )


class MessageTemplate(Base):
    """CS 응답 템플릿"""

    __tablename__ = "message_template"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(Text, nullable=False)  # 템플릿 제목 (검색용)
    content = Column(Text, nullable=False)  # 템플릿 내용
    category = Column(
        Text, nullable=False, default="기타"
    )  # 인사, 안내, 문제해결, 마무리, 기타
    usage_count = Column(
        Integer, nullable=False, default=0
    )  # 사용 횟수 (인기순 정렬용)
    created_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "category IN ('인사', '안내', '문제해결', '마무리', '기타')",
            name="ck_template_category",
        ),
        Index("ix_template_category", "category"),
        Index("ix_template_usage", "usage_count"),
    )


class Notification(Base):
    """사용자 알림"""

    __tablename__ = "notification"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )  # null = 전체 사용자
    type = Column(Text, nullable=False)  # sla_breach, urgent_ticket, system, info
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(Text, nullable=True)  # 클릭 시 이동할 경로 (예: /tickets?id=xxx)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "type IN ('sla_breach', 'urgent_ticket', 'system', 'info')",
            name="ck_notification_type",
        ),
        Index("ix_notification_user_read", "user_id", "is_read"),
        Index("ix_notification_created", "created_at"),
    )


class ClassificationFeedback(Base):
    """분류 피드백 - 운영자가 LLM 분류 결과를 수정한 기록"""

    __tablename__ = "classification_feedback"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)

    # 원본 분류 정보
    event_id = Column(
        GUID(), ForeignKey("message_event.event_id", ondelete="CASCADE"), nullable=False
    )
    ticket_id = Column(
        GUID(), ForeignKey("ticket.ticket_id", ondelete="CASCADE"), nullable=False
    )

    # 원본 LLM 분류 결과
    original_intent = Column(Text, nullable=False)
    original_needs_reply = Column(Boolean, nullable=False)
    original_topic = Column(Text, nullable=True)
    original_confidence = Column(Numeric(3, 2), nullable=True)

    # 수정된 분류
    corrected_intent = Column(Text, nullable=True)
    corrected_needs_reply = Column(Boolean, nullable=True)
    corrected_topic = Column(Text, nullable=True)

    # 메타데이터
    feedback_type = Column(
        Text, nullable=False, default="correction"
    )  # correction, confirmation, rejection
    corrected_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    corrected_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # 학습 반영 여부
    applied_to_version = Column(Integer, nullable=True)  # 어느 학습 버전에 반영되었는지

    __table_args__ = (
        CheckConstraint(
            "feedback_type IN ('correction', 'confirmation', 'rejection')",
            name="ck_feedback_type",
        ),
        Index("ix_feedback_event", "event_id"),
        Index("ix_feedback_ticket", "ticket_id"),
        Index("ix_feedback_corrected_at", "corrected_at"),
    )


class StaffResponseLog(Base):
    """직원 응답 패턴 수집 로그 — 직원이 고객 문의에 어떻게 응답하는지 기록"""

    __tablename__ = "staff_response_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(
        GUID(), ForeignKey("message_event.event_id", ondelete="CASCADE"), nullable=False
    )
    ticket_id = Column(
        GUID(), ForeignKey("ticket.ticket_id", ondelete="CASCADE"), nullable=False
    )
    staff_member = Column(Text, nullable=False)  # 직원 이름 (예: '이우진')
    clinic_key = Column(Text, nullable=False)  # 채팅방 (병원)

    # 응답 컨텍스트
    responding_to_event_id = Column(
        GUID(), ForeignKey("message_event.event_id", ondelete="SET NULL"), nullable=True
    )  # 직전 고객 메시지
    customer_text_snippet = Column(Text, nullable=True)  # 고객 메시지 앞 100자
    customer_intent = Column(Text, nullable=True)  # LLM 분류 의도
    customer_topic = Column(Text, nullable=True)  # 고객 메시지 주제

    # 응답 메타데이터
    response_text_snippet = Column(Text, nullable=True)  # 직원 응답 앞 200자
    response_delay_sec = Column(Integer, nullable=True)  # 응답까지 걸린 초
    response_position = Column(Integer, nullable=False, default=1)  # 대화 내 몇 번째 직원 응답
    message_length = Column(Integer, nullable=False, default=0)  # 응답 메시지 길이

    # 우수 응대 하이라이트
    is_highlighted = Column(Boolean, nullable=False, default=False)
    highlight_reason = Column(Text, nullable=True)  # 예: "1회 해결 + 빠른 응답 + 긍정 종료"

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        Index("ix_staff_response_staff_member", "staff_member"),
        Index("ix_staff_response_clinic", "clinic_key"),
        Index("ix_staff_response_created", "created_at"),
        Index("ix_staff_response_ticket", "ticket_id"),
        Index(
            "ix_staff_response_highlighted",
            "is_highlighted",
            postgresql_where="is_highlighted = TRUE",
        ),
    )


class PatternApplicationLog(Base):
    """패턴 적용 로그 - 학습에서 추출된 패턴의 승인/적용 이력"""

    __tablename__ = "pattern_application_log"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)

    # 어느 학습에서 추출되었는지
    understanding_version = Column(Integer, nullable=False)

    # 패턴 정보
    pattern_type = Column(
        Text, nullable=False
    )  # skip_llm, internal_marker, confirmation, new_intent
    pattern_data = Column(JSON, nullable=False)

    # 적용 상태
    status = Column(
        Text, nullable=False, default="pending"
    )  # pending, approved, rejected, applied
    reviewed_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)

    # 적용 결과
    application_result = Column(JSON, nullable=True)

    # 자동 승인 여부
    auto_approved = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "pattern_type IN ('skip_llm', 'internal_marker', 'confirmation', 'new_intent')",
            name="ck_pattern_type",
        ),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'applied')",
            name="ck_pattern_status",
        ),
        Index("ix_pattern_status", "status"),
        Index("ix_pattern_version", "understanding_version"),
        Index("ix_pattern_created", "created_at"),
    )


class StaffResponseAnalysis(Base):
    """직원 응답 품질 LLM 분석 결과"""

    __tablename__ = "staff_response_analysis"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    version = Column(Integer, nullable=False, unique=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # 분석 메타데이터
    responses_analyzed_count = Column(Integer, nullable=True)
    date_from = Column(DateTime(timezone=True), nullable=True)
    date_to = Column(DateTime(timezone=True), nullable=True)
    staff_members_analyzed = Column(Integer, nullable=True)

    # LLM 분석 내용
    analysis_text = Column(Text, nullable=False)  # 서술형 분석
    insights = Column(JSON, nullable=True)  # 구조화된 인사이트

    # LLM 메타
    model_used = Column(Text, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_staff_analysis_version", "version"),
        Index("ix_staff_analysis_created", "created_at"),
    )


class StaffAnalysisExecution(Base):
    """직원 응답 분석 실행 기록"""

    __tablename__ = "staff_analysis_execution"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    executed_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    status = Column(Text, nullable=False)  # success, failed, partial
    trigger_type = Column(Text, nullable=True)  # scheduled, manual
    duration_seconds = Column(Integer, nullable=True)
    analysis_version = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('success', 'failed', 'partial')",
            name="ck_staff_analysis_exec_status",
        ),
        Index("ix_staff_analysis_exec_at", "executed_at"),
    )


class ClinicProfile(Base):
    """병원(고객) 성향 프로파일 — 응대 톤, 까다로움 수준, 이력 누적"""

    __tablename__ = "clinic_profile"

    clinic_key = Column(Text, primary_key=True)  # 채팅방 이름 = 병원 식별

    # 성향 지표 (0.0 ~ 1.0 정규화)
    sentiment_avg = Column(Numeric(3, 2), nullable=True)  # 평균 감정 (0=negative, 1=positive)
    complaint_ratio = Column(Numeric(3, 2), nullable=True)  # complaint intent 비율
    urgency_avg = Column(Numeric(3, 2), nullable=True)  # 평균 긴급도 (0=low, 1=critical)
    escalation_tendency = Column(Numeric(3, 2), nullable=True)  # 재촉/에스컬레이션 빈도
    recontact_rate = Column(Numeric(3, 2), nullable=True)  # 같은 토픽 재문의 비율

    # 종합 레이블
    profile_label = Column(Text, nullable=True)  # demanding, neutral, friendly

    # 통계
    total_interactions = Column(Integer, nullable=False, default=0)
    total_tickets = Column(Integer, nullable=False, default=0)

    # 메타
    last_analyzed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_clinic_profile_label", "profile_label"),
    )


class TopicKnowledge(Base):
    """토픽별 축적된 해결 지식 — 원인→해결책 패턴"""

    __tablename__ = "topic_knowledge"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    topic = Column(Text, nullable=False)  # 주제 (발송/전송 문제, 예약 관련 등)

    # 지식 내용
    pattern_summary = Column(Text, nullable=False)  # 흔한 문제/원인 요약
    resolution_summary = Column(Text, nullable=False)  # 일반적 해결 방법
    example_conversation = Column(Text, nullable=True)  # 대표 대화 예시 (익명화)

    # 통계
    occurrence_count = Column(Integer, nullable=False, default=1)  # 해당 패턴 발생 횟수
    resolution_success_rate = Column(Numeric(3, 2), nullable=True)  # 해결 성공률

    # 출처
    source_version = Column(Integer, nullable=True)  # 어느 학습 버전에서 추출

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_topic_knowledge_topic", "topic"),
        Index("ix_topic_knowledge_occurrence", "occurrence_count"),
    )

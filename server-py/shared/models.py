import uuid
import os
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Numeric,
    DateTime, ForeignKey, Index, CheckConstraint, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, CHAR
from .database import Base, DATABASE_URL


# Custom UUID type that works with SQLite
class GUID(TypeDecorator):
    """Platform-independent GUID type."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(GUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
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
    if DATABASE_URL.startswith("sqlite"):
        return JSON
    return JSON


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(Text, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


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
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    ticket_links = relationship("TicketEventLink", back_populates="event")
    annotations = relationship("LLMAnnotation",
                               primaryjoin="and_(MessageEvent.event_id==foreign(LLMAnnotation.target_id), "
                                          "LLMAnnotation.target_type=='event')",
                               viewonly=True)

    __table_args__ = (
        CheckConstraint("sender_type IN ('staff', 'customer')", name="ck_sender_type"),
        CheckConstraint("direction IN ('inbound', 'outbound')", name="ck_direction"),
        Index("ux_message_event_dedup", "text_hash", "bucket_ts", unique=True),
        Index("ix_message_event_room_time", "chat_room", "received_at"),
        Index("ix_message_event_sender_type_time", "sender_type", "received_at"),
        Index("ix_message_event_created", "created_at"),
    )


class Ticket(Base):
    __tablename__ = "ticket"

    ticket_id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    clinic_key = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="new")  # new, in_progress, waiting, done
    priority = Column(Text, nullable=False, default="normal")  # low, normal, high, urgent
    topic_primary = Column(Text, nullable=True)
    summary_latest = Column(Text, nullable=True)
    next_action = Column(Text, nullable=True)
    first_inbound_at = Column(DateTime(timezone=True), nullable=True)
    first_response_sec = Column(Integer, nullable=True)
    last_inbound_at = Column(DateTime(timezone=True), nullable=True)
    last_outbound_at = Column(DateTime(timezone=True), nullable=True)
    sla_breached = Column(Boolean, nullable=False, default=False)
    sla_alerted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    event_links = relationship("TicketEventLink", back_populates="ticket", cascade="all, delete-orphan")
    alerts = relationship("SLAAlertLog", back_populates="ticket", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("status IN ('new', 'in_progress', 'waiting', 'done')", name="ck_ticket_status"),
        CheckConstraint("priority IN ('low', 'normal', 'high', 'urgent')", name="ck_ticket_priority"),
        Index("ix_ticket_clinic_status", "clinic_key", "status"),
        Index("ix_ticket_status", "status"),
        Index("ix_ticket_sla_breached", "sla_breached", postgresql_where="sla_breached = TRUE"),
        Index("ix_ticket_updated", "updated_at"),
        Index("ix_ticket_first_inbound", "first_inbound_at"),
    )


class TicketEventLink(Base):
    __tablename__ = "ticket_event_link"

    ticket_id = Column(GUID(), ForeignKey("ticket.ticket_id", ondelete="CASCADE"), primary_key=True)
    event_id = Column(GUID(), ForeignKey("message_event.event_id", ondelete="CASCADE"), primary_key=True)
    link_type = Column(Text, nullable=False, default="append")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

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
    summary = Column(Text, nullable=True)
    confidence = Column(Numeric, nullable=True)
    raw_response = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("target_type IN ('event', 'ticket')", name="ck_llm_target_type"),
        Index("ix_llm_target", "target_type", "target_id"),
        Index("ix_llm_created", "created_at"),
    )


class DeviceHeartbeat(Base):
    __tablename__ = "device_heartbeat"

    device_id = Column(Text, primary_key=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class SLAAlertLog(Base):
    __tablename__ = "sla_alert_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(GUID(), ForeignKey("ticket.ticket_id", ondelete="CASCADE"), nullable=False)
    alert_type = Column(Text, nullable=False, default="slack")
    sent_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    response_status = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    ticket = relationship("Ticket", back_populates="alerts")

    __table_args__ = (
        Index("ix_sla_alert_ticket", "ticket_id"),
    )

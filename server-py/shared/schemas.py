from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================
# Common
# ============================================

class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    ok: bool = False
    error: ErrorDetail


# ============================================
# Ingest API - Events
# ============================================

class EventMetadata(BaseModel):
    title: Optional[str] = None
    subtext: Optional[str] = None
    is_group: Optional[bool] = None


class EventCreate(BaseModel):
    device_id: str
    package: str = "com.kakao.talk"
    chat_room: str
    sender_name: str
    text: str
    received_at: datetime
    notification_id: Optional[str] = None
    metadata: Optional[EventMetadata] = None


class EventResponse(BaseModel):
    ok: bool = True
    event_id: UUID
    deduped: bool = False


# ============================================
# Ingest API - Heartbeat
# ============================================

class HeartbeatRequest(BaseModel):
    device_id: str
    ts: datetime


class HeartbeatResponse(BaseModel):
    ok: bool = True


# ============================================
# Dashboard API - Auth
# ============================================

class LoginRequest(BaseModel):
    email: str
    password: str


class UserInfo(BaseModel):
    id: int
    email: str
    name: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    ok: bool = True
    token: str
    user: UserInfo


# ============================================
# Dashboard API - Users
# ============================================

class UserCreate(BaseModel):
    email: str
    password: str
    name: str


class UserResponse(BaseModel):
    ok: bool = True
    user: UserInfo


class UserListResponse(BaseModel):
    ok: bool = True
    users: list[UserInfo]


# ============================================
# Dashboard API - Tickets
# ============================================

class TicketItem(BaseModel):
    ticket_id: UUID
    clinic_key: str
    status: str
    priority: str
    topic_primary: Optional[str] = None
    summary_latest: Optional[str] = None
    first_inbound_at: Optional[datetime] = None
    last_inbound_at: Optional[datetime] = None
    sla_breached: bool
    sla_remaining_sec: Optional[int] = None

    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    ok: bool = True
    tickets: list[TicketItem]
    total: int
    page: int


class TicketDetail(BaseModel):
    ticket_id: UUID
    clinic_key: str
    status: str
    priority: str
    topic_primary: Optional[str] = None
    summary_latest: Optional[str] = None
    next_action: Optional[str] = None
    first_inbound_at: Optional[datetime] = None
    first_response_sec: Optional[int] = None
    last_inbound_at: Optional[datetime] = None
    last_outbound_at: Optional[datetime] = None
    sla_breached: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    ok: bool = True
    ticket: TicketDetail


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    next_action: Optional[str] = None


# ============================================
# Dashboard API - Ticket Events
# ============================================

class TicketEventItem(BaseModel):
    event_id: UUID
    sender_name: str
    sender_type: str
    staff_member: Optional[str] = None
    text_raw: str
    received_at: datetime

    class Config:
        from_attributes = True


class TicketEventResponse(BaseModel):
    ok: bool = True
    events: list[TicketEventItem]


# ============================================
# Dashboard API - Metrics
# ============================================

class MetricsData(BaseModel):
    today_inbound: int
    sla_breached_count: int
    urgent_count: int
    open_tickets: int
    avg_response_sec: Optional[int] = None


class MetricsResponse(BaseModel):
    ok: bool = True
    metrics: MetricsData


class ClinicHealth(BaseModel):
    clinic_key: str
    today_inbound: int
    sla_breached: int
    urgent_count: int
    open_tickets: int


class ClinicHealthResponse(BaseModel):
    ok: bool = True
    clinics: list[ClinicHealth]


# ============================================
# LLM Classification
# ============================================

class LLMClassificationResult(BaseModel):
    topic: str
    urgency: str  # critical, high, medium, low
    sentiment: str  # positive, neutral, negative, angry
    intent: str  # support_request, complaint, inquiry, feedback, greeting, other
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)


class LLMTicketSummaryResult(BaseModel):
    summary: str
    next_action: str
    overall_urgency: str

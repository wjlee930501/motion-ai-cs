import os
import httpx
import threading
from uuid import UUID
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, case

from shared.database import get_db, engine, Base
from shared.models import (
    User,
    Ticket,
    MessageEvent,
    TicketEventLink,
    LLMAnnotation,
    CSUnderstanding,
    LearningExecution,
    Notification,
    MessageTemplate,
    ClassificationFeedback,
    PatternApplicationLog,
)
from shared.schemas import (
    LoginRequest,
    LoginResponse,
    UserInfo,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    UserDeleteResponse,
    TicketItem,
    TicketListResponse,
    TicketDetail,
    TicketResponse,
    TicketUpdate,
    TicketEventItem,
    TicketEventResponse,
    MetricsData,
    MetricsResponse,
    ClinicHealth,
    ClinicHealthResponse,
    NotificationItem,
    NotificationListResponse,
    NotificationReadResponse,
    NotificationReadAllResponse,
    TemplateItem,
    TemplateListResponse,
    TemplateResponse,
    TemplateCreate,
    TemplateUpdate,
    TemplateDeleteResponse,
    TemplateCopyResponse,
    # Learning System v2 Schemas
    FeedbackCreate,
    FeedbackItem,
    FeedbackResponse,
    FeedbackListResponse,
    FeedbackStatsResponse,
    PatternItem,
    PatternListResponse,
    PatternActionResponse,
    PatternApplyResponse,
    InsightsResponse,
)
from shared.utils import get_kst_now, calculate_sla_remaining_sec
from shared.config import get_settings
from shared.migrations import run_column_migrations
from shared.constants import (
    TEMPLATE_CATEGORIES,
    TICKET_STATUSES,
    TICKET_PRIORITIES,
    USER_ROLES,
)

from .auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_admin_user,
    get_password_hash,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables if not exist
    Base.metadata.create_all(bind=engine)

    # Run migrations for new columns
    db = next(get_db())
    try:
        run_column_migrations(db)
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        db.close()

    # Create admin user if not exists, or update existing to admin role
    db = next(get_db())
    try:
        admin = db.query(User).filter(User.email == "admin").first()
        if not admin:
            admin = User(
                email="admin",
                password_hash=get_password_hash("1234"),
                name="관리자",
                role="admin",
            )
            db.add(admin)
            db.commit()
        elif admin.role != "admin":
            # Ensure existing admin account has admin role
            admin.role = "admin"
            db.commit()
    finally:
        db.close()

    yield
    # Shutdown


app = FastAPI(
    title="CS Dashboard API",
    description="Serves web dashboard for CS management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "dashboard-api"}


# ============================================
# Auth Endpoints
# ============================================


@app.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """User login"""
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "ok": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid email or password",
                },
            },
        )

    token = create_access_token(data={"sub": str(user.id)})
    return LoginResponse(
        ok=True,
        token=token,
        user=UserInfo(id=user.id, email=user.email, name=user.name, role=user.role),
    )


# ============================================
# User Endpoints (Admin Only)
# ============================================


@app.get("/v1/users", response_model=UserListResponse)
async def list_users(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """List all users (any authenticated user can view)"""
    users = db.query(User).order_by(User.id).all()
    return UserListResponse(
        ok=True,
        users=[
            UserInfo(id=u.id, email=u.email, name=u.name, role=u.role) for u in users
        ],
    )


@app.post("/v1/users", response_model=UserResponse)
async def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),  # Admin only
):
    """Create new user (admin only)"""
    # Check if email exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {"code": "DUPLICATE", "message": "Email already exists"},
            },
        )

    if request.role not in USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"Invalid role. Must be one of: {', '.join(USER_ROLES)}",
                },
            },
        )

    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.name,
        role=request.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        ok=True,
        user=UserInfo(id=user.id, email=user.email, name=user.name, role=user.role),
    )


@app.put("/v1/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    request: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),  # Admin only
):
    """Update user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "User not found"},
            },
        )

    # Prevent changing admin's own role (safety measure)
    if user.id == admin_user.id and request.role and request.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Cannot change your own admin role",
                },
            },
        )

    # Update fields
    if request.email is not None:
        # Check for duplicate email
        existing = (
            db.query(User)
            .filter(User.email == request.email, User.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "ok": False,
                    "error": {"code": "DUPLICATE", "message": "Email already exists"},
                },
            )
        user.email = request.email

    if request.password is not None:
        user.password_hash = get_password_hash(request.password)

    if request.name is not None:
        user.name = request.name

    if request.role is not None:
        if request.role not in USER_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "ok": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid role. Must be one of: {', '.join(USER_ROLES)}",
                    },
                },
            )
        user.role = request.role

    db.commit()
    db.refresh(user)

    return UserResponse(
        ok=True,
        user=UserInfo(id=user.id, email=user.email, name=user.name, role=user.role),
    )


@app.delete("/v1/users/{user_id}", response_model=UserDeleteResponse)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),  # Admin only
):
    """Delete user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "User not found"},
            },
        )

    # Prevent self-deletion
    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {"code": "FORBIDDEN", "message": "Cannot delete yourself"},
            },
        )

    # Prevent deleting the last admin
    if user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "ok": False,
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "Cannot delete the last admin user",
                    },
                },
            )

    db.delete(user)
    db.commit()
    return UserDeleteResponse(
        ok=True, message=f"User '{user.email}' deleted successfully"
    )


# ============================================
# Ticket Endpoints
# ============================================


@app.get("/v1/tickets", response_model=TicketListResponse)
async def list_tickets(
    status: Optional[str] = Query(None, description="Comma-separated statuses"),
    priority: Optional[str] = Query(None, description="Comma-separated priorities"),
    clinic_key: Optional[str] = None,
    sla_breached: Optional[bool] = None,
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tickets with filters"""
    query = db.query(Ticket)

    # Apply filters
    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.filter(Ticket.status.in_(statuses))

    if priority:
        priorities = [p.strip() for p in priority.split(",")]
        query = query.filter(Ticket.priority.in_(priorities))

    if clinic_key:
        query = query.filter(Ticket.clinic_key == clinic_key)

    if sla_breached is not None:
        query = query.filter(Ticket.sla_breached == sla_breached)

    # Get total count
    total = query.count()

    # Order: SLA breached first, then by priority, then by updated_at
    # Use CASE statement for cross-database compatibility (SQLite + PostgreSQL)
    from sqlalchemy import case

    priority_order = case(
        (Ticket.priority == "urgent", 0),
        (Ticket.priority == "high", 1),
        (Ticket.priority == "normal", 2),
        (Ticket.priority == "low", 3),
        else_=4,
    )
    query = query.order_by(
        Ticket.sla_breached.desc(), priority_order, Ticket.updated_at.desc()
    )

    # Paginate (only if limit is specified)
    if limit:
        p = page or 1
        tickets = query.offset((p - 1) * limit).limit(limit).all()
    else:
        tickets = query.all()

    # Build response with SLA remaining calculation
    ticket_items = []
    for t in tickets:
        sla_remaining = calculate_sla_remaining_sec(
            t.first_inbound_at, t.first_response_sec, settings.sla_threshold_minutes
        )
        ticket_items.append(
            TicketItem(
                ticket_id=t.ticket_id,
                clinic_key=t.clinic_key,
                status=t.status,
                priority=t.priority,
                topic_primary=t.topic_primary,
                summary_latest=t.summary_latest,
                intent=t.intent,
                first_inbound_at=t.first_inbound_at,
                last_inbound_at=t.last_inbound_at,
                last_outbound_at=t.last_outbound_at,
                last_message_sender=t.last_message_sender,
                needs_reply=t.needs_reply if t.needs_reply is not None else True,
                sla_breached=t.sla_breached,
                sla_remaining_sec=sla_remaining,
            )
        )

    return TicketListResponse(
        ok=True, tickets=ticket_items, total=total, page=page or 1
    )


@app.get("/v1/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single ticket detail"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Ticket not found"},
            },
        )

    return TicketResponse(ok=True, ticket=TicketDetail.model_validate(ticket))


@app.patch("/v1/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID,
    update: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update ticket"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Ticket not found"},
            },
        )

    if update.status is not None:
        if update.status not in TICKET_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "ok": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid status. Must be one of: {', '.join(TICKET_STATUSES)}",
                    },
                },
            )
        ticket.status = update.status

    if update.priority is not None:
        if update.priority not in TICKET_PRIORITIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "ok": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid priority. Must be one of: {', '.join(TICKET_PRIORITIES)}",
                    },
                },
            )
        ticket.priority = update.priority

    if update.next_action is not None:
        ticket.next_action = update.next_action

    if update.needs_reply is not None:
        ticket.needs_reply = update.needs_reply
        # If needs_reply is set to False, also clear SLA breach status
        if not update.needs_reply:
            ticket.sla_breached = False

    db.commit()
    db.refresh(ticket)

    return TicketResponse(ok=True, ticket=TicketDetail.model_validate(ticket))


@app.delete("/v1/tickets/{ticket_id}")
async def delete_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete ticket and related data"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Ticket not found"},
            },
        )

    # Delete related ticket_event_links
    db.query(TicketEventLink).filter(TicketEventLink.ticket_id == ticket_id).delete()

    # Delete related llm_annotations (target_type='ticket' and target_id=ticket_id)
    db.query(LLMAnnotation).filter(
        LLMAnnotation.target_type == "ticket", LLMAnnotation.target_id == ticket_id
    ).delete()

    # Delete ticket
    db.delete(ticket)
    db.commit()

    return {"ok": True, "deleted_ticket_id": str(ticket_id)}


@app.get("/v1/tickets/{ticket_id}/events", response_model=TicketEventResponse)
async def get_ticket_events(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get events (messages) linked to a ticket"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Ticket not found"},
            },
        )

    # Get linked events
    events = (
        db.query(MessageEvent)
        .join(TicketEventLink, TicketEventLink.event_id == MessageEvent.event_id)
        .filter(TicketEventLink.ticket_id == ticket_id)
        .order_by(MessageEvent.received_at.asc())
        .all()
    )

    return TicketEventResponse(
        ok=True,
        events=[
            TicketEventItem(
                event_id=e.event_id,
                sender_name=e.sender_name,
                sender_type=e.sender_type,
                staff_member=e.staff_member,
                text_raw=e.text_raw,
                received_at=e.received_at,
            )
            for e in events
        ],
    )


# ============================================
# Metrics Endpoints
# ============================================


@app.get("/v1/metrics/overview", response_model=MetricsResponse)
async def get_metrics(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get dashboard overview metrics"""
    now = get_kst_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's inbound messages
    today_inbound = (
        db.query(func.count(MessageEvent.event_id))
        .filter(
            MessageEvent.direction == "inbound", MessageEvent.received_at >= today_start
        )
        .scalar()
        or 0
    )

    # SLA breached tickets
    sla_breached_count = (
        db.query(func.count(Ticket.ticket_id))
        .filter(Ticket.sla_breached == True)
        .scalar()
        or 0
    )

    # Urgent tickets (priority = urgent, all lifecycle stages are "open")
    urgent_count = (
        db.query(func.count(Ticket.ticket_id))
        .filter(Ticket.priority == "urgent")
        .scalar()
        or 0
    )

    # Open tickets (all tickets in any lifecycle stage)
    open_tickets = db.query(func.count(Ticket.ticket_id)).scalar() or 0

    # Average response time (for tickets with responses)
    avg_response = (
        db.query(func.avg(Ticket.first_response_sec))
        .filter(Ticket.first_response_sec.isnot(None))
        .scalar()
    )

    return MetricsResponse(
        ok=True,
        metrics=MetricsData(
            today_inbound=today_inbound,
            sla_breached_count=sla_breached_count,
            urgent_count=urgent_count,
            open_tickets=open_tickets,
            avg_response_sec=int(avg_response) if avg_response else None,
        ),
    )


@app.get("/v1/clinics/health", response_model=ClinicHealthResponse)
async def get_clinics_health(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get health status per clinic"""
    now = get_kst_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get all unique clinics with tickets (all lifecycle stages are "open")
    clinics_query = (
        db.query(
            Ticket.clinic_key,
            func.count(Ticket.ticket_id).label("open_tickets"),
            func.count(Ticket.ticket_id)
            .filter(Ticket.sla_breached == True)
            .label("sla_breached"),
            func.count(Ticket.ticket_id)
            .filter(Ticket.priority == "urgent")
            .label("urgent_count"),
        )
        .group_by(Ticket.clinic_key)
        .all()
    )

    clinics = []
    for row in clinics_query:
        # Count today's inbound for this clinic
        today_inbound = (
            db.query(func.count(MessageEvent.event_id))
            .filter(
                MessageEvent.chat_room == row.clinic_key,
                MessageEvent.direction == "inbound",
                MessageEvent.received_at >= today_start,
            )
            .scalar()
            or 0
        )

        clinics.append(
            ClinicHealth(
                clinic_key=row.clinic_key,
                today_inbound=today_inbound,
                sla_breached=row.sla_breached or 0,
                urgent_count=row.urgent_count or 0,
                open_tickets=row.open_tickets or 0,
            )
        )

    # Sort by SLA breached count desc
    clinics.sort(key=lambda x: (x.sla_breached, x.urgent_count), reverse=True)

    return ClinicHealthResponse(ok=True, clinics=clinics)


# ============================================
# Learning Endpoints
# ============================================


@app.get("/v1/learning/understanding")
async def get_latest_understanding(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get latest CS understanding"""
    understanding = (
        db.query(CSUnderstanding).order_by(CSUnderstanding.version.desc()).first()
    )

    if not understanding:
        return {
            "ok": True,
            "understanding": None,
            "message": "No understanding formed yet",
        }

    # Get previous versions list
    previous_versions = (
        db.query(CSUnderstanding.version, CSUnderstanding.created_at)
        .order_by(CSUnderstanding.version.desc())
        .limit(10)
        .all()
    )

    return {
        "ok": True,
        "understanding": {
            "version": understanding.version,
            "created_at": understanding.created_at.isoformat()
            if understanding.created_at
            else None,
            "logs_analyzed_count": understanding.logs_analyzed_count,
            "logs_date_from": understanding.logs_date_from.isoformat()
            if understanding.logs_date_from
            else None,
            "logs_date_to": understanding.logs_date_to.isoformat()
            if understanding.logs_date_to
            else None,
            "understanding_text": understanding.understanding_text,
            "key_insights": understanding.key_insights,
            "model_used": understanding.model_used,
            "prompt_tokens": understanding.prompt_tokens,
            "completion_tokens": understanding.completion_tokens,
        },
        "previous_versions": [
            {
                "version": v.version,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in previous_versions
        ],
    }


@app.get("/v1/learning/understanding/{version}")
async def get_understanding_by_version(
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get specific version of CS understanding"""
    understanding = (
        db.query(CSUnderstanding).filter(CSUnderstanding.version == version).first()
    )

    if not understanding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Understanding v{version} not found",
                },
            },
        )

    return {
        "ok": True,
        "understanding": {
            "version": understanding.version,
            "created_at": understanding.created_at.isoformat()
            if understanding.created_at
            else None,
            "logs_analyzed_count": understanding.logs_analyzed_count,
            "logs_date_from": understanding.logs_date_from.isoformat()
            if understanding.logs_date_from
            else None,
            "logs_date_to": understanding.logs_date_to.isoformat()
            if understanding.logs_date_to
            else None,
            "understanding_text": understanding.understanding_text,
            "key_insights": understanding.key_insights,
            "model_used": understanding.model_used,
            "prompt_tokens": understanding.prompt_tokens,
            "completion_tokens": understanding.completion_tokens,
        },
    }


@app.post("/v1/learning/run")
async def trigger_learning_cycle(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Trigger manual learning cycle by calling Worker service"""

    # Worker service URL (Cloud Run internal or localhost for dev)
    worker_url = os.environ.get("WORKER_URL", "http://localhost:8080")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{worker_url}/learning/run")
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "ok": False,
                    "status": "error",
                    "message": f"Worker returned status {response.status_code}",
                }
    except httpx.RequestError as e:
        # Fallback: try to run locally if worker is not accessible
        print(f"[Learning] Worker not accessible ({e}), trying local execution...")
        try:
            from worker.learning import run_learning_cycle_manual

            def run_in_background():
                try:
                    run_learning_cycle_manual()
                except Exception as ex:
                    print(f"[Learning] Local run failed: {ex}")

            thread = threading.Thread(target=run_in_background, daemon=True)
            thread.start()

            return {
                "ok": True,
                "status": "started",
                "message": "Learning cycle started locally (worker not accessible)",
            }
        except Exception as local_err:
            return {
                "ok": False,
                "status": "error",
                "message": f"Failed to trigger learning: {str(local_err)}",
            }


@app.get("/v1/learning/history")
async def get_learning_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get learning execution history"""
    executions = (
        db.query(LearningExecution)
        .order_by(LearningExecution.executed_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "ok": True,
        "executions": [
            {
                "id": str(e.id),
                "executed_at": e.executed_at.isoformat() if e.executed_at else None,
                "status": e.status,
                "trigger_type": e.trigger_type,
                "duration_seconds": e.duration_seconds,
                "understanding_version": e.understanding_version,
                "error_message": e.error_message,
            }
            for e in executions
        ],
    }


# ============================================
# Notification Endpoints
# ============================================


@app.get("/v1/notifications", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notifications for current user"""
    # Get notifications for current user OR global notifications (user_id is None)
    notifications = (
        db.query(Notification)
        .filter(
            or_(Notification.user_id == current_user.id, Notification.user_id.is_(None))
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )

    # Count unread
    unread_count = (
        db.query(func.count(Notification.id))
        .filter(
            or_(
                Notification.user_id == current_user.id, Notification.user_id.is_(None)
            ),
            Notification.is_read == False,
        )
        .scalar()
        or 0
    )

    return NotificationListResponse(
        ok=True,
        notifications=[NotificationItem.model_validate(n) for n in notifications],
        unread_count=unread_count,
    )


@app.post(
    "/v1/notifications/{notification_id}/read", response_model=NotificationReadResponse
)
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read"""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            or_(
                Notification.user_id == current_user.id, Notification.user_id.is_(None)
            ),
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Notification not found"},
            },
        )

    notification.is_read = True
    db.commit()

    return NotificationReadResponse(ok=True, message="Notification marked as read")


@app.post("/v1/notifications/read-all", response_model=NotificationReadAllResponse)
async def mark_all_notifications_read(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for current user"""
    count = (
        db.query(Notification)
        .filter(
            or_(
                Notification.user_id == current_user.id, Notification.user_id.is_(None)
            ),
            Notification.is_read == False,
        )
        .update({"is_read": True})
    )

    db.commit()

    return NotificationReadAllResponse(
        ok=True, message="All notifications marked as read", count=count
    )


# ============================================
# Template Endpoints
# ============================================


@app.get("/v1/templates", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in title and content"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all templates with optional filtering"""
    query = db.query(MessageTemplate)

    if category:
        query = query.filter(MessageTemplate.category == category)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                MessageTemplate.title.ilike(search_pattern),
                MessageTemplate.content.ilike(search_pattern),
            )
        )

    # Order by usage count (most used first), then by updated_at
    templates = query.order_by(
        MessageTemplate.usage_count.desc(), MessageTemplate.updated_at.desc()
    ).all()

    return TemplateListResponse(
        ok=True, templates=[TemplateItem.model_validate(t) for t in templates]
    )


@app.get("/v1/templates/categories")
async def list_template_categories(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get list of template categories with counts"""
    categories = (
        db.query(
            MessageTemplate.category, func.count(MessageTemplate.id).label("count")
        )
        .group_by(MessageTemplate.category)
        .all()
    )

    return {
        "ok": True,
        "categories": [{"name": c.category, "count": c.count} for c in categories],
    }


@app.get("/v1/templates/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single template"""
    template = (
        db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Template not found"},
            },
        )

    return TemplateResponse(ok=True, template=TemplateItem.model_validate(template))


@app.post("/v1/templates", response_model=TemplateResponse)
async def create_template(
    request: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create new template"""
    # Validate category
    if request.category not in TEMPLATE_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"Invalid category. Must be one of: {', '.join(TEMPLATE_CATEGORIES)}",
                },
            },
        )

    template = MessageTemplate(
        title=request.title,
        content=request.content,
        category=request.category,
        created_by=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    return TemplateResponse(ok=True, template=TemplateItem.model_validate(template))


@app.put("/v1/templates/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    request: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update template"""
    template = (
        db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Template not found"},
            },
        )

    if request.title is not None:
        template.title = request.title

    if request.content is not None:
        template.content = request.content

    if request.category is not None:
        if request.category not in TEMPLATE_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "ok": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid category. Must be one of: {', '.join(TEMPLATE_CATEGORIES)}",
                    },
                },
            )
        template.category = request.category

    db.commit()
    db.refresh(template)

    return TemplateResponse(ok=True, template=TemplateItem.model_validate(template))


@app.delete("/v1/templates/{template_id}", response_model=TemplateDeleteResponse)
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete template"""
    template = (
        db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Template not found"},
            },
        )

    db.delete(template)
    db.commit()

    return TemplateDeleteResponse(
        ok=True, message=f"Template '{template.title}' deleted successfully"
    )


@app.post("/v1/templates/{template_id}/copy", response_model=TemplateCopyResponse)
async def copy_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record template copy action (increment usage count)"""
    template = (
        db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Template not found"},
            },
        )

    template.usage_count = (template.usage_count or 0) + 1
    db.commit()

    return TemplateCopyResponse(ok=True, message="Usage count updated")


# ============================================
# Classification Feedback Endpoints
# ============================================


@app.post("/v1/feedback/classification", response_model=FeedbackResponse)
async def submit_classification_feedback(
    request: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit feedback for a classification correction"""
    event = (
        db.query(MessageEvent).filter(MessageEvent.event_id == request.event_id).first()
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Event not found"},
            },
        )

    ticket_link = (
        db.query(TicketEventLink)
        .filter(TicketEventLink.event_id == request.event_id)
        .first()
    )
    if not ticket_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {
                    "code": "NO_TICKET",
                    "message": "Event is not linked to any ticket",
                },
            },
        )

    annotation = (
        db.query(LLMAnnotation)
        .filter(
            LLMAnnotation.target_type == "event",
            LLMAnnotation.target_id == request.event_id,
        )
        .first()
    )

    original_intent = "unknown"
    original_needs_reply = True
    original_topic = None
    original_confidence = None

    if annotation and annotation.result:
        original_intent = annotation.result.get("intent", "unknown")
        original_needs_reply = annotation.result.get("needs_reply", True)
        original_topic = annotation.result.get("topic")
        confidence_val = annotation.result.get("confidence")
        if confidence_val is not None:
            original_confidence = float(confidence_val)

    feedback = ClassificationFeedback(
        event_id=request.event_id,
        ticket_id=ticket_link.ticket_id,
        original_intent=original_intent,
        original_needs_reply=original_needs_reply,
        original_topic=original_topic,
        original_confidence=original_confidence,
        corrected_intent=request.corrected_intent,
        corrected_needs_reply=request.corrected_needs_reply,
        corrected_topic=request.corrected_topic,
        feedback_type="correction",
        corrected_by=current_user.id,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return FeedbackResponse(ok=True, feedback=FeedbackItem.model_validate(feedback))


@app.get("/v1/feedback/list", response_model=FeedbackListResponse)
async def list_feedbacks(
    limit: int = Query(50, ge=1, le=200),
    applied: Optional[bool] = Query(None, description="Filter by applied status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List classification feedbacks"""
    query = db.query(ClassificationFeedback)

    if applied is not None:
        if applied:
            query = query.filter(ClassificationFeedback.applied_to_version.isnot(None))
        else:
            query = query.filter(ClassificationFeedback.applied_to_version.is_(None))

    total = query.count()
    feedbacks = (
        query.order_by(ClassificationFeedback.corrected_at.desc()).limit(limit).all()
    )

    return FeedbackListResponse(
        ok=True,
        feedbacks=[FeedbackItem.model_validate(f) for f in feedbacks],
        total=total,
    )


@app.get("/v1/feedback/statistics", response_model=FeedbackStatsResponse)
async def get_feedback_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get feedback statistics"""
    total = db.query(func.count(ClassificationFeedback.id)).scalar() or 0
    pending = (
        db.query(func.count(ClassificationFeedback.id))
        .filter(ClassificationFeedback.applied_to_version.is_(None))
        .scalar()
        or 0
    )
    applied = total - pending

    by_type = (
        db.query(
            ClassificationFeedback.feedback_type,
            func.count(ClassificationFeedback.id).label("count"),
        )
        .group_by(ClassificationFeedback.feedback_type)
        .all()
    )

    top_corrections = (
        db.query(
            ClassificationFeedback.original_intent,
            ClassificationFeedback.corrected_intent,
            func.count(ClassificationFeedback.id).label("count"),
        )
        .filter(
            ClassificationFeedback.corrected_intent.isnot(None),
            ClassificationFeedback.original_intent
            != ClassificationFeedback.corrected_intent,
        )
        .group_by(
            ClassificationFeedback.original_intent,
            ClassificationFeedback.corrected_intent,
        )
        .order_by(func.count(ClassificationFeedback.id).desc())
        .limit(10)
        .all()
    )

    return FeedbackStatsResponse(
        ok=True,
        statistics={
            "total_feedback": total,
            "pending_application": pending,
            "applied": applied,
            "by_type": {row.feedback_type: row.count for row in by_type},
            "top_corrections": [
                {
                    "from": row.original_intent,
                    "to": row.corrected_intent,
                    "count": row.count,
                }
                for row in top_corrections
            ],
        },
    )


# ============================================
# Pattern Management Endpoints
# ============================================


@app.get("/v1/patterns/pending", response_model=PatternListResponse)
async def list_pending_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List patterns pending approval"""
    patterns = (
        db.query(PatternApplicationLog)
        .filter(PatternApplicationLog.status == "pending")
        .order_by(PatternApplicationLog.created_at.desc())
        .all()
    )
    return PatternListResponse(
        ok=True, patterns=[PatternItem.model_validate(p) for p in patterns]
    )


@app.get("/v1/patterns/all", response_model=PatternListResponse)
async def list_all_patterns(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all patterns with optional status filter"""
    query = db.query(PatternApplicationLog)
    if status_filter:
        query = query.filter(PatternApplicationLog.status == status_filter)
    patterns = query.order_by(PatternApplicationLog.created_at.desc()).all()
    return PatternListResponse(
        ok=True, patterns=[PatternItem.model_validate(p) for p in patterns]
    )


@app.post("/v1/patterns/{pattern_id}/approve", response_model=PatternActionResponse)
async def approve_pattern(
    pattern_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Approve a pending pattern (admin only)"""
    pattern = (
        db.query(PatternApplicationLog)
        .filter(PatternApplicationLog.id == pattern_id)
        .first()
    )
    if not pattern:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Pattern not found"},
            },
        )

    if pattern.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {
                    "code": "INVALID_STATUS",
                    "message": f"Pattern is already {pattern.status}",
                },
            },
        )

    pattern.status = "approved"
    pattern.reviewed_by = admin_user.id
    pattern.reviewed_at = get_kst_now()
    db.commit()
    db.refresh(pattern)

    return PatternActionResponse(ok=True, pattern=PatternItem.model_validate(pattern))


@app.post("/v1/patterns/{pattern_id}/reject", response_model=PatternActionResponse)
async def reject_pattern(
    pattern_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Reject a pending pattern (admin only)"""
    pattern = (
        db.query(PatternApplicationLog)
        .filter(PatternApplicationLog.id == pattern_id)
        .first()
    )
    if not pattern:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "Pattern not found"},
            },
        )

    if pattern.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "ok": False,
                "error": {
                    "code": "INVALID_STATUS",
                    "message": f"Pattern is already {pattern.status}",
                },
            },
        )

    pattern.status = "rejected"
    pattern.reviewed_by = admin_user.id
    pattern.reviewed_at = get_kst_now()
    db.commit()
    db.refresh(pattern)

    return PatternActionResponse(ok=True, pattern=PatternItem.model_validate(pattern))


@app.post("/v1/patterns/apply", response_model=PatternApplyResponse)
async def apply_approved_patterns(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Apply all approved patterns to the system (admin only)"""
    approved_patterns = (
        db.query(PatternApplicationLog)
        .filter(PatternApplicationLog.status == "approved")
        .all()
    )

    if not approved_patterns:
        return PatternApplyResponse(
            ok=True,
            applied={
                "skip_llm_patterns": 0,
                "internal_markers": 0,
                "new_intents": 0,
                "message": "No approved patterns to apply",
            },
        )

    results = {
        "skip_llm_patterns": 0,
        "internal_markers": 0,
        "new_intents": 0,
        "errors": [],
    }
    now = get_kst_now()

    for pattern in approved_patterns:
        try:
            pattern.status = "applied"
            pattern.applied_at = now
            pattern.application_result = {"applied_by": admin_user.id}

            if pattern.pattern_type == "skip_llm":
                results["skip_llm_patterns"] += 1
            elif pattern.pattern_type == "internal_marker":
                results["internal_markers"] += 1
            elif pattern.pattern_type == "new_intent":
                results["new_intents"] += 1

        except Exception as e:
            results["errors"].append({"pattern_id": str(pattern.id), "error": str(e)})

    db.commit()

    return PatternApplyResponse(
        ok=True,
        applied={
            "skip_llm_patterns": results["skip_llm_patterns"],
            "internal_markers": results["internal_markers"],
            "new_intents": results["new_intents"],
            "applied_at": now.isoformat(),
            "errors": results["errors"] if results["errors"] else None,
        },
    )


# ============================================
# Learning Insights Endpoint
# ============================================


@app.get("/v1/learning/insights", response_model=InsightsResponse)
async def get_learning_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get structured key_insights from latest learning"""
    understanding = (
        db.query(CSUnderstanding).order_by(CSUnderstanding.version.desc()).first()
    )

    if not understanding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "ok": False,
                "error": {"code": "NOT_FOUND", "message": "No learning data available"},
            },
        )

    return InsightsResponse(
        ok=True,
        version=understanding.version,
        created_at=understanding.created_at,
        insights=understanding.key_insights,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

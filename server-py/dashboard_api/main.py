"""
Dashboard API - Serves web dashboard

Endpoints:
- POST /auth/login - User login
- GET/POST/DELETE /v1/users - User management
- GET/PATCH /v1/tickets - Ticket management
- GET /v1/tickets/{id}/events - Ticket events
- GET /v1/metrics/overview - Dashboard metrics
- GET /v1/clinics/health - Clinic health
"""

import os
from uuid import UUID
from datetime import datetime, date
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from shared.database import get_db, engine, Base
from shared.models import User, Ticket, MessageEvent, TicketEventLink, LLMAnnotation, CSUnderstanding, LearningExecution, Notification, MessageTemplate
from sqlalchemy import text
from shared.schemas import (
    LoginRequest, LoginResponse, UserInfo,
    UserCreate, UserUpdate, UserResponse, UserListResponse, UserDeleteResponse,
    TicketItem, TicketListResponse, TicketDetail, TicketResponse, TicketUpdate,
    TicketEventItem, TicketEventResponse,
    MetricsData, MetricsResponse,
    ClinicHealth, ClinicHealthResponse,
    NotificationItem, NotificationListResponse, NotificationReadResponse, NotificationReadAllResponse,
    TemplateItem, TemplateListResponse, TemplateResponse, TemplateCreate, TemplateUpdate, TemplateDeleteResponse, TemplateCopyResponse,
)
from shared.utils import get_kst_now, calculate_sla_remaining_sec
from shared.config import get_settings
from shared.migrations import run_column_migrations

from .auth import (
    authenticate_user, create_access_token, get_current_user, get_admin_user, get_password_hash
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
                role="admin"
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
    lifespan=lifespan
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
            detail={"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Invalid email or password"}}
        )

    token = create_access_token(data={"sub": str(user.id)})
    return LoginResponse(
        ok=True,
        token=token,
        user=UserInfo(id=user.id, email=user.email, name=user.name, role=user.role)
    )


# ============================================
# User Endpoints (Admin Only)
# ============================================

@app.get("/v1/users", response_model=UserListResponse)
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all users (any authenticated user can view)"""
    users = db.query(User).order_by(User.id).all()
    return UserListResponse(
        ok=True,
        users=[UserInfo(id=u.id, email=u.email, name=u.name, role=u.role) for u in users]
    )


@app.post("/v1/users", response_model=UserResponse)
async def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user)  # Admin only
):
    """Create new user (admin only)"""
    # Check if email exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": {"code": "DUPLICATE", "message": "Email already exists"}}
        )

    # Validate role
    if request.role not in ["admin", "member"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": {"code": "VALIDATION_ERROR", "message": "Invalid role. Must be 'admin' or 'member'"}}
        )

    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.name,
        role=request.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        ok=True,
        user=UserInfo(id=user.id, email=user.email, name=user.name, role=user.role)
    )


@app.put("/v1/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    request: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user)  # Admin only
):
    """Update user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "User not found"}}
        )

    # Prevent changing admin's own role (safety measure)
    if user.id == admin_user.id and request.role and request.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": {"code": "FORBIDDEN", "message": "Cannot change your own admin role"}}
        )

    # Update fields
    if request.email is not None:
        # Check for duplicate email
        existing = db.query(User).filter(User.email == request.email, User.id != user_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"ok": False, "error": {"code": "DUPLICATE", "message": "Email already exists"}}
            )
        user.email = request.email

    if request.password is not None:
        user.password_hash = get_password_hash(request.password)

    if request.name is not None:
        user.name = request.name

    if request.role is not None:
        if request.role not in ["admin", "member"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"ok": False, "error": {"code": "VALIDATION_ERROR", "message": "Invalid role. Must be 'admin' or 'member'"}}
            )
        user.role = request.role

    db.commit()
    db.refresh(user)

    return UserResponse(
        ok=True,
        user=UserInfo(id=user.id, email=user.email, name=user.name, role=user.role)
    )


@app.delete("/v1/users/{user_id}", response_model=UserDeleteResponse)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user)  # Admin only
):
    """Delete user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "User not found"}}
        )

    # Prevent self-deletion
    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": {"code": "FORBIDDEN", "message": "Cannot delete yourself"}}
        )

    # Prevent deleting the last admin
    if user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"ok": False, "error": {"code": "FORBIDDEN", "message": "Cannot delete the last admin user"}}
            )

    db.delete(user)
    db.commit()
    return UserDeleteResponse(ok=True, message=f"User '{user.email}' deleted successfully")


# ============================================
# Ticket Endpoints
# ============================================

@app.get("/v1/tickets", response_model=TicketListResponse)
async def list_tickets(
    status: Optional[str] = Query(None, description="Comma-separated statuses"),
    priority: Optional[str] = Query(None, description="Comma-separated priorities"),
    clinic_key: Optional[str] = None,
    sla_breached: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
        else_=4
    )
    query = query.order_by(
        Ticket.sla_breached.desc(),
        priority_order,
        Ticket.updated_at.desc()
    )

    # Paginate
    tickets = query.offset((page - 1) * limit).limit(limit).all()

    # Build response with SLA remaining calculation
    ticket_items = []
    for t in tickets:
        sla_remaining = calculate_sla_remaining_sec(
            t.first_inbound_at,
            t.first_response_sec,
            settings.sla_threshold_minutes
        )
        ticket_items.append(TicketItem(
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
            sla_remaining_sec=sla_remaining
        ))

    return TicketListResponse(ok=True, tickets=ticket_items, total=total, page=page)


@app.get("/v1/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get single ticket detail"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Ticket not found"}}
        )

    return TicketResponse(ok=True, ticket=TicketDetail.model_validate(ticket))


@app.patch("/v1/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID,
    update: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update ticket"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Ticket not found"}}
        )

    # Update fields
    if update.status is not None:
        if update.status not in ["onboarding", "stable", "churn_risk", "important"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"ok": False, "error": {"code": "VALIDATION_ERROR", "message": "Invalid status"}}
            )
        ticket.status = update.status

    if update.priority is not None:
        if update.priority not in ["low", "normal", "high", "urgent"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"ok": False, "error": {"code": "VALIDATION_ERROR", "message": "Invalid priority"}}
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
    current_user: User = Depends(get_current_user)
):
    """Delete ticket and related data"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Ticket not found"}}
        )

    # Delete related ticket_event_links
    db.query(TicketEventLink).filter(TicketEventLink.ticket_id == ticket_id).delete()

    # Delete related llm_annotations (target_type='ticket' and target_id=ticket_id)
    db.query(LLMAnnotation).filter(
        LLMAnnotation.target_type == 'ticket',
        LLMAnnotation.target_id == ticket_id
    ).delete()

    # Delete ticket
    db.delete(ticket)
    db.commit()

    return {"ok": True, "deleted_ticket_id": str(ticket_id)}


@app.get("/v1/tickets/{ticket_id}/events", response_model=TicketEventResponse)
async def get_ticket_events(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get events (messages) linked to a ticket"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Ticket not found"}}
        )

    # Get linked events
    events = db.query(MessageEvent).join(
        TicketEventLink,
        TicketEventLink.event_id == MessageEvent.event_id
    ).filter(
        TicketEventLink.ticket_id == ticket_id
    ).order_by(
        MessageEvent.received_at.asc()
    ).all()

    return TicketEventResponse(
        ok=True,
        events=[TicketEventItem(
            event_id=e.event_id,
            sender_name=e.sender_name,
            sender_type=e.sender_type,
            staff_member=e.staff_member,
            text_raw=e.text_raw,
            received_at=e.received_at
        ) for e in events]
    )


# ============================================
# Metrics Endpoints
# ============================================

@app.get("/v1/metrics/overview", response_model=MetricsResponse)
async def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard overview metrics"""
    now = get_kst_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's inbound messages
    today_inbound = db.query(func.count(MessageEvent.event_id)).filter(
        MessageEvent.direction == "inbound",
        MessageEvent.received_at >= today_start
    ).scalar() or 0

    # SLA breached tickets
    sla_breached_count = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.sla_breached == True
    ).scalar() or 0

    # Urgent tickets (priority = urgent, all lifecycle stages are "open")
    urgent_count = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.priority == "urgent"
    ).scalar() or 0

    # Open tickets (all tickets in any lifecycle stage)
    open_tickets = db.query(func.count(Ticket.ticket_id)).scalar() or 0

    # Average response time (for tickets with responses)
    avg_response = db.query(func.avg(Ticket.first_response_sec)).filter(
        Ticket.first_response_sec.isnot(None)
    ).scalar()

    return MetricsResponse(
        ok=True,
        metrics=MetricsData(
            today_inbound=today_inbound,
            sla_breached_count=sla_breached_count,
            urgent_count=urgent_count,
            open_tickets=open_tickets,
            avg_response_sec=int(avg_response) if avg_response else None
        )
    )


@app.get("/v1/clinics/health", response_model=ClinicHealthResponse)
async def get_clinics_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get health status per clinic"""
    now = get_kst_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get all unique clinics with tickets (all lifecycle stages are "open")
    clinics_query = db.query(
        Ticket.clinic_key,
        func.count(Ticket.ticket_id).label("open_tickets"),
        func.count(Ticket.ticket_id).filter(
            Ticket.sla_breached == True
        ).label("sla_breached"),
        func.count(Ticket.ticket_id).filter(
            Ticket.priority == "urgent"
        ).label("urgent_count")
    ).group_by(
        Ticket.clinic_key
    ).all()

    clinics = []
    for row in clinics_query:
        # Count today's inbound for this clinic
        today_inbound = db.query(func.count(MessageEvent.event_id)).filter(
            MessageEvent.chat_room == row.clinic_key,
            MessageEvent.direction == "inbound",
            MessageEvent.received_at >= today_start
        ).scalar() or 0

        clinics.append(ClinicHealth(
            clinic_key=row.clinic_key,
            today_inbound=today_inbound,
            sla_breached=row.sla_breached or 0,
            urgent_count=row.urgent_count or 0,
            open_tickets=row.open_tickets or 0
        ))

    # Sort by SLA breached count desc
    clinics.sort(key=lambda x: (x.sla_breached, x.urgent_count), reverse=True)

    return ClinicHealthResponse(ok=True, clinics=clinics)


# ============================================
# Learning Endpoints
# ============================================

@app.get("/v1/learning/understanding")
async def get_latest_understanding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get latest CS understanding"""
    understanding = db.query(CSUnderstanding).order_by(
        CSUnderstanding.version.desc()
    ).first()

    if not understanding:
        return {
            "ok": True,
            "understanding": None,
            "message": "No understanding formed yet"
        }

    # Get previous versions list
    previous_versions = db.query(
        CSUnderstanding.version,
        CSUnderstanding.created_at
    ).order_by(
        CSUnderstanding.version.desc()
    ).limit(10).all()

    return {
        "ok": True,
        "understanding": {
            "version": understanding.version,
            "created_at": understanding.created_at.isoformat() if understanding.created_at else None,
            "logs_analyzed_count": understanding.logs_analyzed_count,
            "logs_date_from": understanding.logs_date_from.isoformat() if understanding.logs_date_from else None,
            "logs_date_to": understanding.logs_date_to.isoformat() if understanding.logs_date_to else None,
            "understanding_text": understanding.understanding_text,
            "key_insights": understanding.key_insights,
            "model_used": understanding.model_used,
            "prompt_tokens": understanding.prompt_tokens,
            "completion_tokens": understanding.completion_tokens,
        },
        "previous_versions": [
            {"version": v.version, "created_at": v.created_at.isoformat() if v.created_at else None}
            for v in previous_versions
        ]
    }


@app.get("/v1/learning/understanding/{version}")
async def get_understanding_by_version(
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific version of CS understanding"""
    understanding = db.query(CSUnderstanding).filter(
        CSUnderstanding.version == version
    ).first()

    if not understanding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": f"Understanding v{version} not found"}}
        )

    return {
        "ok": True,
        "understanding": {
            "version": understanding.version,
            "created_at": understanding.created_at.isoformat() if understanding.created_at else None,
            "logs_analyzed_count": understanding.logs_analyzed_count,
            "logs_date_from": understanding.logs_date_from.isoformat() if understanding.logs_date_from else None,
            "logs_date_to": understanding.logs_date_to.isoformat() if understanding.logs_date_to else None,
            "understanding_text": understanding.understanding_text,
            "key_insights": understanding.key_insights,
            "model_used": understanding.model_used,
            "prompt_tokens": understanding.prompt_tokens,
            "completion_tokens": understanding.completion_tokens,
        }
    }


@app.post("/v1/learning/run")
async def trigger_learning_cycle(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger manual learning cycle by calling Worker service"""
    import httpx

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
                    "message": f"Worker returned status {response.status_code}"
                }
    except httpx.RequestError as e:
        # Fallback: try to run locally if worker is not accessible
        print(f"[Learning] Worker not accessible ({e}), trying local execution...")
        try:
            import threading
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
                "message": "Learning cycle started locally (worker not accessible)"
            }
        except Exception as local_err:
            return {
                "ok": False,
                "status": "error",
                "message": f"Failed to trigger learning: {str(local_err)}"
            }


@app.get("/v1/learning/history")
async def get_learning_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get learning execution history"""
    executions = db.query(LearningExecution).order_by(
        LearningExecution.executed_at.desc()
    ).limit(limit).all()

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
        ]
    }


# ============================================
# Notification Endpoints
# ============================================

@app.get("/v1/notifications", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notifications for current user"""
    # Get notifications for current user OR global notifications (user_id is None)
    notifications = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        )
    ).order_by(
        Notification.created_at.desc()
    ).limit(limit).all()

    # Count unread
    unread_count = db.query(func.count(Notification.id)).filter(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False
    ).scalar() or 0

    return NotificationListResponse(
        ok=True,
        notifications=[NotificationItem.model_validate(n) for n in notifications],
        unread_count=unread_count
    )


@app.post("/v1/notifications/{notification_id}/read", response_model=NotificationReadResponse)
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        )
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Notification not found"}}
        )

    notification.is_read = True
    db.commit()

    return NotificationReadResponse(ok=True, message="Notification marked as read")


@app.post("/v1/notifications/read-all", response_model=NotificationReadAllResponse)
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for current user"""
    count = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False
    ).update({"is_read": True})

    db.commit()

    return NotificationReadAllResponse(ok=True, message="All notifications marked as read", count=count)


# ============================================
# Template Endpoints
# ============================================

@app.get("/v1/templates", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in title and content"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
                MessageTemplate.content.ilike(search_pattern)
            )
        )

    # Order by usage count (most used first), then by updated_at
    templates = query.order_by(
        MessageTemplate.usage_count.desc(),
        MessageTemplate.updated_at.desc()
    ).all()

    return TemplateListResponse(
        ok=True,
        templates=[TemplateItem.model_validate(t) for t in templates]
    )


@app.get("/v1/templates/categories")
async def list_template_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of template categories with counts"""
    categories = db.query(
        MessageTemplate.category,
        func.count(MessageTemplate.id).label("count")
    ).group_by(MessageTemplate.category).all()

    return {
        "ok": True,
        "categories": [
            {"name": c.category, "count": c.count}
            for c in categories
        ]
    }


@app.get("/v1/templates/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get single template"""
    template = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Template not found"}}
        )

    return TemplateResponse(ok=True, template=TemplateItem.model_validate(template))


@app.post("/v1/templates", response_model=TemplateResponse)
async def create_template(
    request: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new template"""
    # Validate category
    valid_categories = ["인사", "안내", "문제해결", "마무리", "기타"]
    if request.category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": {"code": "VALIDATION_ERROR", "message": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}}
        )

    template = MessageTemplate(
        title=request.title,
        content=request.content,
        category=request.category,
        created_by=current_user.id
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
    current_user: User = Depends(get_current_user)
):
    """Update template"""
    template = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Template not found"}}
        )

    if request.title is not None:
        template.title = request.title

    if request.content is not None:
        template.content = request.content

    if request.category is not None:
        valid_categories = ["인사", "안내", "문제해결", "마무리", "기타"]
        if request.category not in valid_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"ok": False, "error": {"code": "VALIDATION_ERROR", "message": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}}
            )
        template.category = request.category

    db.commit()
    db.refresh(template)

    return TemplateResponse(ok=True, template=TemplateItem.model_validate(template))


@app.delete("/v1/templates/{template_id}", response_model=TemplateDeleteResponse)
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete template"""
    template = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Template not found"}}
        )

    db.delete(template)
    db.commit()

    return TemplateDeleteResponse(ok=True, message=f"Template '{template.title}' deleted successfully")


@app.post("/v1/templates/{template_id}/copy", response_model=TemplateCopyResponse)
async def copy_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record template copy action (increment usage count)"""
    template = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "Template not found"}}
        )

    template.usage_count = (template.usage_count or 0) + 1
    db.commit()

    return TemplateCopyResponse(ok=True, message="Usage count updated")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

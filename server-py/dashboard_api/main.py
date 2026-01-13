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
import sys
from uuid import UUID
from datetime import datetime, date
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

# Add parent to path for shared imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db, engine, Base
from shared.models import User, Ticket, MessageEvent, TicketEventLink
from shared.schemas import (
    LoginRequest, LoginResponse, UserInfo,
    UserCreate, UserResponse, UserListResponse,
    TicketItem, TicketListResponse, TicketDetail, TicketResponse, TicketUpdate,
    TicketEventItem, TicketEventResponse,
    MetricsData, MetricsResponse,
    ClinicHealth, ClinicHealthResponse,
)
from shared.utils import get_kst_now, calculate_sla_remaining_sec
from shared.config import get_settings

from .auth import (
    authenticate_user, create_access_token, get_current_user, get_password_hash
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables if not exist
    Base.metadata.create_all(bind=engine)

    # Create admin user if not exists
    db = next(get_db())
    try:
        admin = db.query(User).filter(User.email == "admin").first()
        if not admin:
            admin = User(
                email="admin",
                password_hash=get_password_hash("1234"),
                name="관리자"
            )
            db.add(admin)
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
        user=UserInfo(id=user.id, email=user.email, name=user.name)
    )


# ============================================
# User Endpoints
# ============================================

@app.get("/v1/users", response_model=UserListResponse)
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all users"""
    users = db.query(User).all()
    return UserListResponse(
        ok=True,
        users=[UserInfo(id=u.id, email=u.email, name=u.name) for u in users]
    )


@app.post("/v1/users", response_model=UserResponse)
async def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new user (admin only)"""
    # Check if email exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": {"code": "DUPLICATE", "message": "Email already exists"}}
        )

    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.name
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        ok=True,
        user=UserInfo(id=user.id, email=user.email, name=user.name)
    )


@app.delete("/v1/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": {"code": "NOT_FOUND", "message": "User not found"}}
        )

    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": {"code": "FORBIDDEN", "message": "Cannot delete yourself"}}
        )

    db.delete(user)
    db.commit()
    return {"ok": True}


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
            first_inbound_at=t.first_inbound_at,
            last_inbound_at=t.last_inbound_at,
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
        if update.status not in ["new", "in_progress", "waiting", "done"]:
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

    db.commit()
    db.refresh(ticket)

    return TicketResponse(ok=True, ticket=TicketDetail.model_validate(ticket))


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

    # Urgent tickets
    urgent_count = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.priority == "urgent",
        Ticket.status.in_(["new", "in_progress", "waiting"])
    ).scalar() or 0

    # Open tickets
    open_tickets = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.status.in_(["new", "in_progress", "waiting"])
    ).scalar() or 0

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

    # Get all unique clinics with open tickets
    clinics_query = db.query(
        Ticket.clinic_key,
        func.count(Ticket.ticket_id).filter(
            Ticket.status.in_(["new", "in_progress", "waiting"])
        ).label("open_tickets"),
        func.count(Ticket.ticket_id).filter(
            Ticket.sla_breached == True
        ).label("sla_breached"),
        func.count(Ticket.ticket_id).filter(
            Ticket.priority == "urgent"
        ).label("urgent_count")
    ).filter(
        Ticket.status.in_(["new", "in_progress", "waiting"])
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

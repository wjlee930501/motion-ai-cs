"""
Worker - Processes message events, runs LLM classification, checks SLA

This worker polls the database for unprocessed events and:
1. Classifies messages using Claude LLM
2. Creates/updates tickets based on message flow
3. Checks SLA breaches (20-minute rule)
4. Sends Slack alerts for breaches and urgent tickets

Run modes:
- Standalone: python -m worker.main
- Cloud Run: Runs HTTP server with background worker thread
"""

import os
import time
import logging
import threading
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional, List

from sqlalchemy.orm import Session
from fastapi import FastAPI, Header
from contextlib import asynccontextmanager

from shared.database import SessionLocal, engine, Base
from shared.models import MessageEvent, Ticket, TicketEventLink, LLMAnnotation, SLAAlertLog, StaffResponseLog
from shared.config import get_settings
from shared.utils import get_kst_now
from shared.migrations import run_column_migrations, drop_old_status_constraint, migrate_ticket_status, fix_existing_tickets_needs_reply, run_table_migrations

from .llm import classify_event, summarize_ticket, get_priority_from_urgency, should_upgrade_priority
from .slack import send_sla_alert, send_urgent_ticket_alert
from .learning import setup_learning_scheduler, shutdown_learning_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

settings = get_settings()

URGENT_PRIORITIES = {"urgent", "high"}


def get_unprocessed_events(db: Session, limit: int = 50) -> list[MessageEvent]:
    """Get events that haven't been processed yet.

    Uses SELECT FOR UPDATE SKIP LOCKED to prevent duplicate processing
    when multiple worker instances run concurrently.
    """
    return db.query(MessageEvent).filter(
        MessageEvent.ingest_status == "received"  # 'processing' 상태는 다른 워커가 처리 중
    ).order_by(
        MessageEvent.received_at.asc()
    ).limit(limit).with_for_update(skip_locked=True).all()


def find_open_ticket(db: Session, clinic_key: str) -> Optional[Ticket]:
    """Find the most recent ticket for a clinic (모든 상태가 open으로 간주됨)"""
    return db.query(Ticket).filter(
        Ticket.clinic_key == clinic_key
    ).order_by(
        Ticket.updated_at.desc()
    ).first()


def link_event_to_ticket(db: Session, ticket_id, event_id):
    """Create link between ticket and event"""
    link = TicketEventLink(
        ticket_id=ticket_id,
        event_id=event_id,
        link_type="append"
    )
    db.add(link)


def save_llm_annotation(db: Session, event_id, model: str, result: dict):
    """Save LLM classification result"""
    annotation = LLMAnnotation(
        target_type="event",
        target_id=event_id,
        model=model,
        topic=result.get("topic"),
        urgency=result.get("urgency"),
        sentiment=result.get("sentiment"),
        intent=result.get("intent"),
        needs_reply=result.get("needs_reply", True),  # Default to True if not specified
        summary=result.get("summary"),
        confidence=result.get("confidence"),
        raw_response=result
    )
    db.add(annotation)
    return annotation


def reset_sla_for_reinquiry(ticket: Ticket, received_at: datetime):
    """Reset SLA timers when a new inquiry arrives after a response."""
    ticket.sla_breached = False
    ticket.first_inbound_at = received_at
    ticket.first_response_sec = None


def apply_customer_classification(ticket: Ticket, event: MessageEvent, classification: dict, needs_reply: bool):
    """Apply classification results and inbound timestamps to an existing ticket."""
    ticket.last_inbound_at = event.received_at
    ticket.last_message_sender = event.sender_name
    ticket.needs_reply = needs_reply

    if not needs_reply:
        ticket.sla_breached = False

    # C1: Initialize SLA timer if first real inbound on staff-initiated ticket
    if needs_reply and ticket.first_inbound_at is None:
        ticket.first_inbound_at = event.received_at
        ticket.first_response_sec = None

    if needs_reply and ticket.first_response_sec is not None:
        reset_sla_for_reinquiry(ticket, event.received_at)

    new_priority = get_priority_from_urgency(classification.get("urgency", "medium"))
    if should_upgrade_priority(ticket.priority, new_priority):
        ticket.priority = new_priority

    if classification.get("summary"):
        ticket.summary_latest = classification["summary"]

    if classification.get("topic"):
        ticket.topic_primary = classification["topic"]

    if classification.get("intent"):
        ticket.intent = classification["intent"]


def create_customer_ticket(event: MessageEvent, classification: dict, needs_reply: bool) -> Ticket:
    """Create a new ticket from a customer event."""
    new_priority = get_priority_from_urgency(classification.get("urgency", "medium"))
    return Ticket(
        ticket_id=uuid4(),
        clinic_key=event.chat_room,
        status="onboarding",
        priority=new_priority,
        topic_primary=classification.get("topic"),
        summary_latest=classification.get("summary"),
        intent=classification.get("intent"),
        first_inbound_at=event.received_at,
        last_inbound_at=event.received_at,
        last_message_sender=event.sender_name,
        needs_reply=needs_reply,
        sla_breached=False
    )


def create_staff_initiated_ticket(event: MessageEvent, clinic_key: str) -> Ticket:
    """Create a ticket for staff-initiated conversations."""
    return Ticket(
        ticket_id=uuid4(),
        clinic_key=clinic_key,
        status="onboarding",
        priority="normal",
        first_inbound_at=None,
        last_outbound_at=event.received_at,
        last_message_sender=event.sender_name,
        needs_reply=False,
        sla_breached=False
    )


def handle_customer_event(db: Session, event: MessageEvent, classification: dict):
    """
    Handle incoming customer message.

    Flow:
    1. Find or create ticket
    2. Link event to ticket
    3. Update ticket timestamps and status
    4. Apply LLM urgency to priority
    """
    clinic_key = event.chat_room

    ticket = find_open_ticket(db, clinic_key)
    message_needs_reply = classification.get("needs_reply", True)

    if ticket:
        link_event_to_ticket(db, ticket.ticket_id, event.event_id)
        apply_customer_classification(ticket, event, classification, message_needs_reply)
    else:
        ticket = create_customer_ticket(event, classification, message_needs_reply)
        db.add(ticket)
        db.flush()

        link_event_to_ticket(db, ticket.ticket_id, event.event_id)

        if ticket.priority in URGENT_PRIORITIES:
            send_urgent_ticket_alert(
                str(ticket.ticket_id),
                clinic_key,
                event.text_raw,
                classification.get("urgency", "high")
            )

    return ticket


def handle_staff_event(db: Session, event: MessageEvent):
    """
    Handle outgoing staff message.

    Flow:
    1. Find or create ticket
    2. Link event to ticket
    3. Calculate response time (if first response)
    4. Update ticket status
    """
    clinic_key = event.chat_room

    # Find existing open ticket
    ticket = find_open_ticket(db, clinic_key)

    if not ticket:
        # Edge case: staff message without prior customer inquiry
        ticket = create_staff_initiated_ticket(event, clinic_key)
        db.add(ticket)
        db.flush()

    # Link event
    link_event_to_ticket(db, ticket.ticket_id, event.event_id)

    # Calculate first response time
    if ticket.first_response_sec is None and ticket.first_inbound_at:
        response_time = event.received_at - ticket.first_inbound_at
        ticket.first_response_sec = int(response_time.total_seconds())

    # Update timestamps
    ticket.last_outbound_at = event.received_at
    ticket.last_message_sender = event.sender_name

    # Staff responded, so reply is no longer needed
    ticket.needs_reply = False

    # Clear SLA breach on response
    ticket.sla_breached = False

    # Status는 고객 lifecycle 단계이므로 자동 변경하지 않음 (수동으로 관리)

    # Record staff response for analytics (non-blocking)
    record_staff_response(db, event, ticket)

    return ticket


def record_staff_response(db: Session, event: MessageEvent, ticket: Ticket):
    """
    Record staff response context for analytics.

    Captures: which customer message was responded to, response delay,
    response position in conversation, and text snippets for quick lookup.

    Non-blocking: failures are logged but don't affect event processing.
    """
    try:
        # 1. Find the most recent customer (inbound) message in this ticket
        last_customer_event = (
            db.query(MessageEvent)
            .join(TicketEventLink, TicketEventLink.event_id == MessageEvent.event_id)
            .filter(
                TicketEventLink.ticket_id == ticket.ticket_id,
                MessageEvent.sender_type == "customer",
                MessageEvent.received_at < event.received_at,
            )
            .order_by(MessageEvent.received_at.desc())
            .first()
        )

        # 2. Get LLM annotation for the customer message (intent, topic)
        customer_intent = None
        customer_topic = None
        customer_text_snippet = None
        responding_to_event_id = None
        response_delay_sec = None

        if last_customer_event:
            responding_to_event_id = last_customer_event.event_id
            customer_text_snippet = last_customer_event.text_raw[:100] if last_customer_event.text_raw else None

            # Calculate response delay
            if last_customer_event.received_at and event.received_at:
                delay = event.received_at - last_customer_event.received_at
                response_delay_sec = int(delay.total_seconds())

            # Get LLM annotation
            annotation = (
                db.query(LLMAnnotation)
                .filter(
                    LLMAnnotation.target_type == "event",
                    LLMAnnotation.target_id == last_customer_event.event_id,
                )
                .first()
            )
            if annotation:
                customer_intent = annotation.intent
                customer_topic = annotation.topic

        # 3. Calculate response_position: how many staff responses in this ticket before this one
        from sqlalchemy import func

        prior_staff_count = (
            db.query(func.count(StaffResponseLog.id))
            .filter(StaffResponseLog.ticket_id == ticket.ticket_id)
            .scalar()
            or 0
        )
        response_position = prior_staff_count + 1

        # 4. Create the log record
        staff_name = event.staff_member or event.sender_name
        log_entry = StaffResponseLog(
            event_id=event.event_id,
            ticket_id=ticket.ticket_id,
            staff_member=staff_name,
            clinic_key=event.chat_room,
            responding_to_event_id=responding_to_event_id,
            customer_text_snippet=customer_text_snippet,
            customer_intent=customer_intent,
            customer_topic=customer_topic,
            response_text_snippet=event.text_raw[:200] if event.text_raw else None,
            response_delay_sec=response_delay_sec,
            response_position=response_position,
            message_length=len(event.text_raw) if event.text_raw else 0,
        )
        db.add(log_entry)
        logger.info(
            f"StaffResponseLog: {staff_name} responded to ticket {ticket.ticket_id} "
            f"(position={response_position}, delay={response_delay_sec}s)"
        )

    except Exception as e:
        logger.error(f"[StaffResponseLog] Failed to record response: {e}")
        # Non-blocking: don't re-raise, just log


def check_sla_breaches(db: Session):
    """
    Check for SLA breaches on open tickets.

    SLA Rule: 20 minutes from first customer message without staff response
    Only applies to tickets where needs_reply is True (based on LLM classification)
    """
    now = get_kst_now()
    threshold = now - timedelta(minutes=settings.sla_threshold_minutes)

    # Find breachable tickets: no response, first_inbound before threshold
    # Only check tickets that actually need a reply (based on LLM classification)
    breached_tickets = db.query(Ticket).filter(
        Ticket.first_response_sec.is_(None),
        Ticket.first_inbound_at <= threshold,
        Ticket.sla_breached == False,
        Ticket.needs_reply == True  # Only check SLA for messages that need a reply
    ).all()

    alerted_count = 0
    for ticket in breached_tickets:
        # Get latest customer message
        latest_event = db.query(MessageEvent).join(
            TicketEventLink,
            TicketEventLink.event_id == MessageEvent.event_id
        ).filter(
            TicketEventLink.ticket_id == ticket.ticket_id,
            MessageEvent.sender_type == "customer"
        ).order_by(
            MessageEvent.received_at.desc()
        ).first()

        customer_message = latest_event.text_raw if latest_event else "(메시지 없음)"
        elapsed_minutes = int((now - ticket.first_inbound_at).total_seconds() / 60)

        # Send Slack alert
        success, status_code, error = send_sla_alert(
            str(ticket.ticket_id),
            ticket.clinic_key,
            customer_message,
            elapsed_minutes
        )

        # Log alert attempt
        alert_log = SLAAlertLog(
            ticket_id=ticket.ticket_id,
            alert_type="slack",
            response_status=status_code,
            error_message=error
        )
        db.add(alert_log)

        # Only mark breached after successful alert delivery
        if success:
            ticket.sla_breached = True
            ticket.sla_alerted_at = now
            alerted_count += 1
            logger.info(f"SLA breach alert sent for ticket {ticket.ticket_id}: {ticket.clinic_key}")
        else:
            logger.warning(f"SLA breach alert FAILED for ticket {ticket.ticket_id}: {error} — will retry next cycle")

    return alerted_count


def process_event(db: Session, event: MessageEvent):
    """Process a single event"""
    logger.info(f"Processing event {event.event_id}: {event.chat_room} - {event.sender_name}")

    # Skip debug/test data from Android app parse failures
    if event.chat_room and event.chat_room.startswith("[DEBUG]"):
        logger.info(f"Skipping debug event {event.event_id}")
        event.ingest_status = "skipped"
        return

    try:
        # Classify event with LLM (only for customer messages)
        classification = {}
        model_used = "none"

        if event.sender_type == "customer":
            classification, model_used = classify_event(
                event.chat_room,
                event.sender_type,
                event.text_raw
            )

            # Save annotation
            save_llm_annotation(db, event.event_id, model_used, classification)

            # Handle customer event
            ticket = handle_customer_event(db, event, classification)
        else:
            # Staff event
            ticket = handle_staff_event(db, event)

        # Mark event as processed
        event.ingest_status = "processed"

        logger.info(f"Event {event.event_id} processed -> Ticket {ticket.ticket_id} [{ticket.status}]")

    except Exception as e:
        logger.error(f"Error processing event {event.event_id}: {e}")
        event.ingest_status = "error"
        raise


def run_worker_cycle(db: Session):
    """Run one cycle of the worker

    Race condition 방지:
    1. FOR UPDATE SKIP LOCKED로 이벤트 조회
    2. 즉시 ingest_status='processing'으로 일괄 마킹 + 커밋 (락 해제)
    3. 이후 개별 처리 — 다른 워커는 'processing' 상태를 건너뜀
    """
    # Process new events
    events = get_unprocessed_events(db, limit=50)

    if events:
        logger.info(f"Processing {len(events)} events...")

        # Step 1: 즉시 processing으로 마킹하여 다른 워커가 잡지 못하게 함
        event_ids = []
        for event in events:
            event.ingest_status = "processing"
            event_ids.append(event.event_id)
        db.commit()

        # Step 2: 개별 처리 (이미 processing으로 마킹되어 다른 워커와 충돌 없음)
        for event in events:
            try:
                process_event(db, event)
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to process event {event.event_id}: {e}")
                # 에러 상태를 별도 트랜잭션으로 저장 (poison pill 방지)
                try:
                    event.ingest_status = "error"
                    db.commit()
                except Exception as status_err:
                    db.rollback()
                    logger.error(f"Failed to update error status for {event.event_id}: {status_err}")

    # Check SLA breaches
    breach_count = check_sla_breaches(db)
    if breach_count > 0:
        db.commit()
        logger.info(f"Processed {breach_count} SLA breaches")


def worker_loop():
    """Main worker loop - runs in background thread"""
    logger.info("Worker loop starting...")

    while True:
        try:
            db = SessionLocal()
            try:
                run_worker_cycle(db)
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Worker cycle error: {e}")

        # Sleep between cycles
        time.sleep(5)


# Worker state
worker_thread: Optional[threading.Thread] = None
worker_started = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan - start worker thread on startup"""
    global worker_thread, worker_started

    # Create tables if not exist
    Base.metadata.create_all(bind=engine)

    # Run migrations using shared module
    db = SessionLocal()
    try:
        run_column_migrations(db)
        drop_old_status_constraint(db)
        migrate_ticket_status(db)
        fix_existing_tickets_needs_reply(db)
        run_table_migrations(db)
    except Exception as e:
        logger.error(f"Startup error: {e}")
    finally:
        db.close()

    # Start worker in background thread
    worker_thread = threading.Thread(target=worker_loop, daemon=True)
    worker_thread.start()
    worker_started = True
    logger.info("Worker thread started")

    # Start learning scheduler (Mon/Thu 02:00 KST)
    try:
        setup_learning_scheduler()
        logger.info("Learning scheduler started")
    except Exception as e:
        logger.error(f"Failed to start learning scheduler: {e}")

    yield

    # Shutdown
    logger.info("Worker shutting down...")
    try:
        shutdown_learning_scheduler()
    except Exception as e:
        logger.error(f"Failed to shutdown learning scheduler: {e}")


# FastAPI app for Cloud Run health checks
app = FastAPI(
    title="CS Worker",
    description="Background worker for message processing",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {
        "status": "healthy",
        "service": "worker",
        "worker_running": worker_started and worker_thread is not None and worker_thread.is_alive()
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {"service": "cs-worker", "status": "running"}


@app.post("/learning/run")
async def trigger_learning(x_worker_secret: Optional[str] = Header(None)):
    """Trigger manual learning cycle - called by Dashboard API.

    Requires X-Worker-Secret header matching WORKER_SECRET env var.
    """
    expected_secret = os.environ.get("WORKER_SECRET", "")
    if not expected_secret or x_worker_secret != expected_secret:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Invalid or missing worker secret"}}
        )

    import threading
    from .learning import run_learning_cycle_manual

    def run_in_background():
        try:
            logger.info("[Learning] Manual learning cycle starting...")
            run_learning_cycle_manual()
            logger.info("[Learning] Manual learning cycle completed")
        except Exception as e:
            logger.error(f"[Learning] Manual run failed: {e}")

    thread = threading.Thread(target=run_in_background, daemon=True)
    thread.start()

    return {
        "ok": True,
        "status": "started",
        "message": "Learning cycle started in background"
    }


def main():
    """Main entry point - for local development"""
    logger.info("Worker starting in standalone mode...")

    # Create tables if not exist
    Base.metadata.create_all(bind=engine)

    # Run directly without HTTP server
    worker_loop()


if __name__ == "__main__":
    main()

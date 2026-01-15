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
import sys
import time
import logging
import threading
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional, List

from sqlalchemy.orm import Session
from fastapi import FastAPI
from contextlib import asynccontextmanager

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import SessionLocal, engine, Base
from shared.models import MessageEvent, Ticket, TicketEventLink, LLMAnnotation, SLAAlertLog
from sqlalchemy import text
from shared.config import get_settings
from shared.utils import get_kst_now

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


def get_unprocessed_events(db: Session, limit: int = 50) -> list[MessageEvent]:
    """Get events that haven't been processed yet"""
    return db.query(MessageEvent).filter(
        MessageEvent.ingest_status == "received"
    ).order_by(
        MessageEvent.received_at.asc()
    ).limit(limit).all()


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

    # Find existing open ticket
    ticket = find_open_ticket(db, clinic_key)

    # Get needs_reply from LLM classification (default True if not specified)
    message_needs_reply = classification.get("needs_reply", True)

    if ticket:
        # Link to existing ticket
        link_event_to_ticket(db, ticket.ticket_id, event.event_id)

        # Update timestamps
        ticket.last_inbound_at = event.received_at
        ticket.last_message_sender = event.sender_name

        # Update needs_reply based on latest message's LLM classification
        # The ticket's needs_reply reflects whether the LATEST message needs a response
        ticket.needs_reply = message_needs_reply

        # If message doesn't need reply (e.g., "감사합니다"), clear SLA breach status
        if not message_needs_reply:
            ticket.sla_breached = False

        # Re-inquiry 시 SLA 리셋 (상태는 유지)
        if message_needs_reply and ticket.first_response_sec is not None:
            ticket.sla_breached = False
            ticket.first_inbound_at = event.received_at
            ticket.first_response_sec = None

        # Upgrade priority if needed
        new_priority = get_priority_from_urgency(classification.get("urgency", "medium"))
        if should_upgrade_priority(ticket.priority, new_priority):
            ticket.priority = new_priority

        # Update summary if provided
        if classification.get("summary"):
            ticket.summary_latest = classification["summary"]

        # Update topic
        if classification.get("topic"):
            ticket.topic_primary = classification["topic"]

        # Update intent
        if classification.get("intent"):
            ticket.intent = classification["intent"]

    else:
        # Create new ticket
        new_priority = get_priority_from_urgency(classification.get("urgency", "medium"))
        ticket = Ticket(
            ticket_id=uuid4(),
            clinic_key=clinic_key,
            status="onboarding",
            priority=new_priority,
            topic_primary=classification.get("topic"),
            summary_latest=classification.get("summary"),
            intent=classification.get("intent"),
            first_inbound_at=event.received_at,
            last_inbound_at=event.received_at,
            last_message_sender=event.sender_name,
            needs_reply=message_needs_reply,  # Set based on LLM classification
            sla_breached=False
        )
        db.add(ticket)
        db.flush()  # Get ticket_id

        link_event_to_ticket(db, ticket.ticket_id, event.event_id)

        # Send urgent alert for new urgent tickets
        if new_priority in ["urgent", "high"]:
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
        ticket = Ticket(
            ticket_id=uuid4(),
            clinic_key=clinic_key,
            status="onboarding",
            priority="normal",
            first_inbound_at=None,
            last_outbound_at=event.received_at,
            last_message_sender=event.sender_name,
            needs_reply=False,  # Staff initiated, no reply needed
            sla_breached=False
        )
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

    return ticket


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

    for ticket in breached_tickets:
        # Mark as breached
        ticket.sla_breached = True
        ticket.sla_alerted_at = now

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

        # Log alert
        alert_log = SLAAlertLog(
            ticket_id=ticket.ticket_id,
            alert_type="slack",
            response_status=status_code,
            error_message=error
        )
        db.add(alert_log)

        logger.info(f"SLA breach alert sent for ticket {ticket.ticket_id}: {ticket.clinic_key}")

    return len(breached_tickets)


def process_event(db: Session, event: MessageEvent):
    """Process a single event"""
    logger.info(f"Processing event {event.event_id}: {event.chat_room} - {event.sender_name}")

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
    """Run one cycle of the worker"""
    # Process new events
    events = get_unprocessed_events(db, limit=50)

    if events:
        logger.info(f"Processing {len(events)} events...")

        for event in events:
            try:
                process_event(db, event)
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to process event {event.event_id}: {e}")

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


def run_migrations(db: Session):
    """Run database migrations for new columns"""
    migrations = [
        ("ticket", "last_message_sender", "ALTER TABLE ticket ADD COLUMN last_message_sender TEXT"),
        ("ticket", "needs_reply", "ALTER TABLE ticket ADD COLUMN needs_reply BOOLEAN DEFAULT TRUE"),
        ("ticket", "intent", "ALTER TABLE ticket ADD COLUMN intent TEXT"),
        ("llm_annotation", "needs_reply", "ALTER TABLE llm_annotation ADD COLUMN needs_reply BOOLEAN"),
    ]

    for table, column, sql in migrations:
        try:
            check_sql = text(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = '{table}' AND column_name = '{column}'
            """)
            result = db.execute(check_sql).fetchone()
            if not result:
                db.execute(text(sql))
                db.commit()
                logger.info(f"Migration: Added {column} to {table}")
        except Exception as e:
            db.rollback()
            logger.error(f"Migration error for {table}.{column}: {e}")

    # Drop old status check constraint (will be re-added after status migration)
    try:
        db.execute(text("ALTER TABLE ticket DROP CONSTRAINT IF EXISTS ck_ticket_status"))
        db.commit()
        logger.info("Migration: Dropped old status constraint")
    except Exception as e:
        db.rollback()
        logger.error(f"Migration error dropping status constraint: {e}")


def migrate_ticket_status(db: Session):
    """Migrate old ticket status values to new lifecycle-based values"""
    logger.info("Starting status migration...")
    try:
        # Map old status to new status: new/in_progress/waiting -> onboarding, done -> stable
        status_mapping = [
            ("new", "onboarding"),
            ("in_progress", "onboarding"),
            ("waiting", "onboarding"),
            ("done", "stable"),
        ]
        total_migrated = 0
        for old_status, new_status in status_mapping:
            migrate_sql = text("""
                UPDATE ticket SET status = :new_status
                WHERE status = :old_status
            """)
            result = db.execute(migrate_sql, {"old_status": old_status, "new_status": new_status})
            if result.rowcount > 0:
                total_migrated += result.rowcount
                logger.info(f"Migrated {result.rowcount} tickets from '{old_status}' to '{new_status}'")
        db.commit()
        if total_migrated > 0:
            logger.info(f"Status migration complete: {total_migrated} tickets updated")

        # Now add the new constraint after data is migrated
        try:
            db.execute(text("""
                ALTER TABLE ticket ADD CONSTRAINT ck_ticket_status
                CHECK (status IN ('onboarding', 'stable', 'churn_risk', 'important'))
            """))
            db.commit()
            logger.info("Migration: Added new status constraint")
        except Exception as ce:
            db.rollback()
            # Constraint might already exist with new values
            logger.info(f"Status constraint already exists or error: {ce}")

    except Exception as e:
        db.rollback()
        logger.error(f"Status migration error: {e}")


def fix_existing_tickets(db: Session):
    """Fix needs_reply for existing tickets based on last message sender"""
    logger.info("Starting fix_existing_tickets migration...")
    try:
        # First, update last_message_sender for all tickets
        update_sender_sql = text("""
            UPDATE ticket t
            SET last_message_sender = latest.sender_name
            FROM (
                SELECT DISTINCT ON (tel.ticket_id)
                    tel.ticket_id,
                    me.sender_name
                FROM ticket_event_link tel
                JOIN message_event me ON me.event_id = tel.event_id
                ORDER BY tel.ticket_id, me.received_at DESC
            ) latest
            WHERE t.ticket_id = latest.ticket_id
            AND (t.last_message_sender IS NULL OR t.last_message_sender != latest.sender_name)
        """)
        result = db.execute(update_sender_sql)
        db.commit()
        logger.info(f"Updated last_message_sender: {result.rowcount} rows")

        # Fix needs_reply based on sender_name pattern (모션랩스_ prefix = staff)
        # If last message sender starts with '모션랩스_' or '[모션랩스_', it's staff - no reply needed
        fix_sql = text("""
            UPDATE ticket
            SET needs_reply = FALSE
            WHERE (last_message_sender LIKE '모션랩스_%' OR last_message_sender LIKE '[모션랩스_%')
            AND (needs_reply = TRUE OR needs_reply IS NULL)
        """)
        result = db.execute(fix_sql)
        db.commit()
        logger.info(f"Fixed needs_reply for staff messages: {result.rowcount} rows")

        # Also fix sender_type in message_event for future consistency
        fix_sender_type_sql = text("""
            UPDATE message_event
            SET sender_type = 'staff',
                staff_member = SUBSTRING(sender_name FROM 5)
            WHERE (sender_name LIKE '모션랩스_%' OR sender_name LIKE '[모션랩스_%')
            AND sender_type != 'staff'
        """)
        result = db.execute(fix_sender_type_sql)
        db.commit()
        logger.info(f"Fixed sender_type for staff messages: {result.rowcount} rows")

        # Also clear sla_breached for tickets where staff responded
        fix_sla_sql = text("""
            UPDATE ticket
            SET sla_breached = FALSE
            WHERE (last_message_sender LIKE '모션랩스_%' OR last_message_sender LIKE '[모션랩스_%')
            AND sla_breached = TRUE
        """)
        result = db.execute(fix_sla_sql)
        db.commit()
        logger.info(f"Cleared sla_breached for staff-responded tickets: {result.rowcount} rows")

        # Fix specific known staff members who may have incorrect name format
        # (e.g., "한기훈" without "모션랩스_" prefix)
        known_staff_names = ['한기훈']
        for staff_name in known_staff_names:
            # Fix message_event sender_type
            fix_known_staff_sql = text("""
                UPDATE message_event
                SET sender_type = 'staff', staff_member = :name
                WHERE sender_name = :name AND sender_type != 'staff'
            """)
            result = db.execute(fix_known_staff_sql, {"name": staff_name})

            # Fix ticket needs_reply where last_message_sender is this staff
            fix_ticket_sql = text("""
                UPDATE ticket
                SET needs_reply = FALSE, sla_breached = FALSE
                WHERE last_message_sender = :name
                AND (needs_reply = TRUE OR needs_reply IS NULL)
            """)
            result2 = db.execute(fix_ticket_sql, {"name": staff_name})
            db.commit()
            logger.info(f"Fixed known staff '{staff_name}': {result.rowcount} events, {result2.rowcount} tickets")

    except Exception as e:
        db.rollback()
        logger.error(f"Error fixing existing tickets: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan - start worker thread on startup"""
    global worker_thread, worker_started

    # Create tables if not exist
    Base.metadata.create_all(bind=engine)

    # Run migrations
    db = SessionLocal()
    try:
        run_migrations(db)
        migrate_ticket_status(db)
        fix_existing_tickets(db)
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
async def trigger_learning():
    """Trigger manual learning cycle - called by Dashboard API"""
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

"""
Worker - Processes message events, runs LLM classification, checks SLA

This worker polls the database for unprocessed events and:
1. Classifies messages using Claude LLM
2. Creates/updates tickets based on message flow
3. Checks SLA breaches (20-minute rule)
4. Sends Slack alerts for breaches and urgent tickets

Run modes:
- Standalone: python -m worker.main
- With scheduler: Processes events every 5 seconds
"""

import os
import sys
import time
import logging
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional, List

from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import SessionLocal, engine, Base
from shared.models import MessageEvent, Ticket, TicketEventLink, LLMAnnotation, SLAAlertLog
from shared.config import get_settings
from shared.utils import get_kst_now

from .llm import classify_event, summarize_ticket, get_priority_from_urgency, should_upgrade_priority
from .slack import send_sla_alert, send_urgent_ticket_alert

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
    """Find the most recent open ticket for a clinic"""
    return db.query(Ticket).filter(
        Ticket.clinic_key == clinic_key,
        Ticket.status.in_(["new", "in_progress", "waiting"])
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

    if ticket:
        # Link to existing ticket
        link_event_to_ticket(db, ticket.ticket_id, event.event_id)

        # Update timestamps
        ticket.last_inbound_at = event.received_at

        # If waiting, move back to new (re-inquiry)
        if ticket.status == "waiting":
            ticket.status = "new"
            ticket.sla_breached = False
            ticket.first_inbound_at = event.received_at

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

    else:
        # Create new ticket
        new_priority = get_priority_from_urgency(classification.get("urgency", "medium"))
        ticket = Ticket(
            ticket_id=uuid4(),
            clinic_key=clinic_key,
            status="new",
            priority=new_priority,
            topic_primary=classification.get("topic"),
            summary_latest=classification.get("summary"),
            first_inbound_at=event.received_at,
            last_inbound_at=event.received_at,
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
            status="in_progress",
            priority="normal",
            first_inbound_at=None,
            last_outbound_at=event.received_at,
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

    # Clear SLA breach on response
    ticket.sla_breached = False

    # Status transition: new -> in_progress
    if ticket.status == "new":
        ticket.status = "in_progress"

    return ticket


def check_sla_breaches(db: Session):
    """
    Check for SLA breaches on open tickets.

    SLA Rule: 20 minutes from first customer message without staff response
    """
    now = get_kst_now()
    threshold = now - timedelta(minutes=settings.sla_threshold_minutes)

    # Find breachable tickets: new status, no response, first_inbound before threshold
    breached_tickets = db.query(Ticket).filter(
        Ticket.status == "new",
        Ticket.first_response_sec.is_(None),
        Ticket.first_inbound_at <= threshold,
        Ticket.sla_breached == False
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


def main():
    """Main worker loop"""
    logger.info("Worker starting...")

    # Create tables if not exist
    Base.metadata.create_all(bind=engine)

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


if __name__ == "__main__":
    main()

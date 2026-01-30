"""
Database migrations - Shared module for schema migrations

Consolidates migration logic used by both dashboard_api and worker.
"""

import logging
import traceback
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# Common column migrations
COLUMN_MIGRATIONS = [
    # (table, column, sql)
    ("ticket", "last_message_sender", "ALTER TABLE ticket ADD COLUMN last_message_sender TEXT"),
    ("ticket", "needs_reply", "ALTER TABLE ticket ADD COLUMN needs_reply BOOLEAN DEFAULT TRUE"),
    ("ticket", "intent", "ALTER TABLE ticket ADD COLUMN intent TEXT"),
    ("llm_annotation", "needs_reply", "ALTER TABLE llm_annotation ADD COLUMN needs_reply BOOLEAN"),
    ("users", "role", "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'"),
]


def run_column_migrations(db: Session) -> None:
    """Run database migrations for new columns"""
    for table, column, sql in COLUMN_MIGRATIONS:
        try:
            # Check if column exists
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
            logger.error(f"[CRITICAL] Migration failed for {table}.{column}: {e}")
            logger.error(traceback.format_exc())


def drop_old_status_constraint(db: Session) -> None:
    """Drop old status check constraint for status migration"""
    try:
        db.execute(text("ALTER TABLE ticket DROP CONSTRAINT IF EXISTS ck_ticket_status"))
        db.commit()
        logger.info("Migration: Dropped old status constraint")
    except Exception as e:
        db.rollback()
        logger.error(f"[CRITICAL] Migration failed dropping status constraint: {e}")
        logger.error(traceback.format_exc())


def migrate_ticket_status(db: Session) -> None:
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

        # Add the new constraint after data is migrated
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
        logger.error(f"[CRITICAL] Migration failed (status migration): {e}")
        logger.error(traceback.format_exc())


def fix_existing_tickets_needs_reply(db: Session) -> None:
    """
    Fix needs_reply for existing tickets based on last message sender.

    Staff messages (모션랩스_*) should set needs_reply=False.
    """
    logger.info("Starting fix_existing_tickets migration...")
    try:
        # Update last_message_sender for all tickets
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
            AND t.last_message_sender IS NULL
        """)
        result = db.execute(update_sender_sql)
        if result.rowcount > 0:
            logger.info(f"Updated last_message_sender for {result.rowcount} tickets")

        # Set needs_reply=FALSE for tickets where last message is from staff
        fix_sql = text("""
            UPDATE ticket
            SET needs_reply = FALSE
            WHERE (last_message_sender LIKE '모션랩스_%' OR last_message_sender LIKE '[모션랩스_%')
            AND (needs_reply = TRUE OR needs_reply IS NULL)
        """)
        result = db.execute(fix_sql)
        db.commit()
        if result.rowcount > 0:
            logger.info(f"Fixed needs_reply for {result.rowcount} tickets")

    except Exception as e:
        db.rollback()
        logger.error(f"[CRITICAL] Migration failed (fix existing tickets): {e}")
        logger.error(traceback.format_exc())


def run_all_migrations(db: Session) -> None:
    """Run all database migrations in order"""
    run_column_migrations(db)
    drop_old_status_constraint(db)
    migrate_ticket_status(db)
    fix_existing_tickets_needs_reply(db)

"""
Database migrations - Shared module for schema migrations

Consolidates migration logic used by both dashboard_api and worker.
"""

import logging
import traceback
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _is_sqlite(db: Session) -> bool:
    """Check if running on SQLite (skip PostgreSQL-specific migrations)"""
    try:
        return db.bind and db.bind.url.drivername.startswith("sqlite")
    except Exception:
        return False


# Common column migrations
COLUMN_MIGRATIONS = [
    # (table, column, sql)
    ("ticket", "last_message_sender", "ALTER TABLE ticket ADD COLUMN last_message_sender TEXT"),
    ("ticket", "needs_reply", "ALTER TABLE ticket ADD COLUMN needs_reply BOOLEAN DEFAULT TRUE"),
    ("ticket", "intent", "ALTER TABLE ticket ADD COLUMN intent TEXT"),
    ("llm_annotation", "needs_reply", "ALTER TABLE llm_annotation ADD COLUMN needs_reply BOOLEAN"),
    ("users", "role", "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'"),
    # 연구실→프로덕션 피드백 루프 마이그레이션
    ("pattern_application_log", "auto_approved", "ALTER TABLE pattern_application_log ADD COLUMN auto_approved BOOLEAN NOT NULL DEFAULT FALSE"),
    ("cs_understanding", "accuracy_score", "ALTER TABLE cs_understanding ADD COLUMN accuracy_score NUMERIC"),
    ("cs_understanding", "auto_approved_patterns_count", "ALTER TABLE cs_understanding ADD COLUMN auto_approved_patterns_count INTEGER DEFAULT 0"),
    # 004: Resolution tracking + highlights
    ("ticket", "resolution_status", "ALTER TABLE ticket ADD COLUMN resolution_status TEXT"),
    ("ticket", "resolved_at", "ALTER TABLE ticket ADD COLUMN resolved_at TIMESTAMPTZ"),
    ("staff_response_log", "is_highlighted", "ALTER TABLE staff_response_log ADD COLUMN is_highlighted BOOLEAN NOT NULL DEFAULT FALSE"),
    ("staff_response_log", "highlight_reason", "ALTER TABLE staff_response_log ADD COLUMN highlight_reason TEXT"),
]


def run_column_migrations(db: Session) -> None:
    """Run database migrations for new columns"""
    if _is_sqlite(db):
        return
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
    if _is_sqlite(db):
        return
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
    if _is_sqlite(db):
        return
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
    if _is_sqlite(db):
        return
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


def run_table_migrations(db: Session) -> None:
    """Create new tables if they don't exist"""
    if _is_sqlite(db):
        return
    tables_to_create = [
        (
            "staff_response_log",
            """
            CREATE TABLE staff_response_log (
                id SERIAL PRIMARY KEY,
                event_id UUID NOT NULL REFERENCES message_event(event_id) ON DELETE CASCADE,
                ticket_id UUID NOT NULL REFERENCES ticket(ticket_id) ON DELETE CASCADE,
                staff_member TEXT NOT NULL,
                clinic_key TEXT NOT NULL,
                responding_to_event_id UUID REFERENCES message_event(event_id) ON DELETE SET NULL,
                customer_text_snippet TEXT,
                customer_intent TEXT,
                customer_topic TEXT,
                response_text_snippet TEXT,
                response_delay_sec INTEGER,
                response_position INTEGER NOT NULL DEFAULT 1,
                message_length INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
            [
                "CREATE INDEX IF NOT EXISTS ix_staff_response_staff_member ON staff_response_log(staff_member)",
                "CREATE INDEX IF NOT EXISTS ix_staff_response_clinic ON staff_response_log(clinic_key)",
                "CREATE INDEX IF NOT EXISTS ix_staff_response_created ON staff_response_log(created_at)",
                "CREATE INDEX IF NOT EXISTS ix_staff_response_ticket ON staff_response_log(ticket_id)",
            ],
        ),
        (
            "staff_response_analysis",
            """
            CREATE TABLE staff_response_analysis (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                version INTEGER NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                responses_analyzed_count INTEGER,
                date_from TIMESTAMPTZ,
                date_to TIMESTAMPTZ,
                staff_members_analyzed INTEGER,
                analysis_text TEXT NOT NULL,
                insights JSONB,
                model_used TEXT,
                prompt_tokens INTEGER,
                completion_tokens INTEGER
            )
            """,
            [
                "CREATE INDEX IF NOT EXISTS ix_staff_analysis_version ON staff_response_analysis(version)",
                "CREATE INDEX IF NOT EXISTS ix_staff_analysis_created ON staff_response_analysis(created_at)",
            ],
        ),
        (
            "staff_analysis_execution",
            """
            CREATE TABLE staff_analysis_execution (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
                trigger_type TEXT,
                duration_seconds INTEGER,
                analysis_version INTEGER,
                error_message TEXT
            )
            """,
            [
                "CREATE INDEX IF NOT EXISTS ix_staff_analysis_exec_at ON staff_analysis_execution(executed_at)",
            ],
        ),
        (
            "clinic_profile",
            """
            CREATE TABLE clinic_profile (
                clinic_key TEXT PRIMARY KEY,
                sentiment_avg NUMERIC(3,2),
                complaint_ratio NUMERIC(3,2),
                urgency_avg NUMERIC(3,2),
                escalation_tendency NUMERIC(3,2),
                recontact_rate NUMERIC(3,2),
                profile_label TEXT,
                total_interactions INTEGER NOT NULL DEFAULT 0,
                total_tickets INTEGER NOT NULL DEFAULT 0,
                last_analyzed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
            [
                "CREATE INDEX IF NOT EXISTS ix_clinic_profile_label ON clinic_profile(profile_label)",
            ],
        ),
        (
            "topic_knowledge",
            """
            CREATE TABLE topic_knowledge (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                topic TEXT NOT NULL,
                pattern_summary TEXT NOT NULL,
                resolution_summary TEXT NOT NULL,
                example_conversation TEXT,
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                resolution_success_rate NUMERIC(3,2),
                source_version INTEGER,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
            [
                "CREATE INDEX IF NOT EXISTS ix_topic_knowledge_topic ON topic_knowledge(topic)",
                "CREATE INDEX IF NOT EXISTS ix_topic_knowledge_occurrence ON topic_knowledge(occurrence_count)",
            ],
        ),
    ]

    for table_name, create_sql, index_sqls in tables_to_create:
        try:
            check_sql = text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_name = :table_name
            """)
            result = db.execute(check_sql, {"table_name": table_name}).fetchone()
            if not result:
                db.execute(text(create_sql))
                for idx_sql in index_sqls:
                    db.execute(text(idx_sql))
                db.commit()
                logger.info(f"Migration: Created table {table_name} with indexes")
            else:
                logger.info(f"Migration: Table {table_name} already exists")
        except Exception as e:
            db.rollback()
            logger.error(f"[CRITICAL] Migration failed for table {table_name}: {e}")
            logger.error(traceback.format_exc())


def migrate_dedup_index(db: Session) -> None:
    """Replace old dedup index with v2 that includes received_at in hash.

    Old: ux_message_event_dedup (text_hash, bucket_ts) — caused loss of repeated short messages
    New: ux_message_event_dedup_v2 (text_hash, bucket_ts) — hash now includes received_at seconds
    """
    if _is_sqlite(db):
        return
    try:
        # Check if old index exists
        check_sql = text("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'message_event' AND indexname = 'ux_message_event_dedup'
        """)
        result = db.execute(check_sql).fetchone()
        if result:
            db.execute(text("DROP INDEX IF EXISTS ux_message_event_dedup"))
            db.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_message_event_dedup_v2 "
                "ON message_event(text_hash, bucket_ts)"
            ))
            db.commit()
            logger.info("Migration: Replaced ux_message_event_dedup with ux_message_event_dedup_v2")
        else:
            # Check if v2 exists
            check_v2 = text("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'message_event' AND indexname = 'ux_message_event_dedup_v2'
            """)
            if not db.execute(check_v2).fetchone():
                db.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_message_event_dedup_v2 "
                    "ON message_event(text_hash, bucket_ts)"
                ))
                db.commit()
                logger.info("Migration: Created ux_message_event_dedup_v2")
    except Exception as e:
        db.rollback()
        logger.error(f"[CRITICAL] Migration failed for dedup index: {e}")
        logger.error(traceback.format_exc())


def run_index_migrations(db: Session) -> None:
    """Create new indexes on existing tables"""
    if _is_sqlite(db):
        return
    indexes = [
        ("ix_ticket_resolution", "CREATE INDEX IF NOT EXISTS ix_ticket_resolution ON ticket(resolution_status)"),
        ("ix_staff_response_highlighted", "CREATE INDEX IF NOT EXISTS ix_staff_response_highlighted ON staff_response_log(is_highlighted) WHERE is_highlighted = TRUE"),
    ]
    for idx_name, idx_sql in indexes:
        try:
            db.execute(text(idx_sql))
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[Migration] Index {idx_name} failed: {e}")


def run_all_migrations(db: Session) -> None:
    """Run all database migrations in order"""
    run_column_migrations(db)
    drop_old_status_constraint(db)
    migrate_ticket_status(db)
    fix_existing_tickets_needs_reply(db)
    run_table_migrations(db)
    migrate_dedup_index(db)
    run_index_migrations(db)

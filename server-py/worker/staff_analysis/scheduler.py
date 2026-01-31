"""
직원 응답 분석 스케줄러

매주 일요일 03:00 KST에 분석 실행.
"""

import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from shared.database import SessionLocal
from .collector import collect_staff_responses
from .analyzer import analyze_and_save, save_execution_history

logger = logging.getLogger(__name__)

# 스케줄러 인스턴스
_scheduler: Optional[BackgroundScheduler] = None

# 최소 분석 대상 건수
MIN_RESPONSES_FOR_ANALYSIS = 10


def setup_staff_analysis_scheduler():
    """직원 응답 분석 스케줄러 설정 - 매주 일요일 03:00 실행"""
    global _scheduler

    if _scheduler is not None:
        logger.warning("[StaffAnalysis] Scheduler already initialized")
        return

    _scheduler = BackgroundScheduler(timezone="Asia/Seoul")

    _scheduler.add_job(
        run_staff_analysis_cycle,
        CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="staff_analysis_cycle",
        name="Staff Response Quality Analysis",
        replace_existing=True,
        kwargs={"trigger_type": "scheduled"},
    )

    _scheduler.start()
    logger.info("[StaffAnalysis] Scheduler started - runs every Sunday at 03:00 KST")


def shutdown_staff_analysis_scheduler():
    """스케줄러 종료"""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown()
        _scheduler = None
        logger.info("[StaffAnalysis] Scheduler shut down")


def run_staff_analysis_cycle(trigger_type: str = "manual"):
    """
    직원 응답 분석 사이클 실행

    1. 직원 응답 로그 수집 (최근 7일)
    2. LLM 분석 실행
    3. 결과 저장
    4. 실행 이력 기록
    """
    start_time = datetime.now()
    logger.info(
        f"[StaffAnalysis] Starting analysis cycle at {start_time} (trigger: {trigger_type})"
    )

    db = SessionLocal()
    try:
        # 1. 로그 수집
        logs_text, log_meta = collect_staff_responses(db)

        if log_meta["count"] == 0:
            logger.info("[StaffAnalysis] No responses to analyze, skipping")
            save_execution_history(
                db=db,
                status="partial",
                trigger_type=trigger_type,
                error_message="No responses to analyze",
            )
            return None

        if log_meta["count"] < MIN_RESPONSES_FOR_ANALYSIS:
            logger.info(
                f"[StaffAnalysis] Only {log_meta['count']} responses "
                f"(minimum {MIN_RESPONSES_FOR_ANALYSIS}), skipping"
            )
            save_execution_history(
                db=db,
                status="partial",
                trigger_type=trigger_type,
                error_message=f"Insufficient data: {log_meta['count']} responses (min {MIN_RESPONSES_FOR_ANALYSIS})",
            )
            return None

        # 2. 분석 및 저장
        result = analyze_and_save(db, logs_text, log_meta)

        # 3. 실행 이력 기록
        duration = (datetime.now() - start_time).seconds
        save_execution_history(
            db=db,
            status="success",
            trigger_type=trigger_type,
            duration_seconds=duration,
            analysis_version=result["version"],
        )

        logger.info(
            f"[StaffAnalysis] Completed in {duration}s - Analysis v{result['version']}"
        )
        return result

    except Exception as e:
        logger.error(f"[StaffAnalysis] Failed: {e}")
        duration = (datetime.now() - start_time).seconds
        save_execution_history(
            db=db,
            status="failed",
            trigger_type=trigger_type,
            duration_seconds=duration,
            error_message=str(e),
        )
        raise

    finally:
        db.close()


def run_staff_analysis_cycle_manual():
    """수동 실행용 래퍼"""
    return run_staff_analysis_cycle(trigger_type="manual")

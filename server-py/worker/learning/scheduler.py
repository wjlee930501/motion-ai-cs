"""
학습 스케줄러

매일 02:00 KST에 학습 사이클 실행.
"""

import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from shared.database import SessionLocal
from shared.utils import get_kst_now
from .collector import collect_all_logs
from .analyzer import analyze_and_save, save_execution_history

logger = logging.getLogger(__name__)

# 스케줄러 인스턴스
_scheduler: Optional[BackgroundScheduler] = None


def setup_learning_scheduler():
    """학습 스케줄러 설정 - 3일마다 02:00 실행"""
    global _scheduler

    if _scheduler is not None:
        logger.warning("Learning scheduler already initialized")
        return

    _scheduler = BackgroundScheduler(timezone="Asia/Seoul")

    _scheduler.add_job(
        run_learning_cycle,
        CronTrigger(day='*/3', hour=2, minute=0),
        id='learning_cycle',
        name='CS Understanding Learning Cycle',
        replace_existing=True,
        kwargs={'trigger_type': 'scheduled'}
    )

    _scheduler.start()
    logger.info("[Learning] Scheduler started - runs every 3 days at 02:00 KST")


def shutdown_learning_scheduler():
    """스케줄러 종료"""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown()
        _scheduler = None
        logger.info("[Learning] Scheduler shut down")


def run_learning_cycle(trigger_type: str = "manual"):
    """
    학습 사이클 실행

    1. 전체 대화 로그 수집
    2. 이전 이해 로드
    3. LLM 분석 실행
    4. 새 이해 저장
    5. 실행 이력 기록
    """

    start_time = datetime.now()
    logger.info(f"[Learning] Starting learning cycle at {start_time} (trigger: {trigger_type})")

    db = SessionLocal()
    try:
        # 1. 로그 수집
        logs_text, log_meta = collect_all_logs(db)

        if log_meta['count'] == 0:
            logger.info("[Learning] No logs to analyze, skipping")
            save_execution_history(
                db=db,
                status='partial',
                trigger_type=trigger_type,
                error_message='No logs to analyze'
            )
            return None

        # 2. 분석 및 저장
        result = analyze_and_save(db, logs_text, log_meta)

        # 3. 실행 이력 기록
        duration = (datetime.now() - start_time).seconds
        save_execution_history(
            db=db,
            status='success',
            trigger_type=trigger_type,
            duration_seconds=duration,
            understanding_version=result['version']
        )

        logger.info(f"[Learning] Completed in {duration}s - Understanding v{result['version']}")
        return result

    except Exception as e:
        logger.error(f"[Learning] Failed: {e}")
        duration = (datetime.now() - start_time).seconds
        save_execution_history(
            db=db,
            status='failed',
            trigger_type=trigger_type,
            duration_seconds=duration,
            error_message=str(e)
        )
        raise

    finally:
        db.close()


def run_learning_cycle_manual(trigger_type: str = "manual"):
    """수동/자동 트리거 실행용 래퍼"""
    return run_learning_cycle(trigger_type=trigger_type)

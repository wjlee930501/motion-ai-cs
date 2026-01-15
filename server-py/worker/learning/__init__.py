"""
CS 자가 학습 모듈

LLM이 축적된 대화를 반복적으로 읽으며 이해를 형성하는 시스템.
"""

from .scheduler import setup_learning_scheduler, shutdown_learning_scheduler, run_learning_cycle_manual

__all__ = ["setup_learning_scheduler", "shutdown_learning_scheduler", "run_learning_cycle_manual"]

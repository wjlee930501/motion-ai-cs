"""
대화 로그 수집기

전체 대화 로그를 채팅방별로 그룹화하여 수집.
"""

import logging
from datetime import datetime
from typing import Tuple, Dict, List, Any
from sqlalchemy.orm import Session

from shared.models import MessageEvent

logger = logging.getLogger(__name__)


def collect_all_logs(db: Session) -> Tuple[str, Dict[str, Any]]:
    """
    전체 대화 로그를 채팅방별로 그룹화하여 수집

    Returns:
        logs_text: 포맷된 로그 텍스트
        meta: 메타데이터 (count, date_from, date_to)
    """

    # 전체 메시지 조회 (채팅방, 시간순 정렬)
    events = db.query(MessageEvent).filter(
        MessageEvent.text_raw.isnot(None)
    ).order_by(
        MessageEvent.chat_room,
        MessageEvent.received_at
    ).all()

    if not events:
        return "", {'count': 0, 'date_from': None, 'date_to': None}

    # 채팅방별로 그룹화
    rooms: Dict[str, List[MessageEvent]] = {}
    for event in events:
        room = event.chat_room or 'Unknown'
        if room not in rooms:
            rooms[room] = []
        rooms[room].append(event)

    # 텍스트 포맷팅
    logs_text = format_logs_by_room(rooms)

    # 메타데이터
    all_times = [e.received_at for e in events if e.received_at]
    meta = {
        'count': len(events),
        'date_from': min(all_times) if all_times else None,
        'date_to': max(all_times) if all_times else None
    }

    logger.info(f"Collected {meta['count']} messages from {len(rooms)} rooms")

    return logs_text, meta


def format_logs_by_room(rooms: Dict[str, List[MessageEvent]]) -> str:
    """채팅방별로 로그 포맷팅"""

    parts = []

    for room_name, messages in rooms.items():
        first_time = messages[0].received_at
        last_time = messages[-1].received_at

        header = f"### 채팅방: {room_name}\n"
        if first_time and last_time:
            header += f"### 기간: {first_time.strftime('%Y-%m-%d %H:%M')} ~ {last_time.strftime('%Y-%m-%d %H:%M')}\n\n"
        else:
            header += "### 기간: 정보 없음\n\n"

        lines = []
        for msg in messages:
            time_str = msg.received_at.strftime('%H:%M') if msg.received_at else '??:??'
            sender = msg.sender_type or 'unknown'
            # 긴 메시지 truncate
            text = (msg.text_raw or '').replace('\n', ' ')[:200]
            lines.append(f"[{time_str}] {sender}: {text}")

        parts.append(header + '\n'.join(lines))

    return '\n\n---\n\n'.join(parts)

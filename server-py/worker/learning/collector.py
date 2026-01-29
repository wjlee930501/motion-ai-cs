"""
대화 로그 수집기

전체 대화 로그를 채팅방별로 그룹화하여 수집.
토큰 제한을 위한 지능적 샘플링 포함.
"""

import logging
from datetime import datetime
from typing import Tuple, Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from shared.models import MessageEvent

logger = logging.getLogger(__name__)

# 토큰 제한을 고려한 메시지 수 제한
# 대략 1 메시지 = 50-100 토큰으로 추정, 200K 토큰 제한에서 안전 마진 확보
MAX_TOTAL_MESSAGES = 1500
MAX_MESSAGES_PER_ROOM = 50  # 방당 최대 메시지 수 (다양성 확보)


def collect_all_logs(
    db: Session,
    max_messages: int = MAX_TOTAL_MESSAGES,
    max_per_room: int = MAX_MESSAGES_PER_ROOM,
) -> Tuple[str, Dict[str, Any]]:
    """
    대화 로그를 채팅방별로 그룹화하여 수집 (토큰 제한 적용)

    토큰 제한을 위해 지능적 샘플링 적용:
    - 각 방에서 최근 메시지를 max_per_room개까지 수집
    - 전체 메시지는 max_messages개로 제한
    - 다양한 방에서 샘플링하여 대표성 확보

    Returns:
        logs_text: 포맷된 로그 텍스트
        meta: 메타데이터 (count, date_from, date_to, sampled)
    """

    # 먼저 채팅방별 메시지 수 파악
    room_counts = (
        db.query(MessageEvent.chat_room, func.count(MessageEvent.event_id).label("cnt"))
        .filter(MessageEvent.text_raw.isnot(None))
        .group_by(MessageEvent.chat_room)
        .all()
    )

    total_available = sum(rc.cnt for rc in room_counts)
    room_count = len(room_counts)

    logger.info(f"Found {total_available} messages in {room_count} rooms")

    # 채팅방별로 최근 메시지 수집 (stratified sampling)
    rooms: Dict[str, List[MessageEvent]] = {}
    total_collected = 0

    # 메시지 수가 많은 방부터 처리 (활발한 방 우선)
    sorted_rooms = sorted(room_counts, key=lambda x: x.cnt, reverse=True)

    for room_info in sorted_rooms:
        room_name = room_info.chat_room or "Unknown"

        # 남은 예산 계산
        remaining_budget = max_messages - total_collected
        if remaining_budget <= 0:
            break

        # 이 방에서 가져올 메시지 수 결정
        room_limit = min(max_per_room, remaining_budget)

        # 최근 메시지부터 가져오기 (시간 역순으로 limit 적용 후 다시 정순 정렬)
        room_events = (
            db.query(MessageEvent)
            .filter(
                MessageEvent.chat_room == room_info.chat_room,
                MessageEvent.text_raw.isnot(None),
            )
            .order_by(MessageEvent.received_at.desc())
            .limit(room_limit)
            .all()
        )

        # 시간순 정렬 복원
        room_events = sorted(room_events, key=lambda e: e.received_at or datetime.min)

        if room_events:
            rooms[room_name] = room_events
            total_collected += len(room_events)

    if not rooms:
        return "", {"count": 0, "date_from": None, "date_to": None, "sampled": False}

    # 텍스트 포맷팅
    logs_text = format_logs_by_room(rooms)

    # 메타데이터
    all_events = [e for events in rooms.values() for e in events]
    all_times = [e.received_at for e in all_events if e.received_at]

    sampled = total_collected < total_available
    meta = {
        "count": total_collected,
        "total_available": total_available,
        "rooms_included": len(rooms),
        "date_from": min(all_times) if all_times else None,
        "date_to": max(all_times) if all_times else None,
        "sampled": sampled,
    }

    if sampled:
        logger.info(
            f"Sampled {total_collected}/{total_available} messages "
            f"from {len(rooms)}/{room_count} rooms (token limit protection)"
        )
    else:
        logger.info(f"Collected all {total_collected} messages from {len(rooms)} rooms")

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
            time_str = msg.received_at.strftime("%H:%M") if msg.received_at else "??:??"
            sender = msg.sender_type or "unknown"
            # 긴 메시지 truncate
            text = (msg.text_raw or "").replace("\n", " ")[:200]
            lines.append(f"[{time_str}] {sender}: {text}")

        parts.append(header + "\n".join(lines))

    return "\n\n---\n\n".join(parts)

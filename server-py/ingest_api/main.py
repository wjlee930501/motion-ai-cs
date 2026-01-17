"""
Ingest API - Receives KakaoTalk messages from Android collector

Endpoints:
- POST /v1/events - Receive message event
- POST /v1/heartbeat - Device health check
"""

import os
from uuid import uuid4
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from shared.database import get_db, engine, Base
from shared.models import MessageEvent, DeviceHeartbeat
from shared.schemas import EventCreate, EventResponse, HeartbeatRequest, HeartbeatResponse, ErrorResponse
from shared.utils import classify_sender, get_bucket_ts, hash_text, get_kst_now
from shared.config import get_settings


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables if not exist
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown


app = FastAPI(
    title="CS Ingest API",
    description="Receives KakaoTalk messages from Android collector",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_device_key(x_device_key: str = Header(None)) -> str:
    """Verify device key from header"""
    if not x_device_key or x_device_key != settings.device_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Invalid device key"}}
        )
    return x_device_key


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ingest-api"}


@app.post("/v1/events", response_model=EventResponse)
async def create_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    device_key: str = Depends(verify_device_key)
):
    """
    Receive KakaoTalk message event from Android.

    Performs:
    1. Sender classification (staff vs customer)
    2. Deduplication check (10-second bucket)
    3. Store in database
    """
    # Classify sender
    sender_type, staff_member = classify_sender(event.sender_name)

    # Determine direction based on sender type
    direction = "outbound" if sender_type == "staff" else "inbound"

    # Generate dedup hash and bucket timestamp
    text_hash = hash_text(event.chat_room, event.sender_name, event.text)
    bucket_ts = get_bucket_ts(event.received_at)

    # Create event record
    event_id = uuid4()
    db_event = MessageEvent(
        event_id=event_id,
        device_id=event.device_id,
        chat_room=event.chat_room,
        sender_name=event.sender_name,
        sender_type=sender_type,
        staff_member=staff_member,
        direction=direction,
        text_raw=event.text,
        text_hash=text_hash,
        bucket_ts=bucket_ts,
        received_at=event.received_at,
        metadata_json=event.metadata.model_dump() if event.metadata else None,
        ingest_status="received"
    )

    try:
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        return EventResponse(ok=True, event_id=event_id, deduped=False)

    except IntegrityError:
        # Duplicate detected (unique constraint on text_hash + bucket_ts)
        db.rollback()

        # Find existing event
        existing = db.query(MessageEvent).filter(
            MessageEvent.text_hash == text_hash,
            MessageEvent.bucket_ts == bucket_ts
        ).first()

        if existing:
            return EventResponse(ok=True, event_id=existing.event_id, deduped=True)

        # Shouldn't happen, but handle gracefully
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"ok": False, "error": {"code": "INTERNAL_ERROR", "message": "Dedup conflict"}}
        )


@app.post("/v1/heartbeat", response_model=HeartbeatResponse)
async def heartbeat(
    request: HeartbeatRequest,
    db: Session = Depends(get_db),
    device_key: str = Depends(verify_device_key)
):
    """
    Receive heartbeat from Android device.

    Updates or creates device heartbeat record.
    """
    # Upsert heartbeat
    existing = db.query(DeviceHeartbeat).filter(
        DeviceHeartbeat.device_id == request.device_id
    ).first()

    if existing:
        existing.last_seen_at = request.ts
    else:
        db_heartbeat = DeviceHeartbeat(
            device_id=request.device_id,
            last_seen_at=request.ts
        )
        db.add(db_heartbeat)

    db.commit()
    return HeartbeatResponse(ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

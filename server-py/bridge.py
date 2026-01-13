"""
Bridge Script - Pulls messages from Android app and pushes to Ingest API

Usage:
    python bridge.py --android-ip 172.30.1.48 --server-url http://localhost:8001
"""

import argparse
import time
import httpx
from datetime import datetime
import pytz

KST = pytz.timezone("Asia/Seoul")

class AndroidBridge:
    def __init__(self, android_ip: str, server_url: str, device_key: str):
        self.android_url = f"http://{android_ip}:8080"
        self.server_url = server_url
        self.device_key = device_key
        self.last_sync_time = 0
        self.seen_messages = set()

    def get_android_messages(self):
        """Fetch all messages from Android app"""
        try:
            response = httpx.get(f"{self.android_url}/api/sync", timeout=10)
            if response.is_success:
                return response.json()
            return None
        except Exception as e:
            print(f"[ERROR] Failed to fetch from Android: {e}")
            return None

    def push_to_server(self, room_name: str, sender: str, message: str, timestamp: int):
        """Push message to Ingest API"""
        try:
            # Convert timestamp to ISO format
            dt = datetime.fromtimestamp(timestamp / 1000, tz=KST)
            received_at = dt.isoformat()

            payload = {
                "device_id": "android-bridge-001",
                "chat_room": room_name,
                "sender_name": sender,
                "text": message,
                "received_at": received_at
            }

            response = httpx.post(
                f"{self.server_url}/v1/events",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Device-Key": self.device_key
                },
                timeout=10
            )

            if response.is_success:
                data = response.json()
                if data.get("deduped"):
                    print(f"[SKIP] Duplicate: {room_name} - {sender}: {message[:30]}...")
                else:
                    print(f"[OK] Sent: {room_name} - {sender}: {message[:30]}...")
                return True
            else:
                print(f"[ERROR] Server returned {response.status_code}: {response.text}")
                return False

        except Exception as e:
            print(f"[ERROR] Failed to push to server: {e}")
            return False

    def sync(self):
        """Sync messages from Android to server"""
        data = self.get_android_messages()
        if not data:
            return 0

        rooms = {r["id"]: r["roomName"] for r in data.get("rooms", [])}
        messages = data.get("messages", [])

        new_count = 0
        for msg in messages:
            # Create unique key for dedup
            msg_key = f"{msg['roomId']}:{msg['timestamp']}:{msg['body'][:50]}"

            if msg_key in self.seen_messages:
                continue

            # Only sync recent messages (last 5 minutes on first run, then all new)
            if self.last_sync_time == 0:
                cutoff = int(time.time() * 1000) - (5 * 60 * 1000)  # 5 minutes ago
                if msg["timestamp"] < cutoff:
                    self.seen_messages.add(msg_key)
                    continue

            room_name = rooms.get(msg["roomId"], "Unknown")
            sender = msg.get("sender", "Unknown")
            body = msg.get("body", "")
            timestamp = msg.get("timestamp", int(time.time() * 1000))

            if self.push_to_server(room_name, sender, body, timestamp):
                self.seen_messages.add(msg_key)
                new_count += 1

        self.last_sync_time = int(time.time() * 1000)
        return new_count

    def run(self, interval: int = 3):
        """Run bridge loop"""
        print(f"[Bridge] Starting bridge...")
        print(f"[Bridge] Android: {self.android_url}")
        print(f"[Bridge] Server: {self.server_url}")
        print(f"[Bridge] Polling interval: {interval}s")
        print("-" * 50)

        while True:
            try:
                new_count = self.sync()
                if new_count > 0:
                    print(f"[Bridge] Synced {new_count} new messages")
            except KeyboardInterrupt:
                print("\n[Bridge] Stopping...")
                break
            except Exception as e:
                print(f"[Bridge] Error: {e}")

            time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="Android to Server Bridge")
    parser.add_argument("--android-ip", default="172.30.1.48", help="Android device IP")
    parser.add_argument("--server-url", default="http://localhost:8001", help="Ingest API URL")
    parser.add_argument("--device-key", default="shared-secret-for-android", help="Device key")
    parser.add_argument("--interval", type=int, default=3, help="Polling interval in seconds")

    args = parser.parse_args()

    bridge = AndroidBridge(
        android_ip=args.android_ip,
        server_url=args.server_url,
        device_key=args.device_key
    )

    bridge.run(interval=args.interval)


if __name__ == "__main__":
    main()

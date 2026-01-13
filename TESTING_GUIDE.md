# CS 로그 수집 테스트 가이드

이 문서는 실제 안드로이드 폰을 사용하여 CS 로그 수집 테스트를 진행하기 위한 가이드입니다.

## 사전 준비 사항

### 1. 환경 변수 설정

**필수 설정**
```bash
# server-py/.env 파일에서 Anthropic API 키 설정
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

API 키는 https://console.anthropic.com/ 에서 발급받을 수 있습니다.

**선택 설정 (Slack 알림)**
```bash
# Slack 알림을 받으려면 Webhook URL 설정
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. 네트워크 환경 확인

- 안드로이드 폰과 서버가 **같은 네트워크**에 있어야 합니다.
- 서버의 IP 주소를 확인하세요: `ip addr show` 또는 `ifconfig`
- 안드로이드 폰의 IP 주소도 확인하세요 (설정 > Wi-Fi > 네트워크 정보)

### 3. IP 주소 설정 업데이트

환경에 맞게 다음 파일들의 IP 주소를 수정하세요:

**ChatLoggerWeb/.env**
```env
VITE_ANDROID_API_URL=http://[안드로이드폰IP]:8080
VITE_WS_URL=ws://[안드로이드폰IP]:8081
```

---

## 서버 시작

```bash
# 1. 프로젝트 루트로 이동
cd /home/user/motion-ai-cs

# 2. Docker Compose로 서비스 시작
docker-compose -f docker-compose.dev.yml up -d

# 3. 서비스 상태 확인
docker-compose -f docker-compose.dev.yml ps

# 4. 로그 확인
docker-compose -f docker-compose.dev.yml logs -f
```

### 서비스 포트

| 서비스 | 포트 | 설명 |
|--------|------|------|
| Dashboard API | 8000 | 웹 대시보드 API |
| Ingest API | 8001 | 안드로이드에서 메시지 수신 |
| Web Dashboard | 3000 | 웹 프론트엔드 |
| PostgreSQL | 5432 | 데이터베이스 |

### 헬스 체크

```bash
# Ingest API 확인
curl http://localhost:8001/health

# Dashboard API 확인
curl http://localhost:8000/health
```

---

## 안드로이드 앱 설정

### 1. APK 빌드 및 설치

```bash
# ChatLoggerBot 디렉토리로 이동
cd ChatLoggerBot

# APK 빌드
./gradlew assembleDebug

# APK 설치 (USB 연결 상태에서)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 2. 앱 권한 설정

앱 실행 후 다음 권한을 허용해야 합니다:

1. **알림 접근 권한**
   - 앱에서 "Enable Notification Access" 버튼 클릭
   - 설정으로 이동하여 ChatLoggerBot 활성화

2. **알림 권한** (Android 13+)
   - 앱 내에서 알림 권한 요청 수락

### 3. 백엔드 서버 설정

앱의 **Settings** 화면에서:

1. **Backend Server Settings** 섹션 확인
2. **Backend URL** 입력: `http://[서버IP]:8001`
3. **Device Key** 입력: `local-dev-key`
4. **Save** 버튼 클릭
5. **Test** 버튼으로 연결 확인

---

## 테스트 절차

### Step 1: 서버 연결 테스트

1. 앱 Settings에서 **Test** 버튼 클릭
2. "Connected successfully" 메시지 확인
3. 실패 시:
   - IP 주소 확인
   - 방화벽 설정 확인
   - Docker 컨테이너 실행 확인

### Step 2: 카카오톡 메시지 테스트

1. 카카오톡에서 테스트 메시지 전송
2. 앱의 Home 화면에서 메시지 수신 확인
3. 서버 로그에서 이벤트 수신 확인:
   ```bash
   docker logs -f cs-ingest-api
   ```

### Step 3: 티켓 생성 확인

1. Worker 로그 확인:
   ```bash
   docker logs -f cs-worker
   ```
2. 메시지 분류 및 티켓 생성 확인
3. 웹 대시보드 접속 (http://localhost:3000)
4. 로그인: admin / 1234
5. 티켓 목록에서 새 티켓 확인

### Step 4: SLA 알림 테스트

1. 20분 동안 고객 메시지에 응답하지 않음
2. Worker 로그에서 SLA 경고 확인
3. Slack 웹훅 설정 시, Slack 채널에서 알림 확인

---

## 트러블슈팅

### 문제: 안드로이드에서 서버에 연결 실패

```bash
# 서버에서 방화벽 확인
sudo ufw status
sudo ufw allow 8001

# Docker 네트워크 확인
docker network ls
docker network inspect motion-ai-cs_default
```

### 문제: 카카오톡 알림이 수신되지 않음

1. 알림 접근 권한 다시 확인
2. 카카오톡 알림 설정 확인
3. 앱 로그 확인:
   ```bash
   adb logcat | grep KakaoNotificationListener
   ```

### 문제: Worker가 메시지를 처리하지 않음

1. Anthropic API 키 확인
2. Worker 로그 확인:
   ```bash
   docker logs -f cs-worker
   ```
3. 데이터베이스 이벤트 확인:
   ```bash
   docker exec -it cs-postgres psql -U csuser -d csdb -c "SELECT * FROM message_event ORDER BY created_at DESC LIMIT 5;"
   ```

### 문제: 웹 대시보드 로그인 실패

1. Dashboard API 로그 확인
2. 기본 계정 확인: admin / 1234
3. 데이터베이스 사용자 확인:
   ```bash
   docker exec -it cs-postgres psql -U csuser -d csdb -c "SELECT email FROM users;"
   ```

---

## 로그 확인 명령어

```bash
# 전체 로그
docker-compose -f docker-compose.dev.yml logs -f

# 특정 서비스 로그
docker logs -f cs-ingest-api
docker logs -f cs-worker
docker logs -f cs-dashboard-api

# 안드로이드 로그
adb logcat | grep -E "(KakaoNotificationListener|BackendApiClient|HealthCheckWorker)"
```

---

## 데이터 초기화

테스트 데이터를 초기화하려면:

```bash
# Docker 볼륨 삭제 후 재시작
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

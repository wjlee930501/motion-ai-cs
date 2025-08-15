# ChatLogger - KakaoTalk Chat Monitoring System

완전한 카카오톡 채팅 모니터링 시스템 (Android APK + Web Interface)

## 🎯 주요 기능

### Android APK (ChatLoggerBot)
- ✅ KakaoTalk 알림 실시간 수신 및 파싱
- ✅ Room Database를 통한 로컬 저장
- ✅ REST API 서버 (포트 8080)
- ✅ WebSocket 서버 (포트 8081)
- ✅ 백그라운드 상시 실행 (ForegroundService)
- ✅ 부팅 시 자동 시작
- ✅ 데이터 내보내기 (JSON/CSV)

### Web Interface (ChatLoggerWeb)
- ✅ 실제 카카오톡과 유사한 UI
- ✅ 채팅방별 메시지 히스토리 조회
- ✅ 실시간 메시지 업데이트 (WebSocket)
- ✅ 메시지 검색 기능
- ✅ 통계 대시보드
- ✅ 반응형 디자인

## 🚀 빠른 시작

### 전체 시스템 배포
```bash
# 전체 시스템 자동 배포
./deploy.sh
```

### 개별 실행

#### 1. Android APK 빌드 및 설치
```bash
cd ChatLoggerBot
./scripts/build.sh      # APK 빌드
./scripts/provision.sh  # 디바이스에 설치 및 설정
```

#### 2. Web Interface 실행
```bash
cd ChatLoggerWeb
npm install            # 의존성 설치
npm run dev           # 개발 서버 실행 (http://localhost:3000)
```

#### 3. Docker로 실행
```bash
docker-compose up -d  # 모든 서비스 시작
```

## 📱 Android 설정

### 필수 권한
- 알림 접근 권한 (Notification Access)
- POST_NOTIFICATIONS (Android 13+)
- 배터리 최적화 제외

### 자동 프로비저닝
```bash
./ChatLoggerBot/scripts/provision.sh
```
이 스크립트가 자동으로:
- APK 설치
- 알림 권한 부여
- 배터리 최적화 제외
- ForegroundService 시작

## 🌐 Web Interface 설정

### 환경 변수 설정
```bash
cd ChatLoggerWeb
cp .env.example .env
# .env 파일에서 Android 디바이스 IP 수정
```

### 접속 URL
- Web Interface: http://localhost:3000
- Android API: http://[device-ip]:8080
- WebSocket: ws://[device-ip]:8081

## 🏗️ 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   KakaoTalk     │────▶│  Android APK    │────▶│  Web Interface  │
│  Notifications  │     │  (ChatLogger)   │     │    (React)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌─────────────┐          ┌─────────────┐
                        │Room Database│          │  PostgreSQL │
                        └─────────────┘          └─────────────┘
```

## 📂 프로젝트 구조

```
ai-cs/
├── ChatLoggerBot/          # Android 앱
│   ├── app/               # 앱 소스 코드
│   ├── scripts/           # 빌드/배포 스크립트
│   └── README.md
├── ChatLoggerWeb/          # Web 인터페이스
│   ├── src/               # React 소스 코드
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml      # Docker 구성
├── deploy.sh              # 전체 배포 스크립트
└── README.md
```

## 🔧 기술 스택

### Android
- Kotlin
- Jetpack Compose
- Room Database
- NanoHTTPD (REST API)
- NanoWSD (WebSocket)
- WorkManager
- Coroutines

### Web
- React 18
- TypeScript
- Tailwind CSS
- Socket.io Client
- React Query
- Vite

### Infrastructure
- Docker
- PostgreSQL
- Nginx

## 📊 데이터 플로우

1. **알림 수신**: KakaoTalk → NotificationListenerService
2. **파싱**: NotificationParser → 구조화된 데이터
3. **저장**: Room Database (로컬) + PostgreSQL (선택)
4. **API 제공**: REST API + WebSocket
5. **웹 표시**: React UI에서 실시간 렌더링

## 🛠️ 문제 해결

### Android 디바이스 연결 안 됨
```bash
adb devices  # 디바이스 확인
adb tcpip 5555  # TCP 모드 활성화
adb connect [device-ip]:5555
```

### 알림이 수신되지 않음
1. 설정 → 알림 → 알림 접근 → ChatLoggerBot 활성화
2. 카카오톡 알림 설정 확인
3. 배터리 최적화 제외 확인

### Web Interface 연결 실패
1. Android 디바이스와 같은 네트워크 확인
2. 디바이스 IP 주소 확인: `adb shell ip addr`
3. `.env` 파일의 API URL 수정

## 📝 라이선스

MotionLabs Internal Use Only

## 🤝 기여

내부 사용 전용 프로젝트입니다.
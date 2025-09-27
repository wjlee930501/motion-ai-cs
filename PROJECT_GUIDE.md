# ChatLogger 프로젝트 통합 가이드

## 📋 프로젝트 개요
**ChatLogger**는 KakaoTalk CS 채팅을 모니터링하고 관리하기 위한 통합 시스템입니다. Android 기기에서 알림을 수신하여 웹 인터페이스로 실시간 표시하고 관리할 수 있습니다.

## 🏗️ 시스템 아키텍처

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   KakaoTalk      │ ───▶ │  Android APK     │ ───▶ │  Web Interface   │
│  Notifications   │      │ (ChatLoggerBot)  │      │  (React/Vite)    │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                  │                           │
                                  ▼                           ▼
                          ┌──────────────┐          ┌──────────────┐
                          │Room Database │          │  PostgreSQL  │
                          │  (SQLite)    │          │              │
                          └──────────────┘          └──────────────┘
```

### 통신 프로토콜
- **REST API**: 포트 8080 (데이터 조회)
- **WebSocket**: 포트 8081 (실시간 업데이트)
- **PostgreSQL**: 포트 5432 (데이터 영구 저장)

## 🔧 기술 스택

### Android (ChatLoggerBot)
- **언어**: Kotlin
- **UI**: Jetpack Compose
- **데이터베이스**: Room (SQLite)
- **서버**: NanoHTTPD (REST), NanoWSD (WebSocket)
- **백그라운드**: ForegroundService, WorkManager
- **알림 처리**: NotificationListenerService

### Web (ChatLoggerWeb)
- **프레임워크**: React 18 + TypeScript
- **빌드**: Vite
- **스타일링**: Tailwind CSS
- **통신**: Axios (REST), Socket.io (WebSocket)
- **상태관리**: Zustand
- **라우팅**: React Router v6

### Infrastructure
- **컨테이너**: Docker Compose
- **데이터베이스**: PostgreSQL 15
- **웹서버**: Nginx (Production)

## 💾 데이터 모델

### ChatRoom (채팅방)
```sql
- id: VARCHAR(36) PRIMARY KEY
- room_name: VARCHAR(255)
- last_message_at: BIGINT
- last_message: TEXT
- unread_count: INTEGER
```

### ChatMessage (메시지)
```sql
- id: VARCHAR(36) PRIMARY KEY
- room_id: VARCHAR(36) FOREIGN KEY
- timestamp: BIGINT
- sender: VARCHAR(255)
- body: TEXT
- raw_json: TEXT
- is_from_me: BOOLEAN
```

## 🚀 설치 및 실행 가이드

### 전체 시스템 자동 배포
```bash
# 프로젝트 루트에서 실행
./deploy.sh
```
이 스크립트는 다음을 자동 수행합니다:
1. Android APK 빌드
2. Android 기기 프로비저닝
3. Web 애플리케이션 빌드
4. Docker 컨테이너 시작
5. 헬스 체크

### 개별 컴포넌트 실행

#### 1. Android APK 설정
```bash
cd ChatLoggerBot

# APK 빌드
./scripts/build.sh

# 기기에 설치 및 권한 설정
./scripts/provision.sh
```

**자동 설정 항목:**
- APK 설치
- 알림 접근 권한 부여
- POST_NOTIFICATIONS 권한 (Android 13+)
- 배터리 최적화 제외
- ForegroundService 시작
- 부팅 시 자동 시작 설정

#### 2. Web Interface 실행
```bash
cd ChatLoggerWeb

# 개발 모드
npm install
npm run dev

# Production 빌드
npm run build
```

#### 3. Docker 환경
```bash
# 전체 시작
docker-compose up -d

# 개별 서비스
docker-compose up -d chatlogger-db    # DB만
docker-compose up -d chatlogger-web   # Web만
docker-compose up -d chatlogger-sync  # Sync만

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

## 📱 주요 기능 동작 방식

### 1. 알림 수신 및 파싱
**파일**: `KakaoNotificationListener.kt`

1. KakaoTalk 알림 수신 (NotificationListenerService)
2. NotificationParser로 메시지 파싱
3. Room Database에 저장
4. WebSocket으로 실시간 브로드캐스트

**파싱 데이터:**
- 채팅방 이름
- 발신자
- 메시지 내용
- 타임스탬프
- Raw JSON (디버깅용)

### 2. REST API 엔드포인트
**파일**: `ApiService.kt`

| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/api/rooms` | GET | 모든 채팅방 조회 |
| `/api/rooms/{id}/messages` | GET | 특정 채팅방 메시지 조회 |
| `/api/sync` | GET | 전체 데이터 동기화 |
| `/api/search?q={query}` | GET | 메시지 검색 |
| `/api/stats` | GET | 통계 정보 |
| `/health` | GET | 헬스 체크 |

### 3. WebSocket 실시간 통신
**파일**: `WebSocketServer.kt`

**이벤트:**
- `new_message`: 새 메시지 수신
- `room_update`: 채팅방 정보 업데이트
- `connection`: 클라이언트 연결
- `sync_request`: 데이터 동기화 요청

### 4. Web Interface 라우팅
**파일**: `App.tsx`

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | SimpleLoggerPage | 메인 대시보드 |
| `/cs` | CSHomePage | CS 전용 뷰 |
| `/chat/:roomId` | ChatPage | 채팅방 상세 |
| `/search` | SearchPage | 메시지 검색 |
| `/analytics` | CSAnalyticsPage | 통계 분석 |

### 5. 데이터 플로우
```
1. KakaoTalk 알림 발생
   ↓
2. NotificationListenerService 수신
   ↓
3. NotificationParser 파싱
   ↓
4. Room Database 저장 (로컬)
   ↓
5. WebSocket 브로드캐스트
   ↓
6. React UI 실시간 업데이트
   ↓
7. PostgreSQL 영구 저장 (옵션)
```

## 🔒 보안 및 권한

### Android 필수 권한
- `BIND_NOTIFICATION_LISTENER_SERVICE` - 알림 접근
- `POST_NOTIFICATIONS` - 알림 표시 (Android 13+)
- `FOREGROUND_SERVICE` - 백그라운드 실행
- `RECEIVE_BOOT_COMPLETED` - 부팅 시 자동 시작
- `INTERNET` - 네트워크 통신

### 네트워크 보안
- CORS 헤더 설정
- 로컬 네트워크 내부 통신
- WebSocket 인증 (구현 필요 시)

## 🛠️ 문제 해결

### Android 관련

**알림이 수신되지 않음:**
1. 설정 → 알림 → 알림 접근 → ChatLoggerBot 활성화 확인
2. KakaoTalk 알림 설정 확인
3. 배터리 최적화 제외 확인
```bash
adb shell settings get secure enabled_notification_listeners
```

**서비스가 중단됨:**
- WorkManager가 자동으로 재시작
- ForegroundService 상태 확인
```bash
adb shell dumpsys activity services | grep chatlogger
```

### Web Interface 관련

**연결 실패:**
1. Android 기기와 같은 네트워크 확인
2. 기기 IP 주소 확인
```bash
adb shell ip addr | grep wlan0
```
3. `.env` 파일 수정
```env
VITE_API_URL=http://[device-ip]:8080
```

**실시간 업데이트 안 됨:**
- WebSocket 연결 상태 확인 (포트 8081)
- 브라우저 개발자 도구 → Network → WS 탭

### Docker 관련

**컨테이너 시작 실패:**
```bash
# 로그 확인
docker-compose logs chatlogger-db
docker-compose logs chatlogger-web

# 포트 충돌 확인
netstat -an | grep 3000
netstat -an | grep 5432
```

## 📊 데이터 관리

### 백업
```bash
# Android 데이터 내보내기 (앱 내 기능)
- 설정 → 데이터 내보내기 → JSON/CSV 선택

# PostgreSQL 백업
docker exec chatlogger-db pg_dump -U chatlogger chatlogger > backup.sql
```

### 복원
```bash
# PostgreSQL 복원
docker exec -i chatlogger-db psql -U chatlogger chatlogger < backup.sql
```

### 데이터 보존
- 기본 90일 보관
- `RetentionManager.kt`에서 설정 변경 가능
- 자동 삭제는 WorkManager로 스케줄링

## 🔄 업데이트 및 유지보수

### 버전 관리
- Android: `build.gradle` versionCode/versionName
- Web: `package.json` version
- Docker: `docker-compose.yml` image tags

### 로그 위치
- Android: `adb logcat | grep ChatLogger`
- Web: 브라우저 콘솔
- Docker: `docker-compose logs -f`

## 📝 추가 개발 시 고려사항

### 확장 가능한 기능
1. **사용자 인증**: JWT 토큰 기반 인증
2. **다중 기기 지원**: 여러 Android 기기 연결
3. **메시지 필터링**: 키워드/발신자별 필터
4. **자동 응답**: 템플릿 기반 응답
5. **분석 대시보드**: 응답 시간, 빈도 분석
6. **알림 설정**: 특정 조건 시 알림

### 성능 최적화
- 메시지 페이지네이션
- 이미지 lazy loading
- WebSocket 재연결 로직
- 데이터베이스 인덱싱

### 보안 강화
- API 인증 토큰
- HTTPS 적용
- 데이터 암호화
- Rate limiting

## 🤝 지원 및 문의
내부 사용 프로젝트로 MotionLabs 개발팀에 문의하세요.

---
*Last Updated: 2025-09-27*
*Version: 1.0.0*
# MotionLabs ChatLoggerBot v1.0

Android 단말기에서 KakaoTalk 알림을 수신하여 채팅 내역을 자동으로 기록하는 앱

## 주요 기능

- KakaoTalk 푸시 알림 자동 수신 및 파싱
- 채팅방별 메시지 구조화 저장 (Room Database)
- 카카오톡 스타일 UI로 대화 내역 조회
- 데이터 내보내기 (JSON/CSV)
- 90일 자동 보존 정책
- 부팅 시 자동 시작
- 백그라운드 상시 실행 (ForegroundService)

## 빌드 방법

```bash
# 1. APK 빌드
./scripts/build.sh

# 2. 설치 및 프로비저닝
./scripts/provision.sh
```

## 수동 설정 (필요 시)

1. **알림 접근 권한**
   - 설정 > 알림 > 알림 접근 > ChatLoggerBot 활성화

2. **배터리 최적화 제외**
   - 설정 > 배터리 > 배터리 최적화 > ChatLoggerBot > 최적화 안 함

## 프로젝트 구조

```
ChatLoggerBot/
├── app/
│   ├── src/main/java/com/motionlabs/chatlogger/
│   │   ├── MainActivity.kt          # 메인 액티비티
│   │   ├── data/                   # 데이터 레이어
│   │   │   ├── db/                 # Room Database
│   │   │   └── repo/               # Repository
│   │   ├── notify/                 # 알림 처리
│   │   │   ├── KakaoNotificationListener.kt
│   │   │   └── NotificationParser.kt
│   │   ├── service/                # 백그라운드 서비스
│   │   │   ├── ForegroundService.kt
│   │   │   ├── BootReceiver.kt
│   │   │   └── HealthCheckWorker.kt
│   │   ├── ui/                     # UI 컴포넌트
│   │   │   ├── HomeScreen.kt
│   │   │   ├── ChatScreen.kt
│   │   │   └── SettingsScreen.kt
│   │   └── ops/                    # 운영 기능
│   │       ├── ExportManager.kt
│   │       └── RetentionManager.kt
│   └── AndroidManifest.xml
├── scripts/
│   ├── build.sh                    # 빌드 스크립트
│   └── provision.sh                # 프로비저닝 스크립트
└── README.md
```

## 요구사항

- Android 8.0 (API 26) 이상
- KakaoTalk 설치된 단말기
- USB 디버깅 활성화 (프로비저닝용)

## 라이선스

MotionLabs Internal Use Only
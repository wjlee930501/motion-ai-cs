# Deployment Guide (GCP)

## 1. 환경 변수

### Server 공통

```bash
# Database
DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance

# Auth
JWT_SECRET=your-secret-key-min-32-chars

# Timezone
TZ=Asia/Seoul
```

### Ingest API

```bash
# Device authentication
DEVICE_KEY=shared-secret-for-android

# Pub/Sub
PUBSUB_TOPIC_EVENTS=projects/PROJECT_ID/topics/cs-events
```

### Worker

```bash
# Pub/Sub
PUBSUB_SUBSCRIPTION_EVENTS=projects/PROJECT_ID/subscriptions/cs-events-sub

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_MODEL_DEFAULT=claude-3-haiku-20240307
ANTHROPIC_MODEL_ESCALATE=claude-3-5-sonnet-20241022

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SLA_THRESHOLD_MINUTES=20

# Dashboard URL (for alert links)
DASHBOARD_URL=https://cs.motionlabs.io
```

### Dashboard API

```bash
# (DATABASE_URL, JWT_SECRET, TZ 공통)
```

### Web Dashboard

```bash
NEXT_PUBLIC_API_URL=https://api.cs.motionlabs.io
```

---

## 2. GCP 리소스 생성

### Cloud SQL (PostgreSQL)

```bash
# 인스턴스 생성
gcloud sql instances create motionlabs-cs \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-northeast3 \
  --storage-size=10GB \
  --storage-auto-increase

# 데이터베이스 생성
gcloud sql databases create csdb --instance=motionlabs-cs

# 유저 생성
gcloud sql users create csuser \
  --instance=motionlabs-cs \
  --password=YOUR_PASSWORD

# 스키마 적용 (Cloud Shell에서)
gcloud sql connect motionlabs-cs --user=csuser --database=csdb
# -> 03-db.sql 내용 실행
```

### Pub/Sub

```bash
# Topic 생성
gcloud pubsub topics create cs-events

# Subscription 생성
gcloud pubsub subscriptions create cs-events-sub \
  --topic=cs-events \
  --ack-deadline=60
```

### Secret Manager

```bash
# 시크릿 저장
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "sk-ant-xxxxx" | gcloud secrets create anthropic-key --data-file=-
echo -n "https://hooks.slack.com/xxx" | gcloud secrets create slack-webhook --data-file=-
echo -n "device-shared-key" | gcloud secrets create device-key --data-file=-
```

---

## 3. Docker 설정

### server/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### server/requirements.txt

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pydantic==2.5.3
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.26.0
anthropic==0.18.0
google-cloud-pubsub==2.19.0
python-multipart==0.0.6
```

### web-dashboard/Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### docker-compose.yml (로컬 개발용)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: csuser
      POSTGRES_PASSWORD: localpass
      POSTGRES_DB: csdb
    ports:
      - "5432:5432"
    volumes:
      - ./docs/03-db.sql:/docker-entrypoint-initdb.d/init.sql
      - pgdata:/var/lib/postgresql/data

  ingest-api:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://csuser:localpass@postgres:5432/csdb
      DEVICE_KEY: local-dev-key
      JWT_SECRET: local-jwt-secret-32-characters-min
      TZ: Asia/Seoul
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    command: uvicorn ingest_api.main:app --host 0.0.0.0 --port 8080 --reload

  dashboard-api:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://csuser:localpass@postgres:5432/csdb
      JWT_SECRET: local-jwt-secret-32-characters-min
      TZ: Asia/Seoul
    ports:
      - "8081:8080"
    depends_on:
      - postgres
    command: uvicorn dashboard_api.main:app --host 0.0.0.0 --port 8080 --reload

  web:
    build:
      context: ./web-dashboard
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8081
    ports:
      - "3000:3000"
    depends_on:
      - dashboard-api

volumes:
  pgdata:
```

---

## 4. Cloud Run 배포

### Ingest API

```bash
# 빌드 & 푸시
gcloud builds submit --tag gcr.io/PROJECT_ID/cs-ingest-api ./server

# 배포
gcloud run deploy cs-ingest-api \
  --image gcr.io/PROJECT_ID/cs-ingest-api \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT_ID:asia-northeast3:motionlabs-cs \
  --set-secrets DATABASE_URL=db-url:latest,DEVICE_KEY=device-key:latest,JWT_SECRET=jwt-secret:latest \
  --set-env-vars TZ=Asia/Seoul,PUBSUB_TOPIC_EVENTS=projects/PROJECT_ID/topics/cs-events
```

### Worker

```bash
# 빌드 & 푸시
gcloud builds submit --tag gcr.io/PROJECT_ID/cs-worker ./server

# 배포
gcloud run deploy cs-worker \
  --image gcr.io/PROJECT_ID/cs-worker \
  --platform managed \
  --region asia-northeast3 \
  --no-allow-unauthenticated \
  --add-cloudsql-instances PROJECT_ID:asia-northeast3:motionlabs-cs \
  --set-secrets DATABASE_URL=db-url:latest,ANTHROPIC_API_KEY=anthropic-key:latest,SLACK_WEBHOOK_URL=slack-webhook:latest \
  --set-env-vars TZ=Asia/Seoul,SLA_THRESHOLD_MINUTES=20,DASHBOARD_URL=https://cs.motionlabs.io
```

### Dashboard API

```bash
# 빌드 & 푸시
gcloud builds submit --tag gcr.io/PROJECT_ID/cs-dashboard-api ./server

# 배포
gcloud run deploy cs-dashboard-api \
  --image gcr.io/PROJECT_ID/cs-dashboard-api \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT_ID:asia-northeast3:motionlabs-cs \
  --set-secrets DATABASE_URL=db-url:latest,JWT_SECRET=jwt-secret:latest \
  --set-env-vars TZ=Asia/Seoul
```

### Web Dashboard

```bash
# 빌드 & 푸시
gcloud builds submit --tag gcr.io/PROJECT_ID/cs-web ./web-dashboard

# 배포
gcloud run deploy cs-web \
  --image gcr.io/PROJECT_ID/cs-web \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL=https://cs-dashboard-api-xxx.run.app
```

---

## 5. 도메인 설정 (선택)

```bash
# Cloud Run 도메인 매핑
gcloud beta run domain-mappings create \
  --service cs-web \
  --domain cs.motionlabs.io \
  --region asia-northeast3
```

DNS 설정: CNAME → ghs.googlehosted.com

---

## 6. 모니터링

### Cloud Logging 필터

```
resource.type="cloud_run_revision"
resource.labels.service_name="cs-ingest-api" OR
resource.labels.service_name="cs-worker" OR
resource.labels.service_name="cs-dashboard-api"
severity>=WARNING
```

### Alert Policy (권장)

1. **Android 연결 끊김**: heartbeat 5분 이상 없음
2. **에러율 급증**: 5분간 에러 10건 이상
3. **Worker 지연**: Pub/Sub 메시지 처리 지연 5분 이상

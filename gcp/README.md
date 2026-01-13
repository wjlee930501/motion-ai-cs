# GCP Deployment Guide

CS Intelligence System의 GCP(Google Cloud Platform) 배포 가이드입니다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloud Run                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Frontend   │  │ Dashboard    │  │  Ingest API  │          │
│  │   (Nginx)    │  │    API       │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         │                 ▼                 ▼                   │
│         │         ┌──────────────────────────┐                  │
│         │         │     Cloud SQL            │                  │
│         │         │   (PostgreSQL 15)        │                  │
│         │         └──────────────────────────┘                  │
│         │                                                       │
│         └───────────────► HTTPS ─────────────►                  │
└─────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │  Android App     │
                        │  (KakaoTalk      │
                        │   Notification   │
                        │   Listener)      │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │    Ingest API    │
                        │ (Cloud Run)      │
                        └──────────────────┘
```

## 사전 요구사항

1. **GCP 계정 및 프로젝트**
   - GCP 계정
   - 결제가 활성화된 프로젝트
   - 프로젝트 Owner 또는 Editor 권한

2. **로컬 도구**
   ```bash
   # gcloud CLI 설치
   brew install --cask google-cloud-sdk

   # 로그인
   gcloud auth login
   ```

3. **OpenAI API Key**
   - LLM 분류를 위한 OpenAI API 키

## 빠른 시작

### 1. 환경 변수 설정

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-northeast3"  # 서울
```

### 2. GCP 리소스 설정

```bash
./gcp/setup-gcp.sh
```

이 스크립트는 다음을 설정합니다:
- Cloud APIs 활성화
- Artifact Registry 저장소
- Cloud SQL PostgreSQL 인스턴스
- Secret Manager 시크릿
- IAM 권한

### 3. OpenAI API Key 등록

```bash
gcloud secrets create openai-api-key --data-file=- <<< "sk-your-api-key"
```

### 4. 배포

**방법 1: Cloud Build (CI/CD)**
```bash
gcloud builds submit --config=gcp/cloudbuild.yaml
```

**방법 2: 수동 배포**
```bash
./gcp/deploy.sh
```

## 상세 설정

### Cloud SQL

| 설정 | 값 |
|------|-----|
| 인스턴스명 | cs-intelligence-db |
| 버전 | PostgreSQL 15 |
| 티어 | db-f1-micro (개발) |
| 리전 | asia-northeast3 |
| 스토리지 | 10GB SSD |

프로덕션 환경에서는 더 높은 티어를 사용하세요:
```bash
# 프로덕션 티어 업그레이드
gcloud sql instances patch cs-intelligence-db \
    --tier=db-custom-2-4096
```

### Cloud Run 서비스

| 서비스 | 메모리 | CPU | 최소/최대 인스턴스 |
|--------|--------|-----|-------------------|
| cs-dashboard-api | 512Mi | 1 | 0 / 10 |
| cs-ingest-api | 256Mi | 1 | 0 / 20 |
| cs-frontend | 256Mi | 1 | 0 / 5 |

### Secret Manager 시크릿

| 시크릿명 | 설명 |
|----------|------|
| cs-database-url | PostgreSQL 연결 URL |
| cs-jwt-secret | JWT 토큰 서명 키 |
| openai-api-key | OpenAI API 키 |

## 데이터베이스 초기화

Cloud SQL에 연결하여 스키마를 초기화합니다:

```bash
# Cloud SQL Proxy 설치
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Proxy 실행
./cloud-sql-proxy ${GCP_PROJECT_ID}:${GCP_REGION}:cs-intelligence-db &

# 데이터베이스 초기화
psql "postgresql://cs_admin:PASSWORD@localhost:5432/cs_intelligence" < gcp/init-db.sql
```

## 모니터링

### 로그 확인

```bash
# Dashboard API 로그
gcloud run services logs read cs-dashboard-api --region=${GCP_REGION}

# Ingest API 로그
gcloud run services logs read cs-ingest-api --region=${GCP_REGION}
```

### 서비스 상태

```bash
gcloud run services list --region=${GCP_REGION}
```

## 비용 최적화

1. **최소 인스턴스 0**: Cold start가 있지만 비용 절감
2. **db-f1-micro**: 개발/테스트 환경용 최소 사양
3. **리전**: asia-northeast3 (서울)이 한국에서 가장 저렴

예상 월 비용 (사용량에 따라 변동):
- Cloud SQL (db-f1-micro): ~$10/월
- Cloud Run: 사용량 기반 (프리티어 내 무료 가능)
- Secret Manager: 거의 무료

## 트러블슈팅

### 1. Cloud SQL 연결 실패

```bash
# Cloud SQL Admin API 활성화 확인
gcloud services list --enabled | grep sqladmin

# 서비스 계정 권한 확인
gcloud projects get-iam-policy ${GCP_PROJECT_ID} | grep cloudsql
```

### 2. Secret 접근 실패

```bash
# 시크릿 확인
gcloud secrets list

# 시크릿 권한 확인
gcloud secrets get-iam-policy cs-database-url
```

### 3. 빌드 실패

```bash
# 빌드 로그 확인
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

## 롤백

```bash
# 이전 버전으로 롤백
gcloud run services update-traffic cs-dashboard-api \
    --to-revisions=cs-dashboard-api-REVISION_ID=100 \
    --region=${GCP_REGION}
```

## 삭제

모든 리소스를 삭제하려면:

```bash
# Cloud Run 서비스 삭제
gcloud run services delete cs-dashboard-api --region=${GCP_REGION} -q
gcloud run services delete cs-ingest-api --region=${GCP_REGION} -q
gcloud run services delete cs-frontend --region=${GCP_REGION} -q

# Cloud SQL 삭제 (주의: 데이터 손실!)
gcloud sql instances delete cs-intelligence-db -q

# Artifact Registry 삭제
gcloud artifacts repositories delete cs-intelligence --location=${GCP_REGION} -q

# Secrets 삭제
gcloud secrets delete cs-database-url -q
gcloud secrets delete cs-jwt-secret -q
gcloud secrets delete openai-api-key -q
```

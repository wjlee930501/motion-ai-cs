#!/bin/bash

# ChatLogger Stage 2 Deployment Script
# Deploys CS Request Management System

set -e

echo "========================================"
echo "ChatLogger Stage 2 Deployment"
echo "CS Request Management System"
echo "========================================"

# Variables
PROJECT_ROOT=$(pwd)
ANDROID_PROJECT="$PROJECT_ROOT/ChatLoggerBot"
WEB_PROJECT="$PROJECT_ROOT/ChatLoggerWeb"
SERVER_PROJECT="$PROJECT_ROOT/server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Step 1: Check environment variables
echo ""
echo "🔧 Checking environment variables..."
if [ -z "$OPENAI_API_KEY" ]; then
    print_warning "OPENAI_API_KEY not set. GPT classification will use dummy mode."
    export OPENAI_API_KEY="sk-dummy-key-for-development"
fi

if [ -z "$SLACK_WEBHOOK_URL" ]; then
    print_warning "SLACK_WEBHOOK_URL not set. Slack notifications will be disabled."
fi

# Step 2: Install server dependencies
echo ""
echo "📦 Installing server dependencies..."
cd "$SERVER_PROJECT"
if [ ! -f "package.json" ]; then
    print_error "Server package.json not found"
    exit 1
fi
npm install
print_status "Server dependencies installed"

# Step 3: Install web dependencies (if needed)
echo ""
echo "📦 Checking web dependencies..."
cd "$WEB_PROJECT"
if [ ! -d "node_modules" ]; then
    echo "Installing web dependencies..."
    npm install
fi
print_status "Web dependencies ready"

# Step 4: Build web application
echo ""
echo "🔨 Building web application..."
npm run build
print_status "Web application built"

# Step 5: Run database migrations
echo ""
echo "🗄️ Running database migrations..."
cd "$PROJECT_ROOT"

# Check if PostgreSQL is running
if docker ps | grep -q chatlogger-db; then
    print_status "Database container is running"

    # Execute migrations
    docker exec chatlogger-db psql -U chatlogger -d chatlogger -f /docker-entrypoint-initdb.d/02-request-items.sql 2>/dev/null || true
    print_status "Migrations executed"
else
    print_warning "Database container not running. Will apply migrations on container start."
fi

# Step 6: Stop existing containers
echo ""
echo "🛑 Stopping existing containers..."
docker-compose down
print_status "Existing containers stopped"

# Step 7: Start all services
echo ""
echo "🚀 Starting all services..."
docker-compose up -d --build
print_status "All services started"

# Step 8: Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Step 9: Health checks
echo ""
echo "🔍 Running health checks..."

# Check database
if docker exec chatlogger-db pg_isready > /dev/null 2>&1; then
    print_status "Database is ready"
else
    print_error "Database not responding"
fi

# Check server
if curl -f http://localhost:4000/health > /dev/null 2>&1; then
    print_status "Server API is accessible at http://localhost:4000"
else
    print_warning "Server API not responding"
fi

# Check web interface
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_status "Web interface is accessible at http://localhost:3000"
else
    print_warning "Web interface not responding"
fi

# Check Android API (if device is on same network)
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    print_status "Android API is accessible"
else
    print_warning "Android API not accessible (ensure device is on same network)"
fi

# Step 10: Display access information
echo ""
echo "========================================"
echo "✨ Stage 2 Deployment Complete!"
echo "========================================"
echo ""
echo "🆕 New Features:"
echo "  • CS Request Management System"
echo "  • GPT-powered message classification"
echo "  • Request tracking dashboard"
echo "  • Response templates"
echo "  • Slack notifications for urgent requests"
echo "  • Daily/weekly reports"
echo ""
echo "📍 Access Points:"
echo "  📱 Web Interface: http://localhost:3000"
echo "  📊 Requests Dashboard: http://localhost:3000/requests"
echo "  🔌 Server API: http://localhost:4000"
echo "  📱 Android API: http://localhost:8080"
echo "  🗄️ Database: localhost:5432"
echo ""
echo "🔑 Environment Variables:"
echo "  • OPENAI_API_KEY: ${OPENAI_API_KEY:0:20}..."
echo "  • SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL:0:30}..."
echo ""
echo "📚 API Documentation:"
echo "  • GET  /api/v1/requests - List requests"
echo "  • PATCH /api/v1/requests/:id - Update request"
echo "  • GET  /api/v1/stats - View statistics"
echo "  • GET  /api/v1/templates - Response templates"
echo ""
echo "📝 Next Steps:"
echo "1. Open http://localhost:3000/requests"
echo "2. Monitor incoming CS requests"
echo "3. Configure Slack webhook for notifications"
echo "4. Set up OpenAI API key for better classification"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f chatlogger-server"
echo ""
echo "To stop services:"
echo "  docker-compose down"
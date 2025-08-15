#!/bin/bash

# ChatLogger Deployment Script
# Deploys both Android APK and Web Interface

set -e

echo "========================================"
echo "ChatLogger Full Stack Deployment"
echo "========================================"

# Variables
PROJECT_ROOT=$(pwd)
ANDROID_PROJECT="$PROJECT_ROOT/ChatLoggerBot"
WEB_PROJECT="$PROJECT_ROOT/ChatLoggerWeb"

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

# Step 1: Build Android APK
echo ""
echo "📱 Building Android APK..."
cd "$ANDROID_PROJECT"
if [ -f "./scripts/build.sh" ]; then
    ./scripts/build.sh
    print_status "Android APK built successfully"
else
    print_error "Android build script not found"
    exit 1
fi

# Step 2: Deploy Android App
echo ""
echo "📲 Deploying Android App..."
if [ -f "./scripts/provision.sh" ]; then
    ./scripts/provision.sh
    print_status "Android app deployed to device"
else
    print_warning "Android provision script not found, skipping device deployment"
fi

# Step 3: Build Web Application
echo ""
echo "🌐 Building Web Application..."
cd "$WEB_PROJECT"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
npm run build
print_status "Web application built successfully"

# Step 4: Start Docker containers
echo ""
echo "🐳 Starting Docker containers..."
cd "$PROJECT_ROOT"
docker-compose down
docker-compose up -d --build
print_status "Docker containers started"

# Step 5: Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Step 6: Health checks
echo ""
echo "🔍 Running health checks..."

# Check web interface
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_status "Web interface is accessible at http://localhost:3000"
else
    print_warning "Web interface not responding"
fi

# Check database
if docker exec chatlogger-db pg_isready > /dev/null 2>&1; then
    print_status "Database is ready"
else
    print_warning "Database not responding"
fi

# Check Android API (if device is on same network)
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    print_status "Android API is accessible"
else
    print_warning "Android API not accessible (ensure device is on same network)"
fi

# Step 7: Display access information
echo ""
echo "========================================"
echo "✨ Deployment Complete!"
echo "========================================"
echo ""
echo "Access Points:"
echo "  📱 Web Interface: http://localhost:3000"
echo "  🔌 Android API: http://localhost:8080"
echo "  🗄️ Database: localhost:5432"
echo ""
echo "Next Steps:"
echo "1. Ensure Android device is on the same network"
echo "2. Configure device IP in web app if needed"
echo "3. Open KakaoTalk and start receiving messages"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose down"
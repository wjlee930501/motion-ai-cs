#!/bin/bash

# MotionLabs CS Intelligence System - Development Start Script

echo "==================================="
echo "CS Intelligence System v1.0"
echo "==================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Create .env file if not exists
if [ ! -f "server-py/.env" ]; then
    echo "Creating .env file from .env.example..."
    cp server-py/.env.example server-py/.env
    echo "Please edit server-py/.env with your API keys"
fi

# Start services
echo ""
echo "Starting services..."
docker-compose -f docker-compose.dev.yml up --build -d

echo ""
echo "Waiting for services to start..."
sleep 5

# Check service health
echo ""
echo "Checking service health..."

# Check PostgreSQL
if docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U csuser -d csdb > /dev/null 2>&1; then
    echo "✓ PostgreSQL: Running"
else
    echo "✗ PostgreSQL: Not ready"
fi

# Check Ingest API
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "✓ Ingest API: Running (http://localhost:8001)"
else
    echo "✗ Ingest API: Not ready"
fi

# Check Dashboard API
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ Dashboard API: Running (http://localhost:8000)"
else
    echo "✗ Dashboard API: Not ready"
fi

echo ""
echo "==================================="
echo "Services Started!"
echo ""
echo "Dashboard API: http://localhost:8000"
echo "Ingest API:    http://localhost:8001"
echo "Web Dashboard: http://localhost:3000"
echo ""
echo "Default login: admin / 1234"
echo "==================================="
echo ""
echo "To view logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "To stop:      docker-compose -f docker-compose.dev.yml down"

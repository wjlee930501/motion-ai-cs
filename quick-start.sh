#!/bin/bash

# ChatLogger Quick Start Script
# Quickly sets up and runs the entire system

echo "========================================"
echo "ChatLogger Quick Start"
echo "========================================"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env file and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - SLACK_WEBHOOK_URL (optional)"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Load environment variables
source .env

# Check for required API keys
if [[ "$OPENAI_API_KEY" == "sk-your-openai-api-key-here" ]]; then
    echo "⚠️  Please set OPENAI_API_KEY in .env file"
    echo "   Get your key from: https://platform.openai.com/api-keys"
    exit 1
fi

echo "✅ Environment variables loaded"

# Run Stage 2 deployment
if [ -f "deploy-stage2.sh" ]; then
    ./deploy-stage2.sh
else
    echo "❌ deploy-stage2.sh not found"
    exit 1
fi
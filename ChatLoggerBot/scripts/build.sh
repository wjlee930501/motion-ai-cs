#!/bin/bash

# ChatLoggerBot Build Script
# This script builds the APK for the ChatLoggerBot application

echo "========================================"
echo "ChatLoggerBot Build Script"
echo "========================================"

# Navigate to project root
cd "$(dirname "$0")/.."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Build release APK
echo "🔨 Building release APK..."
./gradlew assembleRelease

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo "APK location: app/build/outputs/apk/release/app-release.apk"
    
    # Copy APK to convenient location
    cp app/build/outputs/apk/release/app-release.apk ChatLoggerBot.apk
    echo "APK copied to: ChatLoggerBot.apk"
    
    echo ""
    echo "Next step: Run ./scripts/provision.sh to install and configure the app"
else
    echo "❌ Build failed!"
    exit 1
fi
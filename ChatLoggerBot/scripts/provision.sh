#!/bin/bash

# MotionLabs ChatLoggerBot Provisioning Script
# Version: 1.0.0
# Date: 2025-08-15

echo "========================================"
echo "ChatLoggerBot Provisioning Script"
echo "========================================"

# Variables
PACKAGE_NAME="com.motionlabs.chatlogger"
APK_PATH="../app/build/outputs/apk/release/app-release.apk"
SERVICE_CLASS=".notify.KakaoNotificationListener"
FOREGROUND_SERVICE=".service.ForegroundService"

# Check if APK exists
if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK not found at $APK_PATH"
    echo "Please build the APK first using: ./gradlew assembleRelease"
    exit 1
fi

# Check if device is connected
adb devices | grep -q "device$"
if [ $? -ne 0 ]; then
    echo "❌ No Android device connected"
    echo "Please connect a device and enable USB debugging"
    exit 1
fi

echo "✅ Device connected"

# Step 1: Uninstall existing app (if exists)
echo "🔄 Checking for existing installation..."
adb shell pm list packages | grep -q "$PACKAGE_NAME"
if [ $? -eq 0 ]; then
    echo "📦 Uninstalling existing app..."
    adb uninstall "$PACKAGE_NAME"
fi

# Step 2: Install APK
echo "📦 Installing ChatLoggerBot APK..."
adb install -r "$APK_PATH"
if [ $? -ne 0 ]; then
    echo "❌ Failed to install APK"
    exit 1
fi
echo "✅ APK installed successfully"

# Step 3: Grant notification listener permission
echo "🔔 Granting notification listener permission..."
adb shell cmd notification allow_listener "${PACKAGE_NAME}/${SERVICE_CLASS}"
if [ $? -eq 0 ]; then
    echo "✅ Notification listener permission granted"
else
    echo "⚠️  Failed to grant notification listener permission automatically"
    echo "   Please enable manually in Settings > Notifications > Notification Access"
fi

# Step 4: Grant POST_NOTIFICATIONS permission (Android 13+)
echo "📬 Granting POST_NOTIFICATIONS permission..."
adb shell pm grant "$PACKAGE_NAME" android.permission.POST_NOTIFICATIONS 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ POST_NOTIFICATIONS permission granted"
else
    echo "ℹ️  POST_NOTIFICATIONS permission not applicable (Android < 13)"
fi

# Step 5: Add to battery optimization whitelist
echo "🔋 Adding to battery optimization whitelist..."
adb shell dumpsys deviceidle whitelist "+${PACKAGE_NAME}"
if [ $? -eq 0 ]; then
    echo "✅ Added to battery optimization whitelist"
else
    echo "⚠️  Failed to add to battery optimization whitelist"
fi

# Step 6: Grant necessary permissions
echo "🔐 Granting additional permissions..."
adb shell pm grant "$PACKAGE_NAME" android.permission.RECEIVE_BOOT_COMPLETED 2>/dev/null
adb shell pm grant "$PACKAGE_NAME" android.permission.WAKE_LOCK 2>/dev/null

# Step 7: Start the foreground service
echo "🚀 Starting foreground service..."
adb shell am start-foreground-service "${PACKAGE_NAME}/${FOREGROUND_SERVICE}"
if [ $? -eq 0 ]; then
    echo "✅ Foreground service started"
else
    echo "⚠️  Failed to start foreground service"
    echo "   Trying alternative method..."
    adb shell am startservice "${PACKAGE_NAME}/${FOREGROUND_SERVICE}"
fi

# Step 8: Launch the main activity
echo "📱 Launching ChatLoggerBot..."
adb shell am start -n "${PACKAGE_NAME}/.MainActivity"
if [ $? -eq 0 ]; then
    echo "✅ App launched successfully"
else
    echo "⚠️  Failed to launch app"
fi

# Step 9: Verify installation
echo ""
echo "🔍 Verifying installation..."
echo "----------------------------------------"

# Check if package is installed
adb shell pm list packages | grep -q "$PACKAGE_NAME"
if [ $? -eq 0 ]; then
    echo "✅ Package installed: $PACKAGE_NAME"
else
    echo "❌ Package not found"
fi

# Check notification listener status
adb shell settings get secure enabled_notification_listeners | grep -q "$PACKAGE_NAME"
if [ $? -eq 0 ]; then
    echo "✅ Notification listener enabled"
else
    echo "⚠️  Notification listener not enabled"
    echo "   Please enable manually in Settings"
fi

# Check if service is running
adb shell dumpsys activity services | grep -q "$PACKAGE_NAME"
if [ $? -eq 0 ]; then
    echo "✅ Service is running"
else
    echo "⚠️  Service may not be running"
fi

echo ""
echo "========================================"
echo "✨ Provisioning Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Open KakaoTalk on the device"
echo "2. Join CS chat rooms with dedicated account"
echo "3. Messages will be automatically logged"
echo "4. View logs in ChatLoggerBot app"
echo ""
echo "⚠️  Important:"
echo "- Keep the device plugged in for continuous operation"
echo "- Disable battery optimization for best performance"
echo "- Check notification access if messages aren't being logged"
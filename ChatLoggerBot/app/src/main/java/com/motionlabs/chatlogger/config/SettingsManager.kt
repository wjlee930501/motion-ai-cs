package com.motionlabs.chatlogger.config

import android.content.Context
import android.content.SharedPreferences

/**
 * Manages app settings using SharedPreferences.
 * Stores backend server configuration for Ingest API communication.
 */
class SettingsManager(context: Context) {

    companion object {
        private const val PREFS_NAME = "chatlogger_settings"
        private const val KEY_BACKEND_URL = "backend_url"
        private const val KEY_DEVICE_KEY = "device_key"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_BACKEND_ENABLED = "backend_enabled"
        private const val KEY_HEARTBEAT_INTERVAL = "heartbeat_interval"
        private const val KEY_AUTO_DISMISS_NOTIFICATIONS = "auto_dismiss_notifications"

        // Default values
        const val DEFAULT_BACKEND_URL = "https://cs-ingest-api-obmkspcd3q-du.a.run.app"
        const val DEFAULT_DEVICE_KEY = "k1iycn17S3S92jqWnPoDqmzdYpSD83hr"
        const val DEFAULT_HEARTBEAT_INTERVAL = 60 // seconds

        @Volatile
        private var instance: SettingsManager? = null

        fun getInstance(context: Context): SettingsManager {
            return instance ?: synchronized(this) {
                instance ?: SettingsManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Backend server URL (Ingest API)
     * Example: http://192.168.1.100:8001
     */
    var backendUrl: String
        get() = prefs.getString(KEY_BACKEND_URL, DEFAULT_BACKEND_URL) ?: DEFAULT_BACKEND_URL
        set(value) = prefs.edit().putString(KEY_BACKEND_URL, value.trim()).apply()

    /**
     * Device key for API authentication
     * This should match the DEVICE_KEY environment variable on the server
     */
    var deviceKey: String
        get() = prefs.getString(KEY_DEVICE_KEY, DEFAULT_DEVICE_KEY) ?: DEFAULT_DEVICE_KEY
        set(value) = prefs.edit().putString(KEY_DEVICE_KEY, value.trim()).apply()

    /**
     * Unique device identifier
     * Auto-generated if not set
     */
    var deviceId: String
        get() {
            val id = prefs.getString(KEY_DEVICE_ID, null)
            if (id == null) {
                val newId = generateDeviceId()
                deviceId = newId
                return newId
            }
            return id
        }
        set(value) = prefs.edit().putString(KEY_DEVICE_ID, value).apply()

    /**
     * Whether backend sync is enabled
     */
    var backendEnabled: Boolean
        get() = prefs.getBoolean(KEY_BACKEND_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_BACKEND_ENABLED, value).apply()

    /**
     * Heartbeat interval in seconds
     */
    var heartbeatIntervalSeconds: Int
        get() = prefs.getInt(KEY_HEARTBEAT_INTERVAL, DEFAULT_HEARTBEAT_INTERVAL)
        set(value) = prefs.edit().putInt(KEY_HEARTBEAT_INTERVAL, value).apply()

    /**
     * Whether to automatically dismiss KakaoTalk notifications after processing.
     * This prevents notification buildup which can block new notifications.
     * Default: true (enabled)
     */
    var autoDismissNotifications: Boolean
        get() = prefs.getBoolean(KEY_AUTO_DISMISS_NOTIFICATIONS, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_DISMISS_NOTIFICATIONS, value).apply()

    /**
     * Full URL for events endpoint
     */
    val eventsUrl: String
        get() = "${backendUrl.trimEnd('/')}/v1/events"

    /**
     * Full URL for heartbeat endpoint
     */
    val heartbeatUrl: String
        get() = "${backendUrl.trimEnd('/')}/v1/heartbeat"

    /**
     * Full URL for health check endpoint
     */
    val healthUrl: String
        get() = "${backendUrl.trimEnd('/')}/health"

    /**
     * Check if backend is configured (not using defaults)
     */
    fun isConfigured(): Boolean {
        return backendUrl != DEFAULT_BACKEND_URL || deviceKey != DEFAULT_DEVICE_KEY
    }

    private fun generateDeviceId(): String {
        return "android-${android.os.Build.MODEL.replace(" ", "-")}-${System.currentTimeMillis()}"
    }
}

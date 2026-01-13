package com.motionlabs.chatlogger.api

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.annotations.SerializedName
import com.motionlabs.chatlogger.config.SettingsManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * API client for communicating with the backend Ingest API.
 * Sends KakaoTalk messages and heartbeats to the server.
 */
class BackendApiClient(context: Context) {

    companion object {
        private const val TAG = "BackendApiClient"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        @Volatile
        private var instance: BackendApiClient? = null

        fun getInstance(context: Context): BackendApiClient {
            return instance ?: synchronized(this) {
                instance ?: BackendApiClient(context.applicationContext).also { instance = it }
            }
        }
    }

    private val settingsManager = SettingsManager.getInstance(context)
    private val gson: Gson = GsonBuilder()
        .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        .create()

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    /**
     * Send a KakaoTalk message event to the backend.
     *
     * @param chatRoom The chat room name (clinic name)
     * @param senderName The sender's name
     * @param text The message text
     * @param isGroup Whether this is a group chat
     * @return Result indicating success or failure
     */
    suspend fun sendEvent(
        chatRoom: String,
        senderName: String,
        text: String,
        isGroup: Boolean? = null
    ): Result<EventResponse> = withContext(Dispatchers.IO) {
        if (!settingsManager.backendEnabled) {
            Log.d(TAG, "Backend sync disabled, skipping event send")
            return@withContext Result.failure(Exception("Backend sync disabled"))
        }

        try {
            val request = EventRequest(
                deviceId = settingsManager.deviceId,
                packageName = "com.kakao.talk",
                chatRoom = chatRoom,
                senderName = senderName,
                text = text,
                receivedAt = formatIsoDateTime(Date()),
                metadata = EventMetadata(
                    title = chatRoom,
                    isGroup = isGroup
                )
            )

            val jsonBody = gson.toJson(request)
            Log.d(TAG, "Sending event to ${settingsManager.eventsUrl}: $jsonBody")

            val httpRequest = Request.Builder()
                .url(settingsManager.eventsUrl)
                .header("X-Device-Key", settingsManager.deviceKey)
                .header("Content-Type", "application/json")
                .post(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            client.newCall(httpRequest).execute().use { response ->
                val responseBody = response.body?.string()
                Log.d(TAG, "Event response: ${response.code} - $responseBody")

                if (response.isSuccessful && responseBody != null) {
                    val eventResponse = gson.fromJson(responseBody, EventResponse::class.java)
                    Result.success(eventResponse)
                } else {
                    Log.e(TAG, "Event send failed: ${response.code} - $responseBody")
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event", e)
            Result.failure(e)
        }
    }

    /**
     * Send a heartbeat to the backend to indicate device is alive.
     *
     * @return Result indicating success or failure
     */
    suspend fun sendHeartbeat(): Result<HeartbeatResponse> = withContext(Dispatchers.IO) {
        if (!settingsManager.backendEnabled) {
            Log.d(TAG, "Backend sync disabled, skipping heartbeat")
            return@withContext Result.failure(Exception("Backend sync disabled"))
        }

        try {
            val request = HeartbeatRequest(
                deviceId = settingsManager.deviceId,
                ts = formatIsoDateTime(Date())
            )

            val jsonBody = gson.toJson(request)
            Log.d(TAG, "Sending heartbeat to ${settingsManager.heartbeatUrl}")

            val httpRequest = Request.Builder()
                .url(settingsManager.heartbeatUrl)
                .header("X-Device-Key", settingsManager.deviceKey)
                .header("Content-Type", "application/json")
                .post(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            client.newCall(httpRequest).execute().use { response ->
                val responseBody = response.body?.string()
                Log.d(TAG, "Heartbeat response: ${response.code}")

                if (response.isSuccessful && responseBody != null) {
                    val heartbeatResponse = gson.fromJson(responseBody, HeartbeatResponse::class.java)
                    Result.success(heartbeatResponse)
                } else {
                    Log.e(TAG, "Heartbeat failed: ${response.code} - $responseBody")
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error sending heartbeat", e)
            Result.failure(e)
        }
    }

    /**
     * Check backend server health.
     *
     * @return Result indicating success or failure with health status
     */
    suspend fun checkHealth(): Result<HealthResponse> = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Checking health at ${settingsManager.healthUrl}")

            val httpRequest = Request.Builder()
                .url(settingsManager.healthUrl)
                .get()
                .build()

            client.newCall(httpRequest).execute().use { response ->
                val responseBody = response.body?.string()
                Log.d(TAG, "Health response: ${response.code} - $responseBody")

                if (response.isSuccessful && responseBody != null) {
                    val healthResponse = gson.fromJson(responseBody, HealthResponse::class.java)
                    Result.success(healthResponse)
                } else {
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking health", e)
            Result.failure(e)
        }
    }

    private fun formatIsoDateTime(date: Date): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(date)
    }

    // ============================================
    // Request/Response DTOs
    // ============================================

    data class EventRequest(
        @SerializedName("device_id") val deviceId: String,
        @SerializedName("package") val packageName: String,
        @SerializedName("chat_room") val chatRoom: String,
        @SerializedName("sender_name") val senderName: String,
        @SerializedName("text") val text: String,
        @SerializedName("received_at") val receivedAt: String,
        @SerializedName("notification_id") val notificationId: String? = null,
        @SerializedName("metadata") val metadata: EventMetadata? = null
    )

    data class EventMetadata(
        @SerializedName("title") val title: String? = null,
        @SerializedName("subtext") val subtext: String? = null,
        @SerializedName("is_group") val isGroup: Boolean? = null
    )

    data class EventResponse(
        @SerializedName("ok") val ok: Boolean,
        @SerializedName("event_id") val eventId: String?,
        @SerializedName("deduped") val deduped: Boolean = false
    )

    data class HeartbeatRequest(
        @SerializedName("device_id") val deviceId: String,
        @SerializedName("ts") val ts: String
    )

    data class HeartbeatResponse(
        @SerializedName("ok") val ok: Boolean
    )

    data class HealthResponse(
        @SerializedName("status") val status: String,
        @SerializedName("service") val service: String?
    )
}

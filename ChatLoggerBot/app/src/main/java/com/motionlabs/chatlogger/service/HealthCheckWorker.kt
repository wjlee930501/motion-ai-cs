package com.motionlabs.chatlogger.service

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.motionlabs.chatlogger.api.BackendApiClient
import com.motionlabs.chatlogger.config.SettingsManager
import com.motionlabs.chatlogger.data.db.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HealthCheckWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "HealthCheckWorker"
        private const val SYNCED_RETENTION_DAYS = 7    // 동기화된 메시지 보관 기간
        private const val UNSYNCED_RETENTION_DAYS = 30 // 미동기화 메시지 최대 보관 기간
        private const val MAX_RETRY_COUNT = 100        // 최대 재시도 횟수 (15분 간격 × 100 = 약 25시간)
    }

    private val settingsManager = SettingsManager.getInstance(context)
    private val backendClient = BackendApiClient.getInstance(context)

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Health check started")

            // Check if ForegroundService is running, restart if needed
            if (!isServiceRunning()) {
                startForegroundService()
            }

            // NotificationListenerService 활성 상태 확인
            if (!isNotificationListenerEnabled()) {
                Log.e(TAG, "CRITICAL: NotificationListenerService is NOT enabled! Messages will be lost!")
                showNotificationListenerWarning()
            }

            // Send heartbeat to backend server
            sendHeartbeat()

            // 미동기화 메시지 재시도
            retryUnsyncedMessages()

            // 동기화 완료된 오래된 메시지 정리
            cleanSyncedMessages()

            // 오래된 미동기화 메시지 정리 (30일 이상)
            cleanOldUnsyncedMessages()

            Log.d(TAG, "Health check completed successfully")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Health check failed", e)
            Result.retry()
        }
    }

    @Suppress("DEPRECATION")
    private fun isServiceRunning(): Boolean {
        return try {
            val manager = applicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            manager.getRunningServices(Integer.MAX_VALUE).any {
                it.service.className == ForegroundService::class.java.name
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking service status", e)
            false
        }
    }

    private fun isNotificationListenerEnabled(): Boolean {
        val flat = android.provider.Settings.Secure.getString(
            applicationContext.contentResolver,
            "enabled_notification_listeners"
        )
        return flat?.contains(applicationContext.packageName) == true
    }

    private suspend fun sendHeartbeat() {
        if (!settingsManager.backendEnabled) {
            Log.d(TAG, "Backend sync disabled, skipping heartbeat")
            return
        }

        try {
            val result = backendClient.sendHeartbeat()
            result.onSuccess {
                Log.d(TAG, "Heartbeat sent successfully")
            }.onFailure { error ->
                Log.e(TAG, "Failed to send heartbeat: ${error.message}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error sending heartbeat", e)
        }
    }
    
    private fun startForegroundService() {
        val serviceIntent = Intent(applicationContext, ForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            applicationContext.startForegroundService(serviceIntent)
        } else {
            applicationContext.startService(serviceIntent)
        }
        Log.d(TAG, "ForegroundService restarted")
    }

    private fun showNotificationListenerWarning() {
        try {
            val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = android.app.NotificationChannel(
                    "warning_channel",
                    "경고 알림",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                )
                notificationManager.createNotificationChannel(channel)
            }

            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            val pendingIntent = android.app.PendingIntent.getActivity(
                applicationContext, 0, intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            val notification = androidx.core.app.NotificationCompat.Builder(applicationContext, "warning_channel")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("알림 수신 중단됨")
                .setContentText("알림 접근 권한을 다시 활성화해주세요")
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

            notificationManager.notify(9999, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show warning notification: ${e.message}")
        }
    }

    /**
     * 미동기화 메시지 재시도
     */
    private suspend fun retryUnsyncedMessages() {
        if (!settingsManager.backendEnabled) {
            Log.d(TAG, "Backend sync disabled, skipping retry")
            return
        }

        try {
            val database = AppDatabase.getDatabase(applicationContext)
            val unsyncedMessages = database.chatDao().getUnsyncedMessages(MAX_RETRY_COUNT, 50)

            if (unsyncedMessages.isEmpty()) {
                Log.d(TAG, "No unsynced messages to retry")
                return
            }

            Log.d(TAG, "Retrying ${unsyncedMessages.size} unsynced messages")

            for (message in unsyncedMessages) {
                try {
                    // 채팅방 정보 조회
                    val room = database.chatDao().getRoomById(message.roomId)
                    val roomName = room?.roomName ?: "Unknown"

                    val result = backendClient.sendEvent(
                        chatRoom = roomName,
                        senderName = message.sender,
                        text = message.body,
                        isGroup = null
                    )

                    result.onSuccess { response ->
                        Log.d(TAG, "Retry successful for message ${message.id}: ${response.eventId}")
                        database.chatDao().updateSyncStatus(
                            messageId = message.id,
                            synced = true,
                            syncedAt = System.currentTimeMillis()
                        )
                    }.onFailure { error ->
                        Log.w(TAG, "Retry failed for message ${message.id}: ${error.message}")
                        database.chatDao().incrementRetryCount(message.id)
                    }

                    // 서버 부하 방지를 위한 딜레이
                    kotlinx.coroutines.delay(100)
                } catch (e: Exception) {
                    Log.e(TAG, "Error retrying message ${message.id}", e)
                    database.chatDao().incrementRetryCount(message.id)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in retryUnsyncedMessages", e)
        }
    }

    /**
     * 동기화 완료된 오래된 메시지 삭제 (7일 경과)
     */
    private suspend fun cleanSyncedMessages() {
        try {
            val database = AppDatabase.getDatabase(applicationContext)
            val cutoffTime = System.currentTimeMillis() - (SYNCED_RETENTION_DAYS * 24 * 60 * 60 * 1000L)

            val deletedCount = database.chatDao().deleteSyncedMessagesOlderThan(cutoffTime)
            if (deletedCount > 0) {
                Log.d(TAG, "Deleted $deletedCount synced messages older than $SYNCED_RETENTION_DAYS days")
            }

            // 통계 로깅
            val syncedCount = database.chatDao().getSyncedCount()
            val unsyncedCount = database.chatDao().getUnsyncedCount()
            Log.d(TAG, "Message stats - Synced: $syncedCount, Unsynced: $unsyncedCount")
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning synced messages", e)
        }
    }

    /**
     * 오래된 미동기화 메시지 삭제 (30일 경과 - 데이터 유실 방지 최후 보루)
     */
    private suspend fun cleanOldUnsyncedMessages() {
        try {
            val database = AppDatabase.getDatabase(applicationContext)
            val cutoffTime = System.currentTimeMillis() - (UNSYNCED_RETENTION_DAYS * 24 * 60 * 60 * 1000L)

            // 30일 지난 메시지는 동기화 여부와 관계없이 삭제 (앱 용량 관리)
            database.chatDao().deleteMessagesOlderThan(cutoffTime)
            Log.d(TAG, "Cleaned all messages older than $UNSYNCED_RETENTION_DAYS days")
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning old unsynced messages", e)
        }
    }
}
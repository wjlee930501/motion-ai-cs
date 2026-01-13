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
        private const val RETENTION_DAYS = 90
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

            // Send heartbeat to backend server
            sendHeartbeat()

            // Clean old data
            cleanOldData()

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
    
    private suspend fun cleanOldData() {
        try {
            val database = AppDatabase.getDatabase(applicationContext)
            val cutoffTime = System.currentTimeMillis() - (RETENTION_DAYS * 24 * 60 * 60 * 1000L)
            
            val deletedCount = database.chatDao().deleteMessagesOlderThan(cutoffTime)
            Log.d(TAG, "Cleaned old data, deleted messages older than $RETENTION_DAYS days")
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning old data", e)
        }
    }
}
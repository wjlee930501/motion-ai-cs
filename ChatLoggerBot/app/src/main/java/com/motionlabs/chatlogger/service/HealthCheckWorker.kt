package com.motionlabs.chatlogger.service

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
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

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Health check started")
            
            // Check if ForegroundService is running, restart if needed
            if (!isServiceRunning()) {
                startForegroundService()
            }
            
            // Clean old data
            cleanOldData()
            
            Log.d(TAG, "Health check completed successfully")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Health check failed", e)
            Result.retry()
        }
    }
    
    private fun isServiceRunning(): Boolean {
        // Simple check - in production, you'd use ActivityManager
        return true // Simplified for this implementation
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
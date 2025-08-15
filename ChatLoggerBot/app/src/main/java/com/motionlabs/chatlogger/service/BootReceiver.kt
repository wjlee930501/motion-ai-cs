package com.motionlabs.chatlogger.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.*
import java.util.concurrent.TimeUnit

class BootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Boot completed, starting services")
            
            // Start ForegroundService
            val serviceIntent = Intent(context, ForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            
            // Schedule HealthCheckWorker
            scheduleHealthCheckWorker(context)
        }
    }
    
    private fun scheduleHealthCheckWorker(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
            .setRequiresBatteryNotLow(false)
            .build()

        val healthCheckRequest = PeriodicWorkRequestBuilder<HealthCheckWorker>(
            15, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .addTag("health_check")
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "health_check_work",
            ExistingPeriodicWorkPolicy.REPLACE,
            healthCheckRequest
        )
        
        Log.d(TAG, "HealthCheckWorker scheduled")
    }
}
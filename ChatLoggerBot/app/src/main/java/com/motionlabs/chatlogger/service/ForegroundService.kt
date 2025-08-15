package com.motionlabs.chatlogger.service

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.motionlabs.chatlogger.MainActivity
import com.motionlabs.chatlogger.R
import com.motionlabs.chatlogger.api.ApiService
import com.motionlabs.chatlogger.api.WebSocketServer
import com.motionlabs.chatlogger.notify.KakaoNotificationListener

class ForegroundService : Service() {
    
    private var apiService: ApiService? = null
    private var webSocketServer: WebSocketServer? = null
    
    companion object {
        private const val TAG = "ForegroundService"
        private const val CHANNEL_ID = "ChatLoggerServiceChannel"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "ForegroundService created")
        createNotificationChannel()
        startForegroundServiceWithNotification()
        startApiService()
        startWebSocketServer()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "ForegroundService started")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        stopApiService()
        stopWebSocketServer()
        Log.d(TAG, "ForegroundService destroyed")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Chat Logger Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the chat logger running in the background"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundServiceWithNotification() {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Chat Logger Active")
            .setContentText("Monitoring chat notifications")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or 
                ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }
    
    private fun startApiService() {
        try {
            apiService = ApiService(this, 8080)
            Log.d(TAG, "API Service started on port 8080")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start API Service", e)
        }
    }
    
    private fun stopApiService() {
        try {
            apiService?.stopServer()
            apiService = null
            Log.d(TAG, "API Service stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop API Service", e)
        }
    }
    
    private fun startWebSocketServer() {
        try {
            webSocketServer = WebSocketServer(this, 8081)
            KakaoNotificationListener.webSocketServer = webSocketServer
            Log.d(TAG, "WebSocket Server started on port 8081")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start WebSocket Server", e)
        }
    }
    
    private fun stopWebSocketServer() {
        try {
            KakaoNotificationListener.webSocketServer = null
            webSocketServer?.stopServer()
            webSocketServer = null
            Log.d(TAG, "WebSocket Server stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop WebSocket Server", e)
        }
    }
}
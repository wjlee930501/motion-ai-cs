package com.motionlabs.chatlogger.notify

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.motionlabs.chatlogger.api.BackendApiClient
import com.motionlabs.chatlogger.api.WebSocketServer
import com.motionlabs.chatlogger.config.SettingsManager
import com.motionlabs.chatlogger.data.db.AppDatabase
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class KakaoNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "KakaoNotificationListener"
        private const val KAKAO_PACKAGE = "com.kakao.talk"
        var webSocketServer: WebSocketServer? = null
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var database: AppDatabase
    private lateinit var parser: NotificationParser
    private lateinit var backendClient: BackendApiClient
    private lateinit var settingsManager: SettingsManager

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getDatabase(this)
        parser = NotificationParser()
        backendClient = BackendApiClient.getInstance(this)
        settingsManager = SettingsManager.getInstance(this)
        Log.d(TAG, "NotificationListenerService created")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != KAKAO_PACKAGE) {
            return
        }

        Log.d(TAG, "KakaoTalk notification received")

        serviceScope.launch {
            try {
                val notification = sbn.notification
                val parsedData = parser.parseKakaoNotification(notification)
                
                // 파싱 실패 시 디버그 정보를 서버로 전송
                if (parsedData == null) {
                    Log.w(TAG, "Failed to parse notification, sending debug info")
                    if (settingsManager.backendEnabled) {
                        try {
                            val debugInfo = parser.getDebugInfo(notification)
                            backendClient.sendEvent(
                                chatRoom = "[DEBUG] Parse Failed",
                                senderName = "system",
                                text = debugInfo,
                                isGroup = null
                            )
                        } catch (e: Exception) {
                            Log.e(TAG, "Error sending debug info", e)
                        }
                    }
                    return@launch
                }
                
                parsedData.let { data ->
                    Log.d(TAG, "Parsed notification - Room: ${data.roomName}, Sender: ${data.sender}, Message: ${data.message}")

                    // 데이터베이스에 저장
                    database.chatDao().insertMessageWithRoom(
                        roomName = data.roomName,
                        sender = data.sender,
                        body = data.message,
                        rawJson = data.rawJson
                    )

                    // 백엔드 서버로 전송 (Ingest API)
                    if (settingsManager.backendEnabled) {
                        try {
                            val result = backendClient.sendEvent(
                                chatRoom = data.roomName,
                                senderName = data.sender,
                                text = data.message,
                                isGroup = data.isGroup
                            )
                            result.onSuccess { response ->
                                Log.d(TAG, "Event sent to backend: ${response.eventId}, deduped: ${response.deduped}")
                            }.onFailure { error ->
                                Log.e(TAG, "Failed to send event to backend: ${error.message}")
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Error sending event to backend", e)
                        }
                    }

                    // WebSocket으로 브로드캐스트
                    val room = database.chatDao().getRoomByName(data.roomName)
                    room?.let { chatRoom ->
                        val message = ChatMessage(
                            roomId = chatRoom.id,
                            sender = data.sender,
                            body = data.message,
                            timestamp = System.currentTimeMillis(),
                            isFromMe = false,
                            rawJson = data.rawJson
                        )

                        webSocketServer?.broadcastNewMessage(message)
                        webSocketServer?.broadcastRoomUpdate(chatRoom.copy(
                            lastMessage = data.message,
                            lastMessageAt = System.currentTimeMillis()
                        ))

                        Log.d(TAG, "Broadcasted message via WebSocket")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing notification", e)
            }
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (sbn.packageName == KAKAO_PACKAGE) {
            Log.d(TAG, "KakaoTalk notification removed")
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "NotificationListenerService connected")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.d(TAG, "NotificationListenerService disconnected")
    }
}
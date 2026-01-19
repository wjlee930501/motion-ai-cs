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
        private const val MAX_PROCESSED_CACHE = 500  // 메모리 과부하 방지
        var webSocketServer: WebSocketServer? = null
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var database: AppDatabase
    private lateinit var parser: NotificationParser
    private lateinit var backendClient: BackendApiClient
    private lateinit var settingsManager: SettingsManager

    // 이미 처리한 메시지 추적 (중복 방지)
    private val processedMessages = LinkedHashSet<String>()

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
        processNotification(sbn.notification)
    }

    /**
     * 알림을 처리하고 모든 메시지를 파싱
     */
    private fun processNotification(notification: Notification) {
        serviceScope.launch {
            try {
                val parseResult = parser.parseKakaoNotificationAll(notification)

                // 파싱된 메시지가 없으면 디버그 정보 전송
                if (parseResult.notifications.isEmpty()) {
                    Log.w(TAG, "No messages parsed from notification, sending debug info")
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

                Log.d(TAG, "Parsed ${parseResult.notifications.size} messages from notification")

                // 모든 메시지 처리
                for (data in parseResult.notifications) {
                    // 중복 메시지 체크 (room + sender + message + timestamp 기반)
                    val messageKey = "${data.roomName}|${data.sender}|${data.message}|${data.timestamp}"
                    val isDuplicate = synchronized(processedMessages) {
                        if (processedMessages.contains(messageKey)) {
                            true
                        } else {
                            processedMessages.add(messageKey)
                            // 캐시 크기 제한
                            if (processedMessages.size > MAX_PROCESSED_CACHE) {
                                val iterator = processedMessages.iterator()
                                repeat(100) { if (iterator.hasNext()) { iterator.next(); iterator.remove() } }
                            }
                            false
                        }
                    }

                    if (isDuplicate) {
                        Log.d(TAG, "Skipping duplicate message: ${data.message.take(20)}...")
                        continue
                    }

                    Log.d(TAG, "Processing message - Room: ${data.roomName}, Sender: ${data.sender}, Message: ${data.message.take(30)}...")

                    // 데이터베이스에 저장 (메시지 ID 반환)
                    val messageId = database.chatDao().insertMessageWithRoom(
                        roomName = data.roomName,
                        sender = data.sender,
                        body = data.message,
                        rawJson = data.rawJson
                    )

                    // 백엔드 서버로 전송 (재시도 포함) + 동기화 상태 업데이트
                    if (settingsManager.backendEnabled) {
                        sendEventWithRetry(data, messageId)
                    }

                    // WebSocket으로 브로드캐스트
                    broadcastToWebSocket(data)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing notification", e)
            }
        }
    }

    /**
     * 백엔드 전송 with 재시도 로직 + 동기화 상태 업데이트
     */
    private suspend fun sendEventWithRetry(data: ParsedNotification, messageId: String, maxRetries: Int = 3) {
        var lastError: Exception? = null
        repeat(maxRetries) { attempt ->
            try {
                val result = backendClient.sendEvent(
                    chatRoom = data.roomName,
                    senderName = data.sender,
                    text = data.message,
                    isGroup = data.isGroup
                )
                result.onSuccess { response ->
                    Log.d(TAG, "Event sent to backend (attempt ${attempt + 1}): ${response.eventId}, deduped: ${response.deduped}")
                    // 동기화 성공 - 상태 업데이트
                    database.chatDao().updateSyncStatus(
                        messageId = messageId,
                        synced = true,
                        syncedAt = System.currentTimeMillis()
                    )
                    return
                }.onFailure { error ->
                    lastError = error as? Exception
                    Log.w(TAG, "Backend send attempt ${attempt + 1} failed: ${error.message}")
                }
            } catch (e: Exception) {
                lastError = e
                Log.w(TAG, "Backend send attempt ${attempt + 1} exception: ${e.message}")
            }
            // 재시도 전 대기 (지수 백오프)
            if (attempt < maxRetries - 1) {
                kotlinx.coroutines.delay((attempt + 1) * 1000L)
            }
        }
        // 모든 재시도 실패 - 재시도 횟수 기록 (나중에 HealthCheckWorker에서 재시도)
        Log.e(TAG, "Failed to send event after $maxRetries attempts: ${lastError?.message}")
        database.chatDao().incrementRetryCount(messageId)
    }

    /**
     * WebSocket 브로드캐스트
     */
    private suspend fun broadcastToWebSocket(data: ParsedNotification) {
        try {
            val room = database.chatDao().getRoomByName(data.roomName)
            room?.let { chatRoom ->
                val message = ChatMessage(
                    roomId = chatRoom.id,
                    sender = data.sender,
                    body = data.message,
                    timestamp = data.timestamp,
                    isFromMe = false,
                    rawJson = data.rawJson
                )

                webSocketServer?.broadcastNewMessage(message)
                webSocketServer?.broadcastRoomUpdate(chatRoom.copy(
                    lastMessage = data.message,
                    lastMessageAt = data.timestamp
                ))

                Log.d(TAG, "Broadcasted message via WebSocket")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error broadcasting to WebSocket", e)
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

        // 서비스 재연결 시 대기 중인 알림 처리
        serviceScope.launch {
            try {
                val activeNotifications = getActiveNotifications()
                val kakaoNotifications = activeNotifications?.filter { it.packageName == KAKAO_PACKAGE } ?: emptyList()

                if (kakaoNotifications.isNotEmpty()) {
                    Log.d(TAG, "Processing ${kakaoNotifications.size} pending KakaoTalk notifications")
                    for (sbn in kakaoNotifications) {
                        processNotification(sbn.notification)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing pending notifications", e)
            }
        }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.w(TAG, "NotificationListenerService disconnected - notifications may be missed!")
        // 캐시 클리어 (재연결 시 중복 처리 방지)
        synchronized(processedMessages) {
            processedMessages.clear()
        }
    }
}
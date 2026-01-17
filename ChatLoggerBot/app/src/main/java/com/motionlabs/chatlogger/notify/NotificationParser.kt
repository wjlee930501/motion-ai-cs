package com.motionlabs.chatlogger.notify

import android.app.Notification
import android.app.Person
import android.os.Bundle
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject

data class ParsedNotification(
    val roomName: String,
    val sender: String,
    val message: String,
    val timestamp: Long = System.currentTimeMillis(),
    val rawJson: String? = null,
    val isGroup: Boolean? = null
)

data class ParseResult(
    val notifications: List<ParsedNotification>,
    val rawJson: String? = null
)

class NotificationParser {
    
    companion object {
        private const val TAG = "NotificationParser"
        private const val EXTRA_TITLE = "android.title"
        private const val EXTRA_TEXT = "android.text"
        private const val EXTRA_SUB_TEXT = "android.subText"
        private const val EXTRA_BIG_TEXT = "android.bigText"
        private const val EXTRA_MESSAGES = "android.messages"
        private const val EXTRA_MESSAGING_PERSON = "android.messagingUser"
        private const val EXTRA_CONVERSATION_TITLE = "android.conversationTitle"
    }

    private val gson = Gson()

    /**
     * 단일 알림 파싱 (기존 호환성 유지)
     */
    fun parseKakaoNotification(notification: Notification): ParsedNotification? {
        val result = parseKakaoNotificationAll(notification)
        return result.notifications.lastOrNull()
    }

    /**
     * 그룹 알림의 모든 메시지를 파싱
     * 알림이 쌓여있는 경우 모든 메시지를 반환
     */
    fun parseKakaoNotificationAll(notification: Notification): ParseResult {
        return try {
            val extras = notification.extras
            val rawJson = convertExtrasToJson(extras)

            // 그룹 요약 알림인지 확인 (FLAG_GROUP_SUMMARY)
            val isGroupSummary = (notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0
            if (isGroupSummary) {
                Log.d(TAG, "Skipping group summary notification")
                return ParseResult(emptyList(), rawJson)
            }

            // MessagingStyle 알림 처리 - 모든 메시지 반환
            val messagingStyleResults = parseMessagingStyleAll(extras)
            if (messagingStyleResults.isNotEmpty()) {
                return ParseResult(
                    notifications = messagingStyleResults.map { it.copy(rawJson = rawJson) },
                    rawJson = rawJson
                )
            }

            // 일반 알림 처리
            val title = extras.getCharSequence(EXTRA_TITLE)?.toString() ?: ""
            val text = extras.getCharSequence(EXTRA_TEXT)?.toString() ?: ""
            val bigText = extras.getCharSequence(EXTRA_BIG_TEXT)?.toString()
            val subText = extras.getCharSequence(EXTRA_SUB_TEXT)?.toString()

            val message = bigText ?: text

            // 방 이름과 발신자 파싱
            val (roomName, sender, isGroup) = parseRoomAndSender(title, subText)

            if (roomName.isNotEmpty() && message.isNotEmpty()) {
                ParseResult(
                    notifications = listOf(ParsedNotification(
                        roomName = roomName,
                        sender = sender,
                        message = message,
                        rawJson = rawJson,
                        isGroup = isGroup
                    )),
                    rawJson = rawJson
                )
            } else {
                Log.w(TAG, "Incomplete notification data")
                ParseResult(emptyList(), rawJson)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing notification", e)
            ParseResult(emptyList(), null)
        }
    }

    /**
     * MessagingStyle 알림의 모든 메시지를 파싱
     */
    private fun parseMessagingStyleAll(extras: Bundle): List<ParsedNotification> {
        val results = mutableListOf<ParsedNotification>()
        try {
            val conversationTitle = extras.getCharSequence(EXTRA_CONVERSATION_TITLE)?.toString()
            val subText = extras.getCharSequence(EXTRA_SUB_TEXT)?.toString()
            val messages = extras.getParcelableArray(EXTRA_MESSAGES)

            Log.d(TAG, "DEBUG: conversationTitle=$conversationTitle, subText=$subText, messagesCount=${messages?.size ?: 0}")

            if (!messages.isNullOrEmpty()) {
                // 모든 메시지를 처리 (마지막 것만이 아닌 전체)
                for (msg in messages) {
                    val bundle = msg as? Bundle ?: continue
                    val text = bundle.getCharSequence("text")?.toString() ?: ""
                    if (text.isEmpty()) continue

                    val sender = bundle.getCharSequence("sender")?.toString() ?:
                                bundle.getParcelable<Person>("sender_person")?.name?.toString() ?: "Unknown"
                    val time = bundle.getLong("time", System.currentTimeMillis())

                    // 그룹 채팅방 감지
                    val roomName: String
                    val isGroup: Boolean

                    when {
                        conversationTitle != null && conversationTitle != sender -> {
                            roomName = conversationTitle
                            isGroup = true
                        }
                        !subText.isNullOrEmpty() -> {
                            roomName = subText
                            isGroup = true
                        }
                        else -> {
                            roomName = sender
                            isGroup = false
                        }
                    }

                    results.add(ParsedNotification(
                        roomName = roomName,
                        sender = sender,
                        message = text,
                        timestamp = time,
                        isGroup = isGroup
                    ))
                }
                Log.d(TAG, "DEBUG: Parsed ${results.size} messages from notification")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing MessagingStyle", e)
        }
        return results
    }

    @Deprecated("Use parseMessagingStyleAll instead")
    private fun parseMessagingStyle(extras: Bundle): ParsedNotification? {
        return parseMessagingStyleAll(extras).lastOrNull()
    }

    private fun parseRoomAndSender(title: String, subText: String?): Triple<String, String, Boolean> {
        // 단톡방인 경우: title = "발신자", subText = "방 이름"
        // 1:1 대화인 경우: title = "발신자", subText = null

        return if (!subText.isNullOrEmpty()) {
            // 단톡방
            Triple(subText, title, true)
        } else {
            // 1:1 대화
            Triple(title, title, false)
        }
    }

    /**
     * Get debug info from notification for troubleshooting parse failures
     */
    fun getDebugInfo(notification: Notification): String {
        return try {
            val extras = notification.extras
            val sb = StringBuilder()
            sb.append("=== Notification Debug Info ===\n")

            // Get all standard fields
            val title = extras.getCharSequence(EXTRA_TITLE)?.toString()
            val text = extras.getCharSequence(EXTRA_TEXT)?.toString()
            val subText = extras.getCharSequence(EXTRA_SUB_TEXT)?.toString()
            val bigText = extras.getCharSequence(EXTRA_BIG_TEXT)?.toString()
            val conversationTitle = extras.getCharSequence(EXTRA_CONVERSATION_TITLE)?.toString()
            val messages = extras.getParcelableArray(EXTRA_MESSAGES)

            sb.append("title: $title\n")
            sb.append("text: $text\n")
            sb.append("subText: $subText\n")
            sb.append("bigText: $bigText\n")
            sb.append("conversationTitle: $conversationTitle\n")
            sb.append("hasMessages: ${!messages.isNullOrEmpty()}\n")
            sb.append("messagesCount: ${messages?.size ?: 0}\n")

            // Get all extra keys
            sb.append("allKeys: ${extras.keySet().joinToString(", ")}\n")
            
            sb.toString()
        } catch (e: Exception) {
            "Error getting debug info: ${e.message}"
        }
    }

    private fun convertExtrasToJson(extras: Bundle): String {
        return try {
            val json = JsonObject()
            for (key in extras.keySet()) {
                try {
                    val value = extras.get(key)
                    when (value) {
                        is String -> json.addProperty(key, value)
                        is Int -> json.addProperty(key, value)
                        is Long -> json.addProperty(key, value)
                        is Boolean -> json.addProperty(key, value)
                        is CharSequence -> json.addProperty(key, value.toString())
                        else -> json.addProperty(key, value?.toString() ?: "null")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Error converting key $key", e)
                }
            }
            gson.toJson(json)
        } catch (e: Exception) {
            Log.e(TAG, "Error converting extras to JSON", e)
            "{}"
        }
    }
}
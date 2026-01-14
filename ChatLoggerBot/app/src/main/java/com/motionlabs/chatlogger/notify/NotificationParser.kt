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

    fun parseKakaoNotification(notification: Notification): ParsedNotification? {
        return try {
            val extras = notification.extras
            val rawJson = convertExtrasToJson(extras)
            
            // MessagingStyle 알림 처리
            val messagingStyle = parseMessagingStyle(extras)
            if (messagingStyle != null) {
                return messagingStyle.copy(rawJson = rawJson)
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
                ParsedNotification(
                    roomName = roomName,
                    sender = sender,
                    message = message,
                    rawJson = rawJson,
                    isGroup = isGroup
                )
            } else {
                Log.w(TAG, "Incomplete notification data")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing notification", e)
            null
        }
    }

    private fun parseMessagingStyle(extras: Bundle): ParsedNotification? {
        try {
            val conversationTitle = extras.getCharSequence(EXTRA_CONVERSATION_TITLE)?.toString()
            val subText = extras.getCharSequence(EXTRA_SUB_TEXT)?.toString()
            val title = extras.getCharSequence(EXTRA_TITLE)?.toString()
            val messages = extras.getParcelableArray(EXTRA_MESSAGES)

            Log.d(TAG, "DEBUG: conversationTitle=$conversationTitle, subText=$subText, title=$title, hasMessages=${!messages.isNullOrEmpty()}")

            if (!messages.isNullOrEmpty()) {
                val lastMessage = messages.last() as? Bundle
                if (lastMessage != null) {
                    val text = lastMessage.getCharSequence("text")?.toString() ?: ""
                    val sender = lastMessage.getCharSequence("sender")?.toString() ?:
                                lastMessage.getParcelable<Person>("sender_person")?.name?.toString() ?: "Unknown"
                    val time = lastMessage.getLong("time", System.currentTimeMillis())

                    // 그룹 채팅방 감지 순서:
                    // 1. conversationTitle이 있고 sender와 다르면 그룹
                    // 2. subText가 있으면 그룹 (subText = 방 이름, title = 발신자)
                    val roomName: String
                    val isGroup: Boolean

                    when {
                        conversationTitle != null && conversationTitle != sender -> {
                            // conversationTitle이 있는 그룹 채팅
                            roomName = conversationTitle
                            isGroup = true
                        }
                        !subText.isNullOrEmpty() -> {
                            // subText가 있으면 단톡방 (subText = 방 이름)
                            roomName = subText
                            isGroup = true
                        }
                        else -> {
                            // 1:1 대화
                            roomName = sender
                            isGroup = false
                        }
                    }

                    Log.d(TAG, "DEBUG: Final roomName=$roomName, sender=$sender, isGroup=$isGroup")

                    return ParsedNotification(
                        roomName = roomName,
                        sender = sender,
                        message = text,
                        timestamp = time,
                        isGroup = isGroup
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing MessagingStyle", e)
        }
        return null
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
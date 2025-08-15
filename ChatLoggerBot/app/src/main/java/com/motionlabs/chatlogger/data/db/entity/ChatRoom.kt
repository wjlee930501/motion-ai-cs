package com.motionlabs.chatlogger.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import java.util.UUID

@Entity(
    tableName = "chat_rooms",
    indices = [Index(value = ["roomName"])]
)
data class ChatRoom(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val roomName: String,
    val lastMessageAt: Long = System.currentTimeMillis(),
    val lastMessage: String? = null,
    val unreadCount: Int = 0
)
package com.motionlabs.chatlogger.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index
import java.util.UUID

@Entity(
    tableName = "chat_messages",
    foreignKeys = [
        ForeignKey(
            entity = ChatRoom::class,
            parentColumns = ["id"],
            childColumns = ["roomId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["roomId"]),
        Index(value = ["timestamp"])
    ]
)
data class ChatMessage(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val roomId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val sender: String,
    val body: String,
    val rawJson: String? = null,
    val isFromMe: Boolean = false
)
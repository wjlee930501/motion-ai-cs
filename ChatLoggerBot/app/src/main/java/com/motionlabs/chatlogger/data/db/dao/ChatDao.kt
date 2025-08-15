package com.motionlabs.chatlogger.data.db.dao

import androidx.room.*
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatDao {
    @Query("SELECT * FROM chat_rooms ORDER BY lastMessageAt DESC")
    fun getAllRooms(): Flow<List<ChatRoom>>

    @Query("SELECT * FROM chat_rooms WHERE id = :roomId")
    suspend fun getRoomById(roomId: String): ChatRoom?

    @Query("SELECT * FROM chat_rooms WHERE roomName = :roomName LIMIT 1")
    suspend fun getRoomByName(roomName: String): ChatRoom?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRoom(room: ChatRoom)

    @Update
    suspend fun updateRoom(room: ChatRoom)

    @Delete
    suspend fun deleteRoom(room: ChatRoom)

    @Query("SELECT * FROM chat_messages WHERE roomId = :roomId ORDER BY timestamp ASC")
    fun getMessagesForRoom(roomId: String): Flow<List<ChatMessage>>

    @Query("SELECT * FROM chat_messages WHERE roomId = :roomId ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecentMessagesForRoom(roomId: String, limit: Int = 100): List<ChatMessage>

    @Insert
    suspend fun insertMessage(message: ChatMessage)

    @Insert
    suspend fun insertMessages(messages: List<ChatMessage>)

    @Query("DELETE FROM chat_messages WHERE timestamp < :timestamp")
    suspend fun deleteMessagesOlderThan(timestamp: Long)

    @Query("SELECT * FROM chat_messages WHERE body LIKE '%' || :query || '%' OR sender LIKE '%' || :query || '%' ORDER BY timestamp DESC")
    fun searchMessages(query: String): Flow<List<ChatMessage>>

    @Query("SELECT COUNT(*) FROM chat_messages WHERE roomId = :roomId")
    suspend fun getMessageCountForRoom(roomId: String): Int

    @Query("DELETE FROM chat_rooms")
    suspend fun deleteAllRooms()

    @Query("DELETE FROM chat_messages")
    suspend fun deleteAllMessages()

    @Query("DELETE FROM chat_messages WHERE roomId = :roomId")
    suspend fun deleteMessagesForRoom(roomId: String)

    @Transaction
    suspend fun deleteRoomWithMessages(room: ChatRoom) {
        deleteMessagesForRoom(room.id)
        deleteRoom(room)
    }

    @Transaction
    suspend fun insertMessageWithRoom(roomName: String, sender: String, body: String, rawJson: String? = null) {
        var room = getRoomByName(roomName)
        if (room == null) {
            room = ChatRoom(
                roomName = roomName,
                lastMessageAt = System.currentTimeMillis(),
                lastMessage = body
            )
            insertRoom(room)
        } else {
            updateRoom(room.copy(
                lastMessageAt = System.currentTimeMillis(),
                lastMessage = body
            ))
        }
        
        val message = ChatMessage(
            roomId = room.id,
            sender = sender,
            body = body,
            rawJson = rawJson,
            timestamp = System.currentTimeMillis()
        )
        insertMessage(message)
    }
}
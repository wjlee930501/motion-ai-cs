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
    suspend fun insertMessageWithRoom(roomName: String, sender: String, body: String, rawJson: String? = null): String {
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
            timestamp = System.currentTimeMillis(),
            serverSynced = false  // 초기값: 미동기화
        )
        insertMessage(message)
        return message.id  // 메시지 ID 반환
    }

    // ============================================
    // 서버 동기화 관련 쿼리
    // ============================================

    /**
     * 메시지 동기화 상태 업데이트
     */
    @Query("UPDATE chat_messages SET serverSynced = :synced, syncedAt = :syncedAt WHERE id = :messageId")
    suspend fun updateSyncStatus(messageId: String, synced: Boolean, syncedAt: Long?)

    /**
     * 동기화 실패 시 재시도 횟수 증가
     */
    @Query("UPDATE chat_messages SET retryCount = retryCount + 1 WHERE id = :messageId")
    suspend fun incrementRetryCount(messageId: String)

    /**
     * 미동기화된 메시지 조회 (재시도용)
     */
    @Query("""
        SELECT * FROM chat_messages
        WHERE serverSynced = 0 AND retryCount < :maxRetries
        ORDER BY timestamp ASC
        LIMIT :limit
    """)
    suspend fun getUnsyncedMessages(maxRetries: Int = 10, limit: Int = 50): List<ChatMessage>

    /**
     * 동기화 완료 + 보관 기간 경과한 메시지 삭제
     */
    @Query("""
        DELETE FROM chat_messages
        WHERE serverSynced = 1 AND syncedAt < :cutoffTime
    """)
    suspend fun deleteSyncedMessagesOlderThan(cutoffTime: Long): Int

    /**
     * 동기화 통계
     */
    @Query("SELECT COUNT(*) FROM chat_messages WHERE serverSynced = 0")
    suspend fun getUnsyncedCount(): Int

    @Query("SELECT COUNT(*) FROM chat_messages WHERE serverSynced = 1")
    suspend fun getSyncedCount(): Int
}
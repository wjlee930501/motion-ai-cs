package com.motionlabs.chatlogger.data.repo

import com.motionlabs.chatlogger.data.db.dao.ChatDao
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatRepository @Inject constructor(
    private val chatDao: ChatDao
) {
    fun getAllRooms(): Flow<List<ChatRoom>> = chatDao.getAllRooms()

    fun getMessagesForRoom(roomId: String): Flow<List<ChatMessage>> = 
        chatDao.getMessagesForRoom(roomId)

    suspend fun getRoomById(roomId: String): ChatRoom? = 
        chatDao.getRoomById(roomId)

    suspend fun getRoomByName(roomName: String): ChatRoom? = 
        chatDao.getRoomByName(roomName)

    suspend fun insertRoom(room: ChatRoom) = 
        chatDao.insertRoom(room)

    suspend fun updateRoom(room: ChatRoom) = 
        chatDao.updateRoom(room)

    suspend fun insertMessage(message: ChatMessage) = 
        chatDao.insertMessage(message)

    suspend fun insertMessageWithRoom(
        roomName: String,
        sender: String,
        body: String,
        rawJson: String? = null
    ) = chatDao.insertMessageWithRoom(roomName, sender, body, rawJson)

    suspend fun deleteMessagesOlderThan(timestamp: Long) = 
        chatDao.deleteMessagesOlderThan(timestamp)

    fun searchMessages(query: String): Flow<List<ChatMessage>> = 
        chatDao.searchMessages(query)

    suspend fun getMessageCountForRoom(roomId: String): Int = 
        chatDao.getMessageCountForRoom(roomId)

    suspend fun getRecentMessagesForRoom(roomId: String, limit: Int = 100): List<ChatMessage> = 
        chatDao.getRecentMessagesForRoom(roomId, limit)

    suspend fun deleteAllData() {
        chatDao.deleteAllMessages()
        chatDao.deleteAllRooms()
    }
}
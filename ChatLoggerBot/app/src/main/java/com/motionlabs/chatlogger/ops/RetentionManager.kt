package com.motionlabs.chatlogger.ops

import android.content.Context
import android.util.Log
import com.motionlabs.chatlogger.data.db.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class RetentionManager {
    
    companion object {
        private const val TAG = "RetentionManager"
        private const val DEFAULT_RETENTION_DAYS = 90
    }
    
    suspend fun cleanOldData(
        context: Context,
        retentionDays: Int = DEFAULT_RETENTION_DAYS
    ): Int = withContext(Dispatchers.IO) {
        try {
            val database = AppDatabase.getDatabase(context)
            val cutoffTime = System.currentTimeMillis() - (retentionDays * 24 * 60 * 60 * 1000L)
            
            // Delete old messages
            database.chatDao().deleteMessagesOlderThan(cutoffTime)
            
            // Get all rooms and delete empty ones
            val rooms = database.chatDao().getAllRooms()
            var deletedRoomCount = 0
            
            rooms.collect { roomList ->
                roomList.forEach { room ->
                    val messageCount = database.chatDao().getMessageCountForRoom(room.id)
                    if (messageCount == 0) {
                        database.chatDao().deleteRoom(room)
                        deletedRoomCount++
                    }
                }
            }
            
            Log.d(TAG, "Retention cleanup completed. Deleted messages older than $retentionDays days and $deletedRoomCount empty rooms")
            deletedRoomCount
        } catch (e: Exception) {
            Log.e(TAG, "Retention cleanup failed", e)
            0
        }
    }
    
    suspend fun getDataStatistics(context: Context): DataStatistics {
        return withContext(Dispatchers.IO) {
            try {
                val database = AppDatabase.getDatabase(context)
                val dao = database.chatDao()
                
                val rooms = dao.getAllRooms()
                var roomCount = 0
                var totalMessages = 0
                
                rooms.collect { roomList ->
                    roomCount = roomList.size
                    roomList.forEach { room ->
                        totalMessages += dao.getMessageCountForRoom(room.id)
                    }
                }
                
                DataStatistics(
                    roomCount = roomCount,
                    messageCount = totalMessages,
                    oldestMessageTime = findOldestMessageTime(database),
                    newestMessageTime = findNewestMessageTime(database)
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get data statistics", e)
                DataStatistics()
            }
        }
    }
    
    private suspend fun findOldestMessageTime(database: AppDatabase): Long? {
        // In a real implementation, you'd add a query for this
        return null
    }
    
    private suspend fun findNewestMessageTime(database: AppDatabase): Long? {
        // In a real implementation, you'd add a query for this
        return null
    }
    
    data class DataStatistics(
        val roomCount: Int = 0,
        val messageCount: Int = 0,
        val oldestMessageTime: Long? = null,
        val newestMessageTime: Long? = null
    )
}
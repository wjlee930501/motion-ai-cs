package com.motionlabs.chatlogger.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import com.motionlabs.chatlogger.api.BackendApiClient
import com.motionlabs.chatlogger.data.db.AppDatabase
import com.motionlabs.chatlogger.data.repo.ChatRepository
import com.motionlabs.chatlogger.ops.ExportManager
import com.motionlabs.chatlogger.ops.RetentionManager

class SettingsViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val repository = ChatRepository(database.chatDao())
    private val exportManager = ExportManager()
    private val retentionManager = RetentionManager()
    private val backendClient = BackendApiClient.getInstance(application)
    
    suspend fun exportToJson(context: Context) {
        val rooms = database.chatDao().getAllRooms()
        val messages = database.chatDao().searchMessages("")
        exportManager.exportToJson(context, rooms, messages)
    }
    
    suspend fun exportToCsv(context: Context) {
        val rooms = database.chatDao().getAllRooms()
        val messages = database.chatDao().searchMessages("")
        exportManager.exportToCsv(context, rooms, messages)
    }
    
    suspend fun clearAllData() {
        repository.deleteAllData()
    }
    
    suspend fun cleanOldData(retentionDays: Int) {
        val cutoffTime = System.currentTimeMillis() - (retentionDays * 24 * 60 * 60 * 1000L)
        repository.deleteMessagesOlderThan(cutoffTime)
    }

    suspend fun testBackendConnection(): Boolean {
        return try {
            val result = backendClient.checkHealth()
            result.isSuccess && result.getOrNull()?.status == "healthy"
        } catch (e: Exception) {
            false
        }
    }

    suspend fun sendHeartbeat(): Boolean {
        return try {
            val result = backendClient.sendHeartbeat()
            result.isSuccess
        } catch (e: Exception) {
            false
        }
    }
}
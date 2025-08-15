package com.motionlabs.chatlogger.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import com.motionlabs.chatlogger.data.db.AppDatabase
import com.motionlabs.chatlogger.data.repo.ChatRepository
import com.motionlabs.chatlogger.ops.ExportManager
import com.motionlabs.chatlogger.ops.RetentionManager

class SettingsViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val repository = ChatRepository(database.chatDao())
    private val exportManager = ExportManager()
    private val retentionManager = RetentionManager()
    
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
}
package com.motionlabs.chatlogger.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.motionlabs.chatlogger.data.db.AppDatabase
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import com.motionlabs.chatlogger.data.repo.ChatRepository
import kotlinx.coroutines.flow.Flow

class HomeViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val repository = ChatRepository(database.chatDao())
    
    val rooms: Flow<List<ChatRoom>> = repository.getAllRooms()
}
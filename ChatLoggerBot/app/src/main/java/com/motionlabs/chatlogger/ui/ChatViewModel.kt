package com.motionlabs.chatlogger.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.motionlabs.chatlogger.data.db.AppDatabase
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import com.motionlabs.chatlogger.data.repo.ChatRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ChatViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val repository = ChatRepository(database.chatDao())
    
    private val _currentRoom = MutableStateFlow<ChatRoom?>(null)
    
    fun getMessagesForRoom(roomId: String): Flow<List<ChatMessage>> {
        return repository.getMessagesForRoom(roomId)
    }
    
    fun getRoomById(roomId: String): StateFlow<ChatRoom?> {
        viewModelScope.launch {
            _currentRoom.value = repository.getRoomById(roomId)
        }
        return _currentRoom
    }
}
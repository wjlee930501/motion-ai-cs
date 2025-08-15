package com.motionlabs.chatlogger.api

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.motionlabs.chatlogger.data.db.AppDatabase
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import fi.iki.elonen.NanoWSD
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import java.io.IOException

class WebSocketServer(private val context: Context, port: Int = 8081) : NanoWSD(port) {
    
    companion object {
        private const val TAG = "WebSocketServer"
    }
    
    private val database = AppDatabase.getDatabase(context)
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val connectedClients = mutableSetOf<WebSocket>()
    
    init {
        start(SOCKET_READ_TIMEOUT, false)
        startDatabaseListener()
        Log.d(TAG, "WebSocket server started on port $port")
    }
    
    override fun openWebSocket(handshake: IHTTPSession): WebSocket {
        return ChatWebSocket(handshake)
    }
    
    private fun startDatabaseListener() {
        // Listen for new rooms
        scope.launch {
            database.chatDao().getAllRooms().collectLatest { rooms ->
                broadcastToClients("rooms_update", rooms)
            }
        }
    }
    
    fun broadcastNewMessage(message: ChatMessage) {
        broadcastToClients("new_message", message)
    }
    
    fun broadcastRoomUpdate(room: ChatRoom) {
        broadcastToClients("room_updated", room)
    }
    
    private fun broadcastToClients(event: String, data: Any) {
        val message = gson.toJson(mapOf(
            "event" to event,
            "data" to data,
            "timestamp" to System.currentTimeMillis()
        ))
        
        connectedClients.forEach { client ->
            try {
                client.send(message)
            } catch (e: IOException) {
                Log.e(TAG, "Failed to send message to client", e)
            }
        }
    }
    
    fun stopServer() {
        stop()
        scope.cancel()
    }
    
    inner class ChatWebSocket(handshake: IHTTPSession) : WebSocket(handshake) {
        
        override fun onOpen() {
            connectedClients.add(this)
            Log.d(TAG, "WebSocket client connected. Total clients: ${connectedClients.size}")
            
            // Send initial sync data
            scope.launch {
                try {
                    val rooms = database.chatDao().getAllRooms()
                    rooms.collectLatest { roomList ->
                        val syncData = mapOf(
                            "event" to "initial_sync",
                            "data" to mapOf(
                                "rooms" to roomList
                            )
                        )
                        send(gson.toJson(syncData))
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send initial sync", e)
                }
            }
        }
        
        override fun onClose(code: WebSocketFrame.CloseCode, reason: String, initiatedByRemote: Boolean) {
            connectedClients.remove(this)
            Log.d(TAG, "WebSocket client disconnected. Total clients: ${connectedClients.size}")
        }
        
        override fun onMessage(message: WebSocketFrame) {
            val text = message.textPayload
            Log.d(TAG, "Received message: $text")
            
            try {
                val json = gson.fromJson(text, Map::class.java)
                val event = json["event"] as? String
                
                when (event) {
                    "ping" -> {
                        send(gson.toJson(mapOf("event" to "pong")))
                    }
                    "get_messages" -> {
                        val roomId = json["roomId"] as? String
                        if (roomId != null) {
                            scope.launch {
                                val messages = database.chatDao().getRecentMessagesForRoom(roomId, 100)
                                val response = mapOf(
                                    "event" to "messages",
                                    "roomId" to roomId,
                                    "data" to messages
                                )
                                send(gson.toJson(response))
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing message", e)
            }
        }
        
        override fun onPong(pong: WebSocketFrame) {
            // Handle pong
        }
        
        override fun onException(exception: IOException) {
            Log.e(TAG, "WebSocket exception", exception)
        }
    }
}
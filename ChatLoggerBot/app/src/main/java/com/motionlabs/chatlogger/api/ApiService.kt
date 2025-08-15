package com.motionlabs.chatlogger.api

import android.content.Context
import com.google.gson.Gson
import com.motionlabs.chatlogger.data.db.AppDatabase
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import fi.iki.elonen.NanoHTTPD
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import java.io.IOException

class ApiService(private val context: Context, port: Int = 8080) : NanoHTTPD(port) {
    
    private val database = AppDatabase.getDatabase(context)
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    init {
        start(SOCKET_READ_TIMEOUT, false)
    }
    
    override fun serve(session: IHTTPSession): Response {
        // Enable CORS
        val response = when {
            session.method == Method.OPTIONS -> handleOptions()
            session.uri == "/api/rooms" && session.method == Method.GET -> getRooms()
            session.uri.startsWith("/api/rooms/") && session.uri.endsWith("/messages") -> getMessages(session.uri)
            session.uri == "/api/sync" && session.method == Method.GET -> getSyncData()
            session.uri == "/api/search" && session.method == Method.GET -> searchMessages(session.parameters)
            session.uri == "/api/stats" && session.method == Method.GET -> getStats()
            session.uri == "/health" && session.method == Method.GET -> healthCheck()
            else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"Not found"}""")
        }
        
        // Add CORS headers
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        response.addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
        
        return response
    }
    
    private fun handleOptions(): Response {
        return newFixedLengthResponse(Response.Status.OK, "text/plain", "")
    }
    
    private fun getRooms(): Response {
        return try {
            val rooms = runBlocking {
                database.chatDao().getAllRooms().first()
            }
            newFixedLengthResponse(
                Response.Status.OK,
                "application/json",
                gson.toJson(rooms)
            )
        } catch (e: Exception) {
            errorResponse(e.message ?: "Error fetching rooms")
        }
    }
    
    private fun getMessages(uri: String): Response {
        return try {
            val roomId = uri.split("/")[3]
            val messages = runBlocking {
                database.chatDao().getMessagesForRoom(roomId).first()
            }
            newFixedLengthResponse(
                Response.Status.OK,
                "application/json",
                gson.toJson(messages)
            )
        } catch (e: Exception) {
            errorResponse(e.message ?: "Error fetching messages")
        }
    }
    
    private fun getSyncData(): Response {
        return try {
            val syncData = runBlocking {
                val rooms = database.chatDao().getAllRooms().first()
                val allMessages = mutableListOf<ChatMessage>()
                
                rooms.forEach { room ->
                    val messages = database.chatDao().getMessagesForRoom(room.id).first()
                    allMessages.addAll(messages)
                }
                
                SyncData(rooms = rooms, messages = allMessages)
            }
            
            newFixedLengthResponse(
                Response.Status.OK,
                "application/json",
                gson.toJson(syncData)
            )
        } catch (e: Exception) {
            errorResponse(e.message ?: "Error syncing data")
        }
    }
    
    private fun searchMessages(parameters: Map<String, List<String>>): Response {
        return try {
            val query = parameters["q"]?.firstOrNull() ?: ""
            val messages = runBlocking {
                database.chatDao().searchMessages(query).first()
            }
            newFixedLengthResponse(
                Response.Status.OK,
                "application/json",
                gson.toJson(messages)
            )
        } catch (e: Exception) {
            errorResponse(e.message ?: "Error searching messages")
        }
    }
    
    private fun getStats(): Response {
        return try {
            val stats = runBlocking {
                val rooms = database.chatDao().getAllRooms().first()
                var totalMessages = 0
                
                rooms.forEach { room ->
                    totalMessages += database.chatDao().getMessageCountForRoom(room.id)
                }
                
                Stats(
                    roomCount = rooms.size,
                    messageCount = totalMessages,
                    lastUpdate = System.currentTimeMillis()
                )
            }
            
            newFixedLengthResponse(
                Response.Status.OK,
                "application/json",
                gson.toJson(stats)
            )
        } catch (e: Exception) {
            errorResponse(e.message ?: "Error fetching stats")
        }
    }
    
    private fun healthCheck(): Response {
        return newFixedLengthResponse(
            Response.Status.OK,
            "application/json",
            """{"status":"healthy","timestamp":${System.currentTimeMillis()}}"""
        )
    }
    
    private fun errorResponse(message: String): Response {
        return newFixedLengthResponse(
            Response.Status.INTERNAL_ERROR,
            "application/json",
            gson.toJson(mapOf("error" to message))
        )
    }
    
    data class SyncData(
        val rooms: List<ChatRoom>,
        val messages: List<ChatMessage>
    )
    
    data class Stats(
        val roomCount: Int,
        val messageCount: Int,
        val lastUpdate: Long
    )
    
    fun stopServer() {
        stop()
        scope.cancel()
    }
}
package com.motionlabs.chatlogger.ops

import android.content.Context
import android.os.Environment
import android.util.Log
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.*

class ExportManager {
    
    companion object {
        private const val TAG = "ExportManager"
        private const val EXPORT_DIR = "ChatLoggerBot"
    }
    
    private val gson: Gson = GsonBuilder()
        .setPrettyPrinting()
        .setDateFormat("yyyy-MM-dd HH:mm:ss")
        .create()
    
    suspend fun exportToJson(
        context: Context,
        rooms: Flow<List<ChatRoom>>,
        messages: Flow<List<ChatMessage>>
    ): File? {
        return try {
            val exportDir = getExportDirectory()
            val fileName = "export-${getTimestamp()}.json"
            val file = File(exportDir, fileName)
            
            val exportData = ExportData(
                exportDate = Date(),
                rooms = rooms.first(),
                messages = messages.first()
            )
            
            FileWriter(file).use { writer ->
                gson.toJson(exportData, writer)
            }
            
            Log.d(TAG, "Exported to JSON: ${file.absolutePath}")
            file
        } catch (e: Exception) {
            Log.e(TAG, "Export to JSON failed", e)
            null
        }
    }
    
    suspend fun exportToCsv(
        context: Context,
        rooms: Flow<List<ChatRoom>>,
        messages: Flow<List<ChatMessage>>
    ): File? {
        return try {
            val exportDir = getExportDirectory()
            val fileName = "export-${getTimestamp()}.csv"
            val file = File(exportDir, fileName)
            
            val roomsList = rooms.first()
            val messagesList = messages.first()
            val roomMap = roomsList.associateBy { it.id }
            
            FileWriter(file).use { writer ->
                // Write CSV header
                writer.append("Timestamp,Room,Sender,Message\n")
                
                // Write messages
                messagesList.forEach { message ->
                    val roomName = roomMap[message.roomId]?.roomName ?: "Unknown"
                    val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                        .format(Date(message.timestamp))
                    
                    writer.append("\"$timestamp\",")
                    writer.append("\"${escapeCsv(roomName)}\",")
                    writer.append("\"${escapeCsv(message.sender)}\",")
                    writer.append("\"${escapeCsv(message.body)}\"\n")
                }
            }
            
            Log.d(TAG, "Exported to CSV: ${file.absolutePath}")
            file
        } catch (e: Exception) {
            Log.e(TAG, "Export to CSV failed", e)
            null
        }
    }
    
    private fun getExportDirectory(): File {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val exportDir = File(downloadsDir, EXPORT_DIR)
        
        if (!exportDir.exists()) {
            exportDir.mkdirs()
        }
        
        return exportDir
    }
    
    private fun getTimestamp(): String {
        val sdf = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.getDefault())
        return sdf.format(Date())
    }
    
    private fun escapeCsv(text: String): String {
        return text.replace("\"", "\"\"")
    }
    
    data class ExportData(
        val exportDate: Date,
        val rooms: List<ChatRoom>,
        val messages: List<ChatMessage>
    )
}
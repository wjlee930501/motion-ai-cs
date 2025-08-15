package com.motionlabs.chatlogger.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.motionlabs.chatlogger.data.db.dao.ChatDao
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom

@Database(
    entities = [ChatRoom::class, ChatMessage::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun chatDao(): ChatDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "chatlogger.db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
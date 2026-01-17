package com.motionlabs.chatlogger.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.motionlabs.chatlogger.data.db.dao.ChatDao
import com.motionlabs.chatlogger.data.db.entity.ChatMessage
import com.motionlabs.chatlogger.data.db.entity.ChatRoom

@Database(
    entities = [ChatRoom::class, ChatMessage::class],
    version = 2,  // 버전 업
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun chatDao(): ChatDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        // 마이그레이션: v1 -> v2 (serverSynced, syncedAt, retryCount 추가)
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // 새 컬럼 추가
                database.execSQL("ALTER TABLE chat_messages ADD COLUMN serverSynced INTEGER NOT NULL DEFAULT 0")
                database.execSQL("ALTER TABLE chat_messages ADD COLUMN syncedAt INTEGER")
                database.execSQL("ALTER TABLE chat_messages ADD COLUMN retryCount INTEGER NOT NULL DEFAULT 0")

                // 인덱스 추가
                database.execSQL("CREATE INDEX IF NOT EXISTS index_chat_messages_serverSynced ON chat_messages(serverSynced)")

                // 기존 메시지는 동기화된 것으로 간주 (이미 서버에 전송되었을 가능성)
                database.execSQL("UPDATE chat_messages SET serverSynced = 1, syncedAt = ${System.currentTimeMillis()}")
            }
        }

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "chatlogger.db"
                )
                    .addMigrations(MIGRATION_1_2)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
package com.motionlabs.chatlogger

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.app.NotificationManagerCompat
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.work.*
import com.motionlabs.chatlogger.service.ForegroundService
import com.motionlabs.chatlogger.service.HealthCheckWorker
import com.motionlabs.chatlogger.ui.ChatScreen
import com.motionlabs.chatlogger.ui.HomeScreen
import com.motionlabs.chatlogger.ui.SettingsScreen
import com.motionlabs.chatlogger.ui.theme.ChatLoggerBotTheme
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            checkNotificationListenerPermission()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request permissions
        requestPermissions()

        // Check battery optimization
        checkBatteryOptimization()

        // Start services
        startServices()

        setContent {
            ChatLoggerBotTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainNavigation()
                }
            }
        }
    }
    
    private fun requestPermissions() {
        // Request POST_NOTIFICATIONS permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                checkNotificationListenerPermission()
            }
        } else {
            checkNotificationListenerPermission()
        }
    }
    
    private fun checkNotificationListenerPermission() {
        val componentName = componentName
        val enabledListeners = NotificationManagerCompat.getEnabledListenerPackages(this)
        
        if (!enabledListeners.contains(packageName)) {
            // Prompt user to enable notification access
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            startActivity(intent)
        }
    }
    
    private fun startServices() {
        // Start ForegroundService
        val serviceIntent = Intent(this, ForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        
        // Schedule HealthCheckWorker
        scheduleHealthCheckWorker()
    }
    
    private fun checkBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = android.net.Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    android.util.Log.e("MainActivity", "Failed to request battery optimization exemption: ${e.message}")
                }
            }
        }
    }

    private fun scheduleHealthCheckWorker() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
            .setRequiresBatteryNotLow(false)
            .build()

        val healthCheckRequest = PeriodicWorkRequestBuilder<HealthCheckWorker>(
            15, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .addTag("health_check")
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "health_check_work",
            ExistingPeriodicWorkPolicy.KEEP,
            healthCheckRequest
        )
    }
}

@Composable
fun MainNavigation() {
    val navController = rememberNavController()
    
    NavHost(
        navController = navController,
        startDestination = "home"
    ) {
        composable("home") {
            HomeScreen(
                onRoomClick = { roomId ->
                    navController.navigate("chat/$roomId")
                },
                onSettingsClick = {
                    navController.navigate("settings")
                }
            )
        }
        
        composable("chat/{roomId}") { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
            ChatScreen(
                roomId = roomId,
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }
        
        composable("settings") {
            SettingsScreen(
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }
    }
}
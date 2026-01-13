package com.motionlabs.chatlogger.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.motionlabs.chatlogger.config.SettingsManager
import kotlinx.coroutines.launch
import java.net.NetworkInterface
import java.util.Collections

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBackClick: () -> Unit,
    viewModel: SettingsViewModel = viewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val settingsManager = remember { SettingsManager.getInstance(context) }

    var retentionDays by remember { mutableStateOf(90) }
    var showExportDialog by remember { mutableStateOf(false) }
    var showClearDialog by remember { mutableStateOf(false) }

    // Backend settings state
    var backendUrl by remember { mutableStateOf(settingsManager.backendUrl) }
    var deviceKey by remember { mutableStateOf(settingsManager.deviceKey) }
    var backendEnabled by remember { mutableStateOf(settingsManager.backendEnabled) }
    var connectionStatus by remember { mutableStateOf<ConnectionStatus>(ConnectionStatus.Unknown) }
    var isTestingConnection by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Backend Server Settings Card (NEW - Most Important)
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Backend Server Settings",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Switch(
                            checked = backendEnabled,
                            onCheckedChange = {
                                backendEnabled = it
                                settingsManager.backendEnabled = it
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = if (backendEnabled) "Backend sync enabled" else "Backend sync disabled",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (backendEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = backendUrl,
                        onValueChange = { backendUrl = it },
                        label = { Text("Backend URL") },
                        placeholder = { Text("http://192.168.1.100:8001") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = backendEnabled
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = deviceKey,
                        onValueChange = { deviceKey = it },
                        label = { Text("Device Key") },
                        placeholder = { Text("local-dev-key") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = backendEnabled
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Device ID: ${settingsManager.deviceId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                settingsManager.backendUrl = backendUrl
                                settingsManager.deviceKey = deviceKey
                            },
                            modifier = Modifier.weight(1f),
                            enabled = backendEnabled
                        ) {
                            Text("Save")
                        }

                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    isTestingConnection = true
                                    connectionStatus = ConnectionStatus.Testing
                                    val result = viewModel.testBackendConnection()
                                    connectionStatus = if (result) {
                                        ConnectionStatus.Connected
                                    } else {
                                        ConnectionStatus.Failed
                                    }
                                    isTestingConnection = false
                                }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = backendEnabled && !isTestingConnection
                        ) {
                            if (isTestingConnection) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Icon(
                                    Icons.Default.Refresh,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Test")
                        }
                    }

                    // Connection status indicator
                    when (connectionStatus) {
                        ConnectionStatus.Connected -> {
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Color(0xFF4CAF50),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    "Connected successfully",
                                    color = Color(0xFF4CAF50),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                        ConnectionStatus.Failed -> {
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    "Connection failed",
                                    color = MaterialTheme.colorScheme.error,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                        else -> {}
                    }
                }
            }

            // API Server Status Card (Local)
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Local API Server",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    val ipAddress = remember { getIpAddress() }

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("HTTP API: ")
                        Text(
                            text = "http://$ipAddress:8080",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("WebSocket: ")
                        Text(
                            text = "ws://$ipAddress:8081",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "웹페이지에서 위 주소로 접속하세요",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Data Retention",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Keep messages for: ")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "$retentionDays days",
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                    Slider(
                        value = retentionDays.toFloat(),
                        onValueChange = { retentionDays = it.toInt() },
                        valueRange = 7f..365f,
                        steps = 0,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Export Data",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        Button(
                            onClick = { 
                                scope.launch {
                                    viewModel.exportToJson(context)
                                    showExportDialog = true
                                }
                            }
                        ) {
                            Text("Export JSON")
                        }
                        Button(
                            onClick = { 
                                scope.launch {
                                    viewModel.exportToCsv(context)
                                    showExportDialog = true
                                }
                            }
                        ) {
                            Text("Export CSV")
                        }
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Clear Data",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = { showClearDialog = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Clear All Data")
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "App Info",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Version: 1.0.0")
                    Text("MotionLabs ChatLoggerBot")
                }
            }
        }
    }

    if (showExportDialog) {
        AlertDialog(
            onDismissRequest = { showExportDialog = false },
            title = { Text("Export Complete") },
            text = { Text("Data has been exported to Downloads folder") },
            confirmButton = {
                TextButton(onClick = { showExportDialog = false }) {
                    Text("OK")
                }
            }
        )
    }

    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { showClearDialog = false },
            title = { Text("Clear All Data?") },
            text = { Text("This will delete all chat rooms and messages. This action cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        scope.launch {
                            viewModel.clearAllData()
                            showClearDialog = false
                        }
                    }
                ) {
                    Text("Clear", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

private fun getIpAddress(): String {
    try {
        val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
        for (intf in interfaces) {
            val addrs = Collections.list(intf.inetAddresses)
            for (addr in addrs) {
                if (!addr.isLoopbackAddress) {
                    val sAddr = addr.hostAddress
                    // IPv4 주소인지 확인
                    val isIPv4 = sAddr?.indexOf(':') ?: -1 < 0
                    if (isIPv4) {
                        return sAddr ?: "localhost"
                    }
                }
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
    return "localhost"
}

sealed class ConnectionStatus {
    object Unknown : ConnectionStatus()
    object Testing : ConnectionStatus()
    object Connected : ConnectionStatus()
    object Failed : ConnectionStatus()
}
package com.motionlabs.chatlogger.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.motionlabs.chatlogger.data.db.entity.ChatRoom
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.absoluteValue
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onRoomClick: (String) -> Unit,
    onSettingsClick: () -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val rooms by viewModel.rooms.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chat Logger") },
                actions = {
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (rooms.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No chat rooms yet",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(
                    items = rooms,
                    key = { room -> room.id }
                ) { room ->
                    SwipeToDeleteItem(
                        onDelete = { viewModel.deleteRoom(room) },
                        onItemClick = { onRoomClick(room.id) }
                    ) {
                        ChatRoomItem(room = room)
                    }
                }
            }
        }
    }
}

@Composable
fun ChatRoomItem(
    room: ChatRoom
) {
    Card(
        modifier = Modifier
            .fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = room.roomName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = room.lastMessage ?: "No messages",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Column(
                horizontalAlignment = Alignment.End
            ) {
                Text(
                    text = formatTimestamp(room.lastMessageAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (room.unreadCount > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    @OptIn(ExperimentalMaterial3Api::class)
                    Badge {
                        Text(text = room.unreadCount.toString())
                    }
                }
            }
        }
    }
}

@Composable
fun SwipeToDeleteItem(
    onDelete: () -> Unit,
    onItemClick: () -> Unit,
    content: @Composable () -> Unit
) {
    var offsetX by remember { mutableStateOf(0f) }
    val density = LocalDensity.current
    val deleteButtonWidth = with(density) { 80.dp.toPx() }
    
    // 애니메이션 처리
    val animatedOffsetX by animateFloatAsState(
        targetValue = offsetX,
        label = "offset"
    )
    
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        // 삭제 버튼 배경 - 메인 콘텐츠와 같은 높이
        if (offsetX < 0) {
            Card(
                modifier = Modifier
                    .fillMaxHeight()
                    .width((-offsetX / density.density).dp.coerceAtMost(80.dp))
                    .align(Alignment.CenterEnd),
                colors = CardDefaults.cardColors(containerColor = Color.Red),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable { onDelete() },
                    contentAlignment = Alignment.Center
                ) {
                    if (offsetX < -40) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Delete",
                                tint = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                            Text(
                                "삭제",
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }
        }
        
        // 메인 콘텐츠
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .offset { IntOffset(animatedOffsetX.roundToInt(), 0) }
                .draggable(
                    orientation = Orientation.Horizontal,
                    state = rememberDraggableState { delta ->
                        val newOffset = offsetX + delta
                        offsetX = when {
                            newOffset > 0 -> 0f // 오른쪽으로는 이동 불가
                            newOffset < -deleteButtonWidth -> -deleteButtonWidth // 최대 버튼 너비만큼만
                            else -> newOffset
                        }
                    },
                    onDragStopped = {
                        // 드래그 끝났을 때 위치 결정
                        offsetX = if (offsetX < -deleteButtonWidth / 2) {
                            -deleteButtonWidth // 버튼 완전히 표시
                        } else {
                            0f // 버튼 숨기기
                        }
                    }
                )
                .clickable {
                    // 버튼이 표시된 상태에서 아이템을 클릭하면 버튼 숨기기
                    if (offsetX < 0) {
                        offsetX = 0f
                    } else {
                        // 버튼이 숨겨진 상태에서만 아이템 클릭 동작 수행
                        onItemClick()
                    }
                }
        ) {
            content()
        }
    }
}

private fun formatTimestamp(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    
    return when {
        diff < 60_000 -> "Just now"
        diff < 3_600_000 -> "${diff / 60_000}m ago"
        diff < 86_400_000 -> {
            SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(timestamp))
        }
        else -> {
            SimpleDateFormat("MM/dd", Locale.getDefault()).format(Date(timestamp))
        }
    }
}
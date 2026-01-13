import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { ChatRoomList } from '@/components/ChatRoomList'
import { ChatMessageList } from '@/components/ChatMessageList'
import { StatsPanel } from '@/components/StatsPanel'
import { chatApi } from '@/services/api'
import wsService from '@/services/websocket'
import { ChatMessage, ChatRoom, Stats } from '@/types'
import { FiRefreshCw, FiSearch } from 'react-icons/fi'
import toast from 'react-hot-toast'

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const {
    rooms,
    currentRoom,
    messages,
    fetchRooms,
    fetchMessages,
    setCurrentRoom,
    syncData,
  } = useChatStore()

  const [stats, setStats] = useState<Stats | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Initial data fetch
    fetchRooms()
    fetchStats()

    // WebSocket event listeners
    const unsubscribeConnected = wsService.on('connected', (connected: boolean) => {
      setIsConnected(connected)
      if (connected) {
        toast.success('실시간 연결됨')
      } else {
        toast.error('연결 끊김')
      }
    })

    const unsubscribeNewMessage = wsService.on('new_message', (message: ChatMessage) => {
      if (currentRoom?.id === message.roomId) {
        fetchMessages(message.roomId)
      }
      fetchRooms() // Update room list for last message
    })

    const unsubscribeRoomUpdate = wsService.on('room_updated', (_room: ChatRoom) => {
      fetchRooms()
    })

    return () => {
      unsubscribeConnected()
      unsubscribeNewMessage()
      unsubscribeRoomUpdate()
    }
  }, [currentRoom])

  const fetchStats = async () => {
    try {
      const stats = await chatApi.getStats()
      setStats(stats)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleRefresh = async () => {
    toast.loading('동기화 중...')
    await syncData()
    await fetchStats()
    toast.success('동기화 완료')
  }

  const handleSearch = () => {
    navigate('/search')
  }

  const handleRoomSelect = (room: ChatRoom) => {
    setCurrentRoom(room)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">ChatLogger</h1>
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {isConnected ? '연결됨' : '연결 끊김'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSearch}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiSearch className="text-xl" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiRefreshCw className="text-xl" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Room List */}
        <ChatRoomList
          rooms={rooms}
          selectedRoom={currentRoom}
          onRoomSelect={handleRoomSelect}
        />

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {currentRoom ? (
            <ChatMessageList
              messages={messages}
              roomName={currentRoom.roomName}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 mb-4">채팅방을 선택하세요</p>
                <StatsPanel stats={stats} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
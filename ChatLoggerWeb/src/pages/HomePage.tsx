import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { ChatRoomList } from '@/components/ChatRoomList'
import { ChatMessageList } from '@/components/ChatMessageList'
import { StatsPanel } from '@/components/StatsPanel'
import { chatApi } from '@/services/api'
import { ChatRoom, Stats } from '@/types'
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

  const fetchStats = useCallback(async () => {
    try {
      const stats = await chatApi.getStats()
      setStats(stats)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [])

  useEffect(() => {
    // Initial data fetch
    fetchRooms()
    fetchStats()

    // Polling for updates every 10 seconds
    const pollInterval = setInterval(() => {
      fetchRooms()
      if (currentRoom) {
        fetchMessages(currentRoom.id)
      }
    }, 10000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [currentRoom, fetchRooms, fetchMessages, fetchStats])

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
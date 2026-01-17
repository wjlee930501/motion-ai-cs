import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  FiMessageSquare,
  FiSearch,
  FiDownload,
  FiRefreshCw,
  FiUser,
  FiClock
} from 'react-icons/fi'
import { format } from 'date-fns'
import { chatApi } from '@/services/api'
import toast from 'react-hot-toast'
import { isStaffMember, getDisplayName } from '@/utils/senderUtils'

interface Room {
  id: string
  roomName: string
  lastMessageAt: number
  lastMessage: string | null
  messageCount?: number
}

interface Message {
  id: string
  roomId: string
  timestamp: number
  sender: string
  body: string
  isFromMe: boolean
}

export const SimpleLoggerPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const previousScrollHeight = useRef(0)
  const isUserScrolling = useRef(false)

  const loadRooms = useCallback(async () => {
    try {
      const data = await chatApi.getRooms()
      setRooms(data)
    } catch (error) {
      console.error('Failed to load rooms:', error)
    }
  }, [])

  const loadMessages = useCallback(async (roomId: string) => {
    setLoading(true)
    try {
      const data = await chatApi.getMessages(roomId)
      setMessages(data)
    } catch (error) {
      console.error('Failed to load messages:', error)
      toast.error('메시지를 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRooms()

    // Polling for updates every 10 seconds
    const pollInterval = setInterval(() => {
      loadRooms()
      if (selectedRoom) {
        loadMessages(selectedRoom.id)
      }
    }, 10000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [selectedRoom, loadRooms, loadMessages])

  // 메시지가 업데이트될 때 스크롤 위치 처리
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current
      
      if (isUserScrolling.current) {
        // 사용자가 스크롤 중인 경우: 현재 스크롤 위치를 유지
        // 새 메시지가 아래 추가되면서 기존 메시지들이 위로 밀림
        const heightDiff = container.scrollHeight - previousScrollHeight.current
        container.scrollTop = container.scrollTop + heightDiff
        isUserScrolling.current = false
      } else {
        // 사용자가 맨 아래에 있거나 처음 로드: 맨 아래로 스크롤
        setTimeout(() => {
          container.scrollTop = container.scrollHeight
        }, 10)
      }
    }
  }, [messages])

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room)
    isUserScrolling.current = false // 새 방 선택 시 맨 아래로 스크롤
    loadMessages(room.id)
  }

  const handleRefresh = async () => {
    await loadRooms()
    if (selectedRoom) {
      await loadMessages(selectedRoom.id)
    }
    toast.success('새로고침 완료')
  }

  const handleExport = async () => {
    try {
      const syncData = await chatApi.getSyncData()
      const dataStr = JSON.stringify(syncData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      
      const exportFileDefaultName = `kakao-log-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
      
      toast.success('데이터를 내보냈습니다')
    } catch (error) {
      toast.error('내보내기 실패')
    }
  }

  const filteredRooms = rooms.filter(room => 
    room.roomName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredMessages = searchQuery && selectedRoom
    ? messages.filter(msg => 
        msg.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.sender.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">카카오톡 채팅 로그</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="새로고침"
            >
              <FiRefreshCw />
            </button>
            
            <button
              onClick={handleExport}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="내보내기"
            >
              <FiDownload />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Room List */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-3 border-b border-gray-200">
            <div className="text-sm text-gray-600">
              총 {filteredRooms.length}개 채팅방
            </div>
          </div>
          
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => handleRoomSelect(room)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedRoom?.id === room.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-gray-900">{room.roomName}</h3>
                <span className="text-xs text-gray-500">
                  {format(room.lastMessageAt, 'MM/dd HH:mm')}
                </span>
              </div>
              {room.lastMessage && (
                <p className="text-sm text-gray-600 truncate">{room.lastMessage}</p>
              )}
            </div>
          ))}
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedRoom ? (
            <>
              {/* Room Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FiMessageSquare className="text-gray-600" />
                    <h2 className="font-semibold">{selectedRoom.roomName}</h2>
                  </div>
                  <span className="text-sm text-gray-500">
                    {filteredMessages.length}개 메시지
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    메시지가 없습니다
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMessages.map((message) => {
                      // "모션랩스_"로 시작하는 sender는 내부 멤버 (staff)
                      const isStaff = isStaffMember(message.sender)
                      const displayName = getDisplayName(message.sender)

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${isStaff ? 'items-end' : 'items-start'}`}>
                            {!isStaff && (
                              <div className="flex items-center space-x-2 mb-1">
                                <FiUser className="text-gray-400 text-sm" />
                                <span className="text-sm font-medium text-gray-700">
                                  {displayName}
                                </span>
                              </div>
                            )}
                            {isStaff && (
                              <div className="flex items-center justify-end space-x-2 mb-1">
                                <span className="text-sm font-medium text-blue-600">
                                  {displayName}
                                </span>
                                <FiUser className="text-blue-400 text-sm" />
                              </div>
                            )}

                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                isStaff
                                  ? 'bg-blue-100 text-gray-900'
                                  : 'bg-white border border-gray-200'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.body}
                              </p>
                            </div>

                            <div className="flex items-center space-x-1 mt-1 px-2">
                              <FiClock className="text-gray-400 text-xs" />
                              <span className="text-xs text-gray-500">
                                {format(message.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FiMessageSquare className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">채팅방을 선택하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
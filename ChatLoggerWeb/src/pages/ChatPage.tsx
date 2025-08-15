import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessageList } from '@/components/ChatMessageList'
import { FiArrowLeft } from 'react-icons/fi'

export const ChatPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { currentRoom, messages, fetchMessages, rooms, setCurrentRoom } = useChatStore()

  useEffect(() => {
    if (roomId) {
      fetchMessages(roomId)
      const room = rooms.find(r => r.id === roomId)
      if (room) {
        setCurrentRoom(room)
      }
    }
  }, [roomId, rooms])

  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="text-xl" />
          </button>
          <h1 className="text-lg font-semibold">
            {currentRoom?.roomName || '채팅방'}
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ChatMessageList
          messages={messages}
          roomName={currentRoom?.roomName}
        />
      </div>
    </div>
  )
}
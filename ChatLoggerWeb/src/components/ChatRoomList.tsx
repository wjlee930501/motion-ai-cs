import React from 'react'
import { ChatRoom } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import clsx from 'clsx'

interface ChatRoomListProps {
  rooms: ChatRoom[]
  selectedRoom: ChatRoom | null
  onRoomSelect: (room: ChatRoom) => void
}

export const ChatRoomList: React.FC<ChatRoomListProps> = ({
  rooms,
  selectedRoom,
  onRoomSelect,
}) => {
  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">채팅방</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            채팅방이 없습니다
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => onRoomSelect(room)}
              className={clsx(
                'p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors',
                selectedRoom?.id === room.id && 'bg-blue-50'
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-medium text-gray-900 truncate flex-1">
                  {room.roomName}
                </h3>
                <span className="text-xs text-gray-500 ml-2">
                  {formatDistanceToNow(room.lastMessageAt, {
                    addSuffix: true,
                    locale: ko,
                  })}
                </span>
              </div>
              
              {room.lastMessage && (
                <p className="text-sm text-gray-600 truncate">
                  {room.lastMessage}
                </p>
              )}
              
              {room.unreadCount > 0 && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {room.unreadCount}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
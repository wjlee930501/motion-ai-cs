import React from 'react'
import { CSRoom } from '@/types/cs.types'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import clsx from 'clsx'
import { 
  FiAlertTriangle, 
  FiClock, 
  FiUser, 
  FiTag,
  FiMessageCircle,
  FiCheckCircle,
  FiPauseCircle,
  FiAlertCircle
} from 'react-icons/fi'

interface CSChatRoomListProps {
  rooms: CSRoom[]
  selectedRoom: CSRoom | null
  onRoomSelect: (room: CSRoom) => void
  filter?: 'all' | 'waiting' | 'in_progress' | 'on_hold' | 'resolved' | 'escalated'
}

export const CSChatRoomList: React.FC<CSChatRoomListProps> = ({
  rooms,
  selectedRoom,
  onRoomSelect,
  filter = 'all'
}) => {
  const filteredRooms = filter === 'all' 
    ? rooms 
    : rooms.filter(room => room.status === filter)

  const getPriorityIcon = (priority: CSRoom['priority']) => {
    switch (priority) {
      case 'urgent':
        return <FiAlertTriangle className="text-red-500" />
      case 'high':
        return <FiAlertCircle className="text-orange-500" />
      default:
        return null
    }
  }

  const getStatusIcon = (status: CSRoom['status']) => {
    switch (status) {
      case 'waiting':
        return <FiClock className="text-yellow-500" />
      case 'in_progress':
        return <FiMessageCircle className="text-blue-500" />
      case 'on_hold':
        return <FiPauseCircle className="text-gray-500" />
      case 'resolved':
        return <FiCheckCircle className="text-green-500" />
      case 'escalated':
        return <FiAlertTriangle className="text-red-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: CSRoom['status']) => {
    const statusConfig = {
      waiting: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '대기중' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: '진행중' },
      on_hold: { bg: 'bg-gray-100', text: 'text-gray-800', label: '보류' },
      resolved: { bg: 'bg-green-100', text: 'text-green-800', label: '해결' },
      escalated: { bg: 'bg-red-100', text: 'text-red-800', label: '에스컬레이션' }
    }
    const config = statusConfig[status]
    
    return (
      <span className={clsx(
        'px-2 py-1 text-xs font-medium rounded-full',
        config.bg,
        config.text
      )}>
        {config.label}
      </span>
    )
  }

  const getResponseTimeColor = (responseTime?: number) => {
    if (!responseTime) return 'text-gray-500'
    if (responseTime < 5) return 'text-green-600'
    if (responseTime < 15) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="w-full md:w-96 bg-white border-r border-gray-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold mb-3">CS 상담 목록</h2>
        
        {/* Status Filter Tabs */}
        <div className="flex space-x-2 overflow-x-auto">
          <button
            onClick={() => {}}
            className={clsx(
              'px-3 py-1 text-sm rounded-lg whitespace-nowrap',
              filter === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            전체 ({rooms.length})
          </button>
          <button
            onClick={() => {}}
            className={clsx(
              'px-3 py-1 text-sm rounded-lg whitespace-nowrap',
              filter === 'waiting'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            대기 ({rooms.filter(r => r.status === 'waiting').length})
          </button>
          <button
            onClick={() => {}}
            className={clsx(
              'px-3 py-1 text-sm rounded-lg whitespace-nowrap',
              filter === 'in_progress'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            진행 ({rooms.filter(r => r.status === 'in_progress').length})
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredRooms.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            상담 내역이 없습니다
          </div>
        ) : (
          filteredRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => onRoomSelect(room)}
              className={clsx(
                'p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors',
                selectedRoom?.id === room.id && 'bg-blue-50 border-l-4 border-l-blue-500',
                room.priority === 'urgent' && 'bg-red-50',
                room.priority === 'high' && 'bg-orange-50'
              )}
            >
              {/* Header Row */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {getPriorityIcon(room.priority)}
                    {getStatusIcon(room.status)}
                  </div>
                  <h3 className="font-medium text-gray-900 truncate">
                    {room.customer?.name || room.roomName}
                  </h3>
                </div>
                <span className={clsx(
                  'text-xs',
                  getResponseTimeColor(room.responseTime)
                )}>
                  {formatDistanceToNow(room.lastMessageAt, {
                    addSuffix: true,
                    locale: ko,
                  })}
                </span>
              </div>

              {/* Customer Info */}
              {room.customer && (
                <div className="flex items-center space-x-2 mb-2 text-xs text-gray-600">
                  <FiUser className="flex-shrink-0" />
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded',
                    room.customer.tier === 'VIP' && 'bg-purple-100 text-purple-800',
                    room.customer.tier === 'Premium' && 'bg-blue-100 text-blue-800',
                    room.customer.tier === 'Regular' && 'bg-gray-100 text-gray-800',
                    room.customer.tier === 'New' && 'bg-green-100 text-green-800'
                  )}>
                    {room.customer.tier}
                  </span>
                  <span>문의 {room.customer.totalInquiries}회</span>
                </div>
              )}

              {/* Last Message */}
              {room.lastMessage && (
                <p className="text-sm text-gray-600 truncate mb-2">
                  {room.lastMessage}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusBadge(room.status)}
                  {room.assignedTo && (
                    <span className="text-xs text-gray-500">
                      담당: {room.assignedTo}
                    </span>
                  )}
                </div>
                
                {/* Tags */}
                {room.tags && room.tags.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <FiTag className="text-gray-400 text-xs" />
                    {room.tags.slice(0, 2).map((tag, index) => (
                      <span 
                        key={index}
                        className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {room.tags.length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{room.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Response Time Warning */}
              {room.status === 'waiting' && room.responseTime && room.responseTime > 10 && (
                <div className="mt-2 flex items-center text-xs text-red-600">
                  <FiAlertTriangle className="mr-1" />
                  응답 지연 ({room.responseTime}분)
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
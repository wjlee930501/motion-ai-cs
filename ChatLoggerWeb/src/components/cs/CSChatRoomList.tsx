import React from 'react'
import { CSRoom } from '@/types/cs.types'
import { differenceInMinutes } from 'date-fns'
import clsx from 'clsx'
import {
  FiAlertTriangle,
  FiClock,
  FiUser,
  FiTag,
  FiMessageCircle,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi'
import { isStaffMember } from '@/utils/senderUtils'

interface CSChatRoomListProps {
  rooms: CSRoom[]
  selectedRoom: CSRoom | null
  onRoomSelect: (room: CSRoom) => void
  filter?: 'all' | 'needs_reply' | 'replied'
  onFilterChange?: (filter: 'all' | 'needs_reply' | 'replied') => void
}

export const CSChatRoomList: React.FC<CSChatRoomListProps> = ({
  rooms,
  selectedRoom,
  onRoomSelect,
  filter = 'all',
  onFilterChange
}) => {
  // 회신 필요 여부 판별: 마지막 메시지가 고객이면 회신 필요
  const needsReply = (room: CSRoom): boolean => {
    if (!room.lastMessageSender) return true // sender 정보 없으면 회신 필요로 간주
    return !isStaffMember(room.lastMessageSender)
  }

  const filteredRooms = filter === 'all'
    ? rooms
    : filter === 'needs_reply'
      ? rooms.filter(room => needsReply(room))
      : rooms.filter(room => !needsReply(room))

  const needsReplyCount = rooms.filter(room => needsReply(room)).length
  const repliedCount = rooms.filter(room => !needsReply(room)).length

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
      case 'onboarding':
        return <FiClock className="text-blue-500" />
      case 'stable':
        return <FiCheckCircle className="text-green-500" />
      case 'churn_risk':
        return <FiAlertCircle className="text-orange-500" />
      case 'important':
        return <FiMessageCircle className="text-purple-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: CSRoom['status']) => {
    const statusConfig = {
      onboarding: { bg: 'bg-blue-100', text: 'text-blue-800', label: '온보딩' },
      stable: { bg: 'bg-green-100', text: 'text-green-800', label: '안정기' },
      churn_risk: { bg: 'bg-orange-100', text: 'text-orange-800', label: '이탈우려' },
      important: { bg: 'bg-purple-100', text: 'text-purple-800', label: '중요' }
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

  const getResponseTimeColor = (minutes: number) => {
    if (minutes < 5) return 'text-green-600'
    if (minutes < 15) return 'text-yellow-600'
    if (minutes < 30) return 'text-orange-600'
    return 'text-red-600'
  }

  // 고객 메시지 이후 대기 시간 계산
  const getWaitingTime = (room: CSRoom): { minutes: number; display: string } | null => {
    // 마지막 메시지 발신자가 멤버(모션랩스_)면 이미 응답한 것이므로 표시 안함
    if (room.lastMessageSender && isStaffMember(room.lastMessageSender)) {
      return null
    }

    // 고객의 마지막 메시지 시간이 있으면 사용, 없으면 lastMessageAt 사용
    const customerMessageTime = room.lastCustomerMessageAt || room.lastMessageAt
    const minutes = differenceInMinutes(Date.now(), customerMessageTime)

    if (minutes < 1) {
      return { minutes, display: '방금 전' }
    } else if (minutes < 60) {
      return { minutes, display: `${minutes}분 대기` }
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return { minutes, display: `${hours}시간 ${remainingMinutes}분 대기` }
    }
  }

  return (
    <div className="w-full md:w-96 bg-white border-r border-gray-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold mb-3">CS 상담 목록</h2>

        {/* Reply Status Filter Tabs */}
        <div className="flex space-x-2 overflow-x-auto">
          <button
            onClick={() => onFilterChange?.('all')}
            className={clsx(
              'px-3 py-1 text-sm rounded-lg whitespace-nowrap transition-colors',
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            전체 ({rooms.length})
          </button>
          <button
            onClick={() => onFilterChange?.('needs_reply')}
            className={clsx(
              'px-3 py-1 text-sm rounded-lg whitespace-nowrap transition-colors',
              filter === 'needs_reply'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              needsReplyCount > 0 && filter !== 'needs_reply' && 'animate-pulse'
            )}
          >
            회신 필요 ({needsReplyCount})
          </button>
          <button
            onClick={() => onFilterChange?.('replied')}
            className={clsx(
              'px-3 py-1 text-sm rounded-lg whitespace-nowrap transition-colors',
              filter === 'replied'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            회신 불필요 ({repliedCount})
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
                {/* 회신 필요 시에만 대기 시간 표시 */}
                {(() => {
                  const waitingTime = getWaitingTime(room)
                  if (waitingTime) {
                    return (
                      <span className={clsx(
                        'text-xs font-medium',
                        getResponseTimeColor(waitingTime.minutes)
                      )}>
                        {waitingTime.display}
                      </span>
                    )
                  }
                  // 회신 불필요 상태
                  return (
                    <span className="text-xs text-green-600 flex items-center">
                      <FiCheckCircle className="mr-1" />
                      회신 불필요
                    </span>
                  )
                })()}
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

              {/* Response Time Warning - 회신 필요하고 30분 이상 대기 시 경고 */}
              {(() => {
                const waitingTime = getWaitingTime(room)
                if (waitingTime && waitingTime.minutes >= 30) {
                  return (
                    <div className="mt-2 flex items-center text-xs text-red-600 font-medium">
                      <FiAlertTriangle className="mr-1" />
                      응답 지연 - 즉시 회신 필요
                    </div>
                  )
                }
                return null
              })()}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
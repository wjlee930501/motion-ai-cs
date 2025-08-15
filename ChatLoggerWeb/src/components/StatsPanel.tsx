import React from 'react'
import { Stats } from '@/types'
import { format } from 'date-fns'
import { FiMessageSquare, FiUsers, FiClock } from 'react-icons/fi'

interface StatsPanelProps {
  stats: Stats | null
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  if (!stats) return null

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-lg font-semibold mb-4">통계</h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <FiUsers className="text-2xl text-blue-500" />
          </div>
          <div className="text-2xl font-bold">{stats.roomCount}</div>
          <div className="text-sm text-gray-500">채팅방</div>
        </div>
        
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <FiMessageSquare className="text-2xl text-green-500" />
          </div>
          <div className="text-2xl font-bold">
            {stats.messageCount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">메시지</div>
        </div>
        
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <FiClock className="text-2xl text-purple-500" />
          </div>
          <div className="text-sm">
            {format(stats.lastUpdate, 'HH:mm')}
          </div>
          <div className="text-sm text-gray-500">마지막 업데이트</div>
        </div>
      </div>
    </div>
  )
}
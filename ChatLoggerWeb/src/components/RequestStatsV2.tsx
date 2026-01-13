import React from 'react'

interface RequestStatsV2Props {
  stats: any
}

const RequestStatsV2: React.FC<RequestStatsV2Props> = ({ stats }) => {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{stats?.summary?.total_requests || 0}</div>
            <div className="text-sm text-gray-600">전체 요청</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{stats?.summary?.pending_requests || 0}</div>
            <div className="text-sm text-gray-600">미처리</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats?.summary?.in_progress_requests || 0}</div>
            <div className="text-sm text-gray-600">진행중</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{stats?.summary?.completed_requests || 0}</div>
            <div className="text-sm text-gray-600">완료</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RequestStatsV2

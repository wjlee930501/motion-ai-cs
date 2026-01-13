import React from 'react'
import { FiCalendar } from 'react-icons/fi'

interface WeekendBacklogViewProps {
  requests: any[]
}

const WeekendBacklogView: React.FC<WeekendBacklogViewProps> = ({ requests }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <FiCalendar className="text-purple-600" />
        <h2 className="text-xl font-semibold">주말 백로그</h2>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          주말 동안 들어온 요청이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request: any) => (
            <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">{request.room_name}</h3>
                  <p className="text-sm text-gray-500">{request.sender}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  request.urgency === 'high' ? 'bg-red-100 text-red-700' :
                  request.urgency === 'normal' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {request.urgency === 'high' ? '긴급' : request.urgency === 'normal' ? '보통' : '낮음'}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">{request.message_body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WeekendBacklogView

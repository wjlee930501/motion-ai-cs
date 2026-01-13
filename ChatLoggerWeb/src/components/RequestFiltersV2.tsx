import React from 'react'

interface RequestFiltersV2Props {
  filters: any
  onChange: (filters: any) => void
  onClose: () => void
}

const RequestFiltersV2: React.FC<RequestFiltersV2Props> = ({ filters, onChange, onClose }) => {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={filters.status || ''}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">모든 상태</option>
            <option value="미처리">미처리</option>
            <option value="진행중">진행중</option>
            <option value="완료">완료</option>
          </select>

          <select
            value={filters.urgency || ''}
            onChange={(e) => onChange({ ...filters, urgency: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">모든 긴급도</option>
            <option value="low">낮음</option>
            <option value="normal">보통</option>
            <option value="high">긴급</option>
          </select>

          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default RequestFiltersV2

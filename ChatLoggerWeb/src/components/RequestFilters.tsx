import React from 'react';
import { FiX } from 'react-icons/fi';

interface FilterProps {
  filters: {
    status: string;
    urgency: string;
    type: string;
    assignee: string;
  };
  onChange: (filters: any) => void;
  onClose: () => void;
}

const RequestFilters: React.FC<FilterProps> = ({ filters, onChange, onClose }) => {
  const requestTypes = [
    '계약/결제',
    '계정/기능문의',
    '오류신고',
    '콘텐츠요청',
    '일정/세팅변경',
    '불만/컴플레인',
    '기타'
  ];

  const handleChange = (field: string, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    onChange({
      status: '',
      urgency: '',
      type: '',
      assignee: ''
    });
  };

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">필터</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full border-gray-300 rounded-md"
            >
              <option value="">전체</option>
              <option value="미처리">미처리</option>
              <option value="진행중">진행중</option>
              <option value="완료">완료</option>
            </select>
          </div>

          {/* Urgency Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              긴급도
            </label>
            <select
              value={filters.urgency}
              onChange={(e) => handleChange('urgency', e.target.value)}
              className="w-full border-gray-300 rounded-md"
            >
              <option value="">전체</option>
              <option value="high">긴급</option>
              <option value="normal">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              요청 유형
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full border-gray-300 rounded-md"
            >
              <option value="">전체</option>
              {requestTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              담당자
            </label>
            <input
              type="text"
              value={filters.assignee}
              onChange={(e) => handleChange('assignee', e.target.value)}
              placeholder="담당자 이름"
              className="w-full border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            초기화
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestFilters;
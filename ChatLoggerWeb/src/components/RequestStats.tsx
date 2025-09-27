import React from 'react';
import {
  FiAlertTriangle,
  FiClock,
  FiCheckCircle,
  FiMessageSquare
} from 'react-icons/fi';

interface StatsProps {
  stats: {
    summary: {
      total_requests: number;
      actual_requests: number;
      urgent_requests: number;
      pending_requests: number;
      in_progress_requests: number;
      completed_requests: number;
      today_requests: number;
    };
    byType: Array<{
      request_type: string;
      count: number;
    }>;
  };
}

const RequestStats: React.FC<StatsProps> = ({ stats }) => {
  const cards = [
    {
      title: '오늘 신규 요청',
      value: stats.summary.today_requests,
      icon: FiMessageSquare,
      color: 'bg-blue-500'
    },
    {
      title: '긴급 요청',
      value: stats.summary.urgent_requests,
      icon: FiAlertTriangle,
      color: 'bg-red-500'
    },
    {
      title: '미처리 요청',
      value: stats.summary.pending_requests,
      icon: FiClock,
      color: 'bg-yellow-500'
    },
    {
      title: '완료',
      value: stats.summary.completed_requests,
      icon: FiCheckCircle,
      color: 'bg-green-500'
    }
  ];

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-white overflow-hidden shadow rounded-lg"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 ${card.color} p-3 rounded-md`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {card.title}
                        </dt>
                        <dd className="text-2xl font-semibold text-gray-900">
                          {card.value}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Request Types Distribution */}
        {stats.byType && stats.byType.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              요청 유형 분포
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex gap-4 flex-wrap">
                {stats.byType.map((type) => (
                  <div
                    key={type.request_type}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm text-gray-600">
                      {type.request_type}:
                    </span>
                    <span className="font-semibold text-gray-900">
                      {type.count}건
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestStats;
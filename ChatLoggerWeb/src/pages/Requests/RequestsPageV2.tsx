import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  FiAlertCircle,
  FiClock,
  FiCheckCircle,
  FiUser,
  FiFilter,
  FiRefreshCw,
  FiAlertTriangle,
  FiFlag,
  FiUsers,
  FiCalendar
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { requestApi } from '../../api/requests';
import RequestDetailV2 from '../../components/RequestDetailV2';
import RequestFiltersV2 from '../../components/RequestFiltersV2';
import RequestStatsV2 from '../../components/RequestStatsV2';
import WeekendBacklogView from '../../components/WeekendBacklogView';

type RequestStatus = '미처리' | '진행중' | '완료';
type RequestUrgency = 'low' | 'normal' | 'high';

interface Request {
  id: string;
  room_id: string;
  room_name: string;
  sender: string;
  message_body: string;
  message_timestamp: number;
  is_request: boolean;
  request_type: string;
  request_subtype: string | null;
  urgency: RequestUrgency;
  confidence: number;
  status: RequestStatus;
  assignee: string | null;
  assignee_group: string | null;
  notes: string | null;
  policy_flag: string | null;
  sla_due_at: string | null;
  is_overdue: boolean;
  hours_until_due: number;
  artifacts: any;
  created_at: string;
  updated_at: string;
}

const RequestsPageV2: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'overdue' | 'weekend'>('all');
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    urgency: '',
    type: '',
    assignee: '',
    assignee_group: '',
    policy_flag: '',
    overdue: false,
    weekend_backlog: false
  });

  // Check if it's Monday morning
  const isMondayMorning = () => {
    const now = new Date();
    return now.getDay() === 1 && now.getHours() < 12;
  };

  // Fetch requests
  const { data: requests, isLoading, refetch } = useQuery(
    ['requests', filters, viewMode],
    () => {
      const queryParams = { ...filters };
      if (viewMode === 'overdue') {
        queryParams.overdue = true;
      } else if (viewMode === 'weekend') {
        queryParams.weekend_backlog = true;
      }
      return requestApi.getRequests(queryParams);
    },
    {
      refetchInterval: 10000
    }
  );

  // Fetch statistics
  const { data: stats } = useQuery(
    'requestStats',
    requestApi.getStats,
    {
      refetchInterval: 30000
    }
  );

  // Update request mutation
  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: any }) =>
      requestApi.updateRequest(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('requests');
        queryClient.invalidateQueries('requestStats');
        toast.success('요청이 업데이트되었습니다');
      },
      onError: () => {
        toast.error('업데이트 실패');
      }
    }
  );

  // Batch update mutation
  const batchUpdateMutation = useMutation(
    ({ ids, data }: { ids: string[]; data: any }) =>
      Promise.all(ids.map(id => requestApi.updateRequest(id, data))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('requests');
        setSelectedRequests([]);
        toast.success(`${selectedRequests.length}개 요청이 업데이트되었습니다`);
      }
    }
  );

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'request.created' || data.type === 'request.updated') {
        queryClient.invalidateQueries('requests');
        queryClient.invalidateQueries('requestStats');

        // Show notification for urgent requests
        if (data.type === 'request.created' && data.payload?.urgency === 'high') {
          toast.error(`긴급 요청: ${data.payload.room_name}`, {
            duration: 5000,
            icon: '🚨'
          });
        }
      }
    };

    return () => ws.close();
  }, [queryClient]);

  // Auto-switch to weekend view on Monday morning
  useEffect(() => {
    if (isMondayMorning() && viewMode === 'all') {
      setViewMode('weekend');
      toast('월요일 아침입니다. 주말 백로그를 확인하세요.', {
        icon: '📅',
        duration: 4000
      });
    }
  }, []);

  const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
      case '미처리':
        return <FiAlertCircle className="text-red-500" />;
      case '진행중':
        return <FiClock className="text-yellow-500" />;
      case '완료':
        return <FiCheckCircle className="text-green-500" />;
    }
  };

  const getUrgencyBadge = (urgency: RequestUrgency) => {
    const colors = {
      low: 'bg-gray-100 text-gray-700',
      normal: 'bg-blue-100 text-blue-700',
      high: 'bg-red-100 text-red-700 animate-pulse'
    };

    const labels = {
      low: '낮음',
      normal: '보통',
      high: '긴급'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[urgency]}`}>
        {labels[urgency]}
      </span>
    );
  };

  const getSLABadge = (request: Request) => {
    if (!request.sla_due_at) return null;

    if (request.is_overdue) {
      return (
        <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-semibold animate-pulse">
          SLA 초과
        </span>
      );
    }

    const hours = Math.floor(request.hours_until_due);
    if (hours < 1) {
      return (
        <span className="px-2 py-1 bg-orange-500 text-white rounded-full text-xs font-semibold">
          {Math.floor(request.hours_until_due * 60)}분 남음
        </span>
      );
    }

    return (
      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">
        {hours}시간 남음
      </span>
    );
  };

  const getGroupBadge = (group: string | null) => {
    if (!group) return null;

    const colors: Record<string, string> = {
      ops: 'bg-purple-100 text-purple-700',
      cs: 'bg-green-100 text-green-700',
      content: 'bg-blue-100 text-blue-700',
      tech: 'bg-orange-100 text-orange-700'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[group] || 'bg-gray-100'}`}>
        {group.toUpperCase()}
      </span>
    );
  };

  const handleBatchAssign = (assignee: string, group?: string) => {
    if (selectedRequests.length === 0) return;

    batchUpdateMutation.mutate({
      ids: selectedRequests,
      data: { assignee, assignee_group: group }
    });
  };

  const handleBatchStatusChange = (status: RequestStatus) => {
    if (selectedRequests.length === 0) return;

    batchUpdateMutation.mutate({
      ids: selectedRequests,
      data: { status }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">CS 요청 관리</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <FiFilter />
                  필터
                </button>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <FiRefreshCw />
                  새로고침
                </button>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('all')}
                className={`px-4 py-2 rounded-lg ${
                  viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                전체 요청
              </button>
              <button
                onClick={() => setViewMode('overdue')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  viewMode === 'overdue' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <FiAlertTriangle />
                SLA 초과
                {stats?.summary.overdue_count > 0 && (
                  <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                    {stats.summary.overdue_count}
                  </span>
                )}
              </button>
              <button
                onClick={() => setViewMode('weekend')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  viewMode === 'weekend' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
                } ${isMondayMorning() ? 'animate-pulse' : ''}`}
              >
                <FiCalendar />
                주말 백로그
                {isMondayMorning() && (
                  <span className="bg-yellow-400 text-black px-2 py-0.5 rounded-full text-xs font-bold">
                    NEW
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && <RequestStatsV2 stats={stats} />}

      {/* Filters */}
      {showFilters && (
        <RequestFiltersV2
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Batch Actions */}
      {selectedRequests.length > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedRequests.length}개 선택됨
              </span>
              <div className="flex gap-2">
                <select
                  onChange={(e) => handleBatchAssign(e.target.value)}
                  className="text-sm border-gray-300 rounded-md"
                >
                  <option value="">담당자 지정</option>
                  <option value="김CS">김CS</option>
                  <option value="이CS">이CS</option>
                  <option value="박CS">박CS</option>
                </select>
                <select
                  onChange={(e) => handleBatchStatusChange(e.target.value as RequestStatus)}
                  className="text-sm border-gray-300 rounded-md"
                >
                  <option value="">상태 변경</option>
                  <option value="미처리">미처리</option>
                  <option value="진행중">진행중</option>
                  <option value="완료">완료</option>
                </select>
                <button
                  onClick={() => setSelectedRequests([])}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  선택 해제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'weekend' && isMondayMorning() ? (
          <WeekendBacklogView requests={requests?.data || []} />
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600">로딩 중...</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {requests?.data.map((request: Request) => (
                  <li
                    key={request.id}
                    className={`hover:bg-gray-50 ${
                      request.is_overdue ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedRequests.includes(request.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRequests([...selectedRequests, request.id]);
                            } else {
                              setSelectedRequests(selectedRequests.filter(id => id !== request.id));
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {getStatusIcon(request.status)}
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">
                                  {request.room_name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {request.sender} • {format(new Date(request.created_at), 'PPp', { locale: ko })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getSLABadge(request)}
                              {getUrgencyBadge(request.urgency)}
                              {getGroupBadge(request.assignee_group)}
                              {request.policy_flag && (
                                <span className="flex items-center text-orange-600" title={request.policy_flag}>
                                  <FiFlag className="h-4 w-4" />
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {request.message_body}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>{request.request_type}</span>
                              {request.request_subtype && (
                                <span>• {request.request_subtype}</span>
                              )}
                              {request.assignee && (
                                <span className="flex items-center">
                                  <FiUser className="mr-1" />
                                  {request.assignee}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={request.status}
                                onChange={(e) => updateMutation.mutate({
                                  id: request.id,
                                  data: { status: e.target.value }
                                })}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm border-gray-300 rounded-md"
                              >
                                <option value="미처리">미처리</option>
                                <option value="진행중">진행중</option>
                                <option value="완료">완료</option>
                              </select>
                              <button
                                onClick={() => setSelectedRequest(request)}
                                className="text-sm text-blue-600 hover:text-blue-900"
                              >
                                상세보기
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailV2
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdate={(data) => {
            updateMutation.mutate({ id: selectedRequest.id, data });
          }}
        />
      )}
    </div>
  );
};

export default RequestsPageV2;
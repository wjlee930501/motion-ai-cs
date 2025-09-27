import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  FiAlertCircle,
  FiClock,
  FiCheckCircle,
  FiUser,
  FiFilter,
  FiRefreshCw
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { requestApi } from '../../api/requests';
import RequestDetail from '../../components/RequestDetail';
import RequestFilters from '../../components/RequestFilters';
import RequestStats from '../../components/RequestStats';

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
  urgency: RequestUrgency;
  confidence: number;
  status: RequestStatus;
  assignee: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const RequestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    urgency: '',
    type: '',
    assignee: ''
  });

  // Fetch requests
  const { data: requests, isLoading, refetch } = useQuery(
    ['requests', filters],
    () => requestApi.getRequests(filters),
    {
      refetchInterval: 10000 // Refresh every 10 seconds
    }
  );

  // Fetch statistics
  const { data: stats } = useQuery(
    'requestStats',
    requestApi.getStats,
    {
      refetchInterval: 30000 // Refresh every 30 seconds
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

  // Reprocess request mutation
  const reprocessMutation = useMutation(
    (id: string) => requestApi.reprocessRequest(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('requests');
        toast.success('재분류 요청이 접수되었습니다');
      },
      onError: () => {
        toast.error('재분류 요청 실패');
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
      }
    };

    return () => ws.close();
  }, [queryClient]);

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
      high: 'bg-red-100 text-red-700'
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

  const handleStatusChange = (request: Request, newStatus: RequestStatus) => {
    updateMutation.mutate({
      id: request.id,
      data: { status: newStatus }
    });
  };

  const handleAssigneeChange = (request: Request, assignee: string) => {
    updateMutation.mutate({
      id: request.id,
      data: { assignee }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">요청 기록</h1>
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
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && <RequestStats stats={stats} />}

      {/* Filters */}
      {showFilters && (
        <RequestFilters
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">로딩 중...</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {requests?.data.map((request: Request) => (
                <li key={request.id} className="hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
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
                      <div className="flex items-center gap-4">
                        {getUrgencyBadge(request.urgency)}
                        <span className="text-sm text-gray-600">
                          {request.request_type}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={request.status}
                            onChange={(e) => handleStatusChange(request, e.target.value as RequestStatus)}
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
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {request.message_body}
                      </p>
                    </div>
                    {request.assignee && (
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <FiUser className="mr-1" />
                        담당자: {request.assignee}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetail
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdate={(data) => {
            updateMutation.mutate({ id: selectedRequest.id, data });
          }}
          onReprocess={() => {
            reprocessMutation.mutate(selectedRequest.id);
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
};

export default RequestsPage;
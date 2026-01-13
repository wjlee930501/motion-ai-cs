import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Ticket, TicketEvent } from '../../types/ticket.types';

interface TicketDetailProps {
  ticket: Ticket | null;
  events: TicketEvent[];
  onStatusChange: (ticketId: string, status: string) => void;
  onPriorityChange: (ticketId: string, priority: string) => void;
  isLoading?: boolean;
}

const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  events,
  onStatusChange,
  onPriorityChange,
  isLoading = false
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatEndRef.current && events.length > 0) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  // Empty state when no ticket selected
  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900">티켓을 선택하세요</h3>
          <p className="mt-1 text-sm text-gray-500">
            왼쪽 목록에서 티켓을 선택하면 상세 정보가 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'waiting':
        return 'bg-purple-100 text-purple-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return '신규';
      case 'in_progress':
        return '진행중';
      case 'waiting':
        return '대기중';
      case 'done':
        return '완료';
      default:
        return status;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {ticket.clinic_key}
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                ticket.status
              )}`}
            >
              {getStatusLabel(ticket.status)}
            </span>
            {ticket.sla_breached && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                SLA 초과
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            ID: {ticket.ticket_id.slice(0, 8)}...
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex gap-2">
          <div className="flex-1">
            <select
              value={ticket.status}
              onChange={(e) => onStatusChange(ticket.ticket_id, e.target.value)}
              disabled={isLoading}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="new">신규</option>
              <option value="in_progress">진행중</option>
              <option value="waiting">대기중</option>
              <option value="done">완료</option>
            </select>
          </div>
          <div className="flex-1">
            <select
              value={ticket.priority}
              onChange={(e) => onPriorityChange(ticket.ticket_id, e.target.value)}
              disabled={isLoading}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="low">낮음</option>
              <option value="normal">보통</option>
              <option value="high">높음</option>
              <option value="urgent">긴급</option>
            </select>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
        <div className="space-y-3">
          {ticket.topic_primary && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-1">주제</h3>
              <p className="text-sm text-gray-900">{ticket.topic_primary}</p>
            </div>
          )}
          {ticket.summary_latest && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-1">요약</h3>
              <p className="text-sm text-gray-900">{ticket.summary_latest}</p>
            </div>
          )}
          {ticket.next_action && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-1">다음 액션</h3>
              <p className="text-sm text-gray-900 font-medium">{ticket.next_action}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat History Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-6 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            대화 내역 ({events.length})
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-96">
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              대화 내역이 없습니다
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.event_id}
                className={`flex ${
                  event.sender_type === 'staff' ? 'justify-end' : 'justify-start'
                } transition-all duration-200`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-3 shadow-sm ${
                    event.sender_type === 'staff'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {event.sender_name}
                    </span>
                    <span
                      className={`text-xs ${
                        event.sender_type === 'staff'
                          ? 'text-blue-100'
                          : 'text-gray-500'
                      }`}
                    >
                      {format(new Date(event.received_at), 'HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {event.text_raw}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Footer with metadata */}
      <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
        <div className="flex justify-between text-xs text-gray-500">
          <div className="flex gap-4">
            {ticket.first_inbound_at && (
              <span>
                최초 수신: {format(new Date(ticket.first_inbound_at), 'MM/dd HH:mm', { locale: ko })}
              </span>
            )}
            {ticket.first_response_sec && (
              <span>
                첫 응답 시간: {Math.floor(ticket.first_response_sec / 60)}분
              </span>
            )}
          </div>
          {ticket.updated_at && (
            <span>
              최근 업데이트: {format(new Date(ticket.updated_at), 'MM/dd HH:mm', { locale: ko })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;

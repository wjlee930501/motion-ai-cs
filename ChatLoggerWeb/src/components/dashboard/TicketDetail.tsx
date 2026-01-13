import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MessageSquare, Clock, AlertTriangle, Tag, ChevronRight, Zap } from 'lucide-react';
import clsx from 'clsx';
import { Ticket, TicketEvent } from '../../types/ticket.types';

interface TicketDetailProps {
  ticket: Ticket | null;
  events: TicketEvent[];
  onStatusChange: (ticketId: string, status: string) => void;
  onPriorityChange: (ticketId: string, priority: string) => void;
  isLoading?: boolean;
}

const statusConfig = {
  new: { label: '신규', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  in_progress: { label: '진행중', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  waiting: { label: '대기중', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  done: { label: '완료', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
};

const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  events,
  onStatusChange,
  onPriorityChange,
  isLoading = false
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current && events.length > 0) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/50">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">티켓을 선택하세요</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            왼쪽 목록에서 티켓을 선택하면<br />상세 정보가 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  const status = statusConfig[ticket.status as keyof typeof statusConfig] || statusConfig.new;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {ticket.clinic_key}
              </h2>
              <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium', status.color)}>
                {status.label}
              </span>
              {ticket.sla_breached && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-red-500 text-white animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  SLA 초과
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              ID: {ticket.ticket_id.slice(0, 12)}...
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">상태</label>
            <select
              value={ticket.status}
              onChange={(e) => onStatusChange(ticket.ticket_id, e.target.value)}
              disabled={isLoading}
              className="w-full text-sm px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              <option value="new">신규</option>
              <option value="in_progress">진행중</option>
              <option value="waiting">대기중</option>
              <option value="done">완료</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">우선순위</label>
            <select
              value={ticket.priority}
              onChange={(e) => onPriorityChange(ticket.ticket_id, e.target.value)}
              disabled={isLoading}
              className="w-full text-sm px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all duration-200 disabled:opacity-50 cursor-pointer"
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
      <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="space-y-4">
          {ticket.topic_primary && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">주제</h3>
                <p className="text-sm text-slate-900 dark:text-white">{ticket.topic_primary}</p>
              </div>
            </div>
          )}
          {ticket.summary_latest && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">요약</h3>
                <p className="text-sm text-slate-900 dark:text-white">{ticket.summary_latest}</p>
              </div>
            </div>
          )}
          {ticket.next_action && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">다음 액션</h3>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{ticket.next_action}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            대화 내역
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
            {events.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin max-h-80">
          {events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400 text-sm">대화 내역이 없습니다</p>
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={event.event_id}
                className={clsx(
                  'flex animate-fade-in',
                  event.sender_type === 'staff' ? 'justify-end' : 'justify-start'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={clsx(
                    'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                    event.sender_type === 'staff'
                      ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-br-md'
                      : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-bl-md'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={clsx(
                      'text-xs font-semibold',
                      event.sender_type === 'staff' ? 'text-white/90' : 'text-slate-700 dark:text-slate-300'
                    )}>
                      {event.sender_name}
                    </span>
                    <span className={clsx(
                      'text-xs',
                      event.sender_type === 'staff' ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'
                    )}>
                      {format(new Date(event.received_at), 'HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {event.text_raw}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex flex-wrap justify-between gap-4 text-xs">
          <div className="flex flex-wrap gap-4">
            {ticket.first_inbound_at && (
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>최초 수신: {format(new Date(ticket.first_inbound_at), 'MM/dd HH:mm', { locale: ko })}</span>
              </div>
            )}
            {ticket.first_response_sec && (
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <ChevronRight className="w-3.5 h-3.5" />
                <span>첫 응답: {Math.floor(ticket.first_response_sec / 60)}분</span>
              </div>
            )}
          </div>
          {ticket.updated_at && (
            <span className="text-slate-400 dark:text-slate-500">
              업데이트: {format(new Date(ticket.updated_at), 'MM/dd HH:mm', { locale: ko })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;

import React, { useEffect, useRef } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  Tag,
  ChevronRight,
  Zap,
  User,
  Building2,
  CheckCircle2,
  Circle,
  Send
} from 'lucide-react'
import clsx from 'clsx'
import { Ticket, TicketEvent } from '../../types/ticket.types'

interface TicketDetailProps {
  ticket: Ticket | null
  events: TicketEvent[]
  onStatusChange: (ticketId: string, status: string) => void
  onPriorityChange: (ticketId: string, priority: string) => void
  isLoading?: boolean
}

const statusConfig = {
  new: {
    label: '신규',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    icon: Circle
  },
  in_progress: {
    label: '진행중',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    icon: Zap
  },
  waiting: {
    label: '대기중',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    icon: Clock
  },
  done: {
    label: '완료',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: CheckCircle2
  },
}

const priorityColors = {
  urgent: 'text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-400',
  high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400',
  normal: 'text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-400',
  low: 'text-slate-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-500',
}

function formatMessageTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return format(date, 'a h:mm', { locale: ko })
    }
    return format(date, 'M/d a h:mm', { locale: ko })
  } catch {
    return ''
  }
}

const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  events,
  onStatusChange,
  onPriorityChange,
  isLoading = false
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatEndRef.current && events.length > 0) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events])

  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/50">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">대화를 선택하세요</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto">
            왼쪽 목록에서 대화를 선택하면 상세 내역이 여기에 표시됩니다
          </p>
        </div>
      </div>
    )
  }

  const status = statusConfig[ticket.status as keyof typeof statusConfig] || statusConfig.new
  const StatusIcon = status.icon

  // Group messages by date
  const groupedMessages = events.reduce((acc, event) => {
    const date = format(new Date(event.received_at), 'yyyy-MM-dd')
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, TicketEvent[]>)

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
        {/* Clinic Info */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={clsx(
              'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0',
              ticket.sla_breached
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
            )}>
              {ticket.clinic_key.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {ticket.clinic_key}
                </h2>
                {ticket.sla_breached && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    SLA
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono">#{ticket.ticket_id.slice(0, 8)}</span>
                {ticket.first_inbound_at && (
                  <>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(ticket.first_inbound_at), { addSuffix: true, locale: ko })}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            {/* Status Selector */}
            <div className="flex-1">
              <select
                value={ticket.status}
                onChange={(e) => onStatusChange(ticket.ticket_id, e.target.value)}
                disabled={isLoading}
                className={clsx(
                  'w-full text-sm px-3 py-2 rounded-xl border-2 transition-all cursor-pointer',
                  'focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                  status.bg,
                  status.color,
                  'border-transparent hover:border-slate-300 dark:hover:border-slate-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <option value="new">⚪ 신규</option>
                <option value="in_progress">⚡ 진행중</option>
                <option value="waiting">⏳ 대기중</option>
                <option value="done">✅ 완료</option>
              </select>
            </div>

            {/* Priority Selector */}
            <div className="flex-1">
              <select
                value={ticket.priority}
                onChange={(e) => onPriorityChange(ticket.ticket_id, e.target.value)}
                disabled={isLoading}
                className={clsx(
                  'w-full text-sm px-3 py-2 rounded-xl border-2 transition-all cursor-pointer',
                  'focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                  priorityColors[ticket.priority as keyof typeof priorityColors] || priorityColors.normal,
                  'border-transparent hover:border-slate-300 dark:hover:border-slate-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <option value="urgent">🔴 긴급</option>
                <option value="high">🟠 높음</option>
                <option value="normal">⚪ 보통</option>
                <option value="low">⚫ 낮음</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        {(ticket.topic_primary || ticket.summary_latest) && (
          <div className="px-5 pb-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/50">
              {ticket.topic_primary && (
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-3.5 h-3.5 text-brand-500" />
                  <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                    {ticket.topic_primary}
                  </span>
                </div>
              )}
              {ticket.summary_latest && (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {ticket.summary_latest}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/30 dark:bg-slate-900/30 scrollbar-thin">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">아직 대화 내역이 없습니다</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dayMessages]) => (
            <div key={date}>
              {/* Date Divider */}
              <div className="flex items-center justify-center my-4">
                <div className="px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-xs text-slate-500 dark:text-slate-400">
                  {format(new Date(date), 'M월 d일 EEEE', { locale: ko })}
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                {dayMessages.map((event, index) => {
                  const isStaff = event.sender_type === 'staff'
                  const showAvatar = index === 0 || dayMessages[index - 1]?.sender_name !== event.sender_name

                  return (
                    <div
                      key={event.event_id}
                      className={clsx(
                        'flex gap-2',
                        isStaff ? 'flex-row-reverse' : 'flex-row'
                      )}
                    >
                      {/* Avatar */}
                      <div className={clsx(
                        'w-8 h-8 flex-shrink-0',
                        !showAvatar && 'invisible'
                      )}>
                        <div className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium',
                          isStaff
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        )}>
                          {isStaff ? (
                            <User className="w-4 h-4" />
                          ) : (
                            event.sender_name.charAt(0)
                          )}
                        </div>
                      </div>

                      {/* Message Bubble */}
                      <div className={clsx(
                        'max-w-[75%] flex flex-col',
                        isStaff ? 'items-end' : 'items-start'
                      )}>
                        {/* Sender Name */}
                        {showAvatar && (
                          <span className={clsx(
                            'text-xs font-medium mb-1 px-1',
                            isStaff
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-600 dark:text-slate-400'
                          )}>
                            {event.sender_name}
                            {event.staff_member && ` (${event.staff_member})`}
                          </span>
                        )}

                        {/* Bubble */}
                        <div className={clsx(
                          'px-4 py-2.5 rounded-2xl shadow-sm',
                          isStaff
                            ? 'bg-brand-500 text-white rounded-tr-md'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-tl-md'
                        )}>
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {event.text_raw}
                          </p>
                        </div>

                        {/* Time */}
                        <span className={clsx(
                          'text-2xs mt-1 px-1',
                          isStaff
                            ? 'text-slate-400'
                            : 'text-slate-400 dark:text-slate-500'
                        )}>
                          {formatMessageTime(event.received_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Footer Stats */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 px-5 py-3 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{events.length}개 메시지</span>
            </div>
            {ticket.first_response_sec && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>첫 응답 {Math.floor(ticket.first_response_sec / 60)}분</span>
              </div>
            )}
          </div>
          {ticket.updated_at && (
            <span className="text-slate-400 dark:text-slate-500">
              {format(new Date(ticket.updated_at), 'M/d HH:mm', { locale: ko })} 업데이트
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TicketDetail

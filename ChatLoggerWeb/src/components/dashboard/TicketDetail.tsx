import React, { useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  Tag,
  Zap,
  User,
  CheckCircle2,
  Circle
} from 'lucide-react'
import clsx from 'clsx'
import { Ticket, TicketEvent } from '../../types/ticket.types'
import { isStaffMember, getDisplayName } from '../../utils/senderUtils'

interface TicketDetailProps {
  ticket: Ticket | null
  events: TicketEvent[]
  onStatusChange: (ticketId: string, status: string) => void
  onPriorityChange: (ticketId: string, priority: string) => void
  onNeedsReplyChange?: (ticketId: string, needsReply: boolean) => void
  isLoading?: boolean
}

const statusConfig = {
  onboarding: {
    label: '온보딩',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    icon: Circle
  },
  stable: {
    label: '안정기',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: CheckCircle2
  },
  churn_risk: {
    label: '이탈우려',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    icon: AlertTriangle
  },
  important: {
    label: '중요',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    icon: Zap
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

    // KST 기준으로 오늘인지 확인
    const kstOptions = { timeZone: 'Asia/Seoul' }
    const dateKST = date.toLocaleDateString('ko-KR', kstOptions)
    const nowKST = now.toLocaleDateString('ko-KR', kstOptions)
    const isToday = dateKST === nowKST

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return ''
  }
}

const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  events,
  onStatusChange,
  onPriorityChange,
  onNeedsReplyChange,
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
      <div className="h-full flex items-center justify-center bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-700/50 shadow-2xl">
        <div className="text-center p-12 max-w-md">
          <div className="relative inline-block mb-8">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 rounded-3xl blur-2xl animate-pulse" />
            {/* Icon container */}
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900 flex items-center justify-center shadow-xl">
              <MessageSquare className="w-12 h-12 text-slate-400 dark:text-slate-500" />
            </div>
            {/* Decorative dot */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">대화를 선택하세요</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            왼쪽 목록에서 대화를 선택하면<br />상세 내역이 여기에 표시됩니다
          </p>
          {/* Hint */}
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>티켓을 클릭하여 시작하세요</span>
          </div>
        </div>
      </div>
    )
  }

  const status = statusConfig[ticket.status as keyof typeof statusConfig] || statusConfig.onboarding

  // Group messages by date (KST)
  const groupedMessages = events.reduce((acc, event) => {
    const eventDate = new Date(event.received_at)
    // KST 날짜 키 생성
    const date = eventDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, TicketEvent[]>)

  return (
    <div className="h-full flex flex-col bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-b from-white/50 to-transparent dark:from-slate-900/50">
        {/* Clinic Info */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={clsx(
              'w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-lg transition-all duration-300',
              ticket.sla_breached
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/30'
                : 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-brand-500/30'
            )}>
              {ticket.clinic_key.charAt(0).toUpperCase()}
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
          <div className="flex gap-3 mt-4">
            {/* Status Selector */}
            <div className="flex-1">
              <select
                value={ticket.status}
                onChange={(e) => onStatusChange(ticket.ticket_id, e.target.value)}
                disabled={isLoading}
                className={clsx(
                  'w-full text-sm font-medium px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer shadow-sm',
                  'focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500',
                  'hover:shadow-md hover:scale-[1.02]',
                  status.bg,
                  status.color,
                  'border-slate-200 dark:border-slate-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                )}
              >
                <option value="onboarding">🔵 온보딩</option>
                <option value="stable">🟢 안정기</option>
                <option value="churn_risk">🟠 이탈우려</option>
                <option value="important">🟣 중요</option>
              </select>
            </div>

            {/* Priority Selector */}
            <div className="flex-1">
              <select
                value={ticket.priority}
                onChange={(e) => onPriorityChange(ticket.ticket_id, e.target.value)}
                disabled={isLoading}
                className={clsx(
                  'w-full text-sm font-medium px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer shadow-sm',
                  'focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500',
                  'hover:shadow-md hover:scale-[1.02]',
                  priorityColors[ticket.priority as keyof typeof priorityColors] || priorityColors.normal,
                  'border-slate-200 dark:border-slate-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                )}
              >
                <option value="urgent">🔴 긴급</option>
                <option value="high">🟠 높음</option>
                <option value="normal">⚪ 보통</option>
                <option value="low">⚫ 낮음</option>
              </select>
            </div>
          </div>

          {/* Needs Reply Toggle */}
          {onNeedsReplyChange && (
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                답변 필요 여부
              </span>
              <button
                onClick={() => onNeedsReplyChange(ticket.ticket_id, !ticket.needs_reply)}
                disabled={isLoading}
                className={clsx(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300',
                  'focus:outline-none focus:ring-4 focus:ring-brand-500/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  ticket.needs_reply
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-md shadow-orange-500/30'
                    : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300',
                    ticket.needs_reply ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}
        </div>

        {/* Summary Card */}
        {(ticket.topic_primary || ticket.summary_latest) && (
          <div className="px-5 pb-5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/70 dark:to-slate-800/50 border border-slate-200/80 dark:border-slate-700/50 shadow-sm">
              {ticket.topic_primary && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center">
                    <Tag className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
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
      <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-600">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">아직 대화 내역이 없습니다</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">첫 메시지를 기다리는 중...</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dayMessages]) => (
            <div key={date}>
              {/* Date Divider */}
              <div className="flex items-center justify-center my-6">
                <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-300/50 dark:border-slate-600/50 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                  {new Date(date).toLocaleDateString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                {dayMessages.map((event, index) => {
                  // "모션랩스_"로 시작하는 sender는 내부 멤버 (staff)
                  const isStaff = isStaffMember(event.sender_name)
                  const displayName = getDisplayName(event.sender_name)
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
                        'w-9 h-9 flex-shrink-0',
                        !showAvatar && 'invisible'
                      )}>
                        <div className={clsx(
                          'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold shadow-sm transition-all',
                          isStaff
                            ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white'
                            : 'bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200'
                        )}>
                          {isStaff ? (
                            <User className="w-4 h-4" />
                          ) : (
                            displayName.charAt(0).toUpperCase()
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
                            {displayName}
                            {event.staff_member && ` (${event.staff_member})`}
                          </span>
                        )}

                        {/* Bubble */}
                        <div className={clsx(
                          'px-4 py-3 rounded-2xl shadow-md transition-all duration-200',
                          isStaff
                            ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-tr-md hover:shadow-lg hover:scale-[1.01]'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-200/80 dark:border-slate-700/80 rounded-tl-md hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600'
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
      <div className="flex-shrink-0 border-t-2 border-slate-200/80 dark:border-slate-700/80 px-5 py-4 bg-gradient-to-t from-slate-50/50 to-transparent dark:from-slate-900/50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-5 text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <MessageSquare className="w-4 h-4 text-brand-500" />
              <span className="font-medium">{events.length}개</span>
            </div>
            {ticket.first_response_sec && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span className="font-medium">{Math.floor(ticket.first_response_sec / 60)}분</span>
              </div>
            )}
          </div>
          {ticket.updated_at && (
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {new Date(ticket.updated_at).toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TicketDetail

import { useMemo } from 'react'
import { differenceInMinutes } from 'date-fns'
import { AlertTriangle, Inbox, ChevronRight, User } from 'lucide-react'
import clsx from 'clsx'
import { Ticket } from '@/types/ticket.types'
import { isStaffMember, getDisplayName } from '@/utils/senderUtils'

interface TicketListProps {
  tickets: Ticket[]
  selectedTicketId?: string
  onSelect: (ticket: Ticket) => void
  isLoading?: boolean
  total: number
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  onboarding: {
    label: '온보딩',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    dot: 'bg-blue-500',
  },
  stable: {
    label: '안정기',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    dot: 'bg-emerald-500',
  },
  churn_risk: {
    label: '이탈우려',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    dot: 'bg-orange-500',
  },
  important: {
    label: '중요',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    dot: 'bg-purple-500',
  },
}


// 회신 필요 여부 확인 (LLM 분류 기반)
// 고객 메시지 중 답변이 필요한 메시지만 회신 필요로 표시
// 인사, 감사, 단순 확인 등은 회신 필요 없음으로 분류됨
function checkNeedsReply(ticket: Ticket): boolean {
  return ticket.needs_reply
}

// 대기 시간 계산 (고객 메시지 이후)
function getWaitingTime(ticket: Ticket): { minutes: number; display: string } | null {
  if (!checkNeedsReply(ticket)) return null

  const customerMessageTime = ticket.last_inbound_at
  if (!customerMessageTime) return null

  const minutes = differenceInMinutes(Date.now(), new Date(customerMessageTime))

  if (minutes < 1) {
    return { minutes, display: '방금 전' }
  } else if (minutes < 60) {
    return { minutes, display: `${minutes}분 대기` }
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return { minutes, display: `${hours}시간 ${remainingMinutes}분 대기` }
  }
}

function getWaitingTimeColor(minutes: number, slaBreached?: boolean): string {
  // SLA 초과 시 빨간색 강조
  if (slaBreached) return 'text-red-600 dark:text-red-400 font-semibold'
  if (minutes < 5) return 'text-green-600 dark:text-green-400'
  if (minutes < 15) return 'text-yellow-600 dark:text-yellow-400'
  if (minutes < 30) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function TicketSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12" />
          </div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
          <div className="flex items-center gap-3">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-slate-700 dark:text-slate-300 text-sm font-medium mb-1">표시할 티켓이 없습니다</p>
      <p className="text-slate-400 dark:text-slate-500 text-xs text-center">
        필터 조건을 변경하거나<br />새로운 문의가 들어오면 여기에 표시됩니다
      </p>
    </div>
  )
}

export function TicketList({
  tickets,
  selectedTicketId,
  onSelect,
  isLoading = false,
  total,
}: TicketListProps) {
  // 정렬: 회신 필요한 방 먼저, 그 중 오래 대기한 순으로 내림차순
  const ticketItems = useMemo(() => {
    return [...tickets].sort((a, b) => {
      // 1. 회신 필요 여부로 먼저 정렬 (needs_reply=true가 위로)
      if (a.needs_reply !== b.needs_reply) {
        return a.needs_reply ? -1 : 1
      }

      // 2. 회신 필요한 경우: 대기 시간이 긴 순서로 (오래된 것이 위로)
      if (a.needs_reply && b.needs_reply) {
        const aTime = a.last_inbound_at ? new Date(a.last_inbound_at).getTime() : 0
        const bTime = b.last_inbound_at ? new Date(b.last_inbound_at).getTime() : 0
        return aTime - bTime // 오래된 것이 위로
      }

      // 3. 회신 불필요인 경우: 최근 업데이트 순
      const aTime = a.last_outbound_at ? new Date(a.last_outbound_at).getTime() : 0
      const bTime = b.last_outbound_at ? new Date(b.last_outbound_at).getTime() : 0
      return bTime - aTime // 최근 것이 위로
    })
  }, [tickets])

  if (isLoading) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-4 py-3">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {[...Array(6)].map((_, i) => <TicketSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (ticketItems.length === 0) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-4 py-3">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
            대화 목록 <span className="text-slate-400 font-normal">(0)</span>
          </h2>
        </div>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
            대화 목록 <span className="text-slate-400 font-normal">({total})</span>
          </h2>
          <div className="flex items-center gap-2 text-2xs text-slate-500">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>지연</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span>대기</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>완료</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {ticketItems.map((ticket, index) => {
          const isSelected = selectedTicketId === ticket.ticket_id
          const status = statusConfig[ticket.status] || statusConfig.onboarding
          const needsReply = checkNeedsReply(ticket)
          // SLA는 회신 필요한 경우에만 체크
          const hasSLA = needsReply && (ticket.sla_breached || (ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec < 0))
          const isUrgent = needsReply && ticket.priority === 'urgent'
          const waitingTime = getWaitingTime(ticket)
          const senderName = ticket.last_message_sender
          const isStaff = senderName ? isStaffMember(senderName) : false
          const displaySenderName = senderName ? getDisplayName(senderName) : null

          return (
            <div
              key={ticket.ticket_id}
              onClick={() => onSelect(ticket)}
              className={clsx(
                'relative p-4 cursor-pointer transition-all duration-200',
                'border-l-3',
                isSelected
                  ? 'bg-brand-50/60 dark:bg-brand-900/20 border-l-brand-500'
                  : !needsReply
                    ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-l-emerald-400 hover:bg-emerald-50/70 dark:hover:bg-emerald-900/30'
                    : hasSLA
                      ? 'bg-red-50/40 dark:bg-red-900/10 border-l-red-500 hover:bg-red-50/60 dark:hover:bg-red-900/20'
                      : isUrgent
                        ? 'bg-amber-50/40 dark:bg-amber-900/10 border-l-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-900/20'
                        : 'bg-orange-50/30 dark:bg-orange-900/10 border-l-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/20',
                index !== ticketItems.length - 1 && 'border-b border-slate-100 dark:border-slate-700/50'
              )}
              style={{
                animationDelay: `${index * 30}ms`,
                borderLeftWidth: '3px'
              }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(ticket)
              }}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={clsx(
                  'relative w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm flex-shrink-0',
                  isSelected
                    ? 'bg-brand-500 text-white'
                    : hasSLA
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : isUrgent
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                )}>
                  {ticket.clinic_key.charAt(0)}

                  {/* Status dot */}
                  <div className={clsx(
                    'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800',
                    status.dot
                  )} />

                  {/* Alert badge */}
                  {(hasSLA || isUrgent) && (
                    <div className={clsx(
                      'absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center',
                      hasSLA ? 'bg-red-500' : 'bg-amber-500',
                      'animate-pulse'
                    )}>
                      <AlertTriangle className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header - 채팅방 이름 (병원명) */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className={clsx(
                        'font-semibold text-sm truncate',
                        isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-900 dark:text-white'
                      )}>
                        {ticket.clinic_key}
                      </h3>
                      <span className={clsx(
                        'flex-shrink-0 px-1.5 py-0.5 rounded text-2xs font-medium',
                        status.bg,
                        status.color
                      )}>
                        {status.label}
                      </span>
                    </div>
                    {/* 회신 필요 시 대기 시간 표시, 완료 시 회신 불필요 표시 */}
                    {waitingTime ? (
                      <span className={clsx(
                        'text-2xs flex-shrink-0 ml-2',
                        getWaitingTimeColor(waitingTime.minutes, hasSLA)
                      )}>
                        {waitingTime.display}
                        {hasSLA && ' (응답 지연)'}
                      </span>
                    ) : (
                      <span className="text-2xs text-green-600 dark:text-green-400 flex-shrink-0 ml-2">
                        회신 불필요
                      </span>
                    )}
                  </div>

                  {/* 발송자 이름 - 채팅방 이름과 다를 때만 표시 */}
                  {displaySenderName && displaySenderName !== ticket.clinic_key && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <User className={clsx(
                        'w-3 h-3',
                        isStaff ? 'text-blue-500' : 'text-slate-400'
                      )} />
                      <span className={clsx(
                        'text-xs',
                        isStaff
                          ? 'text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-slate-600 dark:text-slate-400'
                      )}>
                        {displaySenderName}
                        {isStaff && ' (멤버)'}
                      </span>
                    </div>
                  )}

                  {/* 메시지 내용 (한 줄) */}
                  <p className="text-sm text-slate-600 dark:text-slate-300 truncate mb-2">
                    {ticket.summary_latest || '새로운 문의'}
                  </p>

                  {/* Footer - Topic만 표시 */}
                  {ticket.topic_primary && (
                    <div className="flex items-center text-2xs">
                      <span className="text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                        #{ticket.topic_primary}
                      </span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className={clsx(
                  'w-4 h-4 flex-shrink-0 mt-3 transition-transform',
                  isSelected
                    ? 'text-brand-500 translate-x-0.5'
                    : 'text-slate-300 dark:text-slate-600'
                )} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TicketList

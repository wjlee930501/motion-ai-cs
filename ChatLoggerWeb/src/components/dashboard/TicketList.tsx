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

function TicketSkeleton() {
  return (
    <div className="p-4 relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-700 flex-shrink-0 relative">
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer"
               style={{ animationDuration: '1.5s' }} />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-md w-32 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer"
                   style={{ animationDuration: '1.5s', animationDelay: '0.1s' }} />
            </div>
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-16 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer"
                   style={{ animationDuration: '1.5s', animationDelay: '0.2s' }} />
            </div>
          </div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-full relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer"
                 style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer"
                   style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer"
                   style={{ animationDuration: '1.5s', animationDelay: '0.5s' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-lg transform transition-transform duration-300 hover:scale-105">
          <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center shadow-md">
          <span className="text-white text-xs font-bold">0</span>
        </div>
      </div>
      <h3 className="text-slate-800 dark:text-slate-200 text-base font-bold mb-2">모든 티켓을 처리했습니다</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm text-center max-w-xs leading-relaxed">
        현재 대기 중인 문의가 없습니다.<br />
        새로운 문의가 들어오면 자동으로 표시됩니다.
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>실시간 모니터링 중</span>
      </div>
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
      <div className="h-full bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden shadow-soft">
        <div className="border-b-2 border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-800/50 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-32 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer" />
            </div>
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-12 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
        <div className="divide-y-2 divide-slate-100 dark:divide-slate-700/50">
          {[...Array(6)].map((_, i) => <TicketSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (ticketItems.length === 0) {
    return (
      <div className="h-full bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden shadow-soft">
        <div className="border-b-2 border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-800/50 px-5 py-3.5">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">
            대화 목록
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold">
              0
            </span>
          </h2>
        </div>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden shadow-soft">
      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-800/50 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">
            대화 목록
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              {total}
            </span>
          </h2>
          <div className="flex items-center gap-3 text-2xs font-medium">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/20">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm" />
              <span className="text-red-700 dark:text-red-300 font-bold">지연</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20">
              <span className="w-2 h-2 rounded-full bg-orange-400 shadow-sm" />
              <span className="text-orange-700 dark:text-orange-300 font-bold">대기</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">완료</span>
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
                'relative p-4 cursor-pointer transition-all duration-300 group',
                'border-l-4',
                isSelected
                  ? 'bg-brand-50 dark:bg-brand-900/30 border-l-brand-600 shadow-lg shadow-brand-500/10'
                  : !needsReply
                    ? 'bg-white dark:bg-slate-800/50 border-l-emerald-500 hover:bg-emerald-50/70 dark:hover:bg-emerald-900/20 hover:shadow-md hover:shadow-emerald-500/10 hover:-translate-y-0.5'
                    : hasSLA
                      ? 'bg-red-50/80 dark:bg-red-950/40 border-l-red-600 hover:bg-red-100/90 dark:hover:bg-red-950/60 hover:shadow-lg hover:shadow-red-500/20 hover:-translate-y-0.5 animate-pulse-soft'
                      : isUrgent
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-l-amber-600 hover:bg-amber-100/80 dark:hover:bg-amber-950/50 hover:shadow-lg hover:shadow-amber-500/20 hover:-translate-y-0.5'
                        : 'bg-white dark:bg-slate-800/50 border-l-orange-500 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 hover:shadow-md hover:shadow-orange-500/10 hover:-translate-y-0.5',
                index !== ticketItems.length - 1 && 'border-b-2 border-slate-100 dark:border-slate-700/50'
              )}
              style={{
                animationDelay: `${index * 40}ms`,
              }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(ticket)
              }}
            >
              <div className="flex items-start gap-3.5">
                {/* Avatar */}
                <div className={clsx(
                  'relative w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 transition-all duration-300',
                  'shadow-md',
                  isSelected
                    ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-brand-500/30 scale-105'
                    : hasSLA
                      ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/30 group-hover:scale-105'
                      : isUrgent
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30 group-hover:scale-105'
                        : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200 group-hover:scale-105'
                )}>
                  {ticket.clinic_key.charAt(0).toUpperCase()}

                  {/* Status dot */}
                  <div className={clsx(
                    'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800',
                    'transition-all duration-300',
                    status.dot,
                    isSelected && 'scale-110'
                  )} />

                  {/* Alert badge */}
                  {(hasSLA || isUrgent) && (
                    <div className={clsx(
                      'absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg',
                      hasSLA ? 'bg-red-600 animate-pulse' : 'bg-amber-500',
                      'ring-2 ring-white dark:ring-slate-800'
                    )}>
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header - 채팅방 이름 (병원명) */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className={clsx(
                        'font-bold text-base truncate transition-colors duration-200',
                        isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : hasSLA
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200'
                      )}>
                        {ticket.clinic_key}
                      </h3>
                      <span className={clsx(
                        'flex-shrink-0 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wide',
                        'transition-all duration-200',
                        status.bg,
                        status.color,
                        isSelected && 'scale-105'
                      )}>
                        {status.label}
                      </span>
                    </div>
                    {/* 회신 필요 시 대기 시간 표시, 완료 시 회신 불필요 표시 */}
                    {waitingTime ? (
                      <div className={clsx(
                        'flex items-center gap-1 text-2xs font-bold flex-shrink-0 ml-2 px-2 py-1 rounded-full',
                        'transition-all duration-200',
                        hasSLA
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-2 ring-red-500/20'
                          : waitingTime.minutes < 15
                            ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                            : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                      )}>
                        {hasSLA && <AlertTriangle className="w-3 h-3" />}
                        <span>{waitingTime.display}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-2xs font-bold text-emerald-700 dark:text-emerald-400 flex-shrink-0 ml-2 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>완료</span>
                      </div>
                    )}
                  </div>

                  {/* 발송자 이름 - 채팅방 이름과 다를 때만 표시 */}
                  {displaySenderName && displaySenderName !== ticket.clinic_key && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <User className={clsx(
                        'w-3.5 h-3.5 transition-colors duration-200',
                        isStaff ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                      )} />
                      <span className={clsx(
                        'text-xs font-medium transition-colors duration-200',
                        isStaff
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-600 dark:text-slate-400'
                      )}>
                        {displaySenderName}
                        {isStaff && (
                          <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-2xs font-bold">
                            멤버
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* 메시지 내용 (한 줄) */}
                  <p className={clsx(
                    'text-sm leading-relaxed truncate mb-2 transition-colors duration-200',
                    isSelected
                      ? 'text-slate-700 dark:text-slate-200 font-medium'
                      : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                  )}>
                    {ticket.summary_latest || '새로운 문의'}
                  </p>

                  {/* Footer - Topic만 표시 */}
                  {ticket.topic_primary && (
                    <div className="flex items-center">
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-md truncate max-w-[200px] transition-all duration-200',
                        'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
                        'group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                      )}>
                        #{ticket.topic_primary}
                      </span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className={clsx(
                  'w-5 h-5 flex-shrink-0 mt-3 transition-all duration-300',
                  isSelected
                    ? 'text-brand-600 translate-x-1'
                    : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:translate-x-0.5'
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

import { useMemo } from 'react'
import { Clock, AlertTriangle, Inbox } from 'lucide-react'
import clsx from 'clsx'
import { Ticket } from '@/types/ticket.types'

interface TicketListProps {
  tickets: Ticket[]
  selectedTicketId?: string
  onSelect: (ticket: Ticket) => void
  isLoading?: boolean
  total: number
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  new: {
    label: '신규',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
  },
  in_progress: {
    label: '진행중',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  waiting: {
    label: '대기',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-900/40',
  },
  done: {
    label: '완료',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
}

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  urgent: {
    label: '긴급',
    color: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  high: {
    label: '높음',
    color: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  normal: {
    label: '보통',
    color: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  low: {
    label: '낮음',
    color: 'text-slate-400 dark:text-slate-500',
    dot: 'bg-slate-300 dark:bg-slate-600',
  },
}

function formatSlaRemaining(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '-'
  const minutes = Math.floor(Math.abs(seconds) / 60)
  if (seconds < 0) return `초과 ${minutes}분`
  return `${minutes}분`
}

function getSlaState(seconds: number | undefined, breached: boolean) {
  if (breached || (seconds !== undefined && seconds < 0)) {
    return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', urgent: true }
  }
  if (seconds === undefined || seconds === null) {
    return { color: 'text-slate-400', bg: '', urgent: false }
  }
  const minutes = seconds / 60
  if (minutes > 10) return { color: 'text-emerald-600 dark:text-emerald-400', bg: '', urgent: false }
  if (minutes > 5) return { color: 'text-amber-600 dark:text-amber-400', bg: '', urgent: false }
  return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', urgent: true }
}

function TicketSkeleton() {
  return (
    <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-32" />
        <div className="flex items-center gap-2">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-12" />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
        </div>
      </div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-full mb-3" />
      <div className="flex justify-between items-center">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-12" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-16" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-slate-700 dark:text-slate-300 text-sm font-medium mb-1">표시할 티켓이 없습니다</p>
      <p className="text-slate-400 dark:text-slate-500 text-xs">필터 조건을 변경해보세요</p>
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
  const ticketItems = useMemo(() => tickets, [tickets])

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden shadow-card">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-5 py-4">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-24 animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {[...Array(5)].map((_, i) => (
            <TicketSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (ticketItems.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden shadow-card">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-5 py-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">티켓 목록 (0)</h2>
        </div>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden shadow-card">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-5 py-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          티켓 목록{' '}
          <span className="text-slate-500 dark:text-slate-400 font-normal">({total})</span>
        </h2>
      </div>

      {/* Ticket List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
        {ticketItems.map((ticket, index) => {
          const isSelected = selectedTicketId === ticket.ticket_id
          const status = statusConfig[ticket.status] || statusConfig.new
          const priority = priorityConfig[ticket.priority] || priorityConfig.normal
          const slaState = getSlaState(ticket.sla_remaining_sec, ticket.sla_breached)

          return (
            <div
              key={ticket.ticket_id}
              onClick={() => onSelect(ticket)}
              className={clsx(
                'relative p-4 cursor-pointer transition-all duration-200',
                'hover:bg-slate-50 dark:hover:bg-slate-700/50',
                isSelected
                  ? 'bg-brand-50/50 dark:bg-brand-900/20 border-l-4 border-brand-500'
                  : 'border-l-4 border-transparent',
                slaState.bg,
                'animate-fade-in'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelect(ticket)
                }
              }}
            >
              {/* Header Row */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Priority Dot */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={clsx(
                        'w-2.5 h-2.5 rounded-full',
                        priority.dot,
                        ticket.priority === 'urgent' && 'animate-pulse'
                      )}
                    />
                    {ticket.priority === 'urgent' && (
                      <div className={clsx('absolute inset-0 rounded-full animate-ping', priority.dot, 'opacity-75')} />
                    )}
                  </div>

                  {/* Clinic Name */}
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {ticket.clinic_key}
                  </h3>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {ticket.sla_breached && (
                    <span className={clsx(
                      'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium',
                      'bg-red-500 text-white',
                      'animate-pulse shadow-lg shadow-red-500/30'
                    )}>
                      <AlertTriangle className="w-3 h-3" />
                      SLA
                    </span>
                  )}
                  <span className={clsx(
                    'text-xs px-2.5 py-1 rounded-full font-medium',
                    status.bg,
                    status.color
                  )}>
                    {status.label}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-3">
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {ticket.summary_latest || ticket.topic_primary || '요약 정보 없음'}
                </p>
              </div>

              {/* Footer Row */}
              <div className="flex justify-between items-center text-xs">
                {/* Priority */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500">우선순위:</span>
                  <span className={clsx('font-medium', priority.color)}>
                    {priority.label}
                  </span>
                </div>

                {/* SLA Countdown */}
                {ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec !== null ? (
                  <div className={clsx('flex items-center gap-1.5', slaState.color)}>
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">
                      {formatSlaRemaining(ticket.sla_remaining_sec)}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">-</span>
                )}
              </div>

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TicketList

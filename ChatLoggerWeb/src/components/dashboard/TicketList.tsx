import { useMemo } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Clock, AlertTriangle, Inbox, MessageSquare, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { Ticket } from '@/types/ticket.types'

interface TicketListProps {
  tickets: Ticket[]
  selectedTicketId?: string
  onSelect: (ticket: Ticket) => void
  isLoading?: boolean
  total: number
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  new: {
    label: '신규',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: '진행중',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    dot: 'bg-amber-500',
  },
  waiting: {
    label: '대기',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    dot: 'bg-purple-500',
  },
  done: {
    label: '완료',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    dot: 'bg-emerald-500',
  },
}

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: '긴급', color: 'text-red-600', dot: 'bg-red-500' },
  high: { label: '높음', color: 'text-orange-600', dot: 'bg-orange-500' },
  normal: { label: '보통', color: 'text-slate-600', dot: 'bg-slate-400' },
  low: { label: '낮음', color: 'text-slate-400', dot: 'bg-slate-300' },
}

function formatSlaRemaining(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return ''
  const minutes = Math.floor(Math.abs(seconds) / 60)
  if (seconds < 0) return `${minutes}분 초과`
  return `${minutes}분 남음`
}

function formatTimeAgo(dateString: string | undefined): string {
  if (!dateString) return ''
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ko })
  } catch {
    return ''
  }
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
  const ticketItems = useMemo(() => tickets, [tickets])

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
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>SLA</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>긴급</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {ticketItems.map((ticket, index) => {
          const isSelected = selectedTicketId === ticket.ticket_id
          const status = statusConfig[ticket.status] || statusConfig.new
          const priority = priorityConfig[ticket.priority] || priorityConfig.normal
          const hasSLA = ticket.sla_breached || (ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec < 0)
          const isUrgent = ticket.priority === 'urgent'

          return (
            <div
              key={ticket.ticket_id}
              onClick={() => onSelect(ticket)}
              className={clsx(
                'relative p-4 cursor-pointer transition-all duration-200',
                'border-l-3',
                isSelected
                  ? 'bg-brand-50/60 dark:bg-brand-900/20 border-l-brand-500'
                  : hasSLA
                    ? 'bg-red-50/40 dark:bg-red-900/10 border-l-red-500 hover:bg-red-50/60 dark:hover:bg-red-900/20'
                    : isUrgent
                      ? 'bg-amber-50/40 dark:bg-amber-900/10 border-l-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-900/20'
                      : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50',
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
                  {/* Header */}
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
                    <span className="text-2xs text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
                      {formatTimeAgo(ticket.last_inbound_at || ticket.first_inbound_at)}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2 leading-relaxed">
                    {ticket.summary_latest || ticket.topic_primary || '새로운 문의가 접수되었습니다'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-2xs">
                    <div className="flex items-center gap-3">
                      {/* Priority */}
                      <span className={clsx('flex items-center gap-1', priority.color)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', priority.dot)} />
                        {priority.label}
                      </span>

                      {/* Topic */}
                      {ticket.topic_primary && (
                        <span className="text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
                          #{ticket.topic_primary}
                        </span>
                      )}
                    </div>

                    {/* SLA */}
                    {ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec !== null && (
                      <span className={clsx(
                        'flex items-center gap-1 font-medium',
                        ticket.sla_breached || ticket.sla_remaining_sec < 0
                          ? 'text-red-600 dark:text-red-400'
                          : ticket.sla_remaining_sec < 300 // 5분 미만
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-500'
                      )}>
                        <Clock className="w-3 h-3" />
                        {formatSlaRemaining(ticket.sla_remaining_sec)}
                      </span>
                    )}
                  </div>
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

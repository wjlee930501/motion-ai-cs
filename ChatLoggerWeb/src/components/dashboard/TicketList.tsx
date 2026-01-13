import { useMemo } from 'react'
import { Ticket } from '@/types/ticket.types'

interface TicketListProps {
  tickets: Ticket[]
  selectedTicketId?: string
  onSelect: (ticket: Ticket) => void
  isLoading?: boolean
  total: number
}

// Korean labels
const statusLabels: Record<string, string> = {
  new: '신규',
  in_progress: '진행중',
  waiting: '대기',
  done: '완료',
}

const statusColors: Record<string, string> = {
  new: 'bg-red-100 text-red-800 border-red-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  waiting: 'bg-blue-100 text-blue-800 border-blue-200',
  done: 'bg-green-100 text-green-800 border-green-200',
}

const priorityLabels: Record<string, string> = {
  urgent: '긴급',
  high: '높음',
  normal: '보통',
  low: '낮음',
}

const priorityColors: Record<string, string> = {
  urgent: 'text-red-600',
  high: 'text-orange-600',
  normal: 'text-gray-600',
  low: 'text-gray-400',
}

const priorityDots: Record<string, string> = {
  urgent: 'bg-red-600',
  high: 'bg-orange-600',
  normal: 'bg-gray-400',
  low: 'bg-gray-300',
}

// SLA countdown formatter and color logic
function formatSlaRemaining(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '-'
  const minutes = Math.floor(Math.abs(seconds) / 60)
  if (seconds < 0) {
    return `초과 ${minutes}분`
  }
  return `${minutes}분`
}

function getSlaColorClass(seconds: number | undefined, breached: boolean): string {
  if (breached || (seconds !== undefined && seconds < 0)) {
    return 'text-red-600 font-semibold'
  }
  if (seconds === undefined || seconds === null) {
    return 'text-gray-400'
  }
  const minutes = seconds / 60
  if (minutes > 10) return 'text-green-600'
  if (minutes > 5) return 'text-yellow-600'
  return 'text-orange-600 font-semibold'
}

function getSlaBackgroundClass(seconds: number | undefined, breached: boolean): string {
  if (breached || (seconds !== undefined && seconds < 0)) {
    return 'bg-red-50'
  }
  if (seconds === undefined || seconds === null) {
    return ''
  }
  const minutes = seconds / 60
  if (minutes <= 5) return 'bg-orange-50'
  return ''
}

// Loading skeleton component
function TicketSkeleton() {
  return (
    <div className="p-4 border-b border-gray-100 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 bg-gray-200 rounded w-32"></div>
        <div className="flex items-center gap-2">
          <div className="h-6 bg-gray-200 rounded w-12"></div>
          <div className="h-6 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
      <div className="flex justify-between items-center">
        <div className="h-4 bg-gray-200 rounded w-12"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
  )
}

// Empty state component
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <svg
        className="w-16 h-16 text-gray-300 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="text-gray-500 text-sm font-medium mb-1">표시할 티켓이 없습니다</p>
      <p className="text-gray-400 text-xs">필터 조건을 변경해보세요</p>
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
  // Memoize tickets to prevent unnecessary re-renders
  const ticketItems = useMemo(() => tickets, [tickets])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h2 className="font-semibold text-gray-900">티켓 목록</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <TicketSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (ticketItems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h2 className="font-semibold text-gray-900">티켓 목록 (0)</h2>
        </div>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h2 className="font-semibold text-gray-900">
          티켓 목록 <span className="text-gray-500 font-normal">({total})</span>
        </h2>
      </div>

      {/* Ticket List */}
      <div className="divide-y divide-gray-100 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide">
        {ticketItems.map((ticket) => {
          const isSelected = selectedTicketId === ticket.ticket_id
          const slaColor = getSlaColorClass(ticket.sla_remaining_sec, ticket.sla_breached)
          const slaBackground = getSlaBackgroundClass(ticket.sla_remaining_sec, ticket.sla_breached)
          const shouldPulse = ticket.sla_breached || (ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec < 0)

          return (
            <div
              key={ticket.ticket_id}
              onClick={() => onSelect(ticket)}
              className={`
                relative p-4 cursor-pointer transition-all duration-200
                hover:bg-gray-50 hover:shadow-sm
                ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500 shadow-sm' : 'border-l-4 border-transparent'}
                ${slaBackground}
              `}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelect(ticket)
                }
              }}
            >
              {/* Header Row: Clinic Name, Status, Priority */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Priority Indicator Dot */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${priorityDots[ticket.priority]} ${
                        ticket.priority === 'urgent' ? 'animate-pulse' : ''
                      }`}
                    />
                  </div>

                  {/* Clinic Name */}
                  <h3 className="font-semibold text-gray-900 truncate">
                    {ticket.clinic_key}
                  </h3>
                </div>

                {/* Status and SLA Badges */}
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {ticket.sla_breached && (
                    <span className={`
                      text-xs bg-red-600 text-white px-2 py-1 rounded-full font-medium
                      ${shouldPulse ? 'animate-pulse' : ''}
                    `}>
                      SLA 초과
                    </span>
                  )}
                  <span className={`
                    text-xs px-2.5 py-1 rounded-full border font-medium
                    ${statusColors[ticket.status]}
                  `}>
                    {statusLabels[ticket.status]}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-3 pr-2">
                <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                  {ticket.summary_latest || ticket.topic_primary || '요약 정보 없음'}
                </p>
              </div>

              {/* Footer Row: Priority Label, SLA Countdown */}
              <div className="flex justify-between items-center text-xs">
                {/* Priority */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">우선순위:</span>
                  <span className={`font-medium ${priorityColors[ticket.priority]}`}>
                    {priorityLabels[ticket.priority]}
                  </span>
                </div>

                {/* SLA Countdown */}
                {ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec !== null ? (
                  <div className="flex items-center gap-1.5">
                    <svg
                      className={`w-3.5 h-3.5 ${slaColor}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className={slaColor}>
                      {formatSlaRemaining(ticket.sla_remaining_sec)}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
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

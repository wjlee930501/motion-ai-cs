import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import ticketApi from '@/services/ticketApi'
import { Ticket, TicketFilters, TicketUpdate } from '@/types/ticket.types'

// Status badge colors
const statusColors: Record<string, string> = {
  new: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  waiting: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
}

const statusLabels: Record<string, string> = {
  new: '신규',
  in_progress: '진행중',
  waiting: '대기',
  done: '완료',
}

const priorityColors: Record<string, string> = {
  urgent: 'text-red-600 font-bold',
  high: 'text-orange-600 font-semibold',
  normal: 'text-gray-600',
  low: 'text-gray-400',
}

const priorityLabels: Record<string, string> = {
  urgent: '긴급',
  high: '높음',
  normal: '보통',
  low: '낮음',
}

function formatSlaRemaining(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '-'
  const minutes = Math.floor(Math.abs(seconds) / 60)
  if (seconds < 0) {
    return `초과 ${minutes}분`
  }
  return `${minutes}분 남음`
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TicketsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout, checkAuth, isAuthenticated } = useAuthStore()

  const [filters, setFilters] = useState<TicketFilters>({
    page: 1,
    limit: 20,
  })
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // Fetch tickets
  const { data: ticketsData, isLoading } = useQuery(
    ['tickets', filters],
    () => ticketApi.getTickets(filters),
    { refetchInterval: 10000 } // Refresh every 10 seconds
  )

  // Fetch metrics
  const { data: metricsData } = useQuery(
    'metrics',
    () => ticketApi.getMetrics(),
    { refetchInterval: 30000 }
  )

  // Fetch ticket events when selected
  const { data: eventsData } = useQuery(
    ['ticketEvents', selectedTicket?.ticket_id],
    () => selectedTicket ? ticketApi.getTicketEvents(selectedTicket.ticket_id) : null,
    { enabled: !!selectedTicket }
  )

  // Update ticket mutation
  const updateMutation = useMutation(
    ({ ticketId, update }: { ticketId: string; update: TicketUpdate }) =>
      ticketApi.updateTicket(ticketId, update),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tickets')
      },
    }
  )

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    updateMutation.mutate({ ticketId, update: { status: newStatus } })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const metrics = metricsData?.metrics

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">CS Intelligence Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">오늘 인바운드</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.today_inbound}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">열린 티켓</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.open_tickets}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">SLA 초과</div>
              <div className="text-2xl font-bold text-red-600">{metrics.sla_breached_count}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">긴급</div>
              <div className="text-2xl font-bold text-orange-600">{metrics.urgent_count}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4 flex-wrap">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">모든 상태</option>
              <option value="new">신규</option>
              <option value="in_progress">진행중</option>
              <option value="waiting">대기</option>
              <option value="done">완료</option>
            </select>

            <select
              value={filters.priority || ''}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined, page: 1 })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">모든 우선순위</option>
              <option value="urgent">긴급</option>
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="low">낮음</option>
            </select>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.sla_breached === true}
                onChange={(e) => setFilters({
                  ...filters,
                  sla_breached: e.target.checked ? true : undefined,
                  page: 1
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">SLA 초과만</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Ticket List */}
          <div className="col-span-2 bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">
                티켓 목록 ({ticketsData?.total || 0})
              </h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500">로딩 중...</div>
            ) : (
              <div className="divide-y">
                {ticketsData?.tickets.map((ticket) => (
                  <div
                    key={ticket.ticket_id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedTicket?.ticket_id === ticket.ticket_id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-gray-900">{ticket.clinic_key}</div>
                      <div className="flex items-center gap-2">
                        {ticket.sla_breached && (
                          <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                            SLA 초과
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${statusColors[ticket.status]}`}>
                          {statusLabels[ticket.status]}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2 line-clamp-1">
                      {ticket.summary_latest || ticket.topic_primary || '요약 없음'}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span className={priorityColors[ticket.priority]}>
                        {priorityLabels[ticket.priority]}
                      </span>
                      <span>
                        {ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec !== null ? (
                          <span className={ticket.sla_remaining_sec < 0 ? 'text-red-600' : ''}>
                            {formatSlaRemaining(ticket.sla_remaining_sec)}
                          </span>
                        ) : (
                          formatDateTime(ticket.last_inbound_at)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {ticketsData && ticketsData.total > filters.limit! && (
              <div className="p-4 border-t flex justify-center gap-2">
                <button
                  disabled={filters.page === 1}
                  onClick={() => setFilters({ ...filters, page: filters.page! - 1 })}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  이전
                </button>
                <span className="px-3 py-1">
                  {filters.page} / {Math.ceil(ticketsData.total / filters.limit!)}
                </span>
                <button
                  disabled={filters.page! >= Math.ceil(ticketsData.total / filters.limit!)}
                  onClick={() => setFilters({ ...filters, page: filters.page! + 1 })}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}
          </div>

          {/* Ticket Detail */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">티켓 상세</h2>
            </div>

            {selectedTicket ? (
              <div className="p-4">
                <div className="mb-4">
                  <div className="text-sm text-gray-500">채팅방</div>
                  <div className="font-medium">{selectedTicket.clinic_key}</div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-500">상태</div>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(selectedTicket.ticket_id, e.target.value)}
                    className="mt-1 border rounded px-2 py-1 w-full"
                  >
                    <option value="new">신규</option>
                    <option value="in_progress">진행중</option>
                    <option value="waiting">대기</option>
                    <option value="done">완료</option>
                  </select>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-500">주제</div>
                  <div>{selectedTicket.topic_primary || '-'}</div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-500">요약</div>
                  <div className="text-sm">{selectedTicket.summary_latest || '-'}</div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-500">다음 조치</div>
                  <div className="text-sm">{selectedTicket.next_action || '-'}</div>
                </div>

                {/* Events */}
                <div className="border-t pt-4 mt-4">
                  <div className="text-sm text-gray-500 mb-2">대화 내역</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {eventsData?.events.map((event) => (
                      <div
                        key={event.event_id}
                        className={`p-2 rounded text-sm ${
                          event.sender_type === 'staff'
                            ? 'bg-blue-50 ml-4'
                            : 'bg-gray-100 mr-4'
                        }`}
                      >
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{event.sender_name}</span>
                          <span>{formatDateTime(event.received_at)}</span>
                        </div>
                        <div>{event.text_raw}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                티켓을 선택하세요
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default TicketsPage

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import ticketApi from '@/services/ticketApi'
import { Ticket, TicketFilters, TicketUpdate } from '@/types/ticket.types'

import { Button } from '@/components/ui'
import {
  Header,
  TicketList,
  TicketDetail
} from '@/components/dashboard'

const DEFAULT_FILTERS: TicketFilters = {
  page: 1,
  limit: 20,
}

// Reply filter type
type ReplyFilter = 'all' | 'needs_reply' | 'replied'

export function TicketsPageNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout, checkAuth, isAuthenticated } = useAuthStore()

  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('all')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auth check
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // Combine filters
  const effectiveFilters = useMemo(() => ({
    ...filters
  }), [filters])

  // Fetch tickets with auto-refresh
  const {
    data: ticketsData,
    isLoading: isLoadingTickets,
    refetch: refetchTickets
  } = useQuery(
    ['tickets', effectiveFilters],
    () => ticketApi.getTickets(effectiveFilters),
    {
      refetchInterval: 10000,
      onSuccess: () => setLastRefresh(new Date())
    }
  )

  // Fetch metrics (for future use)
  useQuery(
    'metrics',
    () => ticketApi.getMetrics(),
    { refetchInterval: 30000 }
  )

  // 회신 필요 여부 판별: LLM 분류 기반 needs_reply 필드 사용
  // 고객 메시지 중 답변이 필요한 메시지(질문, 요청, 문의 등)만 회신 필요로 표시
  // 인사, 감사, 단순 확인 등은 회신 필요 없음으로 분류됨
  const needsReply = useCallback((ticket: Ticket): boolean => {
    return ticket.needs_reply
  }, [])

  // 회신 필터 적용된 티켓 목록
  const filteredTickets = useMemo(() => {
    const tickets = ticketsData?.tickets || []
    if (replyFilter === 'all') return tickets
    if (replyFilter === 'needs_reply') return tickets.filter(needsReply)
    return tickets.filter(t => !needsReply(t))
  }, [ticketsData?.tickets, replyFilter, needsReply])

  // 회신 필요/완료 개수
  const needsReplyCount = useMemo(() => {
    return (ticketsData?.tickets || []).filter(needsReply).length
  }, [ticketsData?.tickets, needsReply])

  const repliedCount = useMemo(() => {
    return (ticketsData?.tickets || []).filter(t => !needsReply(t)).length
  }, [ticketsData?.tickets, needsReply])

  // Fetch ticket events when selected (with auto-refresh)
  const { data: eventsData, isLoading: isLoadingEvents } = useQuery(
    ['ticketEvents', selectedTicket?.ticket_id],
    () => selectedTicket ? ticketApi.getTicketEvents(selectedTicket.ticket_id) : null,
    {
      enabled: !!selectedTicket,
      refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    }
  )

  // Update ticket mutation
  const updateMutation = useMutation(
    ({ ticketId, update }: { ticketId: string; update: TicketUpdate }) =>
      ticketApi.updateTicket(ticketId, update),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tickets')
        queryClient.invalidateQueries('metrics')
      },
    }
  )

  // Handlers
  const handleStatusChange = useCallback((ticketId: string, newStatus: string) => {
    updateMutation.mutate({ ticketId, update: { status: newStatus } })
    if (selectedTicket?.ticket_id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus as Ticket['status'] } : null)
    }
  }, [updateMutation, selectedTicket])

  const handlePriorityChange = useCallback((ticketId: string, newPriority: string) => {
    updateMutation.mutate({ ticketId, update: { priority: newPriority } })
    if (selectedTicket?.ticket_id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, priority: newPriority as Ticket['priority'] } : null)
    }
  }, [updateMutation, selectedTicket])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])


  const handleTicketSelect = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
  }, [])

  const handleReplyFilterChange = useCallback((filter: ReplyFilter) => {
    setReplyFilter(filter)
  }, [])

  const handleManualRefresh = useCallback(() => {
    refetchTickets()
    queryClient.invalidateQueries('metrics')
  }, [refetchTickets, queryClient])

  // Format last refresh time
  const formatLastRefresh = () => {
    return lastRefresh.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Header */}
      <Header
        userName={user?.name}
        onLogout={handleLogout}
        searchItems={(ticketsData?.tickets || []).map(t => ({
          id: t.ticket_id,
          name: t.clinic_key,
          lastMessage: t.summary_latest,
          needsReply: t.needs_reply
        }))}
        onSearchSelect={(id) => {
          const ticket = ticketsData?.tickets?.find(t => t.ticket_id === id)
          if (ticket) handleTicketSelect(ticket)
        }}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Ticket List with Reply Filter */}
        <div className="w-96 flex-shrink-0 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800">
          {/* Reply Filter Tabs */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-col gap-2 px-3 py-2">
              {/* Filter Buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleReplyFilterChange('all')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    replyFilter === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  전체 {ticketsData?.tickets?.length || 0}
                </button>
                <button
                  onClick={() => handleReplyFilterChange('needs_reply')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    replyFilter === 'needs_reply'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  } ${needsReplyCount > 0 && replyFilter !== 'needs_reply' ? 'animate-pulse' : ''}`}
                >
                  대기 {needsReplyCount}
                </button>
                <button
                  onClick={() => handleReplyFilterChange('replied')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    replyFilter === 'replied'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  완료 {repliedCount}
                </button>
              </div>
              {/* Status Bar */}
              <div className="flex items-center justify-between text-2xs text-slate-400">
                <div className="flex items-center gap-1">
                  {isOnline ? (
                    <Wifi className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-red-500" />
                  )}
                  <span>업데이트: {formatLastRefresh()}</span>
                </div>
                <button
                  onClick={handleManualRefresh}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingTickets ? 'animate-spin' : ''}`} />
                  <span>새로고침</span>
                </button>
              </div>
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-hidden p-4">
            <TicketList
              tickets={filteredTickets}
              selectedTicketId={selectedTicket?.ticket_id}
              onSelect={handleTicketSelect}
              isLoading={isLoadingTickets}
              total={filteredTickets.length}
            />

            {/* Pagination */}
            {ticketsData && ticketsData.total > (filters.limit || 20) && (
              <div className="mt-4 flex justify-center items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                >
                  이전
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {filters.page} / {Math.ceil(ticketsData.total / (filters.limit || 20))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filters.page || 1) >= Math.ceil(ticketsData.total / (filters.limit || 20))}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                >
                  다음
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Ticket Detail (Main Area - Wide) */}
        <div className="flex-1 hidden md:block p-4 bg-slate-50 dark:bg-slate-900/50">
          <TicketDetail
            ticket={selectedTicket}
            events={eventsData?.events || []}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            isLoading={isLoadingEvents}
          />
        </div>
      </div>

      {/* Mobile Ticket Detail Modal (for smaller screens) */}
      {selectedTicket && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full h-[80vh] bg-white dark:bg-slate-800 rounded-t-3xl animate-slide-in-up">
            <div className="h-full p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">대화 상세</h2>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="h-[calc(100%-48px)]">
                <TicketDetail
                  ticket={selectedTicket}
                  events={eventsData?.events || []}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  isLoading={isLoadingEvents}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TicketsPageNew

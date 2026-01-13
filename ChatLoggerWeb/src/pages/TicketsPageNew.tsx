import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import ticketApi from '@/services/ticketApi'
import { Ticket, TicketFilters, TicketUpdate } from '@/types/ticket.types'

import { Button } from '@/components/ui'
import {
  Header,
  MetricsPanel,
  FilterBar,
  TicketList,
  TicketDetail
} from '@/components/dashboard'

const DEFAULT_FILTERS: TicketFilters = {
  page: 1,
  limit: 20,
}

export function TicketsPageNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout, checkAuth, isAuthenticated } = useAuthStore()

  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Auth check
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // Fetch tickets with auto-refresh
  const {
    data: ticketsData,
    isLoading: isLoadingTickets,
    refetch: refetchTickets
  } = useQuery(
    ['tickets', filters],
    () => ticketApi.getTickets(filters),
    {
      refetchInterval: 10000,
      onSuccess: () => setLastRefresh(new Date())
    }
  )

  // Fetch metrics
  const {
    data: metricsData,
    isLoading: isLoadingMetrics
  } = useQuery(
    'metrics',
    () => ticketApi.getMetrics(),
    { refetchInterval: 30000 }
  )

  // Fetch ticket events when selected
  const { data: eventsData, isLoading: isLoadingEvents } = useQuery(
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

  const handleFilterChange = useCallback((newFilters: TicketFilters) => {
    setFilters(newFilters)
  }, [])

  const handleFilterReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const handleTicketSelect = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <Header
        userName={user?.name}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Metrics Panel */}
        <div className="mb-6">
          <MetricsPanel
            metrics={metricsData?.metrics}
            isLoading={isLoadingMetrics}
          />
        </div>

        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleFilterReset}
          />
        </div>

        {/* Refresh Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            마지막 업데이트: {formatLastRefresh()}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            className="text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingTickets ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket List - Takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <TicketList
              tickets={ticketsData?.tickets || []}
              selectedTicketId={selectedTicket?.ticket_id}
              onSelect={handleTicketSelect}
              isLoading={isLoadingTickets}
              total={ticketsData?.total || 0}
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
                <span className="text-sm text-gray-600 dark:text-gray-400">
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

          {/* Ticket Detail - Takes 1 column */}
          <div className="lg:col-span-1">
            <TicketDetail
              ticket={selectedTicket}
              events={eventsData?.events || []}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              isLoading={isLoadingEvents}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-8 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            MotionLabs CS Intelligence System v1.0
          </p>
        </div>
      </footer>
    </div>
  )
}

export default TicketsPageNew

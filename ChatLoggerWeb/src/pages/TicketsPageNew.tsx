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
  TicketDetail,
  ClinicSidebar
} from '@/components/dashboard'

const DEFAULT_FILTERS: TicketFilters = {
  page: 1,
  limit: 20,
}

// Extract unique clinics from tickets
interface ClinicInfo {
  clinic_key: string
  open_tickets: number
  sla_breached: number
  urgent_count: number
}

function extractClinics(tickets: Ticket[]): ClinicInfo[] {
  const clinicMap = new Map<string, ClinicInfo>()

  tickets.forEach(ticket => {
    const existing = clinicMap.get(ticket.clinic_key)
    if (existing) {
      existing.open_tickets++
      if (ticket.sla_breached) existing.sla_breached++
      if (ticket.priority === 'urgent') existing.urgent_count++
    } else {
      clinicMap.set(ticket.clinic_key, {
        clinic_key: ticket.clinic_key,
        open_tickets: 1,
        sla_breached: ticket.sla_breached ? 1 : 0,
        urgent_count: ticket.priority === 'urgent' ? 1 : 0
      })
    }
  })

  return Array.from(clinicMap.values())
}

export function TicketsPageNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout, checkAuth, isAuthenticated } = useAuthStore()

  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [selectedClinic, setSelectedClinic] = useState<string | undefined>()
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

  // Combine filters with selected clinic
  const effectiveFilters = useMemo(() => ({
    ...filters,
    clinic_key: selectedClinic
  }), [filters, selectedClinic])

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

  // Fetch all tickets for clinic sidebar (unfiltered, open tickets only)
  const { data: allTicketsData } = useQuery(
    ['tickets', 'sidebar'],
    () => ticketApi.getTickets({ status: 'new,in_progress,waiting', limit: 500 }),
    { refetchInterval: 30000 }
  )

  // Fetch metrics (for future use)
  useQuery(
    'metrics',
    () => ticketApi.getMetrics(),
    { refetchInterval: 30000 }
  )

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

  // Extract clinics from all tickets
  const clinics = useMemo(() => {
    if (!allTicketsData?.tickets) return []
    return extractClinics(allTicketsData.tickets)
  }, [allTicketsData])

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

  const handleClinicSelect = useCallback((clinicKey: string | undefined) => {
    setSelectedClinic(clinicKey)
    setSelectedTicket(null) // Reset ticket selection when clinic changes
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
      />

      {/* Main Layout - Kakao Business Style */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Clinics (Compact) */}
        <div className="w-56 flex-shrink-0 hidden lg:block">
          <ClinicSidebar
            clinics={clinics}
            selectedClinic={selectedClinic}
            onSelectClinic={handleClinicSelect}
            isLoading={isLoadingTickets}
          />
        </div>

        {/* Center - Ticket List (Narrow - Kakao Style) */}
        <div className="w-80 flex-shrink-0 flex flex-col min-w-0 border-x border-slate-200 dark:border-slate-800">
          {/* Compact Header with Status & Refresh */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {isOnline ? (
                <Wifi className="w-3 h-3 text-emerald-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-500" />
              )}
              <span className="text-2xs">{formatLastRefresh()}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              className="text-slate-500 hover:text-slate-700 h-6 px-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingTickets ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-hidden p-4">
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

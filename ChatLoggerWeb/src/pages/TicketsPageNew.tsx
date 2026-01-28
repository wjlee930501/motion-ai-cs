import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import ticketApi from '@/services/ticketApi'
import { Ticket, TicketUpdate } from '@/types/ticket.types'
import { checkNeedsReply } from '@/utils/ticketUtils'
import { REFETCH_INTERVALS_MS } from '@/constants'

import {
  Header,
  TicketList,
  TicketDetail
} from '@/components/dashboard'
import { LabModal, TemplatesModal } from '@/components/modals'

type ReplyFilter = 'all' | 'needs_reply' | 'replied'

export function TicketsPageNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout, checkAuth, isAuthenticated } = useAuthStore()

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('all')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isLabModalOpen, setIsLabModalOpen] = useState(false)
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false)

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

  // ESC key listener for mobile modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTicket) {
        setSelectedTicket(null)
      }
    }

    if (selectedTicket) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [selectedTicket])

  const {
    data: ticketsData,
    isLoading: isLoadingTickets,
    refetch: refetchTickets
  } = useQuery(
    ['tickets'],
    () => ticketApi.getTickets(),
    {
      refetchInterval: REFETCH_INTERVALS_MS.tickets,
      onSuccess: () => setLastRefresh(new Date())
    }
  )

  const filteredTickets = useMemo(() => {
    const tickets = ticketsData?.tickets || []
    if (replyFilter === 'all') return tickets
    if (replyFilter === 'needs_reply') return tickets.filter(checkNeedsReply)
    return tickets.filter(t => !checkNeedsReply(t))
  }, [ticketsData?.tickets, replyFilter])

  const needsReplyCount = useMemo(() => {
    return (ticketsData?.tickets || []).filter(checkNeedsReply).length
  }, [ticketsData?.tickets])

  const repliedCount = useMemo(() => {
    return (ticketsData?.tickets || []).filter(t => !checkNeedsReply(t)).length
  }, [ticketsData?.tickets])

  const { data: eventsData, isLoading: isLoadingEvents } = useQuery(
    ['ticketEvents', selectedTicket?.ticket_id],
    () => selectedTicket ? ticketApi.getTicketEvents(selectedTicket.ticket_id) : null,
    {
      enabled: !!selectedTicket,
      refetchInterval: REFETCH_INTERVALS_MS.ticketEvents,
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

  const handleNeedsReplyChange = useCallback((ticketId: string, needsReply: boolean) => {
    updateMutation.mutate({ ticketId, update: { needs_reply: needsReply } })
    if (selectedTicket?.ticket_id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, needs_reply: needsReply } : null)
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

  const handleOpenLabModal = useCallback(() => {
    setIsLabModalOpen(true)
  }, [])

  const handleOpenTemplatesModal = useCallback(() => {
    setIsTemplatesModalOpen(true)
  }, [])

  // Format last refresh time
  const formatLastRefresh = () => {
    return lastRefresh.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.025] z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <Header
        userName={user?.name}
        userRole={user?.role}
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
        onOpenLabModal={handleOpenLabModal}
        onOpenTemplatesModal={handleOpenTemplatesModal}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left - Ticket List with Reply Filter */}
        <div className="w-96 flex-shrink-0 flex flex-col min-w-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-r border-slate-300/50 dark:border-slate-700/50 shadow-2xl">
          {/* Reply Filter Tabs - Sticky */}
          <div className="flex-shrink-0 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 z-20">
            <div className="flex flex-col gap-3 px-4 py-4">
              {/* Filter Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleReplyFilterChange('all')}
                  className={`group flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                    replyFilter === 'all'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-[1.02]'
                  }`}
                >
                  <span className="relative z-10">전체 {ticketsData?.tickets?.length || 0}</span>
                  {replyFilter === 'all' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-600/20 animate-pulse" />
                  )}
                </button>
                <button
                  onClick={() => handleReplyFilterChange('needs_reply')}
                  className={`group flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                    replyFilter === 'needs_reply'
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 dark:shadow-red-500/20'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-[1.02]'
                  } ${needsReplyCount > 0 && replyFilter !== 'needs_reply' ? 'animate-pulse' : ''}`}
                >
                  <span className="relative z-10">대기 {needsReplyCount}</span>
                  {replyFilter === 'needs_reply' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-rose-600/20 animate-pulse" />
                  )}
                </button>
                <button
                  onClick={() => handleReplyFilterChange('replied')}
                  className={`group flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                    replyFilter === 'replied'
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/20'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-[1.02]'
                  }`}
                >
                  <span className="relative z-10">완료 {repliedCount}</span>
                  {replyFilter === 'replied' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-green-600/20 animate-pulse" />
                  )}
                </button>
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="font-medium">{formatLastRefresh()}</span>
                </div>
                <button
                  onClick={handleManualRefresh}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? 'animate-spin' : ''}`} />
                  <span className="font-medium">새로고침</span>
                </button>
              </div>
            </div>
          </div>

          {/* Ticket List - Smooth scroll */}
          <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-600">
            <TicketList
              tickets={filteredTickets}
              selectedTicketId={selectedTicket?.ticket_id}
              onSelect={handleTicketSelect}
              isLoading={isLoadingTickets}
              total={filteredTickets.length}
            />

          </div>
        </div>

        {/* Right Panel - Ticket Detail (Main Area - Wide) */}
        <div className="flex-1 hidden md:flex p-6">
          {/* Gradient orbs for atmosphere */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex-1 relative z-10">
            <TicketDetail
              ticket={selectedTicket}
              events={eventsData?.events || []}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onNeedsReplyChange={handleNeedsReplyChange}
              isLoading={isLoadingEvents}
            />
          </div>
        </div>
      </div>

      {/* Mobile Ticket Detail Modal (for smaller screens) */}
      {selectedTicket && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-fade-in"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="w-full h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl animate-slide-in-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              {/* Mobile header */}
              <div className="flex-shrink-0 flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">대화 상세</h2>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="text-slate-600 dark:text-slate-400 text-xl">✕</span>
                </button>
              </div>
              {/* Mobile content */}
              <div className="flex-1 overflow-hidden">
                <TicketDetail
                  ticket={selectedTicket}
                  events={eventsData?.events || []}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onNeedsReplyChange={handleNeedsReplyChange}
                  isLoading={isLoadingEvents}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lab Modal */}
      <LabModal
        isOpen={isLabModalOpen}
        onClose={() => setIsLabModalOpen(false)}
      />

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
      />
    </div>
  )
}

export default TicketsPageNew

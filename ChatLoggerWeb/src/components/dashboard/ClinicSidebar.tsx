import { useState, useMemo } from 'react'
import {
  Building2,
  AlertTriangle,
  Search,
  ChevronRight,
  MessageSquare,
  Clock,
  Filter
} from 'lucide-react'
import clsx from 'clsx'

interface ClinicInfo {
  clinic_key: string
  open_tickets: number
  sla_breached: number
  urgent_count: number
  last_message_at?: string
  last_message_preview?: string
}

interface ClinicSidebarProps {
  clinics: ClinicInfo[]
  selectedClinic?: string
  onSelectClinic: (clinicKey: string | undefined) => void
  isLoading?: boolean
}

type FilterType = 'all' | 'sla' | 'urgent'

export function ClinicSidebar({
  clinics,
  selectedClinic,
  onSelectClinic,
  isLoading = false
}: ClinicSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  const filteredClinics = useMemo(() => {
    let result = clinics

    // Search filter
    if (searchQuery) {
      result = result.filter(c =>
        c.clinic_key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Tab filter
    if (activeFilter === 'sla') {
      result = result.filter(c => c.sla_breached > 0)
    } else if (activeFilter === 'urgent') {
      result = result.filter(c => c.urgent_count > 0)
    }

    // Sort: SLA breached first, then urgent, then by open tickets
    return result.sort((a, b) => {
      if (a.sla_breached !== b.sla_breached) return b.sla_breached - a.sla_breached
      if (a.urgent_count !== b.urgent_count) return b.urgent_count - a.urgent_count
      return b.open_tickets - a.open_tickets
    })
  }, [clinics, searchQuery, activeFilter])

  const counts = useMemo(() => ({
    all: clinics.length,
    sla: clinics.filter(c => c.sla_breached > 0).length,
    urgent: clinics.filter(c => c.urgent_count > 0).length
  }), [clinics])

  const filterTabs: { key: FilterType; label: string; count: number; color?: string }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'sla', label: 'SLA', count: counts.sla, color: 'text-red-500' },
    { key: 'urgent', label: '긴급', count: counts.urgent, color: 'text-amber-500' }
  ]

  return (
    <aside className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-brand-500/10 dark:bg-brand-500/20">
            <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">클리닉</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{clinics.length}개 채팅방</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="클리닉 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex-shrink-0 px-2 py-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all',
                activeFilter === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.5 rounded-full text-2xs font-semibold',
                  activeFilter === tab.key
                    ? tab.color || 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                    : 'bg-slate-200/50 dark:bg-slate-700 text-slate-500'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Clinic List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {/* All Clinics Option */}
        <div className="px-2 mb-1">
          <button
            onClick={() => onSelectClinic(undefined)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
              !selectedClinic
                ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            <div className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              !selectedClinic
                ? 'bg-brand-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            )}>
              <Filter className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <p className={clsx(
                'text-sm font-medium',
                !selectedClinic
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-slate-700 dark:text-slate-300'
              )}>
                모든 클리닉
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                전체 티켓 보기
              </p>
            </div>
          </button>
        </div>

        {/* Clinic Items */}
        {isLoading ? (
          <div className="px-2 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <Building2 className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery ? '검색 결과가 없습니다' : '표시할 클리닉이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="px-2 space-y-1">
            {filteredClinics.map((clinic) => {
              const isSelected = selectedClinic === clinic.clinic_key
              const hasSLA = clinic.sla_breached > 0
              const hasUrgent = clinic.urgent_count > 0

              return (
                <button
                  key={clinic.clinic_key}
                  onClick={() => onSelectClinic(clinic.clinic_key)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left group',
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-900/20'
                      : hasSLA
                        ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {/* Avatar */}
                  <div className={clsx(
                    'relative w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm flex-shrink-0',
                    isSelected
                      ? 'bg-brand-500 text-white'
                      : hasSLA
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  )}>
                    {clinic.clinic_key.charAt(0)}
                    {(hasSLA || hasUrgent) && (
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
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={clsx(
                        'text-sm font-medium truncate',
                        isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-800 dark:text-slate-200'
                      )}>
                        {clinic.clinic_key}
                      </p>
                      {clinic.open_tickets > 0 && (
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-2xs font-semibold flex-shrink-0',
                          hasSLA
                            ? 'bg-red-500 text-white'
                            : hasUrgent
                              ? 'bg-amber-500 text-white'
                              : 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'
                        )}>
                          {clinic.open_tickets}
                        </span>
                      )}
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center gap-3 text-xs">
                      {hasSLA ? (
                        <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          SLA {clinic.sla_breached}건
                        </span>
                      ) : hasUrgent ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          긴급 {clinic.urgent_count}건
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          열린 티켓 {clinic.open_tickets}건
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className={clsx(
                    'w-4 h-4 flex-shrink-0 transition-transform',
                    isSelected
                      ? 'text-brand-500'
                      : 'text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5'
                  )} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

export default ClinicSidebar

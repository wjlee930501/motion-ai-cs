import { useState } from 'react'
import {
  Filter,
  RotateCcw,
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ChevronDown,
  X
} from 'lucide-react'
import clsx from 'clsx'
import { TicketFilters } from '@/types/ticket.types'

interface FilterBarProps {
  filters: TicketFilters
  onFilterChange: (filters: TicketFilters) => void
  onReset: () => void
}

type StatusTab = 'all' | 'new' | 'in_progress' | 'waiting' | 'done'

const statusTabs: { key: StatusTab; label: string; icon: React.ElementType; color?: string }[] = [
  { key: 'all', label: '전체', icon: Inbox },
  { key: 'new', label: '신규', icon: Clock, color: 'text-blue-600' },
  { key: 'in_progress', label: '진행중', icon: Zap, color: 'text-amber-600' },
  { key: 'waiting', label: '대기', icon: AlertTriangle, color: 'text-purple-600' },
  { key: 'done', label: '완료', icon: CheckCircle2, color: 'text-emerald-600' },
]

export function FilterBar({ filters, onFilterChange, onReset }: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const currentStatus = (filters.status || 'all') as StatusTab
  const hasAdvancedFilters = filters.priority || filters.sla_breached

  const handleStatusChange = (status: StatusTab) => {
    onFilterChange({
      ...filters,
      status: status === 'all' ? undefined : status,
      page: 1
    })
  }

  const priorityOptions = [
    { value: '', label: '모든 우선순위' },
    { value: 'urgent', label: '긴급', dot: 'bg-red-500' },
    { value: 'high', label: '높음', dot: 'bg-orange-500' },
    { value: 'normal', label: '보통', dot: 'bg-slate-400' },
    { value: 'low', label: '낮음', dot: 'bg-slate-300' },
  ]

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
      {/* Main Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        {/* Status Tabs */}
        <div className="flex-1 flex">
          {statusTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentStatus === tab.key

            return (
              <button
                key={tab.key}
                onClick={() => handleStatusChange(tab.key)}
                className={clsx(
                  'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all',
                  'hover:bg-slate-50 dark:hover:bg-slate-700/50',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                <Icon className={clsx(
                  'w-4 h-4',
                  isActive ? 'text-brand-500' : tab.color || 'text-slate-400'
                )} />
                <span>{tab.label}</span>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
                )}
              </button>
            )
          })}
        </div>

        {/* Advanced Filter Toggle */}
        <div className="flex items-center gap-2 px-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
              showAdvanced || hasAdvancedFilters
                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
            )}
          >
            <Filter className="w-4 h-4" />
            <span>필터</span>
            {hasAdvancedFilters && (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-brand-500 text-white text-xs">
                {(filters.priority ? 1 : 0) + (filters.sla_breached ? 1 : 0)}
              </span>
            )}
            <ChevronDown className={clsx(
              'w-4 h-4 transition-transform',
              showAdvanced && 'rotate-180'
            )} />
          </button>

          {hasAdvancedFilters && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700 animate-fade-in">
          <div className="flex flex-wrap items-center gap-4">
            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">우선순위:</span>
              <div className="flex gap-1">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onFilterChange({
                      ...filters,
                      priority: opt.value || undefined,
                      page: 1
                    })}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all',
                      filters.priority === opt.value || (!filters.priority && !opt.value)
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600'
                        : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800'
                    )}
                  >
                    {opt.dot && <span className={clsx('w-2 h-2 rounded-full', opt.dot)} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SLA Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onFilterChange({
                  ...filters,
                  sla_breached: filters.sla_breached ? undefined : true,
                  page: 1
                })}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all',
                  filters.sla_breached
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800 border border-transparent'
                )}
              >
                <AlertTriangle className={clsx(
                  'w-4 h-4',
                  filters.sla_breached && 'animate-pulse'
                )} />
                SLA 초과만
                {filters.sla_breached && (
                  <X className="w-3.5 h-3.5 ml-1" />
                )}
              </button>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasAdvancedFilters && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500">적용된 필터:</span>
              <div className="flex gap-2">
                {filters.priority && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">
                    우선순위: {priorityOptions.find(o => o.value === filters.priority)?.label}
                    <button
                      onClick={() => onFilterChange({ ...filters, priority: undefined, page: 1 })}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.sla_breached && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                    SLA 초과
                    <button
                      onClick={() => onFilterChange({ ...filters, sla_breached: undefined, page: 1 })}
                      className="hover:text-red-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FilterBar

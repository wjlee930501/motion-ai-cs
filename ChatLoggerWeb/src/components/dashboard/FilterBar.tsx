import { Filter, RotateCcw } from 'lucide-react'
import { Button } from '../ui'
import { TicketFilters } from '@/types/ticket.types'

interface FilterBarProps {
  filters: TicketFilters
  onFilterChange: (filters: TicketFilters) => void
  onReset: () => void
}

export function FilterBar({ filters, onFilterChange, onReset }: FilterBarProps) {
  const hasActiveFilters = filters.status || filters.priority || filters.sla_breached

  const selectClasses = "min-w-[140px] px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">필터</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-1">
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value || undefined, page: 1 })}
            className={selectClasses}
          >
            <option value="">모든 상태</option>
            <option value="new">신규</option>
            <option value="in_progress">진행중</option>
            <option value="waiting">대기</option>
            <option value="done">완료</option>
          </select>

          <select
            value={filters.priority || ''}
            onChange={(e) => onFilterChange({ ...filters, priority: e.target.value || undefined, page: 1 })}
            className={selectClasses}
          >
            <option value="">모든 우선순위</option>
            <option value="urgent">긴급</option>
            <option value="high">높음</option>
            <option value="normal">보통</option>
            <option value="low">낮음</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={filters.sla_breached === true}
              onChange={(e) => onFilterChange({
                ...filters,
                sla_breached: e.target.checked ? true : undefined,
                page: 1
              })}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              SLA 초과만
            </span>
          </label>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            초기화
          </Button>
        )}
      </div>
    </div>
  )
}

export default FilterBar

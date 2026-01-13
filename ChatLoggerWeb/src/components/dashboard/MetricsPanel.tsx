import React from 'react'
import {
  PhoneIncoming,
  Ticket,
  AlertTriangle,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import clsx from 'clsx'

interface MetricsPanelProps {
  metrics: {
    today_inbound: number
    open_tickets: number
    sla_breached_count: number
    urgent_count: number
    avg_response_sec?: number
  } | undefined
  isLoading?: boolean
}

interface MetricItemProps {
  icon: React.ReactNode
  label: string
  value: string | number
  trend?: number
  accentColor: string
  pulse?: boolean
  isLoading?: boolean
}

const MetricItem: React.FC<MetricItemProps> = ({
  icon,
  label,
  value,
  trend,
  accentColor,
  pulse = false,
  isLoading = false
}) => {
  return (
    <div className={clsx(
      'flex items-center gap-3 px-4 py-3 rounded-xl',
      'bg-white dark:bg-slate-800/80',
      'border border-slate-200/80 dark:border-slate-700/50',
      'transition-all duration-200 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-600',
      pulse && 'ring-2 ring-red-500/20 border-red-300 dark:border-red-700/50'
    )}>
      <div className={clsx(
        'flex-shrink-0 p-2 rounded-lg',
        accentColor,
        pulse && 'animate-pulse'
      )}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {label}
        </p>
        {isLoading ? (
          <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {trend !== undefined && (
              <span className={clsx(
                'flex items-center gap-0.5 text-xs font-medium',
                trend > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
              )}>
                {trend > 0 ? <TrendingUp className="w-3 h-3" /> :
                 trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  isLoading = false
}) => {
  const avgResponseMin = metrics?.avg_response_sec
    ? (metrics.avg_response_sec / 60).toFixed(1)
    : '0.0'

  const hasSLAIssues = (metrics?.sla_breached_count || 0) > 0
  const hasUrgent = (metrics?.urgent_count || 0) > 0

  const metricsData = [
    {
      icon: <PhoneIncoming className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      label: '오늘 인바운드',
      value: metrics?.today_inbound || 0,
      accentColor: 'bg-blue-100 dark:bg-blue-900/40',
      pulse: false,
    },
    {
      icon: <Ticket className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      label: '열린 티켓',
      value: metrics?.open_tickets || 0,
      accentColor: 'bg-emerald-100 dark:bg-emerald-900/40',
      pulse: false,
    },
    {
      icon: <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />,
      label: 'SLA 초과',
      value: metrics?.sla_breached_count || 0,
      accentColor: 'bg-red-100 dark:bg-red-900/40',
      pulse: hasSLAIssues,
    },
    {
      icon: <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      label: '긴급',
      value: metrics?.urgent_count || 0,
      accentColor: 'bg-amber-100 dark:bg-amber-900/40',
      pulse: hasUrgent,
    },
    {
      icon: <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
      label: '평균 응답',
      value: `${avgResponseMin}분`,
      accentColor: 'bg-purple-100 dark:bg-purple-900/40',
      pulse: false,
    },
  ]

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-3">
        {metricsData.map((metric, index) => (
          <div key={index} className="flex-1 min-w-[160px]">
            <MetricItem
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              accentColor={metric.accentColor}
              pulse={metric.pulse}
              isLoading={isLoading}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default MetricsPanel

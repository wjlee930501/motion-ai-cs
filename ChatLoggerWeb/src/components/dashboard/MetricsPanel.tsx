import React, { useEffect, useState } from 'react'
import {
  PhoneIncoming,
  Ticket,
  AlertTriangle,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus
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

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  trend?: number
  gradientFrom: string
  gradientTo: string
  iconBg: string
  pulse?: boolean
  isLoading?: boolean
  delay?: number
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  trend,
  gradientFrom,
  gradientTo,
  iconBg,
  pulse = false,
  isLoading = false,
  delay = 0
}) => {
  const [displayValue, setDisplayValue] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const targetValue = typeof value === 'number' ? value : parseFloat(value) || 0

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (isLoading || typeof value === 'string') {
      return
    }

    const duration = 800
    const steps = 40
    const increment = targetValue / steps
    const stepDuration = duration / steps

    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      if (currentStep >= steps) {
        setDisplayValue(targetValue)
        clearInterval(timer)
      } else {
        setDisplayValue(prev => Math.min(prev + increment, targetValue))
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [targetValue, isLoading, value])

  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-3 h-3" />
    if (trend > 0) return <TrendingUp className="w-3 h-3" />
    return <TrendingDown className="w-3 h-3" />
  }

  const getTrendColor = () => {
    if (!trend) return 'text-slate-400'
    if (trend > 0) return 'text-emerald-500'
    return 'text-red-500'
  }

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/50',
        'bg-white dark:bg-slate-800',
        'transition-all duration-500 ease-out',
        'hover:shadow-card-hover hover:-translate-y-1',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {/* Gradient Top Border */}
      <div
        className={clsx(
          'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r',
          `from-${gradientFrom} to-${gradientTo}`
        )}
        style={{
          background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`
        }}
      />

      {/* Pulse Effect */}
      {pulse && (
        <div className="absolute inset-0 animate-pulse-soft">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}40, transparent)`
            }}
          />
        </div>
      )}

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          {/* Icon */}
          <div
            className={clsx(
              'p-3 rounded-xl transition-transform duration-300 hover:scale-110',
              iconBg
            )}
          >
            {icon}
          </div>

          {/* Trend Badge */}
          {trend !== undefined && (
            <div className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              trend > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : trend < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-700',
              getTrendColor()
            )}>
              {getTrendIcon()}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="space-y-1">
          {isLoading ? (
            <div className="h-9 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ) : (
            <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {typeof value === 'string' ? value : Math.round(displayValue).toLocaleString()}
            </div>
          )}
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {label}
          </div>
        </div>
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

  const metricsData = [
    {
      icon: <PhoneIncoming className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
      label: '오늘 인바운드',
      value: metrics?.today_inbound || 0,
      trend: 12,
      gradientFrom: '#3b82f6',
      gradientTo: '#60a5fa',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      pulse: false,
    },
    {
      icon: <Ticket className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      label: '열린 티켓',
      value: metrics?.open_tickets || 0,
      trend: -5,
      gradientFrom: '#10b981',
      gradientTo: '#34d399',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      pulse: false,
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />,
      label: 'SLA 초과',
      value: metrics?.sla_breached_count || 0,
      gradientFrom: '#ef4444',
      gradientTo: '#f87171',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
      pulse: (metrics?.sla_breached_count || 0) > 0,
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      label: '긴급',
      value: metrics?.urgent_count || 0,
      gradientFrom: '#f59e0b',
      gradientTo: '#fbbf24',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      pulse: (metrics?.urgent_count || 0) > 0,
    },
    {
      icon: <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
      label: '평균 응답시간',
      value: `${avgResponseMin}분`,
      trend: -15,
      gradientFrom: '#8b5cf6',
      gradientTo: '#a78bfa',
      iconBg: 'bg-purple-100 dark:bg-purple-900/40',
      pulse: false,
    },
  ]

  return (
    <div className="w-full">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {metricsData.map((metric, index) => (
          <MetricCard
            key={index}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
            gradientFrom={metric.gradientFrom}
            gradientTo={metric.gradientTo}
            iconBg={metric.iconBg}
            pulse={metric.pulse}
            isLoading={isLoading}
            delay={index * 100}
          />
        ))}
      </div>
    </div>
  )
}

export default MetricsPanel

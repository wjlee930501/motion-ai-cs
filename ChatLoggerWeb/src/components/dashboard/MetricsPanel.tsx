import React, { useEffect, useState } from 'react'
import {
  PhoneIncoming,
  Ticket,
  AlertTriangle,
  Zap,
  Clock
} from 'lucide-react'

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
  color: string
  pulse?: boolean
  isLoading?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  color,
  pulse = false,
  isLoading = false
}) => {
  const [displayValue, setDisplayValue] = useState(0)
  const targetValue = typeof value === 'number' ? value : parseFloat(value) || 0

  useEffect(() => {
    if (isLoading) {
      setDisplayValue(0)
      return
    }

    const duration = 1000 // 1 second animation
    const steps = 60
    const increment = (targetValue - displayValue) / steps
    const stepDuration = duration / steps

    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      if (currentStep >= steps) {
        setDisplayValue(targetValue)
        clearInterval(timer)
      } else {
        setDisplayValue(prev => prev + increment)
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [targetValue, isLoading])

  return (
    <div
      className={`
        relative overflow-hidden
        bg-white rounded-xl border border-gray-200
        p-6
        transition-all duration-300
        hover:shadow-lg hover:scale-105 hover:-translate-y-1
        ${pulse ? 'animate-pulse-border' : ''}
      `}
    >
      {pulse && (
        <div className="absolute inset-0 animate-pulse-glow" />
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`
              p-3 rounded-lg
              ${color}
              transition-transform duration-300
              group-hover:scale-110
            `}
          >
            {icon}
          </div>
        </div>

        <div className="space-y-1">
          <div
            className={`
              text-3xl font-bold
              transition-all duration-500
              ${isLoading ? 'text-gray-300 animate-pulse' : 'text-gray-900'}
            `}
          >
            {isLoading ? (
              <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
            ) : (
              <span className="tabular-nums">
                {typeof value === 'string' ? value : Math.round(displayValue).toLocaleString()}
              </span>
            )}
          </div>

          <div className="text-sm font-medium text-gray-600">
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
      icon: <PhoneIncoming className="w-6 h-6 text-blue-600" />,
      label: '오늘 인바운드',
      value: metrics?.today_inbound || 0,
      color: 'bg-blue-50',
      pulse: false,
    },
    {
      icon: <Ticket className="w-6 h-6 text-green-600" />,
      label: '열린 티켓',
      value: metrics?.open_tickets || 0,
      color: 'bg-green-50',
      pulse: false,
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
      label: 'SLA 초과',
      value: metrics?.sla_breached_count || 0,
      color: 'bg-red-50',
      pulse: (metrics?.sla_breached_count || 0) > 0,
    },
    {
      icon: <Zap className="w-6 h-6 text-orange-600" />,
      label: '긴급',
      value: metrics?.urgent_count || 0,
      color: 'bg-orange-50',
      pulse: (metrics?.urgent_count || 0) > 0,
    },
    {
      icon: <Clock className="w-6 h-6 text-purple-600" />,
      label: '평균 응답시간',
      value: `${avgResponseMin}분`,
      color: 'bg-purple-50',
      pulse: false,
    },
  ]

  return (
    <div className="w-full">
      <div
        className="
          grid gap-4
          grid-cols-2
          sm:grid-cols-3
          lg:grid-cols-5
        "
      >
        {metricsData.map((metric, index) => (
          <MetricCard
            key={index}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            color={metric.color}
            pulse={metric.pulse}
            isLoading={isLoading}
          />
        ))}
      </div>

{/* Pulse animation styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-border {
          0%, 100% { border-color: rgb(239, 68, 68); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { border-color: rgb(220, 38, 38); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.1; }
        }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse-border, .animate-pulse-glow { animation: none; }
        }
      `}} />
    </div>
  )
}

export default MetricsPanel

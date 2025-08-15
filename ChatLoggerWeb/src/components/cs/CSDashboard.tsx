import React from 'react'
import { CSStats } from '@/types/cs.types'
import { 
  FiUsers, 
  FiClock, 
  FiCheckCircle, 
  FiAlertCircle,
  FiTrendingUp,
  FiTrendingDown,
  FiMessageCircle,
  FiSmile
} from 'react-icons/fi'
import clsx from 'clsx'

interface CSDashboardProps {
  stats: CSStats
}

export const CSDashboard: React.FC<CSDashboardProps> = ({ stats }) => {
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}분`
    return `${Math.round(minutes / 60)}시간 ${Math.round(minutes % 60)}분`
  }

  const TrendIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null
    const isPositive = value > 0
    return (
      <span className={clsx(
        'flex items-center text-sm ml-2',
        isPositive ? 'text-green-600' : 'text-red-600'
      )}>
        {isPositive ? <FiTrendingUp /> : <FiTrendingDown />}
        <span className="ml-1">{Math.abs(value)}%</span>
      </span>
    )
  }

  const StatCard = ({ 
    icon, 
    title, 
    value, 
    trend, 
    color,
    subtext 
  }: {
    icon: React.ReactNode
    title: string
    value: string | number
    trend?: number
    color: string
    subtext?: string
  }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
        {trend !== undefined && <TrendIndicator value={trend} />}
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtext && (
          <p className="text-xs text-gray-500 mt-1">{subtext}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiMessageCircle className="text-white text-xl" />}
          title="전체 문의"
          value={stats.totalInquiries}
          trend={stats.totalInquiriesTrend}
          color="bg-blue-500"
          subtext="오늘 접수된 문의"
        />
        
        <StatCard
          icon={<FiCheckCircle className="text-white text-xl" />}
          title="해결 완료"
          value={stats.resolvedToday}
          trend={stats.resolvedTodayTrend}
          color="bg-green-500"
          subtext="오늘 해결된 문의"
        />
        
        <StatCard
          icon={<FiAlertCircle className="text-white text-xl" />}
          title="대기 중"
          value={stats.pendingInquiries}
          trend={stats.pendingInquiriesTrend}
          color="bg-orange-500"
          subtext="처리 대기 중인 문의"
        />
        
        <StatCard
          icon={<FiSmile className="text-white text-xl" />}
          title="만족도"
          value={`${stats.satisfactionRate}%`}
          trend={stats.satisfactionRateTrend}
          color="bg-purple-500"
          subtext="고객 만족도"
        />
      </div>

      {/* Response Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiClock className="mr-2 text-blue-500" />
            평균 응답 시간
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">첫 응답</span>
              <div className="flex items-center">
                <span className="font-bold text-xl">
                  {formatTime(stats.avgResponseTime)}
                </span>
                <TrendIndicator value={stats.avgResponseTimeTrend} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">해결 시간</span>
              <div className="flex items-center">
                <span className="font-bold text-xl">
                  {formatTime(stats.avgResolutionTime)}
                </span>
                <TrendIndicator value={stats.avgResolutionTimeTrend} />
              </div>
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">문의 카테고리</h3>
          <div className="space-y-2">
            {stats.categoryDistribution.slice(0, 5).map((category) => (
              <div key={category.category} className="flex items-center">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700">
                      {category.category}
                    </span>
                    <span className="text-sm font-medium">
                      {category.count} ({category.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FiUsers className="mr-2 text-blue-500" />
          상담사 현황
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">상담사</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-center">처리 건수</th>
                <th className="px-4 py-3 text-center">평균 응답</th>
                <th className="px-4 py-3 text-center">만족도</th>
                <th className="px-4 py-3 text-center">현재 부하</th>
              </tr>
            </thead>
            <tbody>
              {stats.agentPerformance.map((agent) => (
                <tr key={agent.agentId} className="border-b">
                  <td className="px-4 py-3 font-medium">{agent.agentName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'px-2 py-1 text-xs rounded-full',
                      agent.status === 'online' && 'bg-green-100 text-green-800',
                      agent.status === 'busy' && 'bg-yellow-100 text-yellow-800',
                      agent.status === 'away' && 'bg-gray-100 text-gray-800',
                      agent.status === 'offline' && 'bg-red-100 text-red-800'
                    )}>
                      {agent.status === 'online' && '온라인'}
                      {agent.status === 'busy' && '통화중'}
                      {agent.status === 'away' && '자리비움'}
                      {agent.status === 'offline' && '오프라인'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{agent.totalHandled}</td>
                  <td className="px-4 py-3 text-center">
                    {formatTime(agent.avgResponseTime)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'font-semibold',
                      agent.satisfactionRate >= 90 && 'text-green-600',
                      agent.satisfactionRate >= 70 && agent.satisfactionRate < 90 && 'text-yellow-600',
                      agent.satisfactionRate < 70 && 'text-red-600'
                    )}>
                      {agent.satisfactionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={clsx(
                            'h-2 rounded-full',
                            agent.currentLoad < 50 && 'bg-green-500',
                            agent.currentLoad >= 50 && agent.currentLoad < 80 && 'bg-yellow-500',
                            agent.currentLoad >= 80 && 'bg-red-500'
                          )}
                          style={{ width: `${agent.currentLoad}%` }}
                        />
                      </div>
                      <span className="ml-2 text-xs text-gray-600">
                        {agent.currentLoad}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
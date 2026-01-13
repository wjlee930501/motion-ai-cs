import React, { useState } from 'react'
import {
  FiTrendingUp,
  FiUsers,
  FiClock,
  FiMessageCircle,
  FiBarChart2,
  FiDownload,
  FiCalendar,
  FiStar
} from 'react-icons/fi'
import { format, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import clsx from 'clsx'

interface ConversationAnalysis {
  roomId: string
  roomName: string
  customerName: string
  startTime: number
  endTime: number
  duration: number // minutes
  messageCount: number
  csMessages: number
  customerMessages: number
  firstResponseTime: number // minutes
  avgResponseTime: number // minutes
  sentiment: 'positive' | 'neutral' | 'negative'
  resolved: boolean
  satisfactionScore?: number // 1-5
  keywords: string[]
  csAgent: string
}

interface CSAgentPerformance {
  agentName: string
  totalConversations: number
  avgResponseTime: number
  avgResolutionTime: number
  avgSatisfaction: number
  positiveRatio: number
  messagesSent: number
  workingHours: number
  performanceScore: number // calculated
}

export const CSAnalyticsPage: React.FC = () => {
  const [dateRange] = useState({
    start: subDays(new Date(), 7),
    end: new Date()
  })
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'agents' | 'satisfaction' | 'quality'>('overview')

  // Mock data for demonstration
  const mockConversations: ConversationAnalysis[] = [
    {
      roomId: '1',
      roomName: '김고객님',
      customerName: '김고객',
      startTime: Date.now() - 7200000,
      endTime: Date.now() - 3600000,
      duration: 60,
      messageCount: 24,
      csMessages: 10,
      customerMessages: 14,
      firstResponseTime: 2.5,
      avgResponseTime: 3.2,
      sentiment: 'positive',
      resolved: true,
      satisfactionScore: 5,
      keywords: ['배송', '감사', '친절'],
      csAgent: '이상담'
    },
    {
      roomId: '2',
      roomName: '박고객님',
      customerName: '박고객',
      startTime: Date.now() - 14400000,
      endTime: Date.now() - 10800000,
      duration: 60,
      messageCount: 18,
      csMessages: 8,
      customerMessages: 10,
      firstResponseTime: 5.5,
      avgResponseTime: 6.8,
      sentiment: 'negative',
      resolved: false,
      satisfactionScore: 2,
      keywords: ['불만', '환불', '지연'],
      csAgent: '박지원'
    }
  ]

  const mockAgentPerformance: CSAgentPerformance[] = [
    {
      agentName: '이상담',
      totalConversations: 156,
      avgResponseTime: 3.2,
      avgResolutionTime: 24.5,
      avgSatisfaction: 4.6,
      positiveRatio: 0.85,
      messagesSent: 1248,
      workingHours: 40,
      performanceScore: 92
    },
    {
      agentName: '박지원',
      totalConversations: 142,
      avgResponseTime: 5.8,
      avgResolutionTime: 32.1,
      avgSatisfaction: 4.1,
      positiveRatio: 0.72,
      messagesSent: 1136,
      workingHours: 38,
      performanceScore: 78
    },
    {
      agentName: '김서비스',
      totalConversations: 134,
      avgResponseTime: 4.5,
      avgResolutionTime: 28.3,
      avgSatisfaction: 4.3,
      positiveRatio: 0.78,
      messagesSent: 1072,
      workingHours: 40,
      performanceScore: 83
    }
  ]

  const calculateMetrics = () => {
    const totalConversations = mockConversations.length
    const avgResponseTime = mockConversations.reduce((sum, c) => sum + c.firstResponseTime, 0) / totalConversations
    const avgResolutionTime = mockConversations.reduce((sum, c) => sum + c.duration, 0) / totalConversations
    const resolutionRate = (mockConversations.filter(c => c.resolved).length / totalConversations) * 100
    const avgSatisfaction = mockConversations
      .filter(c => c.satisfactionScore)
      .reduce((sum, c) => sum + (c.satisfactionScore || 0), 0) / 
      mockConversations.filter(c => c.satisfactionScore).length

    return {
      totalConversations,
      avgResponseTime,
      avgResolutionTime,
      resolutionRate,
      avgSatisfaction
    }
  }

  const metrics = calculateMetrics()

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FiMessageCircle className="text-2xl text-blue-500" />
            <span className="text-xs text-green-600">+12%</span>
          </div>
          <div className="text-2xl font-bold">{metrics.totalConversations}</div>
          <div className="text-sm text-gray-600">총 상담 건수</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FiClock className="text-2xl text-green-500" />
            <span className="text-xs text-green-600">-15%</span>
          </div>
          <div className="text-2xl font-bold">{metrics.avgResponseTime.toFixed(1)}분</div>
          <div className="text-sm text-gray-600">평균 첫 응답</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FiTrendingUp className="text-2xl text-purple-500" />
            <span className="text-xs text-green-600">+5%</span>
          </div>
          <div className="text-2xl font-bold">{metrics.resolutionRate.toFixed(0)}%</div>
          <div className="text-sm text-gray-600">해결률</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FiStar className="text-2xl text-yellow-500" />
            <span className="text-xs text-green-600">+0.3</span>
          </div>
          <div className="text-2xl font-bold">{metrics.avgSatisfaction.toFixed(1)}/5</div>
          <div className="text-sm text-gray-600">평균 만족도</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FiUsers className="text-2xl text-orange-500" />
          </div>
          <div className="text-2xl font-bold">{mockAgentPerformance.length}</div>
          <div className="text-sm text-gray-600">활동 상담사</div>
        </div>
      </div>

      {/* Conversation Quality Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">대화 품질 분석</h3>
        <div className="space-y-4">
          {mockConversations.map((conv) => (
            <div key={conv.roomId} className="border-l-4 border-gray-200 pl-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <h4 className="font-medium">{conv.customerName}</h4>
                  <span className="text-sm text-gray-500">
                    {format(conv.startTime, 'MM/dd HH:mm', { locale: ko })}
                  </span>
                  <span className={clsx(
                    'px-2 py-1 text-xs rounded-full',
                    conv.sentiment === 'positive' && 'bg-green-100 text-green-800',
                    conv.sentiment === 'neutral' && 'bg-gray-100 text-gray-800',
                    conv.sentiment === 'negative' && 'bg-red-100 text-red-800'
                  )}>
                    {conv.sentiment === 'positive' && '긍정적'}
                    {conv.sentiment === 'neutral' && '중립적'}
                    {conv.sentiment === 'negative' && '부정적'}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    담당: {conv.csAgent}
                  </span>
                  {conv.satisfactionScore && (
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <FiStar
                          key={i}
                          className={clsx(
                            'text-sm',
                            i < conv.satisfactionScore! ? 'text-yellow-400' : 'text-gray-300'
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">대화 시간:</span>
                  <span className="ml-2 font-medium">{conv.duration}분</span>
                </div>
                <div>
                  <span className="text-gray-500">메시지:</span>
                  <span className="ml-2 font-medium">{conv.messageCount}개</span>
                </div>
                <div>
                  <span className="text-gray-500">첫 응답:</span>
                  <span className="ml-2 font-medium">{conv.firstResponseTime}분</span>
                </div>
                <div>
                  <span className="text-gray-500">평균 응답:</span>
                  <span className="ml-2 font-medium">{conv.avgResponseTime}분</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {conv.keywords.map((keyword, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-gray-100 rounded">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderAgentPerformance = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">CS 멤버 성과 평가</h3>
      
      {/* Performance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">상담사</th>
              <th className="px-6 py-3 text-center">상담 건수</th>
              <th className="px-6 py-3 text-center">평균 응답시간</th>
              <th className="px-6 py-3 text-center">해결 시간</th>
              <th className="px-6 py-3 text-center">만족도</th>
              <th className="px-6 py-3 text-center">긍정 비율</th>
              <th className="px-6 py-3 text-center">성과 점수</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mockAgentPerformance.map((agent) => (
              <tr key={agent.agentName} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{agent.agentName}</div>
                  <div className="text-sm text-gray-500">
                    {agent.workingHours}시간 근무
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm font-medium">{agent.totalConversations}</div>
                  <div className="text-xs text-gray-500">
                    {(agent.totalConversations / agent.workingHours).toFixed(1)}/시간
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className={clsx(
                    'text-sm font-medium',
                    agent.avgResponseTime < 4 && 'text-green-600',
                    agent.avgResponseTime >= 4 && agent.avgResponseTime < 6 && 'text-yellow-600',
                    agent.avgResponseTime >= 6 && 'text-red-600'
                  )}>
                    {agent.avgResponseTime.toFixed(1)}분
                  </div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  {agent.avgResolutionTime.toFixed(1)}분
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    <FiStar className="text-yellow-400 mr-1" />
                    <span className="text-sm font-medium">
                      {agent.avgSatisfaction.toFixed(1)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm">
                    {(agent.positiveRatio * 100).toFixed(0)}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${agent.positiveRatio * 100}%` }}
                    />
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={clsx(
                    'px-3 py-1 text-sm font-medium rounded-full',
                    agent.performanceScore >= 90 && 'bg-green-100 text-green-800',
                    agent.performanceScore >= 70 && agent.performanceScore < 90 && 'bg-yellow-100 text-yellow-800',
                    agent.performanceScore < 70 && 'bg-red-100 text-red-800'
                  )}>
                    {agent.performanceScore}점
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Individual Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockAgentPerformance.map((agent) => (
          <div key={agent.agentName} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-lg">{agent.agentName}</h4>
              <span className={clsx(
                'px-2 py-1 text-xs rounded-full',
                agent.performanceScore >= 90 && 'bg-green-100 text-green-800',
                agent.performanceScore >= 70 && agent.performanceScore < 90 && 'bg-yellow-100 text-yellow-800',
                agent.performanceScore < 70 && 'bg-red-100 text-red-800'
              )}>
                상위 {100 - Math.round((mockAgentPerformance.indexOf(agent) + 1) / mockAgentPerformance.length * 100)}%
              </span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">일평균 처리</span>
                <span className="font-medium">
                  {(agent.totalConversations / 7).toFixed(0)}건
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">메시지 전송</span>
                <span className="font-medium">{agent.messagesSent}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">생산성</span>
                <div className="flex items-center">
                  <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(agent.totalConversations / 200) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {((agent.totalConversations / 200) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">개선 포인트</div>
              <div className="mt-1 text-sm">
                {agent.avgResponseTime > 5 && '응답 시간 단축 필요'}
                {agent.avgSatisfaction < 4 && '고객 만족도 개선 필요'}
                {agent.positiveRatio < 0.7 && '긍정적 대화 유도 필요'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSatisfactionAnalysis = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">고객 만족도 분석</h3>

      {/* Satisfaction Distribution */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-medium mb-4">만족도 분포</h4>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = mockConversations.filter(c => c.satisfactionScore === score).length
            const percentage = (count / mockConversations.filter(c => c.satisfactionScore).length) * 100
            
            return (
              <div key={score} className="flex items-center">
                <div className="flex items-center w-20">
                  {[...Array(score)].map((_, i) => (
                    <FiStar key={i} className="text-yellow-400 text-sm" />
                  ))}
                </div>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 rounded-full h-6">
                    <div 
                      className={clsx(
                        'h-6 rounded-full flex items-center justify-end pr-2',
                        score >= 4 && 'bg-green-500',
                        score === 3 && 'bg-yellow-500',
                        score <= 2 && 'bg-red-500'
                      )}
                      style={{ width: `${percentage || 0}%` }}
                    >
                      <span className="text-xs text-white font-medium">
                        {percentage > 0 ? `${percentage.toFixed(0)}%` : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {count}건
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sentiment Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-medium mb-4">감정 분석</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-4xl mb-2">😊</div>
            <div className="text-2xl font-bold text-green-600">
              {mockConversations.filter(c => c.sentiment === 'positive').length}
            </div>
            <div className="text-sm text-gray-600">긍정적</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">😐</div>
            <div className="text-2xl font-bold text-gray-600">
              {mockConversations.filter(c => c.sentiment === 'neutral').length}
            </div>
            <div className="text-sm text-gray-600">중립적</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">😞</div>
            <div className="text-2xl font-bold text-red-600">
              {mockConversations.filter(c => c.sentiment === 'negative').length}
            </div>
            <div className="text-sm text-gray-600">부정적</div>
          </div>
        </div>
      </div>

      {/* Keywords Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-medium mb-4">주요 키워드</h4>
        <div className="flex flex-wrap gap-2">
          {['배송', '환불', '감사', '친절', '불만', '지연', '품질', '가격', '서비스', '앱오류'].map((keyword) => {
            const count = Math.floor(Math.random() * 20) + 1
            return (
              <span 
                key={keyword}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {keyword} ({count})
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CS 로그 분석 시스템</h1>
            <p className="text-sm text-gray-600 mt-1">
              카카오톡 상담 로그 기반 품질 분석 및 성과 평가
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
              <FiCalendar className="text-gray-600" />
              <span className="text-sm">
                {format(dateRange.start, 'MM/dd')} - {format(dateRange.end, 'MM/dd')}
              </span>
            </div>
            
            <button className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <FiDownload className="mr-2" />
              리포트 다운로드
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: '종합 분석', icon: FiBarChart2 },
            { id: 'agents', label: 'CS 멤버 평가', icon: FiUsers },
            { id: 'satisfaction', label: '고객 만족도', icon: FiStar },
            { id: 'quality', label: '대화 품질', icon: FiMessageCircle }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedMetric(tab.id as any)}
              className={clsx(
                'flex items-center py-4 border-b-2 transition-colors',
                selectedMetric === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {selectedMetric === 'overview' && renderOverview()}
        {selectedMetric === 'agents' && renderAgentPerformance()}
        {selectedMetric === 'satisfaction' && renderSatisfactionAnalysis()}
        {selectedMetric === 'quality' && renderOverview()}
      </div>
    </div>
  )
}
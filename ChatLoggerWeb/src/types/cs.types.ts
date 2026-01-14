// CS Team specific types

import { ChatRoom, ChatMessage } from './index'

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  registrationDate: string
  tier: 'VIP' | 'Premium' | 'Regular' | 'New'
  totalInquiries: number
  lastContactDate: number
  tags: string[]
  notes?: string
}

export interface CSRoom extends ChatRoom {
  customerId?: string
  customer?: Customer
  status: 'onboarding' | 'stable' | 'churn_risk' | 'important'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  assignedTo?: string
  category?: string
  tags: string[]
  responseTime?: number
  resolutionTime?: number
  satisfaction?: number
  firstResponseAt?: number
  resolvedAt?: number
  lastMessageSender?: string // 마지막 메시지 발신자 (고객/멤버 구분용)
  lastCustomerMessageAt?: number // 고객의 마지막 메시지 시간 (응답 대기 시간 계산용)
}

export interface CSMessage extends ChatMessage {
  messageType: 'customer' | 'agent' | 'system' | 'auto_reply'
  sentiment?: 'positive' | 'neutral' | 'negative'
  intent?: string
  suggestedResponses?: string[]
  isFirstResponse?: boolean
}

export interface ResponseTemplate {
  id: string
  title: string
  content: string
  category: string
  keywords: string[]
  usage: number
  lastUsed?: number
}

export interface CSStats {
  totalInquiries: number
  totalInquiriesTrend: number // percentage change
  resolvedToday: number
  resolvedTodayTrend: number
  pendingInquiries: number
  pendingInquiriesTrend: number
  avgResponseTime: number // in minutes
  avgResponseTimeTrend: number
  avgResolutionTime: number // in minutes
  avgResolutionTimeTrend: number
  satisfactionRate: number // 0-100
  satisfactionRateTrend: number
  agentPerformance: AgentPerformance[]
  hourlyDistribution: HourlyData[]
  categoryDistribution: CategoryData[]
}

export interface AgentPerformance {
  agentId: string
  agentName: string
  totalHandled: number
  avgResponseTime: number
  avgResolutionTime: number
  satisfactionRate: number
  currentLoad: number
  status: 'online' | 'busy' | 'away' | 'offline'
}

export interface HourlyData {
  hour: string
  count: number
}

export interface CategoryData {
  category: string
  count: number
  percentage: number
}

export interface CSConfig {
  autoAssignment: boolean
  maxConcurrentChats: number
  responseTimeTarget: number // minutes
  workingHours: {
    start: string
    end: string
  }
  escalationRules: {
    responseTimeThreshold: number
    keywords: string[]
  }
  categories: string[]
  tags: string[]
}
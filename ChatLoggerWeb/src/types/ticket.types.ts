// Ticket types for new FastAPI backend

export interface User {
  id: number
  email: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  ok: boolean
  token: string
  user: User
}

export interface Ticket {
  ticket_id: string
  clinic_key: string
  status: 'onboarding' | 'stable' | 'churn_risk' | 'important'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  topic_primary?: string
  summary_latest?: string
  intent?: string // 고객 메시지 의도 (질문/요청/자료전송/기타)
  next_action?: string
  first_inbound_at?: string
  first_response_sec?: number
  last_inbound_at?: string
  last_outbound_at?: string
  last_message_sender?: string // 마지막 메시지 발송자 이름
  needs_reply: boolean // 답변이 필요한 상태인지 (LLM 판단 기반)
  sla_breached: boolean
  sla_remaining_sec?: number
  created_at?: string
  updated_at?: string
}

export interface TicketListResponse {
  ok: boolean
  tickets: Ticket[]
  total: number
  page: number
}

export interface TicketDetailResponse {
  ok: boolean
  ticket: Ticket
}

export interface TicketUpdate {
  status?: string
  priority?: string
  next_action?: string
}

export interface TicketEvent {
  event_id: string
  sender_name: string
  sender_type: 'staff' | 'customer'
  staff_member?: string
  text_raw: string
  received_at: string
}

export interface TicketEventsResponse {
  ok: boolean
  events: TicketEvent[]
}

export interface Metrics {
  today_inbound: number
  sla_breached_count: number
  urgent_count: number
  open_tickets: number
  avg_response_sec?: number
}

export interface MetricsResponse {
  ok: boolean
  metrics: Metrics
}

export interface ClinicHealth {
  clinic_key: string
  today_inbound: number
  sla_breached: number
  urgent_count: number
  open_tickets: number
}

export interface ClinicsHealthResponse {
  ok: boolean
  clinics: ClinicHealth[]
}

export interface TicketFilters {
  status?: string
  priority?: string
  clinic_key?: string
  sla_breached?: boolean
  page?: number
  limit?: number
}

// API Error
export interface ApiError {
  ok: false
  error: {
    code: string
    message: string
  }
}

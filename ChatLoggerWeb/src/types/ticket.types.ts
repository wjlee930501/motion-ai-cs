// Ticket types for new FastAPI backend

export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'member'
}

export interface UserCreate {
  email: string
  password: string
  name: string
  role?: 'admin' | 'member'
}

export interface UserUpdate {
  email?: string
  password?: string
  name?: string
  role?: 'admin' | 'member'
}

export interface UserListResponse {
  ok: boolean
  users: User[]
}

export interface UserResponse {
  ok: boolean
  user: User
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
  needs_reply?: boolean
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

// Message Templates
export type TemplateCategory = '인사' | '안내' | '문제해결' | '마무리' | '기타'

export interface Template {
  id: number
  title: string
  content: string
  category: TemplateCategory
  usage_count: number
  created_at: string
}

export interface TemplateCreate {
  title: string
  content: string
  category: TemplateCategory
}

export interface TemplateUpdate {
  title?: string
  content?: string
  category?: TemplateCategory
}

export interface TemplateListResponse {
  ok: boolean
  templates: Template[]
}

export interface TemplateResponse {
  ok: boolean
  template: Template
}

export interface TemplateCategoryCount {
  name: TemplateCategory
  count: number
}

export interface TemplateCategoriesResponse {
  ok: boolean
  categories: TemplateCategoryCount[]
}

// Learning System v2 Types

export type IntentType =
  | 'inquiry_status'
  | 'request_action'
  | 'request_change'
  | 'complaint'
  | 'question_how'
  | 'question_when'
  | 'follow_up'
  | 'provide_info'
  | 'acknowledgment'
  | 'greeting'
  | 'internal_discussion'
  | 'reaction'
  | 'confirmation_received'
  | 'other'

export interface FeedbackCreate {
  event_id: string
  corrected_intent?: IntentType
  corrected_needs_reply?: boolean
  corrected_topic?: string
}

export interface ClassificationFeedback {
  id: string
  event_id: string
  ticket_id: string
  original_intent: string
  original_needs_reply: boolean
  original_topic?: string
  corrected_intent?: string
  corrected_needs_reply?: boolean
  corrected_topic?: string
  feedback_type: 'correction' | 'confirmation' | 'rejection'
  corrected_by?: number
  corrected_at: string
  applied_to_version?: number
}

export interface FeedbackResponse {
  ok: boolean
  feedback: ClassificationFeedback
}

export interface FeedbackListResponse {
  ok: boolean
  feedbacks: ClassificationFeedback[]
  total: number
}

export interface FeedbackStats {
  total_feedback: number
  pending_application: number
  applied: number
  by_type: Record<string, number>
  top_corrections: Array<{ from: string; to: string; count: number }>
}

export interface FeedbackStatsResponse {
  ok: boolean
  statistics: FeedbackStats
}

export interface Pattern {
  id: string
  understanding_version: number
  pattern_type: 'skip_llm' | 'internal_marker' | 'confirmation' | 'new_intent'
  pattern_data: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  auto_approved: boolean
  reviewed_by?: number
  reviewed_at?: string
  applied_at?: string
  created_at: string
}

export interface PatternListResponse {
  ok: boolean
  patterns: Pattern[]
}

export interface PatternActionResponse {
  ok: boolean
  pattern: Pattern
}

export interface PatternApplyResponse {
  ok: boolean
  applied: {
    skip_llm_patterns: number
    internal_markers: number
    new_intents: number
    applied_at?: string
    errors?: Array<{ pattern_id: string; error: string }>
  }
}

export interface KeyInsights {
  version?: string
  internal_discussion_markers?: Array<{
    pattern: string
    type: string
    description?: string
    confidence: number
    example_count?: number
  }>
  confirmation_patterns?: Array<{
    trigger_message: string
    closing_response: string
    is_closing: boolean
    confidence: number
  }>
  skip_llm_candidates?: Array<{
    pattern: string
    intent: string
    needs_reply: boolean
    confidence: number
    example_count?: number
  }>
  new_intent_candidates?: Array<{
    suggested_name: string
    description_ko: string
    examples?: string[]
    parent_intent?: string
    needs_reply: boolean
    frequency: number
    confidence: number
  }>
  topic_statistics?: Record<string, { count: number; avg_urgency: string }>
  misclassification_learnings?: Array<{
    original_intent: string
    corrected_intent: string
    pattern: string
    lesson: string
  }>
}

export interface InsightsResponse {
  ok: boolean
  version: number
  created_at: string
  insights?: KeyInsights
}

import axios, { AxiosInstance } from 'axios'
import {
  LoginRequest,
  LoginResponse,
  User,
  UserCreate,
  UserUpdate,
  UserListResponse,
  UserResponse,
  TicketListResponse,
  TicketDetailResponse,
  TicketUpdate,
  TicketEventsResponse,
  MetricsResponse,
  ClinicsHealthResponse,
  TicketFilters,
} from '@/types/ticket.types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class TicketApiService {
  private api: AxiosInstance
  private token: string | null = null

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Load token from localStorage
    this.token = localStorage.getItem('cs_token')

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`
      }
      return config
    })

    // Add response interceptor for auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.logout()
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // ============================================
  // Auth
  // ============================================

  async login(request: LoginRequest): Promise<LoginResponse> {
    const { data } = await this.api.post<LoginResponse>('/auth/login', request)
    if (data.ok && data.token) {
      this.token = data.token
      localStorage.setItem('cs_token', data.token)
      localStorage.setItem('cs_user', JSON.stringify(data.user))
    }
    return data
  }

  logout(): void {
    this.token = null
    localStorage.removeItem('cs_token')
    localStorage.removeItem('cs_user')
  }

  isAuthenticated(): boolean {
    return !!this.token
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('cs_user')
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch {
        return null
      }
    }
    return null
  }

  // ============================================
  // Users (Admin Only for create/update/delete)
  // ============================================

  async getUsers(): Promise<UserListResponse> {
    const { data } = await this.api.get<UserListResponse>('/v1/users')
    return data
  }

  async createUser(user: UserCreate): Promise<UserResponse> {
    const { data } = await this.api.post<UserResponse>('/v1/users', user)
    return data
  }

  async updateUser(userId: number, update: UserUpdate): Promise<UserResponse> {
    const { data } = await this.api.put<UserResponse>(`/v1/users/${userId}`, update)
    return data
  }

  async deleteUser(userId: number): Promise<{ ok: boolean; message: string }> {
    const { data } = await this.api.delete(`/v1/users/${userId}`)
    return data
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser()
    return user?.role === 'admin'
  }

  // ============================================
  // Tickets
  // ============================================

  async getTickets(filters?: TicketFilters): Promise<TicketListResponse> {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.priority) params.append('priority', filters.priority)
    if (filters?.clinic_key) params.append('clinic_key', filters.clinic_key)
    if (filters?.sla_breached !== undefined) params.append('sla_breached', String(filters.sla_breached))
    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.limit) params.append('limit', String(filters.limit))

    const { data } = await this.api.get<TicketListResponse>(`/v1/tickets?${params.toString()}`)
    return data
  }

  async getTicket(ticketId: string): Promise<TicketDetailResponse> {
    const { data } = await this.api.get<TicketDetailResponse>(`/v1/tickets/${ticketId}`)
    return data
  }

  async updateTicket(ticketId: string, update: TicketUpdate): Promise<TicketDetailResponse> {
    const { data } = await this.api.patch<TicketDetailResponse>(`/v1/tickets/${ticketId}`, update)
    return data
  }

  async getTicketEvents(ticketId: string): Promise<TicketEventsResponse> {
    const { data } = await this.api.get<TicketEventsResponse>(`/v1/tickets/${ticketId}/events`)
    return data
  }

  // ============================================
  // Metrics
  // ============================================

  async getMetrics(): Promise<MetricsResponse> {
    const { data } = await this.api.get<MetricsResponse>('/v1/metrics/overview')
    return data
  }

  async getClinicsHealth(): Promise<ClinicsHealthResponse> {
    const { data } = await this.api.get<ClinicsHealthResponse>('/v1/clinics/health')
    return data
  }

  // ============================================
  // Health
  // ============================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.api.get('/health')
      return true
    } catch {
      return false
    }
  }
}

export const ticketApi = new TicketApiService()
export default ticketApi

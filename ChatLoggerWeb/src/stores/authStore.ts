import { create } from 'zustand'
import { AxiosError } from 'axios'
import { User } from '@/types/ticket.types'
import ticketApi from '@/services/ticketApi'

interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Computed
  isAdmin: boolean

  // Actions
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isAdmin: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await ticketApi.login({ email, password })
      if (response.ok) {
        set({
          user: response.user,
          isAuthenticated: true,
          isAdmin: response.user.role === 'admin',
          isLoading: false,
        })
        return true
      } else {
        set({
          error: '로그인에 실패했습니다.',
          isLoading: false,
        })
        return false
      }
    } catch (error) {
      const axiosError = error as AxiosError<ApiErrorResponse>
      const message = axiosError.response?.data?.error?.message || '로그인에 실패했습니다.'
      set({
        error: message,
        isLoading: false,
      })
      return false
    }
  },

  logout: () => {
    ticketApi.logout()
    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      error: null,
    })
  },

  checkAuth: () => {
    const isAuthenticated = ticketApi.isAuthenticated()
    const user = ticketApi.getCurrentUser()
    set({
      isAuthenticated,
      user,
      isAdmin: user?.role === 'admin',
    })
  },
}))

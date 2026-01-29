export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const API_TIMEOUT_MS = 10000

export const REFETCH_INTERVALS_MS = {
  tickets: 10000,
  ticketEvents: 5000,
  metrics: 30000,
} as const

export const WAITING_TIME_THRESHOLDS_MIN = {
  warning: 15,
  danger: 30,
} as const

export const STORAGE_KEYS = {
  token: 'cs_token',
  user: 'cs_user',
} as const

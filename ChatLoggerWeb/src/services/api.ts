import axios from 'axios'
import { ChatRoom, ChatMessage, SyncData, Stats } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const chatApi = {
  // Get all chat rooms
  getRooms: async (): Promise<ChatRoom[]> => {
    const { data } = await api.get('/api/rooms')
    return data
  },

  // Get messages for a specific room
  getMessages: async (roomId: string): Promise<ChatMessage[]> => {
    const { data } = await api.get(`/api/rooms/${roomId}/messages`)
    return data
  },

  // Get all sync data
  getSyncData: async (): Promise<SyncData> => {
    const { data } = await api.get('/api/sync')
    return data
  },

  // Search messages
  searchMessages: async (query: string): Promise<ChatMessage[]> => {
    const { data } = await api.get('/api/search', { params: { q: query } })
    return data
  },

  // Get statistics
  getStats: async (): Promise<Stats> => {
    const { data } = await api.get('/api/stats')
    return data
  },

  // Health check
  healthCheck: async (): Promise<boolean> => {
    try {
      await api.get('/health')
      return true
    } catch {
      return false
    }
  },
}

export default api
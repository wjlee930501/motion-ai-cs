import { create } from 'zustand'
import { ChatRoom, ChatMessage } from '@/types'
import { chatApi } from '@/services/api'

interface ChatStore {
  rooms: ChatRoom[]
  currentRoom: ChatRoom | null
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  searchQuery: string
  
  // Actions
  fetchRooms: () => Promise<void>
  fetchMessages: (roomId: string) => Promise<void>
  setCurrentRoom: (room: ChatRoom | null) => void
  searchMessages: (query: string) => Promise<void>
  syncData: () => Promise<void>
  clearError: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  rooms: [],
  currentRoom: null,
  messages: [],
  loading: false,
  error: null,
  searchQuery: '',

  fetchRooms: async () => {
    set({ loading: true, error: null })
    try {
      const rooms = await chatApi.getRooms()
      set({ rooms, loading: false })
    } catch (error) {
      set({ error: 'Failed to fetch rooms', loading: false })
    }
  },

  fetchMessages: async (roomId: string) => {
    set({ loading: true, error: null })
    try {
      const messages = await chatApi.getMessages(roomId)
      const room = get().rooms.find(r => r.id === roomId)
      set({ 
        messages, 
        currentRoom: room || null,
        loading: false 
      })
    } catch (error) {
      set({ error: 'Failed to fetch messages', loading: false })
    }
  },

  setCurrentRoom: (room) => {
    set({ currentRoom: room })
    if (room) {
      get().fetchMessages(room.id)
    }
  },

  searchMessages: async (query: string) => {
    set({ loading: true, error: null, searchQuery: query })
    try {
      const messages = await chatApi.searchMessages(query)
      set({ messages, loading: false })
    } catch (error) {
      set({ error: 'Search failed', loading: false })
    }
  },

  syncData: async () => {
    set({ loading: true, error: null })
    try {
      const syncData = await chatApi.getSyncData()
      set({ 
        rooms: syncData.rooms,
        loading: false 
      })
    } catch (error) {
      set({ error: 'Sync failed', loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
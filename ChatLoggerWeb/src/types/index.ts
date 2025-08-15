export interface ChatRoom {
  id: string
  roomName: string
  lastMessageAt: number
  lastMessage: string | null
  unreadCount: number
}

export interface ChatMessage {
  id: string
  roomId: string
  timestamp: number
  sender: string
  body: string
  rawJson: string | null
  isFromMe: boolean
}

export interface SyncData {
  rooms: ChatRoom[]
  messages: ChatMessage[]
}

export interface Stats {
  roomCount: number
  messageCount: number
  lastUpdate: number
}
import { io, Socket } from 'socket.io-client'
import { ChatMessage, ChatRoom } from '@/types'

class WebSocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<Function>> = new Map()

  connect(url: string = 'ws://localhost:8081') {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.emit('connected', true)
    })

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      this.emit('connected', false)
    })

    this.socket.on('new_message', (message: ChatMessage) => {
      this.emit('new_message', message)
    })

    this.socket.on('room_updated', (room: ChatRoom) => {
      this.emit('room_updated', room)
    })

    this.socket.on('sync_update', (data: any) => {
      this.emit('sync_update', data)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }

  sendMessage(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }
}

export const wsService = new WebSocketService()
export default wsService
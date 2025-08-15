import { ChatMessage, ChatRoom } from '@/types'

class WebSocketService {
  private socket: WebSocket | null = null
  private listeners: Map<string, Set<Function>> = new Map()
  private reconnectTimeout: NodeJS.Timeout | null = null
  private url: string = ''

  connect(url: string = import.meta.env.VITE_WS_URL || 'ws://localhost:8081') {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return
    }

    this.url = url
    this.socket = new WebSocket(url)

    this.socket.onopen = () => {
      console.log('WebSocket connected')
      this.emit('connected', true)
      // Send ping to keep connection alive
      this.sendMessage('ping', {})
    }

    this.socket.onclose = () => {
      console.log('WebSocket disconnected')
      this.emit('connected', false)
      this.reconnect()
    }

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    }

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const eventName = data.event
        
        switch (eventName) {
          case 'new_message':
            this.emit('new_message', data.data)
            break
          case 'room_updated':
            this.emit('room_updated', data.data)
            break
          case 'rooms_update':
            this.emit('rooms_update', data.data)
            break
          case 'initial_sync':
            this.emit('initial_sync', data.data)
            break
          case 'messages':
            this.emit('messages', data.data)
            break
          case 'pong':
            // Handle pong response
            break
          default:
            console.log('Unknown event:', eventName, data)
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  private reconnect() {
    if (this.reconnectTimeout) {
      return
    }
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      console.log('Attempting to reconnect...')
      this.connect(this.url)
    }, 3000)
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
    if (this.socket?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ event, ...data })
      this.socket.send(message)
    }
  }
  
  getMessages(roomId: string) {
    this.sendMessage('get_messages', { roomId })
  }
}

export const wsService = new WebSocketService()
export default wsService
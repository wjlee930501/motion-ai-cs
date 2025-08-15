import React, { useEffect, useRef } from 'react'
import { ChatMessage } from '@/types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface ChatMessageListProps {
  messages: ChatMessage[]
  roomName?: string
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  roomName,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [date: string]: ChatMessage[] } = {}
    
    messages.forEach((message) => {
      const date = format(message.timestamp, 'yyyy년 MM월 dd일')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    })
    
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <div className="flex-1 bg-gray-50 flex flex-col">
      {roomName && (
        <div className="bg-white border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold">{roomName}</h2>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            메시지가 없습니다
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, dayMessages]) => (
            <div key={date}>
              <div className="text-center my-4">
                <span className="inline-block px-3 py-1 text-xs text-gray-500 bg-white rounded-full border border-gray-200">
                  {date}
                </span>
              </div>
              
              {dayMessages.map((message) => (
                <div
                  key={message.id}
                  className={clsx(
                    'flex mb-3',
                    message.isFromMe ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={clsx(
                      'max-w-[70%] space-y-1',
                      message.isFromMe ? 'items-end' : 'items-start'
                    )}
                  >
                    {!message.isFromMe && (
                      <div className="text-sm text-gray-600 px-1">
                        {message.sender}
                      </div>
                    )}
                    
                    <div className="flex items-end gap-2">
                      {message.isFromMe && (
                        <span className="text-xs text-gray-500">
                          {format(message.timestamp, 'HH:mm')}
                        </span>
                      )}
                      
                      <div
                        className={clsx(
                          'px-3 py-2 rounded-2xl break-words',
                          message.isFromMe
                            ? 'bg-kakao-yellow'
                            : 'bg-white border border-gray-200'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">
                          {message.body}
                        </p>
                      </div>
                      
                      {!message.isFromMe && (
                        <span className="text-xs text-gray-500">
                          {format(message.timestamp, 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
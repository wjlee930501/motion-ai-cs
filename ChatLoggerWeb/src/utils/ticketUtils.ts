import { differenceInMinutes } from 'date-fns'
import { Ticket } from '@/types/ticket.types'

export function checkNeedsReply(ticket: Ticket): boolean {
  return ticket.needs_reply
}

export interface WaitingTime {
  minutes: number
  display: string
}

export function getWaitingTime(ticket: Ticket): WaitingTime | null {
  if (!checkNeedsReply(ticket)) return null

  const customerMessageTime = ticket.last_inbound_at
  if (!customerMessageTime) return null

  const minutes = differenceInMinutes(Date.now(), new Date(customerMessageTime))

  if (minutes < 1) {
    return { minutes, display: '방금 전' }
  } else if (minutes < 60) {
    return { minutes, display: `${minutes}분 대기` }
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return { minutes, display: `${hours}시간 ${remainingMinutes}분 대기` }
  }
}

export function formatMessageTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()

    const kstOptions = { timeZone: 'Asia/Seoul' }
    const dateKST = date.toLocaleDateString('ko-KR', kstOptions)
    const nowKST = now.toLocaleDateString('ko-KR', kstOptions)
    const isToday = dateKST === nowKST

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return ''
  }
}

export function sortTicketsByPriority(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    if (a.needs_reply !== b.needs_reply) {
      return a.needs_reply ? -1 : 1
    }

    if (a.needs_reply && b.needs_reply) {
      const aTime = a.last_inbound_at ? new Date(a.last_inbound_at).getTime() : 0
      const bTime = b.last_inbound_at ? new Date(b.last_inbound_at).getTime() : 0
      return aTime - bTime
    }

    const aTime = a.last_outbound_at ? new Date(a.last_outbound_at).getTime() : 0
    const bTime = b.last_outbound_at ? new Date(b.last_outbound_at).getTime() : 0
    return bTime - aTime
  })
}

export function hasSlaBreach(ticket: Ticket): boolean {
  if (!checkNeedsReply(ticket)) return false
  return ticket.sla_breached || (ticket.sla_remaining_sec !== undefined && ticket.sla_remaining_sec < 0)
}

export function isUrgentTicket(ticket: Ticket): boolean {
  return checkNeedsReply(ticket) && ticket.priority === 'urgent'
}

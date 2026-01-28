export const STATUS_CONFIG = {
  onboarding: {
    label: '온보딩',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    bgSolid: 'bg-blue-100 dark:bg-blue-900/40',
    dot: 'bg-blue-500',
  },
  stable: {
    label: '안정기',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    bgSolid: 'bg-emerald-100 dark:bg-emerald-900/40',
    dot: 'bg-emerald-500',
  },
  churn_risk: {
    label: '이탈우려',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    bgSolid: 'bg-orange-100 dark:bg-orange-900/40',
    dot: 'bg-orange-500',
  },
  important: {
    label: '중요',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    bgSolid: 'bg-purple-100 dark:bg-purple-900/40',
    dot: 'bg-purple-500',
  },
} as const

export type TicketStatus = keyof typeof STATUS_CONFIG

export const PRIORITY_COLORS = {
  urgent: 'text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-400',
  high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400',
  normal: 'text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-400',
  low: 'text-slate-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-500',
} as const

export type TicketPriority = keyof typeof PRIORITY_COLORS

export const STATUS_OPTIONS = [
  { value: 'onboarding', label: '🔵 온보딩' },
  { value: 'stable', label: '🟢 안정기' },
  { value: 'churn_risk', label: '🟠 이탈우려' },
  { value: 'important', label: '🟣 중요' },
] as const

export const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '🔴 긴급' },
  { value: 'high', label: '🟠 높음' },
  { value: 'normal', label: '⚪ 보통' },
  { value: 'low', label: '⚫ 낮음' },
] as const

export const UI_LABELS = {
  filter: {
    all: '전체',
    needsReply: '대기',
    replied: '완료',
  },
  ticketList: {
    title: '대화 목록',
    empty: '모든 티켓을 처리했습니다',
    emptyDescription: '현재 대기 중인 문의가 없습니다.\n새로운 문의가 들어오면 자동으로 표시됩니다.',
    monitoring: '실시간 모니터링 중',
  },
  ticketDetail: {
    selectPrompt: '대화를 선택하세요',
    selectDescription: '왼쪽 목록에서 대화를 선택하면 상세 내역이 여기에 표시됩니다',
    noMessages: '아직 대화 내역이 없습니다',
    waitingForMessage: '첫 메시지를 기다리는 중...',
    needsReplyLabel: '답변 필요 여부',
  },
  time: {
    justNow: '방금 전',
    minutesWaiting: '분 대기',
    hoursMinutesWaiting: '시간',
    completed: '완료',
  },
  badge: {
    delayed: '지연',
    waiting: '대기',
    done: '완료',
    member: '멤버',
    sla: 'SLA',
  },
  actions: {
    refresh: '새로고침',
    close: '닫기',
  },
} as const

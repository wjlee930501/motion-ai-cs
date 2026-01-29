import { useState } from 'react'
import { useMutation, useQueryClient } from 'react-query'
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'

import { Button } from '@/components/ui'
import { API_BASE_URL } from '@/constants/api.constants'
import { TicketEvent, FeedbackCreate, IntentType } from '@/types/ticket.types'

interface IntentOption {
  value: IntentType
  label: string
  needsReply: boolean
}

const INTENT_OPTIONS: IntentOption[] = [
  { value: 'inquiry_status', label: '상태 확인 문의', needsReply: true },
  { value: 'request_action', label: '작업 요청', needsReply: true },
  { value: 'request_change', label: '변경 요청', needsReply: true },
  { value: 'complaint', label: '불만/클레임', needsReply: true },
  { value: 'question_how', label: '방법 문의', needsReply: true },
  { value: 'question_when', label: '일정 문의', needsReply: true },
  { value: 'follow_up', label: '추가 정보 제공', needsReply: true },
  { value: 'provide_info', label: '자료 제공', needsReply: false },
  { value: 'acknowledgment', label: '확인/동의', needsReply: false },
  { value: 'greeting', label: '인사', needsReply: false },
  { value: 'internal_discussion', label: '내부 대화', needsReply: false },
  { value: 'reaction', label: '단순 리액션', needsReply: false },
  { value: 'confirmation_received', label: '종결 확인', needsReply: false },
  { value: 'other', label: '기타', needsReply: false }
]

async function submitFeedback(data: FeedbackCreate) {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/feedback/classification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to submit feedback')
  return res.json()
}

interface FeedbackModalProps {
  event: TicketEvent
  currentIntent?: string
  currentNeedsReply?: boolean
  isOpen: boolean
  onClose: () => void
}

export function FeedbackModal({
  event,
  currentIntent,
  currentNeedsReply,
  isOpen,
  onClose
}: FeedbackModalProps) {
  const queryClient = useQueryClient()

  const initialIntent = (currentIntent as IntentType) || 'other'
  const initialNeedsReply = currentNeedsReply ?? true

  const [selectedIntent, setSelectedIntent] = useState<IntentType>(initialIntent)
  const [needsReply, setNeedsReply] = useState(initialNeedsReply)

  const submitMutation = useMutation(submitFeedback, {
    onSuccess: () => {
      queryClient.invalidateQueries('feedbackStats')
      queryClient.invalidateQueries('feedbackList')
      onClose()
    }
  })

  const handleIntentChange = (intent: IntentType) => {
    setSelectedIntent(intent)
    const option = INTENT_OPTIONS.find(o => o.value === intent)
    if (option) {
      setNeedsReply(option.needsReply)
    }
  }

  const handleSubmit = () => {
    const hasIntentChange = selectedIntent !== initialIntent
    const hasNeedsReplyChange = needsReply !== initialNeedsReply

    if (!hasIntentChange && !hasNeedsReplyChange) {
      onClose()
      return
    }

    submitMutation.mutate({
      event_id: event.event_id,
      corrected_intent: hasIntentChange ? selectedIntent : undefined,
      corrected_needs_reply: hasNeedsReplyChange ? needsReply : undefined
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            분류 수정
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">원본 메시지</p>
            <p className="text-sm text-slate-900 dark:text-white line-clamp-3">
              {event.text_raw}
            </p>
          </div>

          {currentIntent && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-slate-600 dark:text-slate-300">현재 분류: </span>
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  {INTENT_OPTIONS.find(o => o.value === currentIntent)?.label || currentIntent}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}({currentNeedsReply ? '답변 필요' : '답변 불필요'})
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              올바른 Intent
            </label>
            <select
              value={selectedIntent}
              onChange={(e) => handleIntentChange(e.target.value as IntentType)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {INTENT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label} {option.needsReply ? '(답변필요)' : '(답변불필요)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              답변 필요 여부
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setNeedsReply(true)}
                className={clsx(
                  'flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                  needsReply
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                답변 필요
              </button>
              <button
                onClick={() => setNeedsReply(false)}
                className={clsx(
                  'flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                  !needsReply
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                답변 불필요
              </button>
            </div>
          </div>

          {submitMutation.isError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4" />
              피드백 저장에 실패했습니다.
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={submitMutation.isLoading}
          >
            취소
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white"
            onClick={handleSubmit}
            disabled={submitMutation.isLoading}
          >
            {submitMutation.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                저장
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FeedbackModal

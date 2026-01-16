import { useState, useCallback } from 'react'
import { useQuery, useMutation } from 'react-query'
import {
  Brain,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react'
import clsx from 'clsx'

import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui'

// Types
interface Understanding {
  version: number
  created_at: string
  logs_analyzed_count: number
  logs_date_from: string | null
  logs_date_to: string | null
  understanding_text: string
  key_insights: unknown
  model_used: string
  prompt_tokens: number
  completion_tokens: number
}

interface LearningExecution {
  id: string
  executed_at: string
  status: 'success' | 'failed' | 'partial'
  trigger_type: string
  duration_seconds: number | null
  understanding_version: number | null
  error_message: string | null
}

interface UnderstandingResponse {
  ok: boolean
  understanding: Understanding | null
  previous_versions?: { version: number; created_at: string }[]
  message?: string
}

interface HistoryResponse {
  ok: boolean
  executions: LearningExecution[]
}

// API functions
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchUnderstanding(): Promise<UnderstandingResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE}/v1/learning/understanding`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch understanding')
  return res.json()
}

async function fetchUnderstandingByVersion(version: number): Promise<{ ok: boolean; understanding: Understanding }> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE}/v1/learning/understanding/${version}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch understanding')
  return res.json()
}

async function fetchHistory(): Promise<HistoryResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE}/v1/learning/history`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

async function triggerLearning(): Promise<{ ok: boolean; status: string; message: string }> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE}/v1/learning/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to trigger learning')
  return res.json()
}

interface LabModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LabModal({ isOpen, onClose }: LabModalProps) {
  const { isAdmin } = useAuthStore()
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Queries
  const {
    data: understandingData,
    isLoading: isLoadingUnderstanding,
    refetch: refetchUnderstanding
  } = useQuery('understanding', fetchUnderstanding, {
    refetchInterval: 30000,
    enabled: isOpen
  })

  const {
    data: historyData,
    isLoading: isLoadingHistory,
    refetch: refetchHistory
  } = useQuery('learningHistory', fetchHistory, {
    refetchInterval: 30000,
    enabled: isOpen
  })

  const {
    data: versionData,
    isLoading: isLoadingVersion
  } = useQuery(
    ['understanding', selectedVersion],
    () => selectedVersion ? fetchUnderstandingByVersion(selectedVersion) : null,
    { enabled: isOpen && !!selectedVersion }
  )

  // Trigger learning mutation
  const triggerMutation = useMutation(triggerLearning, {
    onSuccess: () => {
      refetchHistory()
      setTimeout(() => refetchUnderstanding(), 5000)
    }
  })

  const handleTriggerLearning = useCallback(() => {
    if (confirm('학습을 수동으로 실행하시겠습니까? 몇 분 정도 소요될 수 있습니다.')) {
      triggerMutation.mutate()
    }
  }, [triggerMutation])

  // Current understanding to display
  const displayUnderstanding = selectedVersion && versionData?.understanding
    ? versionData.understanding
    : understandingData?.understanding

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds}초`
    return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-slate-100 dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">연구실</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">CS 자가 학습 시스템</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchUnderstanding()
                refetchHistory()
              }}
            >
              <RefreshCw className={clsx('w-4 h-4', (isLoadingUnderstanding || isLoadingHistory) && 'animate-spin')} />
            </Button>
            {isAdmin && (
              <Button
                onClick={handleTriggerLearning}
                disabled={triggerMutation.isLoading}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {triggerMutation.isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                수동 학습 실행
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Understanding Section - 2 columns */}
              <div className="lg:col-span-2 space-y-6">
                {/* Current Understanding Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      <h2 className="font-semibold text-slate-900 dark:text-white">
                        {selectedVersion ? `이해 v${selectedVersion}` : '현재 이해'}
                      </h2>
                      {displayUnderstanding && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                          v{displayUnderstanding.version}
                        </span>
                      )}
                    </div>
                    {selectedVersion && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedVersion(null)}
                        className="text-slate-500"
                      >
                        최신 버전 보기
                      </Button>
                    )}
                  </div>

                  {isLoadingUnderstanding || isLoadingVersion ? (
                    <div className="p-12 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                  ) : displayUnderstanding ? (
                    <div className="p-6">
                      {/* Meta Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">분석 메시지</p>
                          <p className="text-lg font-semibold text-slate-900 dark:text-white">
                            {displayUnderstanding.logs_analyzed_count?.toLocaleString() || 0}건
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">생성일</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {formatDate(displayUnderstanding.created_at)}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">사용 모델</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {displayUnderstanding.model_used || '-'}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">토큰 사용</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {((displayUnderstanding.prompt_tokens || 0) + (displayUnderstanding.completion_tokens || 0)).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Understanding Text */}
                      <div className="prose dark:prose-invert max-w-none">
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                            {displayUnderstanding.understanding_text}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-500 dark:text-slate-400">
                        아직 학습된 이해가 없습니다.
                      </p>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        학습은 월/목 02:00 KST에 자동 실행됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar - 1 column */}
              <div className="space-y-6">
                {/* Version History */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <h3 className="font-medium text-slate-900 dark:text-white text-sm">버전 이력</h3>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {understandingData?.previous_versions?.length ? (
                      understandingData.previous_versions.map((v) => (
                        <button
                          key={v.version}
                          onClick={() => setSelectedVersion(v.version === selectedVersion ? null : v.version)}
                          className={clsx(
                            'w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0',
                            selectedVersion === v.version && 'bg-purple-50 dark:bg-purple-900/20'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={clsx(
                              'text-sm font-medium',
                              selectedVersion === v.version
                                ? 'text-purple-600 dark:text-purple-400'
                                : 'text-slate-700 dark:text-slate-300'
                            )}>
                              v{v.version}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDate(v.created_at).split(' ').slice(0, 3).join(' ')}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">
                        버전 이력이 없습니다
                      </div>
                    )}
                  </div>
                </div>

                {/* Execution History */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <h3 className="font-medium text-slate-900 dark:text-white text-sm">실행 이력</h3>
                      {historyData?.executions?.length && (
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded">
                          {historyData.executions.length}
                        </span>
                      )}
                    </div>
                    {showHistory ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showHistory && (
                    <div className="max-h-64 overflow-y-auto">
                      {isLoadingHistory ? (
                        <div className="p-4 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        </div>
                      ) : historyData?.executions?.length ? (
                        historyData.executions.map((exec) => (
                          <div
                            key={exec.id}
                            className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {exec.status === 'success' ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                ) : exec.status === 'failed' ? (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Clock className="w-4 h-4 text-amber-500" />
                                )}
                                <span className={clsx(
                                  'text-xs font-medium px-1.5 py-0.5 rounded',
                                  exec.status === 'success' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
                                  exec.status === 'failed' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                                  exec.status === 'partial' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                )}>
                                  {exec.status === 'success' ? '성공' : exec.status === 'failed' ? '실패' : '부분'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {exec.trigger_type === 'scheduled' ? '자동' : '수동'}
                                </span>
                              </div>
                              {exec.understanding_version && (
                                <span className="text-xs text-purple-600 dark:text-purple-400">
                                  v{exec.understanding_version}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{formatDate(exec.executed_at)}</span>
                              <span>{formatDuration(exec.duration_seconds)}</span>
                            </div>
                            {exec.error_message && (
                              <p className="mt-1 text-xs text-red-500 truncate">{exec.error_message}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-slate-500">
                          실행 이력이 없습니다
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Info Card */}
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-2xl border border-purple-200/50 dark:border-purple-800/50 p-4">
                  <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-2">
                    자가 학습 시스템
                  </h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500">-</span>
                      월/목 02:00 KST 자동 실행
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500">-</span>
                      전체 대화 로그 분석
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500">-</span>
                      CS 응대 방식 및 패턴 이해 형성
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500">-</span>
                      버전별 이해 누적 및 발전
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LabModal

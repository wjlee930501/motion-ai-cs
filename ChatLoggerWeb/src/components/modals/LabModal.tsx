import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
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
  Loader2,
  Lightbulb,
  Zap,
  MessageSquare,
  TrendingUp,
  Check,
  Ban,
  Settings
} from 'lucide-react'
import clsx from 'clsx'

import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui'
import { API_BASE_URL } from '@/constants/api.constants'
import {
  Pattern,
  PatternListResponse,
  FeedbackStats,
  FeedbackStatsResponse,
  KeyInsights,
  InsightsResponse
} from '@/types/ticket.types'

interface Understanding {
  version: number
  created_at: string
  logs_analyzed_count: number
  logs_date_from: string | null
  logs_date_to: string | null
  understanding_text: string
  key_insights: KeyInsights | null
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

async function fetchUnderstanding(): Promise<UnderstandingResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/learning/understanding`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch understanding')
  return res.json()
}

async function fetchUnderstandingByVersion(version: number): Promise<{ ok: boolean; understanding: Understanding }> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/learning/understanding/${version}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch understanding')
  return res.json()
}

async function fetchHistory(): Promise<HistoryResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/learning/history`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

async function fetchInsights(): Promise<InsightsResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/learning/insights`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch insights')
  return res.json()
}

async function fetchPendingPatterns(): Promise<PatternListResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/patterns/pending`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch patterns')
  return res.json()
}

async function fetchFeedbackStats(): Promise<FeedbackStatsResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/feedback/statistics`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch feedback stats')
  return res.json()
}

async function triggerLearning(): Promise<{ ok: boolean; status: string; message: string }> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/learning/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to trigger learning')
  return res.json()
}

async function approvePattern(patternId: string) {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/patterns/${patternId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to approve pattern')
  return res.json()
}

async function rejectPattern(patternId: string) {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/patterns/${patternId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to reject pattern')
  return res.json()
}

async function applyPatterns() {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE_URL}/v1/patterns/apply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to apply patterns')
  return res.json()
}

type TabType = 'understanding' | 'insights' | 'patterns' | 'feedback'

interface LabModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LabModal({ isOpen, onClose }: LabModalProps) {
  const { isAdmin } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('understanding')
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

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

  const { data: versionData, isLoading: isLoadingVersion } = useQuery(
    ['understanding', selectedVersion],
    () => selectedVersion ? fetchUnderstandingByVersion(selectedVersion) : null,
    { enabled: isOpen && !!selectedVersion }
  )

  const { data: insightsData, isLoading: isLoadingInsights } = useQuery(
    'learningInsights',
    fetchInsights,
    { enabled: isOpen && activeTab === 'insights' }
  )

  const { data: patternsData, isLoading: isLoadingPatterns, refetch: refetchPatterns } = useQuery(
    'pendingPatterns',
    fetchPendingPatterns,
    { enabled: isOpen && activeTab === 'patterns' }
  )

  const { data: feedbackStatsData, isLoading: isLoadingFeedback } = useQuery(
    'feedbackStats',
    fetchFeedbackStats,
    { enabled: isOpen && activeTab === 'feedback' }
  )

  const triggerMutation = useMutation(triggerLearning, {
    onSuccess: () => {
      refetchHistory()
      setTimeout(() => refetchUnderstanding(), 5000)
    }
  })

  const approveMutation = useMutation(approvePattern, {
    onSuccess: () => {
      queryClient.invalidateQueries('pendingPatterns')
    }
  })

  const rejectMutation = useMutation(rejectPattern, {
    onSuccess: () => {
      queryClient.invalidateQueries('pendingPatterns')
    }
  })

  const applyMutation = useMutation(applyPatterns, {
    onSuccess: () => {
      queryClient.invalidateQueries('pendingPatterns')
    }
  })

  const handleTriggerLearning = useCallback(() => {
    if (confirm('학습을 수동으로 실행하시겠습니까? 몇 분 정도 소요될 수 있습니다.')) {
      triggerMutation.mutate()
    }
  }, [triggerMutation])

  const displayUnderstanding = selectedVersion && versionData?.understanding
    ? versionData.understanding
    : understandingData?.understanding

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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds}초`
    return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'understanding' as const, label: '이해', icon: Brain },
    { id: 'insights' as const, label: '인사이트', icon: Lightbulb },
    { id: 'patterns' as const, label: '패턴 관리', icon: Settings },
    { id: 'feedback' as const, label: '피드백', icon: MessageSquare }
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-slate-100 dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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
                refetchPatterns()
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

        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'understanding' && (
            <UnderstandingTab
              understandingData={understandingData}
              displayUnderstanding={displayUnderstanding}
              versionData={versionData}
              historyData={historyData}
              selectedVersion={selectedVersion}
              showHistory={showHistory}
              isLoadingUnderstanding={isLoadingUnderstanding}
              isLoadingVersion={isLoadingVersion}
              isLoadingHistory={isLoadingHistory}
              setSelectedVersion={setSelectedVersion}
              setShowHistory={setShowHistory}
              formatDate={formatDate}
              formatDuration={formatDuration}
            />
          )}

          {activeTab === 'insights' && (
            <InsightsTab
              insights={insightsData?.insights}
              version={insightsData?.version}
              isLoading={isLoadingInsights}
            />
          )}

          {activeTab === 'patterns' && (
            <PatternsTab
              patterns={patternsData?.patterns || []}
              isLoading={isLoadingPatterns}
              isAdmin={isAdmin}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id) => rejectMutation.mutate(id)}
              onApplyAll={() => applyMutation.mutate()}
              isApproving={approveMutation.isLoading}
              isRejecting={rejectMutation.isLoading}
              isApplying={applyMutation.isLoading}
            />
          )}

          {activeTab === 'feedback' && (
            <FeedbackTab
              stats={feedbackStatsData?.statistics}
              isLoading={isLoadingFeedback}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface UnderstandingTabProps {
  understandingData: UnderstandingResponse | undefined
  displayUnderstanding: Understanding | null | undefined
  versionData: { ok: boolean; understanding: Understanding } | null | undefined
  historyData: HistoryResponse | undefined
  selectedVersion: number | null
  showHistory: boolean
  isLoadingUnderstanding: boolean
  isLoadingVersion: boolean
  isLoadingHistory: boolean
  setSelectedVersion: (v: number | null) => void
  setShowHistory: (v: boolean) => void
  formatDate: (d: string | null) => string
  formatDuration: (s: number | null) => string
}

function UnderstandingTab({
  understandingData,
  displayUnderstanding,
  selectedVersion,
  showHistory,
  isLoadingUnderstanding,
  isLoadingVersion,
  isLoadingHistory,
  historyData,
  setSelectedVersion,
  setShowHistory,
  formatDate,
  formatDuration
}: UnderstandingTabProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
              <div className="p-4">
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

        <div className="space-y-4">
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
  )
}

interface InsightsTabProps {
  insights: KeyInsights | undefined | null
  version: number | undefined
  isLoading: boolean
}

function InsightsTab({ insights, version, isLoading }: InsightsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Lightbulb className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400">아직 구조화된 인사이트가 없습니다.</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          학습 실행 후 생성됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>버전 {version}</span>
        {insights.version && <span>· 스키마 {insights.version}</span>}
      </div>

      {insights.skip_llm_candidates && insights.skip_llm_candidates.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">자동 분류 후보</h3>
            <span className="text-xs text-slate-500">LLM 호출 없이 분류 가능</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.skip_llm_candidates.map((candidate, idx) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                    {candidate.pattern}
                  </code>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    candidate.confidence >= 0.95 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                    candidate.confidence >= 0.9 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  )}>
                    {(candidate.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">→</span>
                  <span className="font-medium text-slate-900 dark:text-white">{candidate.intent}</span>
                  <span className={clsx(
                    'text-xs px-1.5 py-0.5 rounded',
                    candidate.needs_reply
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  )}>
                    {candidate.needs_reply ? '답변필요' : '완료'}
                  </span>
                </div>
                {candidate.example_count && (
                  <p className="text-xs text-slate-500 mt-1">{candidate.example_count}건 발견</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {insights.new_intent_candidates && insights.new_intent_candidates.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">새 Intent 후보</h3>
          </div>
          <div className="p-4 space-y-3">
            {insights.new_intent_candidates.map((intent, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                      {intent.suggested_name}
                    </code>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {intent.description_ko}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{intent.frequency}회</span>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      intent.confidence >= 0.85 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    )}>
                      {(intent.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                {intent.examples && intent.examples.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {intent.examples.slice(0, 3).map((ex, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-white dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        "{ex}"
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {insights.topic_statistics && Object.keys(insights.topic_statistics).length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Topic 통계</h3>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {Object.entries(insights.topic_statistics)
                .sort(([,a], [,b]) => b.count - a.count)
                .map(([topic, stats]) => (
                  <div key={topic} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 dark:text-slate-300 w-40 truncate">{topic}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{ width: `${Math.min(100, stats.count / 5)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{stats.count}건</span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

interface PatternsTabProps {
  patterns: Pattern[]
  isLoading: boolean
  isAdmin: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onApplyAll: () => void
  isApproving: boolean
  isRejecting: boolean
  isApplying: boolean
}

function PatternsTab({
  patterns,
  isLoading,
  isAdmin,
  onApprove,
  onReject,
  onApplyAll,
  isApproving,
  isRejecting,
  isApplying
}: PatternsTabProps) {
  const approvedCount = patterns.filter(p => p.status === 'approved').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {isAdmin && approvedCount > 0 && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-sm text-emerald-700 dark:text-emerald-300">
              {approvedCount}개 패턴 적용 대기 중
            </span>
          </div>
          <Button
            onClick={onApplyAll}
            disabled={isApplying}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : '시스템에 적용'}
          </Button>
        </div>
      )}

      {patterns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Settings className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">승인 대기 중인 패턴이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patterns.map(pattern => (
            <div
              key={pattern.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    pattern.pattern_type === 'skip_llm' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                    pattern.pattern_type === 'internal_marker' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                    pattern.pattern_type === 'new_intent' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                    pattern.pattern_type === 'confirmation' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  )}>
                    {pattern.pattern_type === 'skip_llm' ? 'Skip LLM' :
                     pattern.pattern_type === 'internal_marker' ? '내부 대화' :
                     pattern.pattern_type === 'new_intent' ? '새 Intent' : '확인 패턴'}
                  </span>
                  <span className="text-xs text-slate-500">v{pattern.understanding_version}</span>
                </div>
                {isAdmin && pattern.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReject(pattern.id)}
                      disabled={isRejecting}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      거부
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onApprove(pattern.id)}
                      disabled={isApproving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      승인
                    </Button>
                  </div>
                )}
                {pattern.status !== 'pending' && (
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    pattern.status === 'approved' && 'bg-emerald-100 text-emerald-700',
                    pattern.status === 'rejected' && 'bg-red-100 text-red-700',
                    pattern.status === 'applied' && 'bg-blue-100 text-blue-700'
                  )}>
                    {pattern.status === 'approved' ? '승인됨' :
                     pattern.status === 'rejected' ? '거부됨' : '적용됨'}
                  </span>
                )}
              </div>
              <pre className="text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(pattern.pattern_data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface FeedbackTabProps {
  stats: FeedbackStats | undefined
  isLoading: boolean
}

function FeedbackTab({ stats, isLoading }: FeedbackTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400">피드백 통계를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">총 피드백</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_feedback}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">적용 대기</p>
          <p className="text-3xl font-bold text-amber-600">{stats.pending_application}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">학습 반영</p>
          <p className="text-3xl font-bold text-emerald-600">{stats.applied}</p>
        </div>
      </div>

      {stats.top_corrections && stats.top_corrections.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">주요 수정 패턴</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.top_corrections.map((correction, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-red-600 dark:text-red-400 line-through">
                    {correction.from}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    {correction.to}
                  </span>
                </div>
                <span className="text-sm text-slate-500">{correction.count}회</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.by_type && Object.keys(stats.by_type).length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">피드백 유형별</h3>
          </div>
          <div className="p-4 flex gap-4">
            {Object.entries(stats.by_type).map(([type, count]) => (
              <div key={type} className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
                <p className="text-xs text-slate-500">
                  {type === 'correction' ? '수정' : type === 'confirmation' ? '확인' : type}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LabModal

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { ticketApi } from '@/services/ticketApi'
import { Template, TemplateCategory, TemplateCreate } from '@/types/ticket.types'
import {
  Copy, Plus, Pencil, Trash2, Search,
  MessageSquare, Info, Wrench, HandHeart, MoreHorizontal,
  Check, X
} from 'lucide-react'
import clsx from 'clsx'

const CATEGORIES: { value: TemplateCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: '전체', icon: <MessageSquare className="w-4 h-4" /> },
  { value: '인사', label: '인사', icon: <HandHeart className="w-4 h-4" /> },
  { value: '안내', label: '안내', icon: <Info className="w-4 h-4" /> },
  { value: '문제해결', label: '문제해결', icon: <Wrench className="w-4 h-4" /> },
  { value: '마무리', label: '마무리', icon: <Check className="w-4 h-4" /> },
  { value: '기타', label: '기타', icon: <MoreHorizontal className="w-4 h-4" /> },
]

export default function TemplatesPage() {
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', selectedCategory, searchQuery],
    queryFn: () => ticketApi.getTemplates(
      selectedCategory === 'all' ? undefined : selectedCategory,
      searchQuery || undefined
    ),
    staleTime: 30000,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (template: TemplateCreate) => ticketApi.createTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setIsCreateModalOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: number; update: Partial<TemplateCreate> }) =>
      ticketApi.updateTemplate(id, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setEditingTemplate(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ticketApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  const copyMutation = useMutation({
    mutationFn: (id: number) => ticketApi.copyTemplate(id),
  })

  // Handle copy to clipboard
  const handleCopy = useCallback(async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.content)
      setCopiedId(template.id)
      copyMutation.mutate(template.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [copyMutation])

  // Handle delete
  const handleDelete = useCallback((template: Template) => {
    if (window.confirm(`"${template.title}" 템플릿을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(template.id)
    }
  }, [deleteMutation])

  const templates = templatesData?.templates || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              응답 템플릿
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              자주 사용하는 응답 메시지를 템플릿으로 관리하세요
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-5 h-5" />
            <span>새 템플릿</span>
          </button>
        </div>

        {/* Search & Categories */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/50 dark:border-slate-700/50 p-6 mb-6">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="템플릿 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  selectedCategory === cat.value
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                )}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">로딩 중...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                {searchQuery ? '검색 결과가 없습니다' : '템플릿이 없습니다'}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 text-blue-500 hover:text-blue-600 font-medium"
              >
                첫 번째 템플릿 만들기
              </button>
            </div>
          ) : (
            templates.map((template: Template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-xl transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-medium',
                        template.category === '인사' && 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
                        template.category === '안내' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        template.category === '문제해결' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        template.category === '마무리' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        template.category === '기타' && 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
                      )}>
                        {template.category}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {template.title}
                      </h3>
                      <span className="text-xs text-slate-400">
                        사용 {template.usage_count}회
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-3">
                      {template.content}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(template)}
                      className={clsx(
                        'p-2.5 rounded-xl transition-all',
                        copiedId === template.id
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                      )}
                      title="복사"
                    >
                      {copiedId === template.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingTemplate(template)}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                      title="수정"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(isCreateModalOpen || editingTemplate) && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setIsCreateModalOpen(false)
            setEditingTemplate(null)
          }}
          onSave={(data) => {
            if (editingTemplate) {
              updateMutation.mutate({ id: editingTemplate.id, update: data })
            } else {
              createMutation.mutate(data as TemplateCreate)
            }
          }}
          isSaving={createMutation.isLoading || updateMutation.isLoading}
        />
      )}
    </div>
  )
}

// Template Create/Edit Modal
interface TemplateModalProps {
  template: Template | null
  onClose: () => void
  onSave: (data: Partial<TemplateCreate>) => void
  isSaving: boolean
}

function TemplateModal({ template, onClose, onSave, isSaving }: TemplateModalProps) {
  const [title, setTitle] = useState(template?.title || '')
  const [content, setContent] = useState(template?.content || '')
  const [category, setCategory] = useState<TemplateCategory>(template?.category || '기타')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    onSave({ title: title.trim(), content: content.trim(), category })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {template ? '템플릿 수정' : '새 템플릿'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="템플릿 제목"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                카테고리
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.filter(c => c.value !== 'all').map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value as TemplateCategory)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      category === cat.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    )}
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                내용
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="템플릿 내용을 입력하세요..."
                rows={6}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim() || !content.trim()}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : (template ? '수정' : '생성')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Bell, Settings, LogOut, Moon, Sun, Menu, X, Sparkles, ChevronDown, Search, Brain, Users, Loader2, MessageSquareText } from 'lucide-react'
import { Button } from '../ui'
import clsx from 'clsx'

// API
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface NotificationItem {
  id: number
  type: 'sla_breach' | 'urgent_ticket' | 'system' | 'info'
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

interface NotificationListResponse {
  ok: boolean
  notifications: NotificationItem[]
  unread_count: number
}

async function fetchNotifications(): Promise<NotificationListResponse> {
  const token = localStorage.getItem('cs_token')
  const res = await fetch(`${API_BASE}/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch notifications')
  return res.json()
}

async function markNotificationRead(notificationId: number): Promise<void> {
  const token = localStorage.getItem('cs_token')
  await fetch(`${API_BASE}/v1/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
}

async function markAllNotificationsRead(): Promise<void> {
  const token = localStorage.getItem('cs_token')
  await fetch(`${API_BASE}/v1/notifications/read-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
}

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return date.toLocaleDateString('ko-KR')
}

interface SearchableItem {
  id: string
  name: string
  lastMessage?: string
  needsReply?: boolean
}

interface HeaderProps {
  userName?: string
  userRole?: 'admin' | 'member'
  onLogout: () => void
  onToggleTheme?: () => void
  isDarkMode?: boolean
  searchItems?: SearchableItem[]
  onSearchSelect?: (id: string) => void
  onOpenLabModal?: () => void
  onOpenTemplatesModal?: () => void
}

export function Header({ userName, userRole, onLogout, onToggleTheme, isDarkMode, searchItems = [], onSearchSelect, onOpenLabModal, onOpenTemplatesModal }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isLabPage = location.pathname === '/lab'
  const isUsersPage = location.pathname === '/users'
  const isTemplatesPage = location.pathname === '/templates'
  const isAdmin = userRole === 'admin'

  // Fetch notifications
  const { data: notificationData, isLoading: notificationsLoading } = useQuery(
    'notifications',
    fetchNotifications,
    {
      refetchInterval: 30000, // 30초마다 갱신
      staleTime: 10000,
    }
  )

  // Mark notification as read mutation
  const markReadMutation = useMutation(markNotificationRead, {
    onSuccess: () => {
      queryClient.invalidateQueries('notifications')
    }
  })

  // Mark all as read mutation
  const markAllReadMutation = useMutation(markAllNotificationsRead, {
    onSuccess: () => {
      queryClient.invalidateQueries('notifications')
    }
  })

  const notifications = notificationData?.notifications || []
  const unreadCount = notificationData?.unread_count || 0

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
      setShowNotifications(false)
    }
  }

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate()
  }

  // 검색 결과 필터링
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return searchItems
      .filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.lastMessage && item.lastMessage.toLowerCase().includes(query))
      )
      .slice(0, 8) // 최대 8개 결과
  }, [searchQuery, searchItems])

  // 검색 모달 열릴 때 포커스
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  // ESC key listener for modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false)
        if (showNotifications) setShowNotifications(false)
        if (showUserMenu) setShowUserMenu(false)
        if (showMobileMenu) setShowMobileMenu(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showSearch, showNotifications, showUserMenu, showMobileMenu])

  // 키보드 단축키 (⌘K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(prev => !prev)
        setShowNotifications(false)
        setShowUserMenu(false)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchSelect = (id: string) => {
    onSearchSelect?.(id)
    setShowSearch(false)
    setSearchQuery('')
  }

  // Map notification type to UI style
  const getNotificationStyle = (type: NotificationItem['type']) => {
    switch (type) {
      case 'sla_breach':
        return 'bg-amber-500'
      case 'urgent_ticket':
        return 'bg-red-500 animate-pulse'
      case 'system':
        return 'bg-blue-500'
      case 'info':
      default:
        return 'bg-slate-400'
    }
  }

  return (
    <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-700/60 sticky top-0 z-50 shadow-soft dark:shadow-slate-900/50">
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <button
            onClick={() => navigate('/tickets')}
            className="flex items-center gap-4 cursor-pointer group"
          >
            <div className="relative">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-500 via-accent-purple to-accent-pink rounded-2xl blur-lg opacity-40 group-hover:opacity-70 transition-all duration-500 group-hover:blur-xl animate-gradient-xy bg-[length:200%_200%]" />
              <div className="relative w-11 h-11 bg-gradient-to-br from-brand-500 via-accent-purple to-accent-pink rounded-2xl flex items-center justify-center shadow-elevated transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
                <Sparkles className="w-5 h-5 text-white group-hover:animate-pulse" />
              </div>
            </div>
            <div className="hidden sm:block text-left">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-300">
                MotionLabs AI-CS
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-300">
                System
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSearch(!showSearch)
                  setShowNotifications(false)
                  setShowUserMenu(false)
                }}
                className="group flex items-center gap-3 px-4 py-2 w-72 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-850 rounded-xl text-slate-500 dark:text-slate-400 hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-700 dark:hover:to-slate-800 transition-all duration-300 shadow-sm hover:shadow-md border border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
              >
                <Search className="w-4 h-4 group-hover:scale-110 group-hover:text-brand-500 transition-all duration-300" />
                <span className="text-sm flex-1 text-left font-medium">메시지 검색</span>
                <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg text-2xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-300/70 dark:border-slate-600/70 shadow-sm group-hover:border-brand-300 dark:group-hover:border-brand-700 transition-all duration-300">
                  ⌘K
                </kbd>
              </button>

              {/* Search Modal */}
              {showSearch && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowSearch(false)}
                  />
                  {/* Modal */}
                  <div className="absolute left-0 mt-3 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-elevated border-2 border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50 animate-scale-in">
                    {/* Search Input */}
                    <div className="p-4 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-900/50 border-b border-slate-200/80 dark:border-slate-700/80">
                      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 focus-within:border-brand-400 dark:focus-within:border-brand-600 focus-within:shadow-glow transition-all duration-300">
                        <Search className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="메시지 검색..."
                          className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                      {searchQuery.trim() === '' ? (
                        <div className="p-8 text-center">
                          <Search className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">검색어를 입력하세요</p>
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-8 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <X className="w-6 h-6 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">"{searchQuery}" 검색 결과 없음</p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {searchResults.map((item, index) => (
                            <button
                              key={item.id}
                              onClick={() => handleSearchSelect(item.id)}
                              style={{ animationDelay: `${index * 30}ms` }}
                              className="w-full px-3 py-3 text-left rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/50 dark:hover:from-slate-700/50 dark:hover:to-slate-800/50 transition-all duration-200 flex items-start gap-3 group animate-fade-in-down border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
                            >
                              <div className={clsx(
                                'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md',
                                item.needsReply
                                  ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white'
                                  : 'bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200'
                              )}>
                                {item.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                    {item.name}
                                  </span>
                                  {item.needsReply && (
                                    <span className="flex-shrink-0 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-2xs font-bold rounded-md shadow-sm">
                                      대기
                                    </span>
                                  )}
                                </div>
                                {item.lastMessage && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                                    {item.lastMessage}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/80 dark:to-slate-800/50">
                      <div className="flex items-center justify-between text-2xs font-semibold text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">↑↓</kbd>
                          이동
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Enter</kbd>
                          선택
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">ESC</kbd>
                          닫기
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  setShowUserMenu(false)
                  setShowSearch(false)
                }}
                className="relative group hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-300"
              >
                <Bell className="w-5 h-5 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white text-2xs font-bold rounded-full flex items-center justify-center shadow-elevated animate-pulse-soft ring-2 ring-white dark:ring-slate-900">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-3 w-[28rem] bg-white dark:bg-slate-800 rounded-2xl shadow-elevated border-2 border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50 animate-scale-in">
                    <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-md">
                          <Bell className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">알림</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모든 알림을 확인했습니다'}
                          </p>
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          disabled={markAllReadMutation.isLoading}
                          className="px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 border border-brand-200 dark:border-brand-800"
                        >
                          {markAllReadMutation.isLoading ? '처리 중...' : '모두 읽음'}
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                      {notificationsLoading ? (
                        <div className="px-4 py-12 flex flex-col items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-brand-500 dark:text-brand-400 mb-3" />
                          <p className="text-sm text-slate-400">알림을 불러오는 중...</p>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <Bell className="w-8 h-8 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">알림이 없습니다</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">새로운 알림이 도착하면 여기에 표시됩니다</p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {notifications.map((notification, index) => (
                            <div
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              style={{ animationDelay: `${index * 30}ms` }}
                              className={clsx(
                                'px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/50 dark:hover:from-slate-700/50 dark:hover:to-slate-800/50 cursor-pointer transition-all duration-200 group animate-fade-in-down border hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm',
                                !notification.is_read
                                  ? 'bg-gradient-to-r from-brand-50/50 to-transparent dark:from-brand-900/10 dark:to-transparent border-brand-100 dark:border-brand-900/30'
                                  : 'border-transparent'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="relative mt-1">
                                  <div
                                    className={clsx(
                                      'w-3 h-3 rounded-full flex-shrink-0 shadow-md',
                                      getNotificationStyle(notification.type)
                                    )}
                                  />
                                  {!notification.is_read && (
                                    <div className="absolute inset-0 rounded-full bg-current animate-ping opacity-75" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                    {notification.message}
                                  </p>
                                  <p className="text-2xs text-slate-400 dark:text-slate-500 mt-2 font-medium">
                                    {formatTimeAgo(notification.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Theme Toggle */}
            {onToggleTheme && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleTheme}
                className="group relative rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 overflow-hidden"
              >
                {isDarkMode ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Sun className="w-5 h-5 text-amber-500 relative group-hover:scale-110 group-hover:rotate-90 transition-all duration-500" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Moon className="w-5 h-5 text-slate-600 relative group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500" />
                  </>
                )}
              </Button>
            )}

            {/* Lab Button */}
            <Button
              variant="ghost"
              size="sm"
              className={clsx(
                'group rounded-xl flex items-center gap-2 transition-all duration-300 relative overflow-hidden',
                isLabPage
                  ? 'bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-200 dark:border-purple-800'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
              onClick={() => onOpenLabModal ? onOpenLabModal() : navigate('/lab')}
            >
              {isLabPage && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-purple-600/10 animate-gradient-x bg-[length:200%_200%]" />
              )}
              <Brain className={clsx(
                'w-5 h-5 relative transition-all duration-300',
                isLabPage ? 'animate-pulse-soft' : 'group-hover:scale-110'
              )} />
              <span className="text-sm font-semibold hidden lg:inline relative">연구실</span>
            </Button>

            {/* Templates Button */}
            <Button
              variant="ghost"
              size="sm"
              className={clsx(
                'group rounded-xl flex items-center gap-2 transition-all duration-300 relative overflow-hidden',
                isTemplatesPage
                  ? 'bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20 text-green-600 dark:text-green-400 shadow-sm border border-green-200 dark:border-green-800'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
              onClick={() => onOpenTemplatesModal ? onOpenTemplatesModal() : navigate('/templates')}
            >
              {isTemplatesPage && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-green-600/10 animate-gradient-x bg-[length:200%_200%]" />
              )}
              <MessageSquareText className={clsx(
                'w-5 h-5 relative transition-all duration-300',
                isTemplatesPage ? 'animate-pulse-soft' : 'group-hover:scale-110'
              )} />
              <span className="text-sm font-semibold hidden lg:inline relative">템플릿</span>
            </Button>

            {/* Users Button (Admin Only) */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className={clsx(
                  'group rounded-xl flex items-center gap-2 transition-all duration-300 relative overflow-hidden',
                  isUsersPage
                    ? 'bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
                onClick={() => navigate('/users')}
              >
                {isUsersPage && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-blue-600/10 animate-gradient-x bg-[length:200%_200%]" />
                )}
                <Users className={clsx(
                  'w-5 h-5 relative transition-all duration-300',
                  isUsersPage ? 'animate-pulse-soft' : 'group-hover:scale-110'
                )} />
                <span className="text-sm font-semibold hidden lg:inline relative">사용자</span>
              </Button>
            )}

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              className="group rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
            >
              <Settings className="w-5 h-5 group-hover:scale-110 group-hover:rotate-90 transition-all duration-500" />
            </Button>

            {/* Divider */}
            <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-slate-600 mx-2" />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu)
                  setShowNotifications(false)
                  setShowSearch(false)
                }}
                className="group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-brand-500 via-accent-purple to-accent-pink rounded-xl blur opacity-40 group-hover:opacity-70 transition-all duration-300" />
                  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 via-accent-purple to-accent-pink flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:shadow-lg transition-all duration-300">
                    {userName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {userName || 'Admin'}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isAdmin ? '관리자' : '멤버'}
                  </p>
                </div>
                <ChevronDown className={clsx(
                  'w-4 h-4 text-slate-400 transition-all duration-300',
                  showUserMenu && 'rotate-180 text-brand-500'
                )} />
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-elevated border-2 border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50 animate-scale-in">
                    <div className="px-5 py-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-slate-200/80 dark:border-slate-700/80">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="absolute -inset-1 bg-gradient-to-br from-brand-500 via-accent-purple to-accent-pink rounded-2xl blur-md opacity-50" />
                          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 via-accent-purple to-accent-pink flex items-center justify-center text-white font-bold shadow-lg">
                            {userName?.charAt(0).toUpperCase() || 'A'}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{userName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">admin@motionlabs.kr</p>
                          <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border border-brand-200 dark:border-brand-800">
                            <span className="text-2xs font-bold text-brand-600 dark:text-brand-400">
                              {isAdmin ? '관리자' : '멤버'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <button className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/50 dark:hover:from-slate-700/50 dark:hover:to-slate-800/50 transition-all duration-200 flex items-center gap-3 rounded-xl group border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </div>
                        <span className="group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">설정</span>
                      </button>
                      <button
                        onClick={onLogout}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100/50 dark:hover:from-red-900/20 dark:hover:to-red-900/10 transition-all duration-200 flex items-center gap-3 rounded-xl group border border-transparent hover:border-red-200 dark:hover:border-red-800 mt-1"
                      >
                        <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                        <span>로그아웃</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? (
              <X className="w-6 h-6 rotate-90 transition-transform duration-300" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden py-4 border-t border-slate-200/60 dark:border-slate-700/60 animate-fade-in-down bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/50">
            <div className="flex flex-col gap-2">
              <div className="relative group mx-2">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 via-accent-purple to-accent-pink rounded-2xl blur opacity-20" />
                <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 via-accent-purple to-accent-pink flex items-center justify-center text-white font-bold shadow-md">
                    {userName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{userName}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{isAdmin ? '관리자' : '멤버'}</p>
                  </div>
                </div>
              </div>

              <div className="px-2 space-y-1 mt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start group hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-800 dark:hover:to-slate-850 rounded-xl transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  onClick={() => {
                    if (onOpenLabModal) {
                      onOpenLabModal()
                    } else {
                      navigate('/lab')
                    }
                    setShowMobileMenu(false)
                  }}
                >
                  <Brain className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-semibold">연구실</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start group hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-800 dark:hover:to-slate-850 rounded-xl transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  onClick={() => {
                    if (onOpenTemplatesModal) {
                      onOpenTemplatesModal()
                    } else {
                      navigate('/templates')
                    }
                    setShowMobileMenu(false)
                  }}
                >
                  <MessageSquareText className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-semibold">템플릿</span>
                </Button>

                {isAdmin && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start group hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-800 dark:hover:to-slate-850 rounded-xl transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    onClick={() => {
                      navigate('/users')
                      setShowMobileMenu(false)
                    }}
                  >
                    <Users className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-semibold">사용자</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="w-full justify-start group hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-800 dark:hover:to-slate-850 rounded-xl transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <Settings className="w-5 h-5 mr-3 group-hover:scale-110 group-hover:rotate-90 transition-all duration-500" />
                  <span className="font-semibold">설정</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start group hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100/50 dark:hover:from-red-900/20 dark:hover:to-red-900/10 rounded-xl transition-all duration-300 text-red-600 dark:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-800"
                  onClick={onLogout}
                >
                  <LogOut className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-semibold">로그아웃</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header

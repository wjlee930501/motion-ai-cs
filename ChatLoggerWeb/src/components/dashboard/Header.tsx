import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, Settings, LogOut, Moon, Sun, Menu, X, Sparkles, ChevronDown, Search, Brain } from 'lucide-react'
import { Button } from '../ui'
import clsx from 'clsx'

interface SearchableItem {
  id: string
  name: string
  lastMessage?: string
  needsReply?: boolean
}

interface HeaderProps {
  userName?: string
  onLogout: () => void
  onToggleTheme?: () => void
  isDarkMode?: boolean
  searchItems?: SearchableItem[]
  onSearchSelect?: (id: string) => void
}

export function Header({ userName, onLogout, onToggleTheme, isDarkMode, searchItems = [], onSearchSelect }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isLabPage = location.pathname === '/lab'

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

  const notifications = [
    {
      id: 1,
      title: 'SLA 초과 알림',
      message: '테스트병원 티켓이 SLA를 초과했습니다',
      time: '5분 전',
      type: 'warning',
      unread: true,
    },
    {
      id: 2,
      title: '긴급 티켓',
      message: '새로운 긴급 티켓이 접수되었습니다',
      time: '10분 전',
      type: 'urgent',
      unread: true,
    },
    {
      id: 3,
      title: '시스템 알림',
      message: '워커 서비스가 정상 동작 중입니다',
      time: '1시간 전',
      type: 'info',
      unread: false,
    },
  ]

  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-accent-purple rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-brand-500 to-accent-purple rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                MotionLabs AI-CS
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">
                System
              </p>
            </div>
          </div>

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
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">병원 검색</span>
                <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-2xs text-slate-400 border border-slate-200 dark:border-slate-600">
                  ⌘K
                </kbd>
              </button>

              {/* Search Modal */}
              {showSearch && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSearch(false)}
                  />
                  {/* Modal */}
                  <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-elevated border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-fade-in-down">
                    {/* Search Input */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="병원명 또는 메시지 검색..."
                          className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-64 overflow-y-auto">
                      {searchQuery.trim() === '' ? (
                        <div className="p-4 text-center text-sm text-slate-400">
                          검색어를 입력하세요
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-400">
                          "{searchQuery}" 검색 결과 없음
                        </div>
                      ) : (
                        searchResults.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSearchSelect(item.id)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-start gap-3"
                          >
                            <div className={clsx(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium flex-shrink-0',
                              item.needsReply
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            )}>
                              {item.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                                  {item.name}
                                </span>
                                {item.needsReply && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 text-2xs rounded">
                                    대기
                                  </span>
                                )}
                              </div>
                              {item.lastMessage && (
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {item.lastMessage}
                                </p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between text-2xs text-slate-400">
                        <span>↑↓ 이동</span>
                        <span>Enter 선택</span>
                        <span>ESC 닫기</span>
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
                }}
                className="relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full flex items-center justify-center font-medium shadow-lg animate-bounce-soft">
                    {unreadCount}
                  </span>
                )}
              </Button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-elevated border border-slate-200 dark:border-slate-700 py-2 animate-fade-in-down overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">알림</span>
                    <span className="text-xs text-slate-500">모두 읽음으로 표시</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={clsx(
                          'px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors',
                          notification.unread && 'bg-brand-50/50 dark:bg-brand-900/10'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={clsx(
                              'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                              notification.type === 'warning' && 'bg-amber-500',
                              notification.type === 'urgent' && 'bg-red-500 animate-pulse',
                              notification.type === 'info' && 'bg-blue-500'
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
                    <button className="w-full text-center text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium">
                      모든 알림 보기
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            {onToggleTheme && (
              <Button variant="ghost" size="sm" onClick={onToggleTheme} className="rounded-xl">
                {isDarkMode ? (
                  <Sun className="w-5 h-5 text-amber-500" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>
            )}

            {/* Lab Button */}
            <Button
              variant="ghost"
              size="sm"
              className={clsx(
                'rounded-xl flex items-center gap-2',
                isLabPage && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              )}
              onClick={() => navigate('/lab')}
            >
              <Brain className="w-5 h-5" />
              <span className="text-sm font-medium hidden lg:inline">연구실</span>
            </Button>

            {/* Settings */}
            <Button variant="ghost" size="sm" className="rounded-xl">
              <Settings className="w-5 h-5" />
            </Button>

            {/* Divider */}
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2" />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu)
                  setShowNotifications(false)
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-white font-medium text-sm">
                  {userName?.charAt(0) || 'A'}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {userName || 'Admin'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">관리자</p>
                </div>
                <ChevronDown className={clsx(
                  'w-4 h-4 text-slate-400 transition-transform duration-200',
                  showUserMenu && 'rotate-180'
                )} />
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-elevated border border-slate-200 dark:border-slate-700 py-2 animate-fade-in-down">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">admin@motionlabs.kr</p>
                  </div>
                  <div className="py-1">
                    <button className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      설정
                    </button>
                    <button
                      onClick={onLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden rounded-xl"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden py-4 border-t border-slate-200 dark:border-slate-700 animate-fade-in-down">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-white font-medium">
                  {userName?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">관리자</p>
                </div>
              </div>
              <Button variant="ghost" className="justify-start" onClick={onLogout}>
                <LogOut className="w-5 h-5 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header

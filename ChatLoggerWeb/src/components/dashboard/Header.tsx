import { useState } from 'react'
import { Bell, Settings, LogOut, Moon, Sun, Menu, X, Sparkles, ChevronDown, Search } from 'lucide-react'
import { Button } from '../ui'
import clsx from 'clsx'

interface HeaderProps {
  userName?: string
  onLogout: () => void
  onToggleTheme?: () => void
  isDarkMode?: boolean
}

export function Header({ userName, onLogout, onToggleTheme, isDarkMode }: HeaderProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

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
                CS Intelligence
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">
                MotionLabs Dashboard
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search */}
            <div className="relative mr-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <Search className="w-4 h-4" />
                <span className="text-sm">검색...</span>
                <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-700 rounded-md text-xs text-slate-400 border border-slate-200 dark:border-slate-600">
                  ⌘K
                </kbd>
              </div>
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

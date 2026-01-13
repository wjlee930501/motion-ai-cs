import { useState } from 'react'
import { Bell, Settings, LogOut, Moon, Sun, Menu, X } from 'lucide-react'
import { Button } from '../ui'

interface HeaderProps {
  userName?: string
  onLogout: () => void
  onToggleTheme?: () => void
  isDarkMode?: boolean
}

export function Header({ userName, onLogout, onToggleTheme, isDarkMode }: HeaderProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CS</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                CS Intelligence
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-0.5">
                MotionLabs Dashboard
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  2
                </span>
              </Button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="font-semibold text-gray-900 dark:text-white">알림</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">SLA 초과 알림</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">테스트병원 티켓이 SLA를 초과했습니다</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">5분 전</p>
                    </div>
                    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">긴급 티켓</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">새로운 긴급 티켓이 접수되었습니다</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">10분 전</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            {onToggleTheme && (
              <Button variant="ghost" size="sm" onClick={onToggleTheme}>
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            )}

            {/* Settings */}
            <Button variant="ghost" size="sm">
              <Settings className="w-5 h-5" />
            </Button>

            {/* User Info & Logout */}
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-gray-200 dark:border-gray-700">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{userName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">관리자</p>
              </div>
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{userName}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">관리자</span>
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

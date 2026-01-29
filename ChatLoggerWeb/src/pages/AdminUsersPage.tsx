import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import {
  Users,
  UserPlus,
  Trash2,
  ArrowLeft,
  Shield,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import ticketApi from '@/services/ticketApi'
import { User } from '@/types/ticket.types'
import toast from 'react-hot-toast'

export function AdminUsersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, checkAuth, isAuthenticated } = useAuthStore()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  const isAdmin = user?.email === 'admin'

  useEffect(() => {
    if (user && !isAdmin) {
      toast.error('관리자만 접근할 수 있습니다.')
      navigate('/tickets')
    }
  }, [user, isAdmin, navigate])

  const { data: usersData, isLoading, error } = useQuery(
    'users',
    () => ticketApi.getUsers(),
    { enabled: isAdmin }
  )

  const createMutation = useMutation(
    (userData: { email: string; password: string; name: string }) =>
      ticketApi.createUser(userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users')
        setShowCreateForm(false)
        setNewUser({ email: '', password: '', name: '' })
        toast.success('계정이 생성되었습니다.')
      },
      onError: () => {
        toast.error('계정 생성에 실패했습니다.')
      },
    }
  )

  const deleteMutation = useMutation(
    (userId: number) => ticketApi.deleteUser(userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users')
        setDeleteConfirm(null)
        toast.success('계정이 삭제되었습니다.')
      },
      onError: () => {
        toast.error('계정 삭제에 실패했습니다.')
      },
    }
  )

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('모든 필드를 입력해주세요.')
      return
    }
    createMutation.mutate(newUser)
  }

  const handleDeleteUser = (userId: number) => {
    if (deleteConfirm === userId) {
      deleteMutation.mutate(userId)
    } else {
      setDeleteConfirm(userId)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/tickets')}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                    계정 관리
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    직원 계정 발급 및 관리
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              <UserPlus className="w-4 h-4" />
              계정 추가
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {usersData?.users?.length || 0}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">전체 계정</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">1</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">관리자</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {(usersData?.users?.length || 1) - 1}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">직원 계정</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              등록된 계정
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-red-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              계정 목록을 불러오는데 실패했습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {usersData?.users?.map((userItem: User) => (
                <div
                  key={userItem.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold text-lg shadow-lg ${
                      userItem.email === 'admin'
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      {userItem.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {userItem.name}
                        </p>
                        {userItem.email === 'admin' && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                            관리자
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {userItem.email}
                      </p>
                    </div>
                  </div>

                  {userItem.email !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(userItem.id)}
                      disabled={deleteMutation.isLoading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        deleteConfirm === userItem.id
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                      }`}
                    >
                      {deleteMutation.isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {deleteConfirm === userItem.id ? '삭제 확인' : '삭제'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateForm(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-500 to-blue-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">새 계정 생성</h3>
                  <p className="text-sm text-blue-100">직원 계정을 추가합니다</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <UserIcon className="w-4 h-4" />
                  이름
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  이메일 / 아이디
                </label>
                <input
                  type="text"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@motionlabs.kr"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="w-4 h-4" />
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {createMutation.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      계정 생성
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsersPage

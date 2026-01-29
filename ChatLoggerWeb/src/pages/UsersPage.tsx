import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import ticketApi from '@/services/ticketApi'
import { User, UserCreate, UserUpdate } from '@/types/ticket.types'
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Shield,
  ShieldOff,
  X,
  Check,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'

export function UsersPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isAdmin, user: currentUser, checkAuth } = useAuthStore()

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New user form
  const [showNewUserForm, setShowNewUserForm] = useState(false)
  const [newUser, setNewUser] = useState<UserCreate>({
    email: '',
    password: '',
    name: '',
    role: 'member',
  })
  const [isCreating, setIsCreating] = useState(false)

  // Edit user
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: '' })

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    } else if (!isAdmin) {
      navigate('/tickets')
    }
  }, [isAuthenticated, isAdmin, navigate])

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadUsers()
    }
  }, [isAuthenticated, isAdmin])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const response = await ticketApi.getUsers()
      if (response.ok) {
        setUsers(response.users)
      }
    } catch {
      setError('사용자 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.email || !newUser.password || !newUser.name) {
      setError('모든 필드를 입력해주세요.')
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      const response = await ticketApi.createUser(newUser)
      if (response.ok) {
        setUsers([...users, response.user])
        setShowNewUserForm(false)
        setNewUser({ email: '', password: '', name: '', role: 'member' })
      }
    } catch {
      setError('사용자 생성에 실패했습니다.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('정말 이 사용자를 삭제하시겠습니까?')) return

    try {
      setError(null)
      const response = await ticketApi.deleteUser(userId)
      if (response.ok) {
        setUsers(users.filter((u) => u.id !== userId))
      }
    } catch {
      setError('사용자 삭제에 실패했습니다.')
    }
  }

  const startEditing = (user: User) => {
    setEditingUserId(user.id)
    setEditForm({ name: user.name, email: user.email, password: '', role: user.role })
  }

  const handleUpdateUser = async (userId: number) => {
    try {
      setError(null)
      const updateData: UserUpdate = {}
      if (editForm.name) updateData.name = editForm.name
      if (editForm.email) updateData.email = editForm.email
      if (editForm.password) updateData.password = editForm.password
      if (editForm.role) updateData.role = editForm.role as 'admin' | 'member'

      const response = await ticketApi.updateUser(userId, updateData)
      if (response.ok) {
        setUsers(users.map((u) => (u.id === userId ? response.user : u)))
        setEditingUserId(null)
      }
    } catch {
      setError('사용자 수정에 실패했습니다.')
    }
  }

  if (!isAuthenticated || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tickets')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <h1 className="text-xl font-semibold">사용자 관리</h1>
            </div>
          </div>
          <button
            onClick={() => setShowNewUserForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            새 사용자
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* New User Form */}
        {showNewUserForm && (
          <div className="mb-8 p-6 bg-gray-900 border border-white/10 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              새 사용자 생성
            </h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">이름</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">이메일 (로그인 ID)</label>
                <input
                  type="text"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="********"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">권한</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'member' })}
                  className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="member">일반 멤버</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowNewUserForm(false)}
                  className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isCreating ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-sm text-white/60">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">이름</th>
                <th className="px-6 py-4">이메일</th>
                <th className="px-6 py-4">권한</th>
                <th className="px-6 py-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/40">
                    로딩 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/40">
                    등록된 사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 text-white/60">{user.id}</td>
                    <td className="px-6 py-4">
                      {editingUserId === user.id ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 bg-gray-800 border border-white/20 rounded"
                        />
                      ) : (
                        <span className="flex items-center gap-2">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                              나
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white/80">
                      {editingUserId === user.id ? (
                        <input
                          type="text"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-2 py-1 bg-gray-800 border border-white/20 rounded"
                        />
                      ) : (
                        user.email
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingUserId === user.id ? (
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="px-2 py-1 bg-gray-800 border border-white/20 rounded"
                          disabled={user.id === currentUser?.id}
                        >
                          <option value="member">일반 멤버</option>
                          <option value="admin">관리자</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm ${
                            user.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <Shield className="w-3.5 h-3.5" />
                          ) : (
                            <ShieldOff className="w-3.5 h-3.5" />
                          )}
                          {user.role === 'admin' ? '관리자' : '멤버'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {editingUserId === user.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateUser(user.id)}
                              className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                              title="저장"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-2 text-white/40 hover:bg-white/10 rounded-lg transition-colors"
                              title="취소"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(user)}
                              className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                              title="수정"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={user.id === currentUser?.id}
                              className="p-2 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                              title={user.id === currentUser?.id ? '자신은 삭제할 수 없습니다' : '삭제'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

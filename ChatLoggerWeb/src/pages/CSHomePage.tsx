import React, { useEffect, useState } from 'react'
import { CSChatRoomList } from '@/components/cs/CSChatRoomList'
import { ChatMessageList } from '@/components/ChatMessageList'
import { CustomerInfoPanel } from '@/components/cs/CustomerInfoPanel'
import { ResponseTemplates } from '@/components/cs/ResponseTemplates'
import { CSDashboard } from '@/components/cs/CSDashboard'
import { 
  FiHome,
  FiMessageSquare,
  FiBarChart2,
  FiUsers,
  FiSettings,
  FiRefreshCw,
  FiBell,
  FiSearch
} from 'react-icons/fi'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// Mock data for demonstration
const mockCustomer = {
  id: '1',
  name: '김모션',
  phone: '010-1234-5678',
  email: 'kim@example.com',
  registrationDate: '2023-01-15',
  tier: 'Premium' as const,
  totalInquiries: 24,
  lastContactDate: Date.now() - 86400000,
  tags: ['주요고객', '기술문의', '앱사용자'],
  notes: '앱 사용 중 자주 기술적 문의를 함. 친절한 응대 필요.'
}

const mockTemplates = [
  {
    id: '1',
    title: '인사말',
    content: '안녕하세요, 모션랩스 고객센터입니다. 어떤 도움이 필요하신가요?',
    category: '기본',
    keywords: ['인사', '시작'],
    usage: 245,
    lastUsed: Date.now() - 3600000
  },
  {
    id: '2',
    title: '배송 문의 응답',
    content: '고객님의 주문 배송 상태를 확인해드리겠습니다. 주문번호를 알려주시겠어요?',
    category: '배송',
    keywords: ['배송', '주문', '추적'],
    usage: 189,
    lastUsed: Date.now() - 7200000
  },
  {
    id: '3',
    title: '환불 안내',
    content: '환불 요청 도와드리겠습니다. 구매하신 제품명과 주문번호를 확인해주세요.',
    category: '환불/교환',
    keywords: ['환불', '반품', '교환'],
    usage: 156,
    lastUsed: Date.now() - 10800000
  }
]

const mockStats = {
  totalInquiries: 127,
  totalInquiriesTrend: 12,
  resolvedToday: 89,
  resolvedTodayTrend: -5,
  pendingInquiries: 38,
  pendingInquiriesTrend: 8,
  avgResponseTime: 4.2,
  avgResponseTimeTrend: -15,
  avgResolutionTime: 24.5,
  avgResolutionTimeTrend: -10,
  satisfactionRate: 92,
  satisfactionRateTrend: 3,
  agentPerformance: [
    {
      agentId: '1',
      agentName: '이상담',
      totalHandled: 32,
      avgResponseTime: 3.5,
      avgResolutionTime: 18,
      satisfactionRate: 95,
      currentLoad: 65,
      status: 'online' as const
    },
    {
      agentId: '2',
      agentName: '박지원',
      totalHandled: 28,
      avgResponseTime: 4.8,
      avgResolutionTime: 22,
      satisfactionRate: 88,
      currentLoad: 80,
      status: 'busy' as const
    },
    {
      agentId: '3',
      agentName: '김서비스',
      totalHandled: 25,
      avgResponseTime: 5.2,
      avgResolutionTime: 28,
      satisfactionRate: 90,
      currentLoad: 45,
      status: 'online' as const
    }
  ],
  hourlyDistribution: [],
  categoryDistribution: [
    { category: '기술지원', count: 45, percentage: 35 },
    { category: '배송문의', count: 32, percentage: 25 },
    { category: '환불/교환', count: 28, percentage: 22 },
    { category: '제품문의', count: 15, percentage: 12 },
    { category: '기타', count: 7, percentage: 6 }
  ]
}

type ViewMode = 'dashboard' | 'chat' | 'customers' | 'analytics'

export const CSHomePage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])

  useEffect(() => {
    // Mock data setup
    const mockRooms = [
      {
        id: '1',
        roomName: '김모션',
        lastMessageAt: Date.now() - 300000,
        lastMessage: '앱이 계속 종료되는데 확인 부탁드립니다',
        unreadCount: 2,
        customer: mockCustomer,
        status: 'waiting' as const,
        priority: 'high' as const,
        category: '기술지원',
        tags: ['앱오류', '긴급'],
        responseTime: 12
      },
      {
        id: '2',
        roomName: '이고객',
        lastMessageAt: Date.now() - 600000,
        lastMessage: '주문한 상품이 아직 안왔어요',
        unreadCount: 0,
        status: 'in_progress' as const,
        priority: 'normal' as const,
        assignedTo: '이상담',
        category: '배송문의',
        tags: ['배송지연'],
        responseTime: 5
      },
      {
        id: '3',
        roomName: '박구매',
        lastMessageAt: Date.now() - 900000,
        lastMessage: '환불 처리 완료되었나요?',
        unreadCount: 1,
        status: 'on_hold' as const,
        priority: 'urgent' as const,
        category: '환불/교환',
        tags: ['환불', 'VIP'],
        responseTime: 18
      }
    ]
    setRooms(mockRooms)
  }, [])

  const handleRoomSelect = (room: any) => {
    setSelectedRoom(room)
    // Mock messages
    setMessages([
      {
        id: '1',
        roomId: room.id,
        timestamp: Date.now() - 1800000,
        sender: room.roomName,
        body: '안녕하세요',
        isFromMe: false
      },
      {
        id: '2',
        roomId: room.id,
        timestamp: Date.now() - 1700000,
        sender: 'CS팀',
        body: '안녕하세요, 모션랩스 고객센터입니다. 어떤 도움이 필요하신가요?',
        isFromMe: true
      },
      {
        id: '3',
        roomId: room.id,
        timestamp: Date.now() - 1600000,
        sender: room.roomName,
        body: room.lastMessage,
        isFromMe: false
      }
    ])
  }

  const handleUseTemplate = (template: any) => {
    toast.success(`템플릿 "${template.title}" 적용됨`)
  }

  const renderContent = () => {
    switch (viewMode) {
      case 'dashboard':
        return <CSDashboard stats={mockStats} />
      
      case 'chat':
        return (
          <div className="flex h-full">
            <CSChatRoomList
              rooms={rooms}
              selectedRoom={selectedRoom}
              onRoomSelect={handleRoomSelect}
            />
            
            <div className="flex-1 flex">
              {selectedRoom ? (
                <>
                  <div className="flex-1 flex flex-col">
                    <ChatMessageList
                      messages={messages}
                      roomName={selectedRoom.roomName}
                    />
                    
                    {/* Quick Actions Bar */}
                    <div className="bg-white border-t border-gray-200 p-4">
                      <div className="flex items-center space-x-2">
                        <button className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                          상태 변경
                        </button>
                        <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                          담당자 할당
                        </button>
                        <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                          태그 추가
                        </button>
                        <button className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600">
                          해결 완료
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Sidebar */}
                  <div className="w-96 bg-gray-50 border-l border-gray-200 p-4 space-y-4 overflow-y-auto">
                    <CustomerInfoPanel
                      customer={selectedRoom.customer || mockCustomer}
                      inquiryHistory={[
                        {
                          date: '2024-01-10',
                          category: '기술지원',
                          status: 'resolved',
                          satisfaction: 5
                        },
                        {
                          date: '2024-01-05',
                          category: '배송문의',
                          status: 'resolved',
                          satisfaction: 4
                        }
                      ]}
                    />
                    
                    <ResponseTemplates
                      templates={mockTemplates}
                      onUseTemplate={handleUseTemplate}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <FiMessageSquare className="text-6xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">상담을 선택하세요</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      
      case 'customers':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">고객 관리</h2>
            <p className="text-gray-600">고객 정보 관리 페이지</p>
          </div>
        )
      
      case 'analytics':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">상세 분석</h2>
            <CSDashboard stats={mockStats} />
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-gray-900">
              MotionLabs CS Center
            </h1>
            
            {/* Navigation Tabs */}
            <nav className="flex space-x-1">
              <button
                onClick={() => setViewMode('dashboard')}
                className={clsx(
                  'flex items-center px-4 py-2 text-sm font-medium rounded-lg',
                  viewMode === 'dashboard'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <FiHome className="mr-2" />
                대시보드
              </button>
              <button
                onClick={() => setViewMode('chat')}
                className={clsx(
                  'flex items-center px-4 py-2 text-sm font-medium rounded-lg',
                  viewMode === 'chat'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <FiMessageSquare className="mr-2" />
                상담 관리
              </button>
              <button
                onClick={() => setViewMode('customers')}
                className={clsx(
                  'flex items-center px-4 py-2 text-sm font-medium rounded-lg',
                  viewMode === 'customers'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <FiUsers className="mr-2" />
                고객 관리
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={clsx(
                  'flex items-center px-4 py-2 text-sm font-medium rounded-lg',
                  viewMode === 'analytics'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <FiBarChart2 className="mr-2" />
                분석
              </button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Notification Badge */}
            <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
              <FiBell className="text-xl" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
              <FiSearch className="text-xl" />
            </button>
            
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
              <FiRefreshCw className="text-xl" />
            </button>
            
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
              <FiSettings className="text-xl" />
            </button>
            
            {/* Agent Status */}
            <div className="flex items-center space-x-2 pl-3 border-l border-gray-200">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">이상담</span>
              <span className="text-xs text-gray-500">온라인</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}
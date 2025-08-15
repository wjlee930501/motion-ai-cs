import React from 'react'
import { Customer } from '@/types/cs.types'
import { 
  FiUser, 
  FiPhone, 
  FiMail, 
  FiCalendar, 
  FiMessageCircle,
  FiStar,
  FiTag,
  FiEdit2,
  FiClock
} from 'react-icons/fi'
import { format } from 'date-fns'
import clsx from 'clsx'

interface CustomerInfoPanelProps {
  customer: Customer | null
  inquiryHistory?: {
    date: string
    category: string
    status: 'resolved' | 'pending'
    satisfaction?: number
  }[]
  onEditCustomer?: (customer: Customer) => void
}

export const CustomerInfoPanel: React.FC<CustomerInfoPanelProps> = ({
  customer,
  inquiryHistory = [],
  onEditCustomer
}) => {
  if (!customer) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <FiUser className="text-4xl mx-auto mb-2" />
          <p>고객 정보가 없습니다</p>
        </div>
      </div>
    )
  }

  const getTierColor = (tier: Customer['tier']) => {
    switch (tier) {
      case 'VIP':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'Premium':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'Regular':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'New':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Customer Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <FiUser className="text-xl text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {customer.name}
              </h3>
              <span className={clsx(
                'inline-block px-2 py-1 text-xs font-medium rounded-full border',
                getTierColor(customer.tier)
              )}>
                {customer.tier} 고객
              </span>
            </div>
          </div>
          {onEditCustomer && (
            <button
              onClick={() => onEditCustomer(customer)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <FiEdit2 />
            </button>
          )}
        </div>

        {/* Contact Info */}
        <div className="space-y-2">
          {customer.phone && (
            <div className="flex items-center text-sm text-gray-600">
              <FiPhone className="mr-2 text-gray-400" />
              {customer.phone}
            </div>
          )}
          {customer.email && (
            <div className="flex items-center text-sm text-gray-600">
              <FiMail className="mr-2 text-gray-400" />
              {customer.email}
            </div>
          )}
          <div className="flex items-center text-sm text-gray-600">
            <FiCalendar className="mr-2 text-gray-400" />
            가입일: {customer.registrationDate}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <FiClock className="mr-2 text-gray-400" />
            마지막 연락: {format(customer.lastContactDate, 'yyyy-MM-dd HH:mm')}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900">
              {customer.totalInquiries}
            </div>
            <div className="text-xs text-gray-600">총 문의 건수</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(customer.totalInquiries * 0.85)}%
            </div>
            <div className="text-xs text-gray-600">평균 만족도</div>
          </div>
        </div>

        {/* Tags */}
        {customer.tags && customer.tags.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center flex-wrap gap-2">
              <FiTag className="text-gray-400" />
              {customer.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {customer.notes && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>메모:</strong> {customer.notes}
            </p>
          </div>
        )}
      </div>

      {/* Inquiry History */}
      <div className="p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
          <FiMessageCircle className="mr-2" />
          최근 상담 이력
        </h4>
        
        {inquiryHistory.length > 0 ? (
          <div className="space-y-2">
            {inquiryHistory.slice(0, 5).map((inquiry, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {inquiry.category}
                    </span>
                    <span className={clsx(
                      'px-2 py-0.5 text-xs rounded-full',
                      inquiry.status === 'resolved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    )}>
                      {inquiry.status === 'resolved' ? '해결' : '진행중'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {inquiry.date}
                  </span>
                </div>
                {inquiry.satisfaction && (
                  <div className="flex items-center">
                    <FiStar className={clsx(
                      'text-sm',
                      inquiry.satisfaction >= 4
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    )} />
                    <span className="ml-1 text-sm text-gray-600">
                      {inquiry.satisfaction}/5
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">상담 이력이 없습니다</p>
        )}
      </div>
    </div>
  )
}
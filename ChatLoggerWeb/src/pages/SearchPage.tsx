import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchBar } from '@/components/SearchBar'
import { chatApi } from '@/services/api'
import { ChatMessage } from '@/types'
import { format } from 'date-fns'
import { FiArrowLeft } from 'react-icons/fi'

export const SearchPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    try {
      const results = await chatApi.searchMessages(query)
      setSearchResults(results)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="text-xl" />
          </button>
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} placeholder="메시지 검색..." />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isSearching ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">검색 중...</p>
          </div>
        ) : hasSearched && searchResults.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">검색 결과가 없습니다</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {searchResults.length}개의 결과를 찾았습니다
            </p>
            {searchResults.map((message) => (
              <div
                key={message.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-900">
                      {message.sender}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      {format(message.timestamp, 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {message.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">검색어를 입력하세요</p>
          </div>
        )}
      </div>
    </div>
  )
}
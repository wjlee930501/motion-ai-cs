import React, { useState } from 'react'
import { ResponseTemplate } from '@/types/cs.types'
import { 
  FiCopy, 
  FiEdit2, 
  FiSearch, 
  FiPlus,
  FiTrendingUp,
  FiClock,
  FiHash
} from 'react-icons/fi'
import clsx from 'clsx'

interface ResponseTemplatesProps {
  templates: ResponseTemplate[]
  onUseTemplate: (template: ResponseTemplate) => void
  onEditTemplate?: (template: ResponseTemplate) => void
  onCreateTemplate?: () => void
}

export const ResponseTemplates: React.FC<ResponseTemplatesProps> = ({
  templates,
  onUseTemplate,
  onEditTemplate,
  onCreateTemplate
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))]
  
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const sortedTemplates = [...filteredTemplates].sort((a, b) => b.usage - a.usage)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">응답 템플릿</h3>
          {onCreateTemplate && (
            <button
              onClick={onCreateTemplate}
              className="flex items-center px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <FiPlus className="mr-1" />
              새 템플릿
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="템플릿 검색..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex space-x-2 overflow-x-auto">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={clsx(
                'px-3 py-1 text-sm rounded-lg whitespace-nowrap',
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {category === 'all' ? '전체' : category}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {sortedTemplates.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            템플릿이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedTemplates.map((template) => (
              <div
                key={template.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {template.title}
                    </h4>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500 flex items-center">
                        <FiHash className="mr-1" />
                        {template.category}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center">
                        <FiTrendingUp className="mr-1" />
                        {template.usage}회 사용
                      </span>
                      {template.lastUsed && (
                        <span className="text-xs text-gray-500 flex items-center">
                          <FiClock className="mr-1" />
                          {new Date(template.lastUsed).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onUseTemplate(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="템플릿 사용"
                    >
                      <FiCopy />
                    </button>
                    {onEditTemplate && (
                      <button
                        onClick={() => onEditTemplate(template)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="템플릿 수정"
                      >
                        <FiEdit2 />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {template.content}
                </p>

                {template.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
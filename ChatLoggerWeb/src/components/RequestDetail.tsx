import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  FiX,
  FiRefreshCw
} from 'react-icons/fi';
import { useQuery } from 'react-query';
import { requestApi } from '../api/requests';

interface RequestDetailProps {
  request: any;
  onClose: () => void;
  onUpdate: (data: any) => void;
  onReprocess: () => void;
}

const RequestDetail: React.FC<RequestDetailProps> = ({
  request,
  onClose,
  onUpdate,
  onReprocess
}) => {
  const [notes, setNotes] = useState(request.notes || '');
  const [assignee, setAssignee] = useState(request.assignee || '');

  // ESC key listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Fetch full request details with context
  const { data: fullRequest } = useQuery(
    ['request', request.id],
    () => requestApi.getRequest(request.id)
  );

  // Fetch templates
  const { data: templates } = useQuery(
    'templates',
    requestApi.getTemplates
  );

  const handleSave = () => {
    onUpdate({
      notes,
      assignee: assignee || null
    });
  };

  const handleTemplateSelect = async (template: any) => {
    setNotes(notes + '\n\n' + template.template_text);
    await requestApi.useTemplate(template.id);
  };

  return (
    <div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              요청 상세 정보
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-80px)]">
          {/* Left Panel - Request Info */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">기본 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">채팅방:</span>
                    <span className="font-medium">{request.room_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">발신자:</span>
                    <span className="font-medium">{request.sender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">요청 유형:</span>
                    <span className="font-medium">{request.request_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">긴급도:</span>
                    <span className={`font-medium ${
                      request.urgency === 'high' ? 'text-red-600' :
                      request.urgency === 'normal' ? 'text-blue-600' :
                      'text-gray-600'
                    }`}>
                      {request.urgency === 'high' ? '긴급' :
                       request.urgency === 'normal' ? '보통' : '낮음'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">신뢰도:</span>
                    <span className="font-medium">
                      {(request.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">생성일시:</span>
                    <span className="font-medium">
                      {format(new Date(request.created_at), 'PPp', { locale: ko })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Original Message */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">원본 메시지</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {request.message_body}
                </p>
              </div>

              {/* Context Messages */}
              {fullRequest?.context && (
                <div>
                  <h3 className="font-semibold mb-3">대화 맥락</h3>
                  <div className="space-y-2">
                    {fullRequest.context.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.id === request.message_id
                            ? 'bg-yellow-100 border border-yellow-300'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{msg.sender}</span>
                          <span>
                            {format(new Date(msg.timestamp), 'HH:mm', { locale: ko })}
                          </span>
                        </div>
                        <p className="text-sm">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Actions & Templates */}
          <div className="w-80 border-l border-gray-200 p-4 flex flex-col">
            {/* Status & Assignment */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상태
                </label>
                <select
                  value={request.status}
                  onChange={(e) => onUpdate({ status: e.target.value })}
                  className="w-full border-gray-300 rounded-md"
                >
                  <option value="미처리">미처리</option>
                  <option value="진행중">진행중</option>
                  <option value="완료">완료</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  담당자
                </label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="담당자 이름 입력"
                  className="w-full border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  처리 메모
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="처리 내용이나 메모를 입력하세요"
                  className="w-full border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Templates */}
            {templates && templates.length > 0 && (
              <div className="flex-1 overflow-y-auto mb-4">
                <h3 className="font-semibold mb-3">응답 템플릿</h3>
                <div className="space-y-2">
                  {templates.map((template: any) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {template.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {template.category}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleSave}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
              <button
                onClick={onReprocess}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <FiRefreshCw className="h-4 w-4" />
                재분류 요청
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestDetail;
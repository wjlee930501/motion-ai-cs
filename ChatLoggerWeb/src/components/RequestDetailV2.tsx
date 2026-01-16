import React, { useEffect } from 'react'

interface RequestDetailV2Props {
  request: any
  onClose: () => void
  onUpdate: (data: any) => void
}

const RequestDetailV2: React.FC<RequestDetailV2Props> = ({ request, onClose, onUpdate }) => {
  // ESC key listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">요청 상세 (V2)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="space-y-4">
          <p><strong>채팅방:</strong> {request.room_name}</p>
          <p><strong>발신자:</strong> {request.sender}</p>
          <p><strong>내용:</strong> {request.message_body}</p>
          <p><strong>상태:</strong> {request.status}</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onUpdate({ status: '완료' })}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            완료
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default RequestDetailV2

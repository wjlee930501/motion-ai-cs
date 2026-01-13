import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { HomePage } from './pages/HomePage'
import { ChatPage } from './pages/ChatPage'
import { SearchPage } from './pages/SearchPage'
import { CSHomePage } from './pages/CSHomePage'
import { CSAnalyticsPage } from './pages/CSAnalyticsPage'
import { SimpleLoggerPage } from './pages/SimpleLoggerPage'
import { LoginPage } from './pages/LoginPage'
import { TicketsPageNew } from './pages/TicketsPageNew'
import RequestsPage from './pages/Requests/RequestsPage'
import wsService from './services/websocket'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  useEffect(() => {
    console.log('App mounted')
    // Connect to WebSocket on app start (optional, for legacy features)
    try {
      wsService.connect()
    } catch (error) {
      console.error('WebSocket connection error:', error)
    }

    return () => {
      wsService.disconnect()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* New v1 routes */}
            <Route path="/" element={<Navigate to="/tickets" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/tickets" element={<TicketsPageNew />} />

            {/* Legacy routes */}
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/analytics" element={<CSAnalyticsPage />} />
            <Route path="/cs" element={<CSHomePage />} />
            <Route path="/basic" element={<HomePage />} />
            <Route path="/logger" element={<SimpleLoggerPage />} />
            <Route path="/chat/:roomId" element={<ChatPage />} />
            <Route path="/search" element={<SearchPage />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App
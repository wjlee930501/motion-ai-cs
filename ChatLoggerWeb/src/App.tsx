import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { HomePage } from './pages/HomePage'
import { ChatPage } from './pages/ChatPage'
import { SearchPage } from './pages/SearchPage'
import { CSHomePage } from './pages/CSHomePage'
import { CSAnalyticsPage } from './pages/CSAnalyticsPage'
import { SimpleLoggerPage } from './pages/SimpleLoggerPage'
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
    // Connect to WebSocket on app start
    wsService.connect()

    return () => {
      wsService.disconnect()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<SimpleLoggerPage />} />
            <Route path="/analytics" element={<CSAnalyticsPage />} />
            <Route path="/cs" element={<CSHomePage />} />
            <Route path="/basic" element={<HomePage />} />
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
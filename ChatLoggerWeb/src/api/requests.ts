import axios from 'axios';

// Use Dashboard API for ticket/request operations
// Legacy endpoints have been migrated to Python backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface RequestFilters {
  status?: string;
  urgency?: string;
  type?: string;
  assignee?: string;
  limit?: number;
}

export interface RequestStats {
  summary: {
    total_requests: number;
    actual_requests: number;
    urgent_requests: number;
    pending_requests: number;
    in_progress_requests: number;
    completed_requests: number;
    today_requests: number;
  };
  byType: Array<{
    request_type: string;
    count: number;
  }>;
}

export const requestApi = {
  // Get requests with filters
  getRequests: async (filters: RequestFilters) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const { data } = await api.get(`/requests?${params.toString()}`);
    return data;
  },

  // Get single request with context
  getRequest: async (id: string) => {
    const { data } = await api.get(`/requests/${id}`);
    return data;
  },

  // Update request
  updateRequest: async (id: string, updateData: any) => {
    const { data } = await api.patch(`/requests/${id}`, updateData);
    return data;
  },

  // Reprocess request classification
  reprocessRequest: async (id: string) => {
    const { data } = await api.post(`/requests/reprocess/${id}`);
    return data;
  },

  // Get statistics
  getStats: async (): Promise<RequestStats> => {
    const { data } = await api.get('/requests/stats');
    return data;
  },

  // Get templates
  getTemplates: async () => {
    const { data } = await api.get('/templates');
    return data;
  },

  // Use template
  useTemplate: async (id: string) => {
    const { data } = await api.post(`/templates/${id}/use`);
    return data;
  },

  // Get overall statistics
  getOverviewStats: async () => {
    const { data } = await api.get('/stats/overview');
    return data;
  },

  // Get daily statistics
  getDailyStats: async (days: number = 7) => {
    const { data } = await api.get(`/stats/daily?days=${days}`);
    return data;
  },

  // Get statistics by type
  getStatsByType: async () => {
    const { data } = await api.get('/stats/by-type');
    return data;
  },

  // Get response times
  getResponseTimes: async () => {
    const { data } = await api.get('/stats/response-times');
    return data;
  },

  // Get assignee performance
  getAssigneePerformance: async () => {
    const { data } = await api.get('/stats/assignee-performance');
    return data;
  }
};

export default requestApi;
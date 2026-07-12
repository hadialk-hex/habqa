import axios from 'axios';

// Default to the same-origin proxy (see rewrites in next.config.ts) so no
// CORS or CSP exceptions are needed. NEXT_PUBLIC_API_URL overrides it.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/backend',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to login when the session expires or the token is revoked
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== 'undefined' &&
      error.response?.status === 401 &&
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/register')
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

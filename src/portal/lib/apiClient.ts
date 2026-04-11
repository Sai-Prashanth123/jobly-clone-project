import axios from 'axios';

// Base URL comes from VITE_API_URL in .env.local (see CLAUDE.md).
// Falls back to the Azure deployment if the env var is missing so that
// static hosting environments without a build-time env still work.
const API_URL =
  import.meta.env.VITE_API_URL ??
  'https://prashanthreddy-hndndtdfhkdjhwft.eastasia-01.azurewebsites.net/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from sessionStorage on every request
apiClient.interceptors.request.use(config => {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 → clear session and redirect to login
apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      sessionStorage.clear();
      window.location.href = '/portal/login';
    }
    return Promise.reject(err);
  },
);

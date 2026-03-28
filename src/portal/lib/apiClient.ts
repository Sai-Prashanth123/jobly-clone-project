import axios from 'axios';

const API_URL = 'https://prashanthreddy-hndndtdfhkdjhwft.eastasia-01.azurewebsites.net/api/v1';

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

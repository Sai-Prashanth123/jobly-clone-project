import axios from 'axios';
import { toast } from 'sonner';
import { getApiErrorMessage } from './apiError';

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

// Idle-session timeout: if no API activity for > IDLE_LIMIT, treat the session
// as expired on the next request and bounce to login. Mitigates unattended-
// workstation risk (#8 edge-case audit). Uses sessionStorage so closing the
// tab also resets it.
const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_KEY = 'last_activity_at';
function touchActivity() {
  sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}
function isIdleExpired(): boolean {
  const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
  return last > 0 && Date.now() - last > IDLE_LIMIT_MS;
}

// Attach JWT from sessionStorage on every request
apiClient.interceptors.request.use(config => {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    if (isIdleExpired()) {
      // Force a 401-style redirect on the next response — let it flow through
      // the normal handler so the redirect logic stays in one place.
      sessionStorage.clear();
      window.location.href = '/portal/login?reason=idle';
      return Promise.reject(new axios.Cancel('Session idle timeout'));
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 → clear session and redirect to login, preserving the current path
// so the user lands back where they were after re-authenticating.
let redirecting = false;
apiClient.interceptors.response.use(
  res => { touchActivity(); return res; },
  err => {
    const status = err.response?.status;

    // The backend gates a user who still must reset their temp password: every
    // protected call returns 403 PASSWORD_RESET_REQUIRED until they do. Push them
    // to the force-reset screen (the ProtectedRoute gate normally catches this
    // first; this is the defensive net for direct/stale API calls).
    if (status === 403 && err.response?.data?.code === 'PASSWORD_RESET_REQUIRED') {
      if (!window.location.pathname.endsWith('/force-password-reset')) {
        window.location.href = '/portal/force-password-reset';
      }
      return Promise.reject(err);
    }

    if (status === 401 && !redirecting) {
      redirecting = true;
      sessionStorage.clear();
      const here = window.location.pathname + window.location.search;
      // Don't loop back to login itself; only set redirect for in-portal pages.
      const redirectParam =
        here.startsWith('/portal/') && !here.startsWith('/portal/login')
          ? `?redirect=${encodeURIComponent(here)}`
          : '';
      window.location.href = `/portal/login${redirectParam}`;
      return Promise.reject(err);
    }

    // Surface failed DATA LOADS (GET) as a clear popup so the user always knows
    // why something didn't load (403/404/409/500/offline). Mutations
    // (POST/PUT/DELETE) already toast at the call site, so we skip them here to
    // avoid double toasts. 401 is handled by the redirect above. A request can
    // opt out by sending the header 'X-Silent-Error'.
    const method = (err.config?.method ?? '').toLowerCase();
    const silent = !!err.config?.headers?.['X-Silent-Error'];
    if (status !== 401 && method === 'get' && !silent) {
      const { title, description } = getApiErrorMessage(err);
      toast.error(title, { description, id: `api-${status ?? 'net'}-${description}` });
    }

    return Promise.reject(err);
  },
);

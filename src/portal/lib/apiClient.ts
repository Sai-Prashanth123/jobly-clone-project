import axios from 'axios';

// Extend Axios config to carry a retry flag used by the 401 refresh logic.
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

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
const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours
const ACTIVITY_KEY = 'last_activity_at';
function touchActivity() {
  sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}
function isIdleExpired(): boolean {
  const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
  return last > 0 && Date.now() - last > IDLE_LIMIT_MS;
}
if (typeof window !== 'undefined') {
  (['keydown', 'mousemove', 'touchstart', 'click'] as const).forEach(evt =>
    document.addEventListener(evt, touchActivity, { passive: true })
  );
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
  res => {
    touchActivity();
    // A successful response means the session is alive — clear the 401 redirect
    // latch so a future genuine 401 can redirect instead of being swallowed if
    // an earlier redirect was ever interrupted.
    redirecting = false;
    return res;
  },
  async err => {
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

    if (status === 401 && !err.config?._retry && !redirecting) {
      // Attempt a silent token refresh before giving up.
      const rawSession = sessionStorage.getItem('jobly_session');
      const refreshToken = rawSession ? (() => { try { return JSON.parse(rawSession)?.refreshToken; } catch { return null; } })() : null;

      if (refreshToken) {
        err.config._retry = true;
        try {
          const { data: refreshData } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const newToken: string = refreshData?.data?.token ?? refreshData?.data?.accessToken ?? refreshData?.token;
          if (newToken) {
            sessionStorage.setItem('access_token', newToken);
            // Merge new token into stored session
            if (rawSession) {
              try {
                const parsed = JSON.parse(rawSession);
                parsed.token = newToken;
                sessionStorage.setItem('jobly_session', JSON.stringify(parsed));
              } catch { /* ignore */ }
            }
            // Retry the original request with the new token
            err.config.headers = err.config.headers ?? {};
            err.config.headers.Authorization = `Bearer ${newToken}`;
            return apiClient.request(err.config);
          }
        } catch {
          // Refresh failed — fall through to logout
        }
      }

      redirecting = true;
      sessionStorage.clear();
      window.location.href = '/portal/login';
      return Promise.reject(err);
    }

    // Error toasts are surfaced centrally by the TanStack query/mutation caches
    // (see queryClient.ts surfaceRequestError) — the one place that catches BOTH
    // queries and mutations. This interceptor only owns the redirect/idle flows.
    return Promise.reject(err);
  },
);

import axios from 'axios';

// Extend Axios config to carry a retry flag used by the 401 refresh logic.
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

// Base URL comes from VITE_API_URL at build time (see CLAUDE.md).
//
// The default is RELATIVE on purpose. On AWS the SPA and the API are served
// from the same CloudFront distribution, so a relative path keeps every call
// same-origin: no CORS preflight, and the app works under whatever hostname
// it happens to be served from. Baking in an absolute host is what broke
// login the moment the site was reachable at www.joblysolutions.com as well
// as the cloudfront.net URL.
//
// It previously fell back to the Azure deployment, which no longer exists.
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

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

// ...except on the unauthenticated auth endpoints. A 401 from /auth/login is
// not an expired session — it IS the answer to the question being asked ("are
// these credentials valid?"). Redirecting on it reloaded /portal/login, which
// wiped the form and destroyed the "Invalid email or password" message before
// it could render, so a mistyped password looked like the Sign in button
// simply did nothing. Same reasoning for /auth/forgot-password.
//
// /auth/change-password is deliberately NOT exempt: it requires a valid token,
// so a 401 there really does mean the session died and the redirect is right.
// /auth/refresh never reaches this interceptor — it uses a bare axios call.
const UNAUTHENTICATED_AUTH_PATHS = ['/auth/login', '/auth/forgot-password'];
const isUnauthenticatedAuthCall = (url?: string) =>
  !!url && UNAUTHENTICATED_AUTH_PATHS.some(path => url.includes(path));

// Shared in-flight refresh call. Supabase refresh tokens rotate on use, so
// when several requests 401 at once (e.g. a dashboard firing parallel
// queries right as the token expires), each independently calling
// /auth/refresh meant only the first succeeded and the rest failed and
// logged the user out — even though the session was still perfectly valid.
// Concurrent 401s now await the same promise instead of racing.
let refreshPromise: Promise<string | null> | null = null;
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { data: refreshData } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      return refreshData?.data?.token ?? refreshData?.data?.accessToken ?? refreshData?.token ?? null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
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

    if (status === 401 && !isUnauthenticatedAuthCall(err.config?.url) && !err.config?._retry && !redirecting) {
      // Attempt a silent token refresh before giving up.
      const rawSession = sessionStorage.getItem('jobly_session');
      const refreshToken = rawSession ? (() => { try { return JSON.parse(rawSession)?.refreshToken; } catch { return null; } })() : null;

      if (refreshToken) {
        err.config._retry = true;
        try {
          const newToken = await refreshAccessToken(refreshToken);
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

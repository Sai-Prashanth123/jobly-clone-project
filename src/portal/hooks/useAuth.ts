export { useAuthContext as useAuth } from '../context/AuthContext';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

// Self-service password change — used by the forced first-login reset screen
// and the voluntary "Change Password" dialog. POST, so apiClient never
// auto-toasts (that's GET-only); callers surface errors inline from the thrown
// response. No custom headers — a custom header would trigger a CORS preflight
// that the backend's allowedHeaders (Content-Type, Authorization) would reject.
export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const { data } = await apiClient.post('/auth/change-password', body);
      return data;
    },
  });
}

// Self-service "Forgot password?" — always resolves (the backend never reveals
// whether the email exists), so the UI shows the same generic confirmation.
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiClient.post('/auth/forgot-password', { email });
      return data;
    },
  });
}

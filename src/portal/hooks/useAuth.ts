export { useAuthContext as useAuth } from '../context/AuthContext';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

// Self-service password change — used by the forced first-login reset screen
// and the voluntary "Change Password" dialog. POST, so apiClient does not
// auto-toast; callers surface errors from the thrown response.
export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const { data } = await apiClient.post('/auth/change-password', body, {
        headers: { 'X-Silent-Error': '1' },
      });
      return data;
    },
  });
}

// Self-service "Forgot password?" — always resolves (the backend never reveals
// whether the email exists), so the UI shows the same generic confirmation.
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiClient.post(
        '/auth/forgot-password',
        { email },
        { headers: { 'X-Silent-Error': '1' } },
      );
      return data;
    },
  });
}

import type { AxiosError } from 'axios';

// Central place that turns any failed request into a human-readable
// title + description. Prefers the backend's own `error` message (those are
// written for humans — e.g. the duplicate-email conflict), and falls back to a
// friendly status-based message so the user always understands what happened.

export function getStatus(error: unknown): number | undefined {
  return (error as AxiosError | undefined)?.response?.status;
}

export function getApiErrorMessage(error: unknown): { title: string; description: string } {
  const err = error as AxiosError<{ error?: string; message?: string }> | undefined;
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.error || err?.response?.data?.message;

  // Request was sent but no response came back → offline / CORS / server down.
  if (err?.request && !err?.response) {
    return {
      title: "Can't reach the server",
      description: 'Check your internet connection and try again in a moment.',
    };
  }

  switch (status) {
    case 400:
      return { title: 'Invalid request', description: serverMsg || 'Some details look incorrect. Please review and try again.' };
    case 401:
      return { title: 'Session expired', description: serverMsg || 'Please sign in again to continue.' };
    case 403:
      return { title: 'Access denied', description: serverMsg || "You don't have permission to view or change this." };
    case 404:
      return { title: 'Not found', description: serverMsg || 'This item may have been moved or deleted.' };
    case 409:
      return { title: 'Already exists', description: serverMsg || 'This conflicts with data that already exists.' };
    case 413:
      return { title: 'File too large', description: serverMsg || 'The file exceeds the allowed size limit.' };
    case 422:
      return { title: 'Validation error', description: serverMsg || 'Please correct the highlighted fields and try again.' };
    case 429:
      return { title: 'Too many requests', description: serverMsg || 'Please slow down and try again in a moment.' };
    default:
      if (status && status >= 500) {
        return { title: 'Server error', description: serverMsg || 'Something went wrong on our end. Please try again shortly.' };
      }
      return { title: 'Something went wrong', description: serverMsg || err?.message || 'Please try again.' };
  }
}

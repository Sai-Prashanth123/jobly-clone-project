import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMailerStatus } from '../../hooks/useSystem';

/**
 * One-line warning banner shown to admin/hr when GMAIL_USER / GMAIL_APP_PASSWORD
 * aren't set on the backend. Without this, welcome emails to new employees and
 * invoice emails to clients silently never send, and the only signal HR sees
 * is a toast warning *after* creating an employee.
 */
export function MailerStatusBanner() {
  const { user } = useAuth();
  const { data } = useMailerStatus();
  const [dismissed, setDismissed] = useState(false);

  const isHrOrAdmin = user?.role === 'admin' || user?.role === 'hr';
  if (!isHrOrAdmin) return null;
  if (!data) return null;
  if (data.configured) return null;
  if (dismissed) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 sm:px-4 py-2.5 flex items-start gap-3 text-sm portal-animate-in">
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">Email is not configured on the server.</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Welcome emails to new employees and invoice emails to clients will not be delivered until the server's
          <code className="mx-1 px-1 py-0.5 rounded bg-amber-100 font-mono text-[11px]">GMAIL_USER</code>
          and
          <code className="mx-1 px-1 py-0.5 rounded bg-amber-100 font-mono text-[11px]">GMAIL_APP_PASSWORD</code>
          environment variables are set. Until then, share temporary passwords manually.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded hover:bg-amber-100 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

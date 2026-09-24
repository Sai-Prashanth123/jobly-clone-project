import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useChangePassword } from '../../hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Voluntary "Change Password" — reused by the sidebar footer and the My Profile
// security card. Requires the current password (verified server-side) plus a new
// password + confirmation. Never generates a temp; sets the user-chosen password.
export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setErr(''); setShow(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    // Same rules as the forced-reset screen and the API's changePasswordSchema:
    // 8-12 characters, upper + lower + number. This screen previously checked
    // only the length, so it accepted alphanumeric passwords the backend then
    // rejected - the user got a server error for a form that had just told
    // them everything was fine.
    const missing = ([
      [next.length >= 8, 'be at least 8 characters'],
      [next.length <= 12, 'be no more than 12 characters'],
      [/[A-Z]/.test(next), 'contain an uppercase letter'],
      [/[a-z]/.test(next), 'contain a lowercase letter'],
      [/[0-9]/.test(next), 'contain a number'],
    ] as const).filter(([ok]) => !ok).map(([, label]) => label);
    if (missing.length) { setErr(`New password must ${missing.join(', ')}.`); return; }
    if (next !== confirm) { setErr('New password and confirmation do not match.'); return; }
    if (next === current) { setErr('New password must be different from your current password.'); return; }
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      toast.success('Password updated');
      reset();
      onOpenChange(false);
    } catch (e2: unknown) {
      const msg = (e2 as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Could not change password. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password, then choose a new one — 8–12 characters with an uppercase letter, a lowercase letter and a number.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Current password</Label>
            <Input id="cp-current" type={show ? 'text' : 'password'} value={current}
              onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New password</Label>
            <div className="relative">
              <Input id="cp-new" type={show ? 'text' : 'password'} value={next}
                onChange={e => setNext(e.target.value)} autoComplete="new-password" required className="pr-10" />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input id="cp-confirm" type={show ? 'text' : 'password'} value={confirm}
              onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending} className="gap-1.5">
              {change.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Update password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

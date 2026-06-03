import { useState } from 'react';

// Same base-URL resolution the public invoice view uses.
const API_URL = import.meta.env.VITE_API_URL
  ?? 'https://prashanthreddy-hndndtdfhkdjhwft.eastasia-01.azurewebsites.net/api/v1';

export interface ContactFields {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

type Status = 'idle' | 'sending' | 'success' | 'error';
const EMPTY: ContactFields = { name: '', email: '', phone: '', subject: '', message: '' };

// Shared logic for the landing-page Contact forms — POSTs to the public
// /contact endpoint (which emails info@joblysolutions.com) and tracks status.
export function useContactForm() {
  const [fields, setFields] = useState<ContactFields>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const set = (key: keyof ContactFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.name.trim() || !fields.email.trim() || !fields.message.trim()) {
      setStatus('error');
      setError('Please fill in your name, email, and message.');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to send your message.');
      setStatus('success');
      setFields(EMPTY);
    } catch (err) {
      setStatus('error');
      setError(
        (err as Error)?.message
          || 'Could not send your message. Please try again, or email info@joblysolutions.com directly.',
      );
    }
  };

  return { fields, set, status, error, submit };
}

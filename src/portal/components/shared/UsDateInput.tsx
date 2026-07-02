import { useRef, useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * US-format date input: text field masked as MM/DD/YYYY with a calendar button
 * that opens the native date picker. Native <input type="date"> renders in the
 * OS locale (dd-mm-yyyy outside the US) and `lang` can't override it — so the
 * visible field here is a plain text input we format ourselves, and the native
 * input stays hidden, used only for its calendar popup.
 *
 * Value in/out is ISO YYYY-MM-DD (empty string when blank) — drop-in
 * compatible with existing state previously bound to type="date" inputs.
 */
interface UsDateInputProps {
  value: string;                       // ISO YYYY-MM-DD or ''
  onChange: (iso: string) => void;
  min?: string;                        // ISO
  max?: string;                        // ISO
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
}

const isoToUs = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
};

const usToIso = (us: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(us);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const mo = Number(mm), d = Number(dd), y = Number(yyyy);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  // Reject impossible dates like 02/31 (UTC round-trip check).
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${yyyy}-${mm}-${dd}`;
};

/** Auto-insert slashes as the user types digits: 07022026 → 07/02/2026 */
const maskUs = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export function UsDateInput({
  value, onChange, min, max, disabled, required, className, id, placeholder = 'MM/DD/YYYY', ...rest
}: UsDateInputProps) {
  const [text, setText] = useState(() => isoToUs(value));
  const [invalid, setInvalid] = useState(false);
  const nativeRef = useRef<HTMLInputElement>(null);

  // Sync when the ISO value changes from outside (form reset, prefill, calendar pick).
  useEffect(() => {
    setText(prev => {
      const fromValue = isoToUs(value);
      // Don't clobber in-progress typing unless the parsed value actually differs.
      return usToIso(prev) === (value || null) && prev !== '' ? prev : fromValue;
    });
    if (value) setInvalid(false);
  }, [value]);

  const commit = (t: string) => {
    if (t === '') { setInvalid(false); onChange(''); return; }
    const iso = usToIso(t);
    if (!iso) { setInvalid(true); return; }
    if ((min && iso < min) || (max && iso > max)) { setInvalid(true); return; }
    setInvalid(false);
    onChange(iso);
  };

  const handleTextChange = (raw: string) => {
    const masked = maskUs(raw);
    setText(masked);
    // Commit eagerly once a full date is typed so dependent state stays live.
    if (masked.length === 10) commit(masked);
    else if (masked === '') commit('');
  };

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.click(); // Older browsers without showPicker()
    }
  };

  return (
    <div className={cn('relative', className)}>
      <input
        type="text"
        inputMode="numeric"
        id={id}
        value={text}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        maxLength={10}
        onChange={e => handleTextChange(e.target.value)}
        onBlur={() => commit(text)}
        aria-label={rest['aria-label']}
        className={cn(
          'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 pr-9 text-sm shadow-sm transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-red-400' : 'border-input',
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        title="Open calendar"
      >
        <Calendar className="h-4 w-4" />
      </button>
      {/* Hidden native input: calendar popup only. Kept visually invisible but
          positioned under the button so showPicker() anchors the popup nearby. */}
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        min={min}
        max={max}
        onChange={e => { onChange(e.target.value); setInvalid(false); }}
        className="absolute right-0 bottom-0 h-px w-px opacity-0 pointer-events-none"
      />
    </div>
  );
}

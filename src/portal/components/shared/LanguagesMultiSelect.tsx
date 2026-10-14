import { useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '../../lib/utils';
import { LANGUAGES } from '../../lib/languages';

interface LanguagesMultiSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const parse = (value: string): string[] =>
  value.split(',').map(s => s.trim()).filter(Boolean);

export function LanguagesMultiSelect({ value, onChange, placeholder = 'Select languages…', className }: LanguagesMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = parse(value);

  // Sixty-eight languages behind an eight-row window. Without a filter the
  // only way to reach Telugu is to scroll and read, and this list is not even
  // alphabetical by accident of how it was written.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? LANGUAGES.filter(l => l.toLowerCase().includes(q)) : LANGUAGES;
  }, [query]);

  const toggle = (lang: string) => {
    const next = selected.includes(lang)
      ? selected.filter(l => l !== lang)
      : [...selected, lang];
    onChange(next.join(', '));
  };

  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
        >
          <span className={cn('truncate text-left', selected.length === 0 && 'text-muted-foreground')}>
            {selected.length > 0 ? selected.join(', ') : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onOpenAutoFocus={e => { e.preventDefault(); searchRef.current?.focus(); }}
      >
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type to search…"
          aria-label="Search languages"
          className="mb-2 h-8 w-full rounded-sm border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {visible.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">No matches for “{query}”</p>
          )}
          {visible.map(lang => (
            <label
              key={lang}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
            >
              <Checkbox checked={selected.includes(lang)} onCheckedChange={() => toggle(lang)} />
              {lang}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

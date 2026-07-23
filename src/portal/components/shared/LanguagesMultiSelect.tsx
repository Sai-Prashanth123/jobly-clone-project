import { useState } from 'react';
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
  const selected = parse(value);

  const toggle = (lang: string) => {
    const next = selected.includes(lang)
      ? selected.filter(l => l !== lang)
      : [...selected, lang];
    onChange(next.join(', '));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-72 p-2" align="start">
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {LANGUAGES.map(lang => (
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

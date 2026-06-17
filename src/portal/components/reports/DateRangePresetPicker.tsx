import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

interface DateRangePresetPickerProps {
  label: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
}

type Preset = 'last6' | 'last12' | 'thisYear' | 'lastYear' | 'thisQuarter' | 'lastQuarter' | 'custom';

function toYMD(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}

function computePresetDates(preset: Preset): { start: string; end: string } | null {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  switch (preset) {
    case 'last6': {
      const start = new Date(Date.UTC(y, m - 6, 1));
      const end = lastDayOfMonth(y, m - 1);
      return { start: toYMD(start), end: toYMD(end) };
    }
    case 'last12': {
      const start = new Date(Date.UTC(y, m - 12, 1));
      const end = lastDayOfMonth(y, m - 1);
      return { start: toYMD(start), end: toYMD(end) };
    }
    case 'thisYear':
      return { start: `${y}-01-01`, end: toYMD(now) };
    case 'lastYear':
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    case 'thisQuarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { start: toYMD(new Date(Date.UTC(y, qStart, 1))), end: toYMD(now) };
    }
    case 'lastQuarter': {
      const curQStart = Math.floor(m / 3) * 3;
      const prevQStart = curQStart - 3;
      const start = new Date(Date.UTC(y, prevQStart, 1));
      const end = lastDayOfMonth(y, prevQStart + 2);
      return { start: toYMD(start), end: toYMD(end) };
    }
    default:
      return null;
  }
}

export function DateRangePresetPicker({
  label,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePresetPickerProps) {
  const [preset, setPreset] = useState<Preset>('custom');

  function handlePresetChange(value: string) {
    const p = value as Preset;
    setPreset(p);
    const dates = computePresetDates(p);
    if (dates) {
      onStartDateChange(dates.start);
      onEndDateChange(dates.end);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>

        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last6">Last 6 months</SelectItem>
            <SelectItem value="last12">Last 12 months</SelectItem>
            <SelectItem value="thisYear">This year</SelectItem>
            <SelectItem value="lastYear">Last year</SelectItem>
            <SelectItem value="thisQuarter">This quarter</SelectItem>
            <SelectItem value="lastQuarter">Last quarter</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setPreset('custom');
                onStartDateChange(e.target.value);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End</label>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setPreset('custom');
                onEndDateChange(e.target.value);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

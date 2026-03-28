import { Input } from '@/components/ui/input';
import type { TimesheetEntry } from '../../types';

interface TimesheetWeekGridProps {
  entries: TimesheetEntry[];
  onChange?: (entries: TimesheetEntry[]) => void;
  readonly?: boolean;
}

export function TimesheetWeekGrid({ entries, onChange, readonly = false }: TimesheetWeekGridProps) {
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  const handleChange = (index: number, hours: number) => {
    if (!onChange) return;
    const updated = entries.map((e, i) =>
      i === index ? { ...e, hours: Math.max(0, Math.min(24, hours)), isBillable: hours > 0 } : e
    );
    onChange(updated);
  };

  return (
    <div>
      {/* Desktop/tablet: horizontal table (md and up) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              {entries.map(entry => (
                <th key={entry.date} className="px-3 py-2 text-center font-medium text-gray-700 min-w-[90px]">
                  <div>{entry.dayOfWeek.slice(0, 3)}</div>
                  <div className="text-xs text-gray-500 font-normal">{entry.date.slice(5)}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-gray-900 min-w-[70px]">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map((entry, i) => (
                <td key={entry.date} className="px-2 py-3 text-center border-r border-gray-100 last:border-0">
                  {readonly ? (
                    <div className={`text-center font-medium ${entry.hours > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                      {entry.hours > 0 ? entry.hours : '—'}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      value={entry.hours || ''}
                      placeholder="0"
                      onChange={e => handleChange(i, parseFloat(e.target.value) || 0)}
                      className="w-full text-center"
                      disabled={readonly}
                    />
                  )}
                </td>
              ))}
              <td className="px-3 py-3 text-center">
                <span className={`text-lg font-semibold ${totalHours > 40 ? 'text-orange-500' : 'text-gray-900'}`}>
                  {totalHours}
                </span>
                <div className="text-xs text-gray-400">hrs</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile: vertical card list */}
      <div className="md:hidden space-y-2">
        {entries.map((entry, i) => (
          <div key={entry.date} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">{entry.dayOfWeek}</p>
              <p className="text-xs text-gray-400">{entry.date.slice(5)}</p>
            </div>
            {readonly ? (
              <span className={`text-base font-semibold ${entry.hours > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                {entry.hours > 0 ? `${entry.hours} hrs` : '—'}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={entry.hours || ''}
                  placeholder="0"
                  onChange={e => handleChange(i, parseFloat(e.target.value) || 0)}
                  className="w-20 text-center"
                />
                <span className="text-xs text-gray-400">hrs</span>
              </div>
            )}
          </div>
        ))}
        {/* Mobile total */}
        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-blue-50 border border-blue-100 mt-1">
          <p className="text-sm font-semibold text-gray-700">Total Hours</p>
          <span className={`text-lg font-bold ${totalHours > 40 ? 'text-orange-500' : 'text-blue-700'}`}>
            {totalHours} hrs
          </span>
        </div>
      </div>
    </div>
  );
}

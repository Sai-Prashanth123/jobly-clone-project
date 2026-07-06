import { Input } from '@/components/ui/input';
import { parseNumberInput } from '../../lib/utils';
import { type LeaveDayInfo, LEAVE_TYPE_SHORT } from '../../hooks/useTimesheets';
import type { Holiday } from '../../hooks/useHolidays';
import type { TimesheetEntry } from '../../types';

interface TimesheetWeekGridProps {
  entries: TimesheetEntry[];
  onChange?: (entries: TimesheetEntry[]) => void;
  readonly?: boolean;
  // Per-date approved/pending leave for this week — flags day columns where
  // logging hours conflicts with leave.
  leaveByDate?: Record<string, LeaveDayInfo>;
  // Company holidays falling within this week — locks that day's hours to 0,
  // same as the monthly attendance view.
  holidayByDate?: Record<string, Holiday>;
}

function LeaveBadge({ info }: { info: LeaveDayInfo }) {
  const approved = info.status === 'approved';
  return (
    <span
      title={`${approved ? 'Approved' : 'Pending'} leave ${info.leaveDisplayId} (${LEAVE_TYPE_SHORT[info.leaveType] ?? 'Leave'})`}
      className={`mt-0.5 inline-block text-[9px] font-semibold px-1 py-0.5 rounded ${approved ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
    >
      {approved ? 'On leave' : 'Leave pending'}
    </span>
  );
}

function HolidayBadge({ holiday }: { holiday: Holiday }) {
  return (
    <span
      title={`Company holiday: ${holiday.name}`}
      className="mt-0.5 inline-block text-[9px] font-semibold px-1 py-0.5 rounded bg-violet-100 text-violet-700"
    >
      {holiday.name}
    </span>
  );
}

export function TimesheetWeekGrid({ entries, onChange, readonly = false, leaveByDate, holidayByDate }: TimesheetWeekGridProps) {
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const leaveOf = (date: string): LeaveDayInfo | undefined => leaveByDate?.[date];
  const holidayOf = (date: string): Holiday | undefined => holidayByDate?.[date];

  const handleChange = (index: number, hours: number) => {
    if (!onChange) return;
    if (holidayOf(entries[index].date)) return; // locked — same as the monthly view
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
                  {holidayOf(entry.date) && <HolidayBadge holiday={holidayOf(entry.date)!} />}
                  {leaveOf(entry.date) && <LeaveBadge info={leaveOf(entry.date)!} />}
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
                  ) : holidayOf(entry.date) ? (
                    <Input type="number" value="" placeholder="—" disabled className="w-full text-center" />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      value={entry.hours || ''}
                      placeholder="—"
                      onChange={e => handleChange(i, parseNumberInput(e.target.value) ?? 0)}
                      className={`w-full text-center ${leaveOf(entry.date)?.status === 'approved' && entry.hours > 0 ? 'border-red-400 ring-1 ring-red-300 bg-red-50' : ''}`}
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
              {holidayOf(entry.date) && <HolidayBadge holiday={holidayOf(entry.date)!} />}
              {leaveOf(entry.date) && <LeaveBadge info={leaveOf(entry.date)!} />}
            </div>
            {readonly ? (
              <span className={`text-base font-semibold ${entry.hours > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                {entry.hours > 0 ? `${entry.hours} hrs` : '—'}
              </span>
            ) : holidayOf(entry.date) ? (
              <div className="flex items-center gap-2">
                <Input type="number" value="" placeholder="—" disabled className="w-20 text-center" />
                <span className="text-xs text-gray-400">hrs</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={entry.hours || ''}
                  placeholder="—"
                  onChange={e => handleChange(i, parseNumberInput(e.target.value) ?? 0)}
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

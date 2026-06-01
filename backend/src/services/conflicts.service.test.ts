import { describe, it, expect, vi } from 'vitest';

// conflicts.service imports '../config/supabase' at module load (which builds a
// client from env vars). Stub it so the PURE helpers can be imported under test
// without real Supabase env — the functions exercised here never touch the DB.
vi.mock('../config/supabase', () => ({ supabaseAdmin: {} }));

import {
  eachDateInRange,
  classifyConflicts,
  approvedLeaveBlockMessage,
  workedDaysBlockMessage,
  leaveOverlapMessage,
  type LeaveDayRef,
} from './conflicts.service';

describe('eachDateInRange', () => {
  it('returns a single inclusive day', () => {
    expect(eachDateInRange('2026-06-01', '2026-06-01')).toEqual(['2026-06-01']);
  });
  it('returns every day inclusive', () => {
    expect(eachDateInRange('2026-06-01', '2026-06-03')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });
  it('crosses a month boundary correctly (UTC-safe)', () => {
    expect(eachDateInRange('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
  });
  it('is empty when start is after end', () => {
    expect(eachDateInRange('2026-06-03', '2026-06-01')).toEqual([]);
  });
});

const coverage = (rows: [string, 'approved' | 'pending', string, string][]) => {
  const m = new Map<string, LeaveDayRef>();
  for (const [date, status, id, type] of rows) m.set(date, { date, status, leaveDisplayId: id, leaveType: type });
  return m;
};

describe('classifyConflicts', () => {
  it('blocks approved, warns pending, ignores uncovered days', () => {
    const cov = coverage([
      ['2026-06-01', 'approved', 'LV-1', 'vacation'],
      ['2026-06-02', 'pending', 'LV-2', 'sick'],
    ]);
    const { blocking, warnings } = classifyConflicts(['2026-06-01', '2026-06-02', '2026-06-03'], cov);
    expect(blocking.map(b => b.date)).toEqual(['2026-06-01']);
    expect(blocking[0].leaveDisplayId).toBe('LV-1');
    expect(blocking[0].severity).toBe('block');
    expect(warnings.map(w => w.date)).toEqual(['2026-06-02']);
    expect(warnings[0].severity).toBe('warn');
  });
  it('returns nothing when no day is covered', () => {
    expect(classifyConflicts(['2026-06-01'], new Map())).toEqual({ blocking: [], warnings: [] });
  });
  it('blocks every approved day', () => {
    const cov = coverage([
      ['2026-06-01', 'approved', 'LV-1', 'vacation'],
      ['2026-06-02', 'approved', 'LV-1', 'vacation'],
    ]);
    expect(classifyConflicts(['2026-06-01', '2026-06-02'], cov).blocking).toHaveLength(2);
  });
});

describe('message builders', () => {
  it('single approved-leave block names the date, type and LV id', () => {
    const msg = approvedLeaveBlockMessage([
      { date: '2026-06-01', code: 'WORK_ON_APPROVED_LEAVE', severity: 'block', leaveDisplayId: 'LV-7', leaveType: 'vacation' },
    ]);
    expect(msg).toContain('LV-7');
    expect(msg).toContain('vacation');
    expect(msg).toMatch(/Jun 1, 2026/);
  });
  it('multi-day approved block summarizes the count', () => {
    const msg = approvedLeaveBlockMessage([
      { date: '2026-06-01', code: 'WORK_ON_APPROVED_LEAVE', severity: 'block', leaveDisplayId: 'LV-7', leaveType: 'sick' },
      { date: '2026-06-02', code: 'WORK_ON_APPROVED_LEAVE', severity: 'block', leaveDisplayId: 'LV-7', leaveType: 'sick' },
    ]);
    expect(msg).toContain('2 days');
    expect(msg).toContain('LV-7');
  });
  it('worked-days message differs for request vs approve', () => {
    const w = [{ date: '2026-06-01', refType: 'weekly' as const, refDisplayId: 'TS-3' }];
    expect(workedDaysBlockMessage(w, 'request')).toMatch(/already logged hours/);
    expect(workedDaysBlockMessage(w, 'approve')).toMatch(/Can't approve/);
  });
  it('overlap message names the conflicting request', () => {
    const msg = leaveOverlapMessage({ display_id: 'LV-9', status: 'approved', start_date: '2026-06-01', end_date: '2026-06-03' });
    expect(msg).toContain('LV-9');
    expect(msg).toContain('approved');
  });
});

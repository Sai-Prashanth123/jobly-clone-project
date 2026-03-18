export const STORAGE_KEYS = {
  SESSION: 'jobly_portal_session',
  EMPLOYEES: 'jobly_portal_employees',
  CLIENTS: 'jobly_portal_clients',
  ASSIGNMENTS: 'jobly_portal_assignments',
  TIMESHEETS: 'jobly_portal_timesheets',
  INVOICES: 'jobly_portal_invoices',
  SEEDED: 'jobly_portal_seeded',
} as const;

export function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to write to localStorage', e);
  }
}

export function storageRemove(key: string): void {
  localStorage.removeItem(key);
}

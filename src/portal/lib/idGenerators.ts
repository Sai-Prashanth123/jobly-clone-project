import type { Employee, Client, Assignment, Timesheet, Invoice } from '../types';

function pad(n: number, width: number = 4): string {
  return String(n).padStart(width, '0');
}

export function generateEmployeeId(existing: Employee[]): string {
  const nums = existing
    .map(e => parseInt(e.id.replace('EMP-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `EMP-${pad(next)}`;
}

export function generateClientId(existing: Client[]): string {
  const nums = existing
    .map(c => parseInt(c.id.replace('CLT-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `CLT-${pad(next)}`;
}

export function generateAssignmentId(existing: Assignment[]): string {
  const nums = existing
    .map(a => parseInt(a.id.replace('ASN-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `ASN-${pad(next)}`;
}

export function generateTimesheetId(existing: Timesheet[]): string {
  const nums = existing
    .map(t => parseInt(t.id.replace('TS-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `TS-${pad(next)}`;
}

export function generateInvoiceNumber(existing: Invoice[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map(i => parseInt(i.invoiceNumber.split('-').pop() ?? '0', 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `INV-${year}-${pad(next)}`;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

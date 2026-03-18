import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Employee, Client, Assignment, Timesheet, Invoice, InvoiceLineItem } from '../types';
import { storageGet, storageSet, STORAGE_KEYS } from '../lib/storage';
import {
  SEED_EMPLOYEES, SEED_CLIENTS, SEED_ASSIGNMENTS,
  SEED_TIMESHEETS, SEED_INVOICES,
} from '../lib/mockData';
import {
  generateEmployeeId, generateClientId, generateAssignmentId,
  generateTimesheetId, generateInvoiceNumber, generateId,
} from '../lib/idGenerators';
import { addDays } from '../lib/utils';
import { addDays as dfnsAddDays, parseISO } from 'date-fns';

interface PortalDataContextValue {
  // Employees
  employees: Employee[];
  addEmployee: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Employee;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  // Clients
  clients: Client[];
  addClient: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Client;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Assignments
  assignments: Assignment[];
  addAssignment: (data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>) => Assignment;
  updateAssignment: (id: string, data: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;

  // Timesheets
  timesheets: Timesheet[];
  addTimesheet: (data: Omit<Timesheet, 'id' | 'createdAt' | 'updatedAt'>) => Timesheet;
  updateTimesheet: (id: string, data: Partial<Timesheet>) => void;
  deleteTimesheet: (id: string) => void;

  // Invoices
  invoices: Invoice[];
  addInvoice: (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Invoice;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  generateInvoice: (timesheetIds: string[], clientId: string) => Invoice;
}

const PortalDataContext = createContext<PortalDataContextValue | null>(null);

export function PortalDataProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const seeded = localStorage.getItem(STORAGE_KEYS.SEEDED);
    if (!seeded) {
      setEmployees(SEED_EMPLOYEES);
      setClients(SEED_CLIENTS);
      setAssignments(SEED_ASSIGNMENTS);
      setTimesheets(SEED_TIMESHEETS);
      setInvoices(SEED_INVOICES);
      storageSet(STORAGE_KEYS.EMPLOYEES, SEED_EMPLOYEES);
      storageSet(STORAGE_KEYS.CLIENTS, SEED_CLIENTS);
      storageSet(STORAGE_KEYS.ASSIGNMENTS, SEED_ASSIGNMENTS);
      storageSet(STORAGE_KEYS.TIMESHEETS, SEED_TIMESHEETS);
      storageSet(STORAGE_KEYS.INVOICES, SEED_INVOICES);
      localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
    } else {
      setEmployees(storageGet<Employee[]>(STORAGE_KEYS.EMPLOYEES) ?? SEED_EMPLOYEES);
      setClients(storageGet<Client[]>(STORAGE_KEYS.CLIENTS) ?? SEED_CLIENTS);
      setAssignments(storageGet<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS) ?? SEED_ASSIGNMENTS);
      setTimesheets(storageGet<Timesheet[]>(STORAGE_KEYS.TIMESHEETS) ?? SEED_TIMESHEETS);
      setInvoices(storageGet<Invoice[]>(STORAGE_KEYS.INVOICES) ?? SEED_INVOICES);
    }
  }, []);

  // ─── Employee CRUD ───────────────────────────────────────────────────────────

  const addEmployee = (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Employee => {
    const now = new Date().toISOString();
    const emp: Employee = { ...data, id: generateEmployeeId(employees), createdAt: now, updatedAt: now };
    const updated = [...employees, emp];
    setEmployees(updated);
    storageSet(STORAGE_KEYS.EMPLOYEES, updated);
    return emp;
  };

  const updateEmployee = (id: string, data: Partial<Employee>) => {
    const updated = employees.map(e => e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e);
    setEmployees(updated);
    storageSet(STORAGE_KEYS.EMPLOYEES, updated);
  };

  const deleteEmployee = (id: string) => {
    const updated = employees.filter(e => e.id !== id);
    setEmployees(updated);
    storageSet(STORAGE_KEYS.EMPLOYEES, updated);
  };

  // ─── Client CRUD ─────────────────────────────────────────────────────────────

  const addClient = (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client => {
    const now = new Date().toISOString();
    const client: Client = { ...data, id: generateClientId(clients), createdAt: now, updatedAt: now };
    const updated = [...clients, client];
    setClients(updated);
    storageSet(STORAGE_KEYS.CLIENTS, updated);
    return client;
  };

  const updateClient = (id: string, data: Partial<Client>) => {
    const updated = clients.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c);
    setClients(updated);
    storageSet(STORAGE_KEYS.CLIENTS, updated);
  };

  const deleteClient = (id: string) => {
    const updated = clients.filter(c => c.id !== id);
    setClients(updated);
    storageSet(STORAGE_KEYS.CLIENTS, updated);
  };

  // ─── Assignment CRUD ──────────────────────────────────────────────────────────

  const addAssignment = (data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>): Assignment => {
    const now = new Date().toISOString();
    const asgn: Assignment = { ...data, id: generateAssignmentId(assignments), createdAt: now, updatedAt: now };
    const updated = [...assignments, asgn];
    setAssignments(updated);
    storageSet(STORAGE_KEYS.ASSIGNMENTS, updated);
    return asgn;
  };

  const updateAssignment = (id: string, data: Partial<Assignment>) => {
    const updated = assignments.map(a => a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a);
    setAssignments(updated);
    storageSet(STORAGE_KEYS.ASSIGNMENTS, updated);
  };

  const deleteAssignment = (id: string) => {
    const updated = assignments.filter(a => a.id !== id);
    setAssignments(updated);
    storageSet(STORAGE_KEYS.ASSIGNMENTS, updated);
  };

  // ─── Timesheet CRUD ───────────────────────────────────────────────────────────

  const addTimesheet = (data: Omit<Timesheet, 'id' | 'createdAt' | 'updatedAt'>): Timesheet => {
    const now = new Date().toISOString();
    const ts: Timesheet = { ...data, id: generateTimesheetId(timesheets), createdAt: now, updatedAt: now };
    const updated = [...timesheets, ts];
    setTimesheets(updated);
    storageSet(STORAGE_KEYS.TIMESHEETS, updated);
    return ts;
  };

  const updateTimesheet = (id: string, data: Partial<Timesheet>) => {
    const updated = timesheets.map(t => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t);
    setTimesheets(updated);
    storageSet(STORAGE_KEYS.TIMESHEETS, updated);
  };

  const deleteTimesheet = (id: string) => {
    const updated = timesheets.filter(t => t.id !== id);
    setTimesheets(updated);
    storageSet(STORAGE_KEYS.TIMESHEETS, updated);
  };

  // ─── Invoice CRUD ─────────────────────────────────────────────────────────────

  const addInvoice = (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Invoice => {
    const now = new Date().toISOString();
    const inv: Invoice = { ...data, id: generateId(), createdAt: now, updatedAt: now };
    const updated = [...invoices, inv];
    setInvoices(updated);
    storageSet(STORAGE_KEYS.INVOICES, updated);
    return inv;
  };

  const updateInvoice = (id: string, data: Partial<Invoice>) => {
    const updated = invoices.map(i => i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i);
    setInvoices(updated);
    storageSet(STORAGE_KEYS.INVOICES, updated);
  };

  const deleteInvoice = (id: string) => {
    const updated = invoices.filter(i => i.id !== id);
    setInvoices(updated);
    storageSet(STORAGE_KEYS.INVOICES, updated);
  };

  // ─── Generate Invoice ─────────────────────────────────────────────────────────

  const generateInvoice = (timesheetIds: string[], clientId: string): Invoice => {
    const selectedTimesheets = timesheets.filter(t => timesheetIds.includes(t.id));
    const client = clients.find(c => c.id === clientId);

    const lineItems: InvoiceLineItem[] = selectedTimesheets.map(ts => {
      const asgn = assignments.find(a => a.id === ts.assignmentId);
      const emp = employees.find(e => e.id === ts.employeeId);
      const billRate = asgn?.billRate ?? client?.defaultBillRate ?? 0;
      const hours = ts.totalHours;
      const amount = hours * billRate;
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : ts.employeeId;
      return {
        description: `${empName} — Week of ${ts.weekStartDate}`,
        employeeId: ts.employeeId,
        timesheetId: ts.id,
        hours,
        billRate,
        amount,
      };
    });

    const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
    const taxRate = 0;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;
    const issueDate = new Date().toISOString().split('T')[0];
    const netDays = client?.netPaymentDays ?? 30;
    const dueDate = dfnsAddDays(parseISO(issueDate), netDays).toISOString().split('T')[0];
    const now = new Date().toISOString();

    const inv: Invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(invoices),
      clientId,
      issueDate,
      dueDate,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      status: 'draft',
      timesheetIds,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...invoices, inv];
    setInvoices(updated);
    storageSet(STORAGE_KEYS.INVOICES, updated);
    return inv;
  };

  return (
    <PortalDataContext.Provider value={{
      employees, addEmployee, updateEmployee, deleteEmployee,
      clients, addClient, updateClient, deleteClient,
      assignments, addAssignment, updateAssignment, deleteAssignment,
      timesheets, addTimesheet, updateTimesheet, deleteTimesheet,
      invoices, addInvoice, updateInvoice, deleteInvoice, generateInvoice,
    }}>
      {children}
    </PortalDataContext.Provider>
  );
}

export function usePortalDataContext() {
  const ctx = useContext(PortalDataContext);
  if (!ctx) throw new Error('usePortalDataContext must be used within PortalDataProvider');
  return ctx;
}

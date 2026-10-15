import { describe, it, expect } from 'vitest';
import { redactEmployee } from './employees.service';

/**
 * What an employee may see, and set, on their own record.
 *
 * "Please check from employee side was that pay rate section was removed to
 * them or not." It was removed from the SCREEN — the Payroll card came off
 * MyProfile — but redactEmployee short-circuited on `isOwn`, so pay_rate was
 * still in the JSON the browser received. Off the screen and one devtools tab
 * away is not hidden.
 *
 * Checking that turned up the worse half: the profile form posts the whole
 * employee object, pay rate and status included, and nothing on the server
 * filtered by field — only by WHOSE record it was. So an employee could set
 * their own pay rate, or flip themselves to active past HR's approval.
 */

const EMP = {
  id: 'e1',
  first_name: 'Test',
  pay_rate: 85,
  ssn: '111-22-3333',
  bank_routing_number: '021000021',
  bank_account_number: '12345678',
};

describe('what an employee sees on their own record', () => {
  it('does not receive their pay rate', () => {
    const out = redactEmployee({ ...EMP }, 'employee', true);
    expect(out.pay_rate).toBe(0);
  });

  // Bank details stay: the onboarding wizard prefills them and marks the
  // payroll section complete from them. They are not displayed on MyProfile.
  it('still receives bank details, which onboarding needs', () => {
    const out = redactEmployee({ ...EMP }, 'employee', true);
    expect(out.bank_account_number).toBe('12345678');
    expect(out.ssn).toBe('111-22-3333');
  });

  it('leaves admin and HR seeing the pay rate', () => {
    expect(redactEmployee({ ...EMP }, 'admin', false).pay_rate).toBe(85);
    expect(redactEmployee({ ...EMP }, 'hr', false).pay_rate).toBe(85);
  });

  it('still hides pay from a Project Manager', () => {
    const out = redactEmployee({ ...EMP }, 'operations', false);
    expect(out.pay_rate).toBe(0);
    // ...while keeping the SSN they need for an I-9.
    expect(out.ssn).toBe('111-22-3333');
  });

  // A finance or ops user looking at their own record is not the case this
  // change is about, and should not silently lose a field.
  it('does not change what other roles see of their own record', () => {
    expect(redactEmployee({ ...EMP }, 'finance', true).pay_rate).toBe(85);
  });
});

/**
 * The write side.
 *
 * The controller checks WHOSE record is being edited, never WHICH fields. The
 * profile form posts the whole object — pay rate, pay type and status — so an
 * employee saving their own profile was sending all three, and the server took
 * them. HR_ONLY_EMPLOYEE_FIELDS drops them for an employee actor before the
 * record is touched.
 *
 * Exercised through the exported helper rather than updateEmployee itself,
 * which would need a live database.
 */
import { stripHrOnlyFields } from './employees.service';

describe('what an employee may set on their own record', () => {
  const SUBMITTED = {
    firstName: 'Test',
    phone: '555-0100',
    payRate: 500,
    payType: 'hourly',
    status: 'active',
    bankAccountNumber: '12345678',
  } as any;

  it('drops pay rate, pay type and status from an employee', () => {
    const out = stripHrOnlyFields(SUBMITTED, 'employee');
    expect(out.payRate).toBeUndefined();
    expect(out.payType).toBeUndefined();
    expect(out.status).toBeUndefined();
  });

  it('keeps everything the employee legitimately edits', () => {
    const out = stripHrOnlyFields(SUBMITTED, 'employee');
    expect(out.firstName).toBe('Test');
    expect(out.phone).toBe('555-0100');
    // Onboarding is where bank details are collected, so these must survive.
    expect(out.bankAccountNumber).toBe('12345678');
  });

  it('leaves HR and admin submissions untouched', () => {
    for (const role of ['admin', 'hr']) {
      const out = stripHrOnlyFields(SUBMITTED, role);
      expect(out.payRate, role).toBe(500);
      expect(out.status, role).toBe('active');
    }
  });

  it('does not mutate what it was given', () => {
    const input = { ...SUBMITTED };
    stripHrOnlyFields(input, 'employee');
    expect(input.payRate).toBe(500);
  });
});

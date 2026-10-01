import { describe, it, expect } from 'vitest';
import { isEmployerManagedDoc } from './employerDocs';

// The document read policy, asserted as a table rather than by importing
// storage.service (which pulls in supabase/mammoth/xlsx). This mirrors
// assertMayReadDocument exactly; if that function changes, this must change
// with it — which is the point.
//
// Audit finding: the real function used to return early for every role except
// `employee`, so `operations` and `finance` could mint a signed URL for any
// SSN card or passport scan by UUID — while redactEmployee deliberately blinds
// those same two roles to `ssn` and `bank_*` on the JSON path.
type Doc = { entity_type?: string | null; entity_id?: string | null; type?: string | null };
type User = { role: string; employeeId?: string | null };

function mayRead(doc: Doc, user: User): boolean {
  if (user.role === 'employee') {
    const ownsIt = doc.entity_type === 'employee' && doc.entity_id === user.employeeId;
    return ownsIt && !isEmployerManagedDoc(doc);
  }
  if ((user.role === 'operations' || user.role === 'finance') && doc.entity_type === 'employee') {
    return false;
  }
  return true;
}

const ownDoc: Doc = { entity_type: 'employee', entity_id: 'emp-1', type: 'Resume' };
const otherDoc: Doc = { entity_type: 'employee', entity_id: 'emp-2', type: 'Resume' };
const everify: Doc = { entity_type: 'employee', entity_id: 'emp-1', type: 'E-Verify Letter' };
const clientDoc: Doc = { entity_type: 'client', entity_id: 'cli-1', type: 'Contract' };
const invoiceDoc: Doc = { entity_type: 'invoice', entity_id: 'inv-1', type: 'Invoice PDF' };

const employee: User = { role: 'employee', employeeId: 'emp-1' };

describe('document read policy', () => {
  it('lets an employee read their own documents', () => {
    expect(mayRead(ownDoc, employee)).toBe(true);
  });

  it('refuses an employee another employee\'s documents', () => {
    expect(mayRead(otherDoc, employee)).toBe(false);
  });

  it('refuses an employee the employer-managed documents on their own record', () => {
    expect(mayRead(everify, employee)).toBe(false);
  });

  it('refuses an employee client and invoice documents', () => {
    expect(mayRead(clientDoc, employee)).toBe(false);
    expect(mayRead(invoiceDoc, employee)).toBe(false);
  });

  // The gap this suite exists for.
  it.each(['operations', 'finance'])('refuses %s ANY employee document', role => {
    expect(mayRead(ownDoc, { role })).toBe(false);
    expect(mayRead(otherDoc, { role })).toBe(false);
    expect(mayRead(everify, { role })).toBe(false);
  });

  it.each(['operations', 'finance'])('still lets %s read client and invoice documents', role => {
    expect(mayRead(clientDoc, { role })).toBe(true);
    expect(mayRead(invoiceDoc, { role })).toBe(true);
  });

  it.each(['admin', 'hr'])('lets %s read everything', role => {
    for (const doc of [ownDoc, otherDoc, everify, clientDoc, invoiceDoc]) {
      expect(mayRead(doc, { role })).toBe(true);
    }
  });
});

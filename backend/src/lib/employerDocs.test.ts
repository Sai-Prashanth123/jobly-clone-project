import { describe, it, expect } from 'vitest';
import { isEmployerManagedDoc, withoutEmployerManagedDocs } from './employerDocs';

// Reported: an employee could see their own E-Verify Letter on the Documents
// page, with working Preview and Download buttons. These documents hang off
// the employee's own record, so every ownership check ("is this mine?") passed
// for them.
describe('employer-managed documents', () => {
  it('recognises every employer-managed type', () => {
    for (const type of [
      'E-Verify Letter',
      'Form I-129',
      'Copy of LCA',
      'Employer Letter / Employment Verification Letter',
      'Employer-Countersigned Offer / Contract Letter',
      'Contract / MSA (Petitioner & Vendor)',
    ]) {
      expect(isEmployerManagedDoc({ type })).toBe(true);
    }
  });

  it('leaves the employee\'s own documents alone', () => {
    for (const type of ['Resume', 'W-4', 'Passport', 'I-94', 'Visa', 'I-20', 'Insurance Waiver Form']) {
      expect(isEmployerManagedDoc({ type })).toBe(false);
    }
  });

  it('is exact, not a substring match', () => {
    // A document the employee uploaded that merely mentions E-Verify must stay
    // theirs; only the exact stored label is employer-managed.
    expect(isEmployerManagedDoc({ type: 'E-Verify Letter (copy)' })).toBe(false);
    expect(isEmployerManagedDoc({ type: 'My E-Verify Letter' })).toBe(false);
  });

  it('treats a missing type as not employer-managed', () => {
    expect(isEmployerManagedDoc({})).toBe(false);
    expect(isEmployerManagedDoc({ type: null })).toBe(false);
    expect(isEmployerManagedDoc(null)).toBe(false);
    expect(isEmployerManagedDoc(undefined)).toBe(false);
  });

  it('filters a document list down to what the employee may see', () => {
    const docs = [
      { id: '1', type: 'Resume' },
      { id: '2', type: 'E-Verify Letter' },
      { id: '3', type: 'W-4' },
      { id: '4', type: 'Copy of LCA' },
    ];
    expect(withoutEmployerManagedDocs(docs).map(d => d.id)).toEqual(['1', '3']);
  });

  it('returns an empty list unchanged', () => {
    expect(withoutEmployerManagedDocs([])).toEqual([]);
  });
});

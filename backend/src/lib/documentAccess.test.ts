import { describe, it, expect } from 'vitest';
import { mayReadDocument, type AccessibleDoc, type DocViewer } from './documentAccess';

// Imports the REAL policy. An earlier version of this file re-stated the rule
// by hand with a comment saying the two had to be changed together — which is
// the duplicated-rule pattern behind most of the bugs this codebase has been
// fixing, and it meant this suite kept passing while describing behaviour the
// product did not want. The rule now lives in one dependency-light module that
// both storage.service.ts and this file import.

const ownDoc: AccessibleDoc = { entity_type: 'employee', entity_id: 'emp-1', type: 'Resume' };
const otherDoc: AccessibleDoc = { entity_type: 'employee', entity_id: 'emp-2', type: 'Resume' };
const everify: AccessibleDoc = { entity_type: 'employee', entity_id: 'emp-1', type: 'E-Verify Letter' };
const eadCard: AccessibleDoc = { entity_type: 'employee', entity_id: 'emp-2', type: 'Employment Authorization Document' };
const clientDoc: AccessibleDoc = { entity_type: 'client', entity_id: 'cli-1', type: 'Contract' };
const invoiceDoc: AccessibleDoc = { entity_type: 'invoice', entity_id: 'inv-1', type: 'Invoice PDF' };

const employee: DocViewer = { role: 'employee', employeeId: 'emp-1' };

describe('document read policy', () => {
  it('lets an employee read their own documents', () => {
    expect(mayReadDocument(ownDoc, employee)).toBe(true);
  });

  it("refuses an employee another employee's documents", () => {
    expect(mayReadDocument(otherDoc, employee)).toBe(false);
  });

  // HR asked for this one specifically: an employee could preview and download
  // their own E-Verify letter, which is the employer's document, not theirs.
  it('refuses an employee the employer-managed documents on their own record', () => {
    expect(mayReadDocument(everify, employee)).toBe(false);
  });

  it('refuses an employee client and invoice documents', () => {
    expect(mayReadDocument(clientDoc, employee)).toBe(false);
    expect(mayReadDocument(invoiceDoc, employee)).toBe(false);
  });

  it('refuses a signed-out-ish viewer with no employeeId their "own" documents', () => {
    // entity_id === undefined must not accidentally match.
    expect(mayReadDocument({ entity_type: 'employee', entity_id: undefined, type: 'Resume' }, { role: 'employee' }))
      .toBe(false);
  });

  // Operations and finance were briefly refused ALL employee documents during
  // an audit. Nobody had asked for that, and it broke the document preview for
  // them entirely: /url, /preview-url and /render all 403'd, so the dialog
  // showed "Could not load this document" with Download greyed out — which
  // reads as a broken file, not a permission decision. Reviewing employee
  // documents is ordinary work for an operations manager.
  it.each(['operations', 'finance'])('lets %s read employee documents', role => {
    expect(mayReadDocument(ownDoc, { role })).toBe(true);
    expect(mayReadDocument(otherDoc, { role })).toBe(true);
    expect(mayReadDocument(eadCard, { role })).toBe(true);
    expect(mayReadDocument(everify, { role })).toBe(true);
  });

  it.each(['operations', 'finance'])('lets %s read client and invoice documents', role => {
    expect(mayReadDocument(clientDoc, { role })).toBe(true);
    expect(mayReadDocument(invoiceDoc, { role })).toBe(true);
  });

  it.each(['admin', 'hr'])('lets %s read everything', role => {
    for (const doc of [ownDoc, otherDoc, everify, eadCard, clientDoc, invoiceDoc]) {
      expect(mayReadDocument(doc, { role })).toBe(true);
    }
  });

  // legal passes this gate but is case-scoped separately by the caller, which
  // needs a DB lookup and so cannot live in the pure policy.
  it('lets legal through this gate, leaving case-scoping to the caller', () => {
    expect(mayReadDocument(ownDoc, { role: 'legal' })).toBe(true);
  });
});

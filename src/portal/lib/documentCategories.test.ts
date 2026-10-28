import { describe, it, expect } from 'vitest';
import {
  IDENTITY_DOC_ROWS, EMPLOYER_DOC_ROWS,
  DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_ORDER,
  categoryOf,
} from './documentTypes';

/**
 * Grouping related documents together.
 *
 * The wizard showed up to 23 document cards in one flat grid, with a passport
 * next to a PERM questionnaire next to a pay stub. Nothing grouped them, which
 * is how two separate rows for the LCA — one employee-provided, one
 * employer-issued — sat there unnoticed.
 *
 * These are the compiled-in defaults. The live categories are editable by HR,
 * so what is pinned here is coverage and ordering, not any particular opinion
 * about where a given document belongs.
 */

const ALL: Array<[string, 'employee' | 'employer']> = [
  ...IDENTITY_DOC_ROWS.map(r => [r.type, 'employee'] as [string, 'employee']),
  ...EMPLOYER_DOC_ROWS.map(r => [r.type, 'employer'] as [string, 'employer']),
];

describe('every document has a home', () => {
  it('covers all 40 documents', () => {
    expect(ALL.length).toBe(40);
  });

  it('puts every document in a declared category', () => {
    const known = new Set(DOCUMENT_CATEGORIES.map(c => c.key));
    for (const [type, issuedBy] of ALL) {
      expect(known, `${type} landed outside the category list`).toContain(categoryOf(type, issuedBy));
    }
  });

  it('leaves no category empty, so no group renders as a heading with nothing under it', () => {
    const used = new Set(ALL.map(([t, by]) => categoryOf(t, by)));
    for (const c of DOCUMENT_CATEGORIES) {
      expect(used, `${c.key} has no documents`).toContain(c.key);
    }
  });

  it('keeps every employer-issued document out of the employee groups', () => {
    for (const row of EMPLOYER_DOC_ROWS) {
      expect(categoryOf(row.type, 'employer'), row.type).toBe('employer');
    }
  });

  it('keeps the employee documents out of the employer group', () => {
    for (const row of IDENTITY_DOC_ROWS) {
      expect(categoryOf(row.type, 'employee'), row.type).not.toBe('employer');
    }
  });
});

describe('the category list itself', () => {
  it('labels every category', () => {
    for (const c of DOCUMENT_CATEGORIES) {
      expect(DOCUMENT_CATEGORY_LABELS[c.key], c.key).toBeTruthy();
    }
  });

  // Every surface sorts by this, so a gap or a duplicate would make two
  // screens disagree about the running order.
  it('orders them without gaps or ties', () => {
    const order = DOCUMENT_CATEGORIES.map(c => DOCUMENT_CATEGORY_ORDER[c.key]);
    expect(order).toEqual([...Array(DOCUMENT_CATEGORIES.length).keys()]);
  });

  it('puts employer-issued paperwork last', () => {
    const last = DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1];
    expect(last.key).toBe('employer');
  });

  it('has no duplicate keys', () => {
    const keys = DOCUMENT_CATEGORIES.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('a document nobody has categorised', () => {
  // The fallback is the employee/employer split rather than a bucket called
  // "Other", so a newly added document still lands somewhere truthful.
  it('falls back by who issues it, never to an unknown group', () => {
    expect(categoryOf('a_document_invented_tomorrow', 'employer')).toBe('employer');
    expect(categoryOf('a_document_invented_tomorrow', 'employee')).toBe('project');
    expect(DOCUMENT_CATEGORIES.map(c => c.key)).toContain(categoryOf('whatever'));
  });
});

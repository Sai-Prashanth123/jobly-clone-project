import { describe, it, expect } from 'vitest';
import {
  getRequiredIdentityTypes, EMPLOYER_REQUIRED_BY_VISA, missingEmployerDocs,
} from './documentTypes';

/**
 * "Major documents required H1B — LCA, E-VERIFY, I-9, I-797."
 *
 * H-1B had NO entry in the per-visa required table at all, so none of this
 * was ever demanded. All four H-1B employees on file are missing all four
 * documents, two of them already active.
 *
 * The four split in two, and the split matters: an employee can produce an
 * I-9 and an I-797, but the LCA and the E-Verify letter are issued by the
 * EMPLOYER. Requiring those of the employee would make onboarding impossible
 * to finish — they would be staring at a mandatory field for a document only
 * the company can generate.
 */

describe('what an H-1B employee must upload', () => {
  const required = getRequiredIdentityTypes('h1b');

  it('demands the I-9 and the I-797', () => {
    expect(required).toContain('i9_form');
    expect(required).toContain('i797');
  });

  // The trap this is guarding.
  it('never demands the employer-issued documents from the employee', () => {
    expect(required).not.toContain('lca_copy');
    expect(required).not.toContain('e_verify_letter');
    expect(required).not.toContain('lca');
  });

  it('still demands the passport and I-94 every work visa needs', () => {
    expect(required).toContain('passport');
    expect(required).toContain('i94');
  });

  it('leaves the other visa types as they were', () => {
    const opt = getRequiredIdentityTypes('opt');
    expect(opt).toContain('i20');
    expect(opt).toContain('ead');
    expect(opt).not.toContain('i797');
  });
});

describe('what the employer owes for an H-1B', () => {
  it('names the LCA and the E-Verify letter', () => {
    expect(EMPLOYER_REQUIRED_BY_VISA.h1b).toEqual(['Copy of LCA', 'E-Verify Letter']);
  });

  it('reports both missing when nothing is on file — the live case', () => {
    expect(missingEmployerDocs('h1b', [])).toEqual(['Copy of LCA', 'E-Verify Letter']);
  });

  // "LCA" and "Copy of LCA" are the same piece of paper.
  it('accepts an LCA filed under either label', () => {
    expect(missingEmployerDocs('h1b', [{ type: 'LCA' }])).toEqual(['E-Verify Letter']);
    expect(missingEmployerDocs('h1b', [{ type: 'Copy of LCA' }])).toEqual(['E-Verify Letter']);
  });

  it('reports nothing once both are filed', () => {
    expect(missingEmployerDocs('h1b', [{ type: 'LCA' }, { type: 'E-Verify Letter' }])).toEqual([]);
  });

  it('says nothing for visa types with no employer requirement', () => {
    for (const visa of ['opt', 'stem_opt', 'gc', 'citizen', 'l1', undefined, null]) {
      expect(missingEmployerDocs(visa, []), String(visa)).toEqual([]);
    }
  });

  it('survives a missing document list', () => {
    expect(missingEmployerDocs('h1b', null)).toEqual(['Copy of LCA', 'E-Verify Letter']);
  });
});

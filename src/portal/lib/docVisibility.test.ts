import { describe, it, expect } from 'vitest';
import {
  canSeeRestrictedDocs,
  isRestrictedIdentityType,
  visibleIdentityDocs,
  visibleDocuments,
} from './docVisibility';

/**
 * HR asked for E-Verify, I-9, I-94, I-140, LCA, I-797, Visa, DL and Education
 * to be manager-only.
 *
 * A first attempt gated the whole documents list and the entire Identity &
 * Documents card, and HR reported the same morning that they could not find
 * ANY employee documents — resumes, W-4s, offer letters, insurance waivers and
 * SSN cards had all gone with them. These tests exist mostly to pin the
 * boundary: what is hidden, and just as importantly what must not be.
 */
describe('who counts as a manager', () => {
  it('is admin and Project Manager', () => {
    expect(canSeeRestrictedDocs('admin')).toBe(true);
    expect(canSeeRestrictedDocs('operations')).toBe(true);
  });

  it('is not HR, Finance, Legal or an employee', () => {
    for (const r of ['hr', 'finance', 'legal', 'employee']) {
      expect(canSeeRestrictedDocs(r), r).toBe(false);
    }
  });

  it('refuses an absent or unknown role rather than defaulting open', () => {
    expect(canSeeRestrictedDocs(undefined)).toBe(false);
    expect(canSeeRestrictedDocs(null)).toBe(false);
    expect(canSeeRestrictedDocs('superuser')).toBe(false);
  });
});

describe('exactly the nine that were named are restricted', () => {
  it('covers each one', () => {
    for (const t of ['i9_form', 'i94', 'i140', 'lca', 'i797', 'us_visa', 'driver_license', 'education_documents']) {
      expect(isRestrictedIdentityType(t), t).toBe(true);
    }
  });

  it('includes the state ID, since it stands in for the licence', () => {
    expect(isRestrictedIdentityType('state_id')).toBe(true);
  });

  // The regression. HR handles all of these daily.
  it('leaves the everyday documents alone', () => {
    for (const t of ['resume', 'w4', 'offer_letter', 'insurance_waiver', 'ssn', 'passport', 'i20', 'green_card']) {
      expect(isRestrictedIdentityType(t), `${t} must stay visible`).toBe(false);
    }
  });
});

describe('filtering a list', () => {
  const identityDocs = [
    { type: 'passport' }, { type: 'resume' }, { type: 'i94' },
    { type: 'driver_license' }, { type: 'w4' },
  ];

  it('gives a manager everything', () => {
    expect(visibleIdentityDocs(identityDocs, 'operations')).toHaveLength(5);
    expect(visibleIdentityDocs(identityDocs, 'admin')).toHaveLength(5);
  });

  it('hides only the restricted ones from HR', () => {
    const seen = visibleIdentityDocs(identityDocs, 'hr').map(d => d.type);
    expect(seen).toEqual(['passport', 'resume', 'w4']);
  });

  it('never returns an empty list just because the viewer is not a manager', () => {
    // The shape of the original bug: HR seeing nothing at all.
    expect(visibleIdentityDocs(identityDocs, 'hr').length).toBeGreaterThan(0);
  });

  it('filters uploaded documents by their stored label', () => {
    const uploaded = [
      { type: 'Resume' }, { type: 'I-9 Form' }, { type: 'W-4' },
      { type: 'LCA' }, { type: 'Insurance Waiver Form' },
    ];
    expect(visibleDocuments(uploaded, 'operations')).toHaveLength(5);
    expect(visibleDocuments(uploaded, 'hr').map(d => d.type)).toEqual(['Resume', 'W-4', 'Insurance Waiver Form']);
  });

  it('copes with empty input', () => {
    expect(visibleIdentityDocs([], 'hr')).toEqual([]);
    expect(visibleDocuments([], 'admin')).toEqual([]);
  });
});

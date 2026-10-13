import { describe, it, expect } from 'vitest';
import React from 'react';
import { labelText, findByPrefix } from './selectSearch';

/**
 * "Please fix the search option to be enabled when you type with letter —
 * e.g. India, when you hit I, it should select/highlight the field."
 *
 * Two separate faults. The matcher only ever compared ONE character, so "ind"
 * could not narrow to India — it cycled through everything starting with "d".
 * And it read the label only when it was a plain string, so the state pickers,
 * whose items render `{code} — {name}` as JSX, matched nothing whatsoever:
 * typing in a 57-item list did literally nothing.
 */

const item = (value: string, label: React.ReactNode) => ({ value, label });

// How the country list renders: a plain string.
const COUNTRIES = [
  item('IN', 'India'),
  item('ID', 'Indonesia'),
  item('IE', 'Ireland'),
  item('DE', 'Germany'),
  item('DK', 'Denmark'),
];

// How the state list renders: a JSX fragment, which is why it never worked.
const STATES = [
  item('TX', React.createElement(React.Fragment, null, 'TX', ' — ', 'Texas')),
  item('TN', React.createElement(React.Fragment, null, 'TN', ' — ', 'Tennessee')),
  item('CA', React.createElement(React.Fragment, null, 'CA', ' — ', 'California')),
];

describe('labelText', () => {
  it('reads a plain string label', () => {
    expect(labelText('India')).toBe('India');
  });

  it('reads a JSX label — the case that silently matched nothing', () => {
    expect(labelText(STATES[0].label)).toBe('TX — Texas');
  });

  it('handles numbers, arrays and nested elements', () => {
    expect(labelText(42)).toBe('42');
    expect(labelText(['a', 'b'])).toBe('ab');
    expect(labelText(React.createElement('span', null, React.createElement('b', null, 'x'), 'y'))).toBe('xy');
  });

  it('ignores nullish and boolean children rather than printing them', () => {
    expect(labelText(null)).toBe('');
    expect(labelText(undefined)).toBe('');
    expect(labelText(false)).toBe('');
    expect(labelText(['a', null, false, 'b'])).toBe('ab');
  });
});

describe('typing a prefix', () => {
  it('finds India from "i"', () => {
    expect(findByPrefix(COUNTRIES, 'i', undefined)?.value).toBe('IN');
  });

  // The reported behaviour: more letters must narrow, not cycle.
  it('narrows to Indonesia on "ind" + "o"', () => {
    expect(findByPrefix(COUNTRIES, 'indo', undefined)?.value).toBe('ID');
  });

  it('cycles through matches when the same single letter is repeated', () => {
    const first = findByPrefix(COUNTRIES, 'i', undefined)!;
    const second = findByPrefix(COUNTRIES, 'i', first.value)!;
    const third = findByPrefix(COUNTRIES, 'i', second.value)!;
    expect([first.value, second.value, third.value]).toEqual(['IN', 'ID', 'IE']);
    // ...and wraps back round.
    expect(findByPrefix(COUNTRIES, 'i', third.value)?.value).toBe('IN');
  });

  // A multi-character prefix should settle, not skip past the item it just
  // landed on — otherwise typing "india" walks off the end of the matches.
  it('does not skip past the active item for a longer prefix', () => {
    expect(findByPrefix(COUNTRIES, 'india', 'IN')?.value).toBe('IN');
  });

  it('matches a state despite its JSX label', () => {
    expect(findByPrefix(STATES, 't', undefined)?.value).toBe('TX');
    expect(findByPrefix(STATES, 'tn', undefined)?.value).toBe('TN');
  });

  it('is case insensitive', () => {
    expect(findByPrefix(COUNTRIES, 'INDIA'.toLowerCase(), undefined)?.value).toBe('IN');
  });

  it('matches on prefix, not substring — "ind" is not West Indies', () => {
    const list = [item('WI', 'West Indies'), item('IN', 'India')];
    expect(findByPrefix(list, 'ind', undefined)?.value).toBe('IN');
  });

  it('returns nothing for no match or an empty prefix', () => {
    expect(findByPrefix(COUNTRIES, 'zz', undefined)).toBeUndefined();
    expect(findByPrefix(COUNTRIES, '', undefined)).toBeUndefined();
  });

  it('skips disabled items', () => {
    const list = [{ value: 'IN', label: 'India', disabled: true }, item('ID', 'Indonesia')];
    expect(findByPrefix(list, 'i', undefined)?.value).toBe('ID');
  });

  it('survives an empty list', () => {
    expect(findByPrefix([], 'a', undefined)).toBeUndefined();
  });
});

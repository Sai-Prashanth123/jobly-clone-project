import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { LANGUAGES } from '@/portal/lib/languages';

/**
 * Typing a letter should REVEAL the matches, not cycle silently between them.
 *
 * "When we press T it is going to Thai but not showing other two language
 * options." That is the whole report: native-select typeahead jumps to one
 * match and leaves the rest wherever they are, so on a sixty-eight item list
 * behind a twelve-row window the control looks broken even when the matching
 * is perfect. It was. Three rounds of fixing the matcher never addressed it.
 */

function LanguageSelect() {
  return (
    <Select>
      <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
      <SelectContent>
        {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const open = () => fireEvent.click(screen.getByRole('combobox'));
const search = () => screen.getByRole('textbox', { name: /search options/i });
const optionText = () => screen.queryAllByRole('option').map(o => o.textContent?.trim());

describe('the search box', () => {
  it('appears on a long list', () => {
    render(<LanguageSelect />);
    open();
    expect(search()).toBeTruthy();
  });

  // The reported case, in full.
  it('shows Tamil, Telugu AND Thai together when "t" is typed', () => {
    render(<LanguageSelect />);
    open();
    fireEvent.change(search(), { target: { value: 'ta' } });
    const shown = optionText();
    expect(shown).toContain('Tamil');
    expect(shown).toContain('Tagalog (Filipino)');

    fireEvent.change(search(), { target: { value: 't' } });
    const all = optionText();
    for (const lang of ['Tamil', 'Telugu', 'Thai']) expect(all).toContain(lang);
  });

  it('narrows to a single language', () => {
    render(<LanguageSelect />);
    open();
    fireEvent.change(search(), { target: { value: 'telug' } });
    expect(optionText()).toEqual(['Telugu']);
  });

  it('matches partway through a name, so "fil" finds Tagalog (Filipino)', () => {
    render(<LanguageSelect />);
    open();
    fireEvent.change(search(), { target: { value: 'fil' } });
    expect(optionText()).toContain('Tagalog (Filipino)');
  });

  it('is case insensitive', () => {
    render(<LanguageSelect />);
    open();
    fireEvent.change(search(), { target: { value: 'TELUGU' } });
    expect(optionText()).toEqual(['Telugu']);
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    render(<LanguageSelect />);
    open();
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(optionText()).toEqual([]);
    expect(screen.getByText(/no matches/i)).toBeTruthy();
  });

  it('starts clean when reopened, not stuck on the last search', () => {
    render(<LanguageSelect />);
    open();
    fireEvent.change(search(), { target: { value: 'telugu' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    open();
    expect(optionText().length).toBeGreaterThan(10);
  });
});

describe('short lists are left alone', () => {
  it('shows no search box for a handful of options', () => {
    render(
      <Select>
        <SelectTrigger><SelectValue placeholder="Blood group" /></SelectTrigger>
        <SelectContent>
          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-'].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
        </SelectContent>
      </Select>,
    );
    open();
    expect(screen.queryByRole('textbox', { name: /search options/i })).toBeNull();
    expect(optionText()).toHaveLength(6);
  });
});

describe('the keyboard still works while filtered', () => {
  it('commits a filtered option with Enter', () => {
    const picked: string[] = [];
    render(
      <Select onValueChange={v => picked.push(v)}>
        <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
        <SelectContent>
          {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>,
    );
    open();
    fireEvent.change(search(), { target: { value: 'telugu' } });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(picked).toEqual(['Telugu']);
  });

  // Arrowing must not walk onto rows the filter has hidden.
  it('arrows only through what is on screen', () => {
    render(<LanguageSelect />);
    open();
    fireEvent.change(search(), { target: { value: 'tel' } });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    const active = document.querySelector('[role="option"].bg-accent');
    expect(active?.textContent?.trim()).toBe('Telugu');
  });
});

describe('the language list itself', () => {
  it('keeps same-letter languages together', () => {
    const t = LANGUAGES.filter(l => l.startsWith('T'));
    const firstT = LANGUAGES.indexOf(t[0]);
    // Contiguous: no non-T language in between.
    expect(LANGUAGES.slice(firstT, firstT + t.length)).toEqual(t);
  });

  it('keeps Other last, where a catch-all belongs', () => {
    expect(LANGUAGES[LANGUAGES.length - 1]).toBe('Other');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/**
 * Letter search, tested through the real component.
 *
 * This was reported fixed twice and was not. Both times the matcher was
 * correct and unit-tested, and both times the interaction was broken
 * somewhere else — once because nothing listened until the list was open,
 * once because the state labels lead with a code so prefix matching never
 * hit. Helper tests could not see either, because neither was in the helper.
 *
 * These drive the keyboard against a mounted Select, exactly as the DL and
 * State-ID rows do.
 */

/** How the state pickers render: label leads with the CODE, then the name. */
const STATES = [
  { code: 'CA', name: 'California' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
];

function StateSelect({ onChange }: { onChange?: (v: string) => void }) {
  return (
    <Select onValueChange={onChange}>
      <SelectTrigger aria-label="State"><SelectValue placeholder="State" /></SelectTrigger>
      <SelectContent>
        {STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/**
 * The trigger button.
 *
 * Role is `combobox`, not `button`: the trigger carries aria-haspopup=listbox,
 * which is what a select-like control should expose.
 */
const trigger = () => screen.getByRole('combobox');

/**
 * Type a word at a target.
 *
 * Takes `Document` as well as `Element` because the open list listens on
 * `document` (capture phase) rather than on a focused node — which is the
 * whole reason typing works without the popup stealing focus.
 */
function type(el: Element | Document, word: string) {
  for (const ch of word) fireEvent.keyDown(el, { key: ch });
}

/**
 * The option the component has highlighted.
 *
 * Found by the highlight CLASS, not aria-selected: aria-selected marks the
 * CHOSEN value, while the keyboard highlight is a separate idea and is styled
 * with bg-accent. Conflating the two made every assertion here read null.
 */
function highlighted(): string | null {
  const active = document.querySelector('[role="option"].bg-accent');
  return active?.textContent?.trim() ?? null;
}

describe('typing on a CLOSED dropdown', () => {
  // The gesture people actually use: click the field, start typing.
  it('opens the list', () => {
    render(<StateSelect />);
    type(trigger(), 't');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('jumps to the state whose name was typed, not just its code', () => {
    render(<StateSelect />);
    type(trigger(), 'texas');
    expect(highlighted()).toMatch(/Texas/);
  });

  it('still works when the code is typed', () => {
    render(<StateSelect />);
    type(trigger(), 'nj');
    expect(highlighted()).toMatch(/New Jersey/);
  });

  it('matches partway through a name', () => {
    render(<StateSelect />);
    type(trigger(), 'jersey');
    expect(highlighted()).toMatch(/New Jersey/);
  });
});

describe('typing on an OPEN dropdown', () => {
  it('narrows as more letters arrive', () => {
    render(<StateSelect />);
    fireEvent.click(trigger());          // open it first
    type(document, 'tex');
    expect(highlighted()).toMatch(/Texas/);
  });

  it('distinguishes two states sharing a first letter', () => {
    render(<StateSelect />);
    fireEvent.click(trigger());
    type(document, 'tenn');
    expect(highlighted()).toMatch(/Tennessee/);
  });
});

describe('choosing the highlighted option', () => {
  it('commits the typed state on Enter', () => {
    const picked: string[] = [];
    render(<StateSelect onChange={v => picked.push(v)} />);
    type(trigger(), 'california');
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(picked).toEqual(['CA']);
  });
});

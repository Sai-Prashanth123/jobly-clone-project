import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiFileUploadSlot } from './MultiFileUploadSlot';

/**
 * Selecting several documents must stage all of them.
 *
 * "If I am editing and uploading documents it is only picking 1 or 2 documents
 * at a time" — I-20 and I-983 rows routinely hold five to ten files. The input
 * had no `multiple` attribute and the handler read `files[0]`, so the rest
 * were dropped without a word. These tests count what arrives, because
 * counting is exactly what the old code got wrong.
 */

const toasts = { error: vi.fn(), warning: vi.fn() };
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toasts.error(...a), warning: (...a: unknown[]) => toasts.warning(...a) } }));

const file = (name: string, bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

function setup(over: Partial<React.ComponentProps<typeof MultiFileUploadSlot>> = {}) {
  const onAdd = vi.fn();
  render(
    <MultiFileUploadSlot
      inputId="i20"
      existingDocs={[]}
      stagedFiles={[]}
      maxFiles={10}
      onAdd={onAdd}
      onRemoveStaged={vi.fn()}
      {...over}
    />,
  );
  return { onAdd, input: document.getElementById('i20') as HTMLInputElement };
}

beforeEach(() => { toasts.error.mockReset(); toasts.warning.mockReset(); });

describe('MultiFileUploadSlot', () => {
  it('allows the OS dialog to offer more than one file', () => {
    const { input } = setup();
    // Without this attribute the picker is single-select and nothing else
    // in here can help.
    expect(input).toHaveProperty('multiple', true);
  });

  it('stages every file that was selected, not just the first', () => {
    const { onAdd, input } = setup();
    fireEvent.change(input, { target: { files: [file('i20-a.pdf'), file('i20-b.pdf'), file('i20-c.pdf')] } });

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((f: File) => f.name))
      .toEqual(['i20-a.pdf', 'i20-b.pdf', 'i20-c.pdf']);
  });

  it('fills the remaining slots and says what did not fit', () => {
    // Eight already on file, ten allowed, five chosen: two fit.
    const existing = Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, name: `on-file-${i}.pdf` }));
    const { onAdd, input } = setup({ existingDocs: existing, maxFiles: 10 });

    fireEvent.change(input, {
      target: { files: [file('a.pdf'), file('b.pdf'), file('c.pdf'), file('d.pdf'), file('e.pdf')] },
    });

    expect(onAdd.mock.calls[0][0]).toHaveLength(2);
    expect(toasts.warning).toHaveBeenCalled();
    // Silence here is what made this look like files vanishing.
    expect(String(toasts.warning.mock.calls[0][0])).toMatch(/3 more did not fit/);
  });

  it('keeps the good files when one is rejected', () => {
    const { onAdd, input } = setup();
    // An empty file fails validateUploadFile; the others are fine.
    fireEvent.change(input, { target: { files: [file('ok-1.pdf'), file('empty.pdf', 0), file('ok-2.pdf')] } });

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((f: File) => f.name)).toEqual(['ok-1.pdf', 'ok-2.pdf']);
    expect(toasts.error).toHaveBeenCalled();
  });

  it('does not call onAdd when nothing survives validation', () => {
    const { onAdd, input } = setup();
    fireEvent.change(input, { target: { files: [file('empty.pdf', 0)] } });
    expect(onAdd).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalled();
  });

  it('clears the input so the same file can be picked again', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { files: [file('a.pdf')] } });
    // A non-empty value would suppress the next change event for that file,
    // which reads as the control ignoring the second attempt.
    expect(input.value).toBe('');
  });

  it('shows the count against the cap', () => {
    setup({ stagedFiles: [file('a.pdf'), file('b.pdf')], maxFiles: 10 });
    expect(screen.getByText('2/10')).toBeInTheDocument();
  });
});

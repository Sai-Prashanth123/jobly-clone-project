import { describe, it, expect } from 'vitest';
import {
  planAttachments, describeOmissions,
  MAX_TOTAL_ATTACHMENT_BYTES, MAX_SINGLE_ATTACHMENT_BYTES,
} from './mailAttachments';

const MB = 1024 * 1024;
const f = (filename: string, mb: number) => ({ filename, bytes: Math.round(mb * MB) });

describe('what fits in one invoice email', () => {
  it('keeps everything when it all fits', () => {
    const plan = planAttachments([f('INV-1.pdf', 0.2), f('TS-1.pdf', 1), f('TS-2.pdf', 1)]);
    expect(plan.attach.map(a => a.filename)).toEqual(['INV-1.pdf', 'TS-1.pdf', 'TS-2.pdf']);
    expect(plan.omitted).toEqual([]);
  });

  it('preserves the given order — the PDF first, then line order', () => {
    const plan = planAttachments([f('INV-1.pdf', 0.2), f('TS-1.pdf', 2), f('TS-2.pdf', 2)]);
    expect(plan.attach[0].filename).toBe('INV-1.pdf');
    expect(plan.attach.map(a => a.filename)).toEqual(['INV-1.pdf', 'TS-1.pdf', 'TS-2.pdf']);
  });
});

describe('one oversize file must not fail the whole email', () => {
  // The case the upload work created: proofs may now be up to 100 MB, and SES
  // refuses the entire message over 40 MB.
  it('omits a single huge scan and still sends the rest', () => {
    const plan = planAttachments([f('INV-1.pdf', 0.2), f('huge-scan.pdf', 60), f('TS-2.pdf', 1)]);
    expect(plan.attach.map(a => a.filename)).toEqual(['INV-1.pdf', 'TS-2.pdf']);
    expect(plan.omitted).toEqual([
      { item: f('huge-scan.pdf', 60), reason: 'too-large' },
    ]);
  });

  it('treats the single-file cap as the limit, not the total', () => {
    // 10 MB is under the 20 MB total but over the 8 MB per-file cap: one big
    // file must not be allowed to consume the whole budget.
    const plan = planAttachments([f('big.pdf', 10)]);
    expect(plan.attach).toEqual([]);
    expect(plan.omitted[0].reason).toBe('too-large');
  });
});

describe('the total budget', () => {
  it('stops attaching once full', () => {
    const items = Array.from({ length: 8 }, (_, i) => f(`TS-${i + 1}.pdf`, 7));
    const plan = planAttachments(items);
    // 7 MB each under a 20 MB total → two fit, the rest are budget-full.
    expect(plan.attach).toHaveLength(2);
    expect(plan.totalBytes).toBeLessThanOrEqual(MAX_TOTAL_ATTACHMENT_BYTES);
    expect(plan.omitted.every(o => o.reason === 'budget-full')).toBe(true);
  });

  // Including a later small file is strictly better for the client than
  // bailing out at the first one that does not fit.
  it('keeps scanning past a file that did not fit', () => {
    const plan = planAttachments(
      [f('a.pdf', 7), f('b.pdf', 7), f('big.pdf', 7.5), f('small.pdf', 0.5)],
      { totalBytes: 15 * MB },
    );
    expect(plan.attach.map(a => a.filename)).toEqual(['a.pdf', 'b.pdf', 'small.pdf']);
    expect(plan.omitted.map(o => o.item.filename)).toEqual(['big.pdf']);
  });

  it('accepts a file exactly at each cap', () => {
    const exact = { filename: 'exact.pdf', bytes: MAX_SINGLE_ATTACHMENT_BYTES };
    expect(planAttachments([exact]).attach).toEqual([exact]);

    const full = { filename: 'full.pdf', bytes: MAX_TOTAL_ATTACHMENT_BYTES };
    expect(planAttachments([full], { singleBytes: MAX_TOTAL_ATTACHMENT_BYTES }).attach)
      .toEqual([full]);
  });

  it('handles an empty list', () => {
    expect(planAttachments([])).toEqual({ attach: [], omitted: [], totalBytes: 0 });
  });
});

describe('telling the client what is missing', () => {
  // A silently missing proof is the failure worth avoiding: AP cannot chase a
  // file they do not know existed.
  it('names the omitted files', () => {
    const plan = planAttachments([f('INV-1.pdf', 0.2), f('week-2-scan.pdf', 40)]);
    const note = describeOmissions(plan.omitted);
    expect(note).toContain('week-2-scan.pdf');
    expect(note).toMatch(/too large/i);
  });

  it('says nothing when everything fitted', () => {
    const plan = planAttachments([f('INV-1.pdf', 0.2)]);
    expect(describeOmissions(plan.omitted)).toBeNull();
  });

  it('is plural-correct', () => {
    const one = describeOmissions([{ item: f('a.pdf', 50), reason: 'too-large' as const }]);
    expect(one).toMatch(/^One supporting document was/);
    const two = describeOmissions([
      { item: f('a.pdf', 50), reason: 'too-large' as const },
      { item: f('b.pdf', 50), reason: 'too-large' as const },
    ]);
    expect(two).toMatch(/^2 supporting documents were/);
  });
});

describe('the budget stays under what SES will accept', () => {
  it('leaves room for base64 inflation and the HTML body', () => {
    // SES rejects a message over 40 MB, and MIME base64 costs 4/3.
    const worstCase = MAX_TOTAL_ATTACHMENT_BYTES * (4 / 3);
    expect(worstCase).toBeLessThan(30 * MB);
    expect(MAX_SINGLE_ATTACHMENT_BYTES).toBeLessThan(MAX_TOTAL_ATTACHMENT_BYTES);
  });
});

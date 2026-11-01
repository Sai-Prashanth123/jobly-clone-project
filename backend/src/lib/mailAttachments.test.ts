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

describe('what the client is told about what is missing', () => {
  it('does not call a small file too large', () => {
    // A client was told a 300 KB week-9 timesheet "was too large to attach".
    // It was simply last in the queue, and their AP team cannot act on a
    // reason that is not true.
    const note = describeOmissions([{ item: f('week-9.pdf', 0.3), reason: 'budget-full' as const }]);
    expect(note).not.toMatch(/too large/i);
    expect(note).toMatch(/size limit/i);
  });

  it('separates the reasons when more than one applied', () => {
    const note = describeOmissions([
      { item: f('huge-scan.pdf', 50), reason: 'too-large' as const },
      { item: f('week-9.pdf', 0.3), reason: 'budget-full' as const },
      { item: f('gone.pdf', 1), reason: 'unavailable' as const },
    ]);
    expect(note).toMatch(/too large to attach \(huge-scan\.pdf\)/);
    expect(note).toMatch(/size limit \(week-9\.pdf\)/);
    expect(note).toMatch(/could not be retrieved \(gone\.pdf\)/);
  });
});

describe('the invoice PDF is reserved, not budgeted', () => {
  it('leaves room for it so the message cannot overrun', () => {
    // How invoices.service now plans a send: the PDF is always attached, so
    // its bytes come off the top and the supporting documents get the rest.
    const pdfBytes = 7 * MB;
    const proofs = [f('TS-1.pdf', 7), f('TS-2.pdf', 7)];

    // Uncounted — which is what used to happen — both proofs fit and the
    // message is over budget the moment the invoice itself is added. SES then
    // refuses the whole email and the invoice never goes out.
    const uncounted = planAttachments(proofs);
    expect(uncounted.totalBytes + pdfBytes).toBeGreaterThan(MAX_TOTAL_ATTACHMENT_BYTES);

    const reserved = planAttachments(proofs, { totalBytes: MAX_TOTAL_ATTACHMENT_BYTES - pdfBytes });
    expect(reserved.attach).toHaveLength(1);
    expect(reserved.totalBytes + pdfBytes).toBeLessThanOrEqual(MAX_TOTAL_ATTACHMENT_BYTES);
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

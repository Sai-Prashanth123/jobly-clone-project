import type { Page } from '@playwright/test';

export { test, expect } from '@playwright/test';

/**
 * Shared setup for the portal end-to-end specs.
 *
 * Two things learned the hard way and worth not re-learning:
 *
 * 1. These run against `vite preview` on the built `dist/`, never `npm run
 *    dev`. The dev server cannot boot this app — the jQuery ESM shim throws
 *    "does not provide an export named 'default'".
 * 2. Never find elements with a loose "first scrollable div" heuristic. The
 *    sidebar nav is also scrollable and matches first.
 */

/** Signed in as HR, with no real credential anywhere near this. */
export async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('access_token', 'test-token');
    sessionStorage.setItem('jobly_session', JSON.stringify({
      user: {
        id: 'u1', email: 'hr@example.test', name: 'Test HR',
        role: 'hr', mustResetPassword: false,
      },
      loginTime: new Date().toISOString(),
    }));
  });
}

/**
 * Long, unbreakable filenames on purpose — they are the whole reason the
 * document rows overflowed on a phone.
 */
export const LONG_FILE = 'SSN_SaiPrabhakaraReddyGuduru_StemExtension_2026.pdf';

export const EMPLOYEES = Array.from({ length: 30 }, (_, i) => ({
  id: `emp-${i}`,
  display_id: `EMP-${String(i).padStart(4, '0')}`,
  first_name: 'Person',
  last_name: `Number${i}`,
  email: `person${i}.with.a.long.address@joblysolutions.com`,
  department: 'Engineering',
  job_title: 'Senior Software Engineer',
  employment_type: 'W2',
  start_date: '2026-10-15',
  status: 'onboarding',
  onboarding_status: 'in_progress',
  // The identity-document rows are gated on visa type — I-20 and I-983 only
  // appear for OPT / STEM OPT (documentTypes.ts:290,295). Without this the
  // wizard renders the section heading and no file inputs at all.
  visa_type: 'stem_opt',
  work_authorization: 'stem_opt',
  documents: [
    { id: 'doc-1', name: LONG_FILE, type: 'Social Security Card', uploadedAt: '2026-10-27', url: null },
    { id: 'doc-2', name: 'OfferLetter_SaiPrabhakaraReddyGuduru.pdf', type: 'Offer Letter', uploadedAt: '2026-10-27', url: null },
    // Several of ONE type, which is what made the list unreadable: "Still the
    // documents are scattered". These are the rows that must collapse into a
    // folder; the two above hold one document each and stay plain rows.
    { id: 'doc-3', name: 'I983_Initial_2024.pdf', type: 'I-983', uploadedAt: '2026-10-20', url: null },
    { id: 'doc-4', name: 'I983_Evaluation_12mo.pdf', type: 'I-983', uploadedAt: '2026-10-22', url: null },
    { id: 'doc-5', name: 'I983_Evaluation_24mo.pdf', type: 'I-983', uploadedAt: '2026-10-26', url: null },
  ],
}));

/**
 * Answer everything with something shaped plausibly.
 *
 * A list endpoint gets the employee fixtures, a single record gets one, and
 * anything else gets an empty array — enough for a page to render its chrome,
 * which is all a layout test needs.
 */
export async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', route => {
    const url = route.request().url();
    const json = (data: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });

    if (/\/employees\/emp-\d+/.test(url)) return json(EMPLOYEES[0]);
    if (/\/employees(\?|$)/.test(url)) return json(EMPLOYEES);
    if (/\/(documents|render|url)\b/.test(url)) return json({ kind: 'passthrough', inlineUrl: null });
    return json([]);
  });
}

/** Every element sticking out past the right edge, widest first. */
export async function horizontalOffenders(page: Page): Promise<
  { tag: string; cls: string; right: number; text: string }[]
> {
  return page.evaluate(() => {
    const limit = window.innerWidth + 1;
    const out: { tag: string; cls: string; right: number; text: string }[] = [];
    document.querySelectorAll<HTMLElement>('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= limit) return;
      // Only the outermost offender of a chain is useful; a child sticking out
      // because its parent does is noise.
      if (el.parentElement && el.parentElement.getBoundingClientRect().right > limit) return;
      // Content inside a box that scrolls horizontally on purpose — a tab
      // strip, a wide table — is reachable by swiping, so it is not a bug.
      // Unreachable is the thing worth failing on: .portal-scope sets
      // overflow-x: clip, so anything past the page edge is simply gone.
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') return;
      }
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className ?? '').slice(0, 90),
        right: Math.round(r.right),
        text: (el.textContent ?? '').trim().slice(0, 50),
      });
    });
    return out.sort((a, b) => b.right - a.right);
  });
}

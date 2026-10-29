import { test, expect, signIn, mockApi, horizontalOffenders } from '../playwright-fixture';

/**
 * Nothing in the portal may scroll sideways on a phone.
 *
 * This is a discovery tool as much as a guard. A hand-written inventory of
 * overflowing screens is out of date the moment somebody adds a page; an
 * assertion per route is not.
 *
 * It exists because a document list pushed its Preview and Download buttons
 * off the right edge of a phone — a long filename in a flex row, which
 * defaults to `min-width: auto` and so refuses to shrink below its content.
 *
 * Failures name the offending element, because "the page overflows" is not a
 * bug report.
 */

const PHONE = { width: 360, height: 740 };

/** Routes an HR user reaches, plus the detail pages where filenames live. */
const ROUTES = [
  '/portal/dashboard',
  '/portal/employees',
  '/portal/employees/emp-0',
  '/portal/clients',
  '/portal/documents',
  '/portal/invoices',
  '/portal/timesheets',
  '/portal/expenses',
  '/portal/cases',
  '/portal/legal-review',
  '/portal/my-profile',
  '/portal/enrollment-forms',
  '/portal/support-tickets',
  '/portal/announcements',
  '/portal/expiring-documents',
  '/portal/document-gaps',
  '/portal/hr/onboarding',
];

test.describe('mobile layout', () => {
  test.use({ viewport: PHONE });

  for (const route of ROUTES) {
    test(`${route} does not scroll sideways at ${PHONE.width}px`, async ({ page }) => {
      await signIn(page);
      await mockApi(page);

      await page.goto(route);
      // Let the lazy chunk, the query cache and any images settle; a late
      // image is a classic cause of overflow that appears a beat after load.
      await page.waitForLoadState('networkidle').catch(() => { /* fine */ });
      await page.waitForTimeout(700);

      // NOT document.scrollWidth. When the overflowing row sits inside a card
      // with overflow-x:auto the document never widens, so that assertion
      // passes while Preview and Download sit 260px off the side of a phone —
      // which is exactly what was reported. Measure the elements.
      const offenders = (await horizontalOffenders(page))
        // Sonner's toast viewport is fixed-position and manages its own
        // off-screen transform; it is not page content.
        .filter(o => !/toaster|sonner/i.test(o.cls))
        .filter(o => o.right > PHONE.width + 8);

      if (offenders.length > 0) {
        console.log(`\n${route}:`);
        for (const o of offenders.slice(0, 6)) {
          console.log(`  ${o.right - PHONE.width}px off-screen  <${o.tag} class="${o.cls}"> "${o.text}"`);
        }
      }

      expect(
        offenders.map(o => `${o.right - PHONE.width}px off: <${o.tag} class="${o.cls}">`),
        `${route} has content pushed off the right edge`,
      ).toEqual([]);
    });
  }

  /**
   * The reported bug, named explicitly.
   *
   * The generic sweep above ignores anything inside a horizontally scrollable
   * box, which is correct — but it means a regression here could hide behind
   * that rule if somebody wrapped the card in overflow-x-auto. This asserts
   * the thing the user actually complained about: the buttons are on screen.
   */
  test('employee document rows keep their buttons on screen', async ({ page }) => {
    await signIn(page);
    await mockApi(page);
    await page.goto('/portal/employees/emp-0');

    const preview = page.getByRole('button', { name: /preview/i }).first();
    await preview.waitFor({ timeout: 15_000 });

    const box = await preview.boundingBox();
    expect(box, 'the Preview button should be laid out').not.toBeNull();
    expect(
      Math.round(box!.x + box!.width),
      `Preview sits ${Math.round(box!.x + box!.width) - PHONE.width}px past the right edge of a ${PHONE.width}px screen`,
    ).toBeLessThanOrEqual(PHONE.width);

    // And the filename must still be readable rather than silently clipped to
    // nothing — truncation is fine, disappearing is not.
    const name = page.getByTitle(/SSN_SaiPrabhakaraReddyGuduru/).first();
    await expect(name).toBeVisible();
  });
});

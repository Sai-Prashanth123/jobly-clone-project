import { test, expect, type Page } from '@playwright/test';

/**
 * Does Back put the employee list back where it was?
 *
 * Reported three times and "fixed" twice from reasoning alone, which is how we
 * got here. This drives the real thing: scroll the list, open a row, go back,
 * and read the scroll position off the page rather than argue about it.
 *
 * The list does NOT scroll the window. DataTable's desktop table is capped at
 * max-h-[640px] with overflow-y-auto so its header can stay sticky, so the
 * number that matters is that container's scrollTop.
 */

const EMPLOYEES = Array.from({ length: 60 }, (_, i) => ({
  id: `emp-${i}`,
  display_id: `EMP-${String(i).padStart(4, '0')}`,
  first_name: `Person`,
  last_name: `Number${i}`,
  email: `person${i}@example.test`,
  department: 'Engineering',
  job_title: 'Senior Software Engineer',
  employment_type: 'W2',
  start_date: '2026-10-15',
  status: 'onboarding',
  onboarding_status: 'in_progress',
}));

/** Signed in, without a real credential anywhere near this. */
async function signIn(page: Page) {
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

async function mockApi(page: Page) {
  await page.route('**/api/v1/**', async route => {
    const url = route.request().url();
    const json = (data: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });

    if (/\/employees\/emp-\d+/.test(url)) return json(EMPLOYEES[0]);
    if (/\/employees(\?|$)/.test(url)) return json(EMPLOYEES);
    // Everything else the dashboard chrome asks for.
    return json([]);
  });
}

/** The scrollTop of DataTable's desktop scroll container. */
async function listScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    // The TABLE container specifically. A loose "first scrollable div"
    // heuristic finds the sidebar nav, which also scrolls — that cost one
    // confusing test run.
    const box = document.querySelector('div.max-h-\\[640px\\]');
    return box ? (box as HTMLElement).scrollTop : -1;
  });
}

test('Back returns the employee list to where it was scrolled', async ({ page }) => {
  await signIn(page);
  await mockApi(page);

  await page.goto('/portal/employees');
  await expect(page.getByRole('table').getByText('EMP-0000')).toBeVisible({ timeout: 15_000 });

  // Scroll the list well down, the way somebody hunting for a name would.
  await page.evaluate(() => {
    const box = document.querySelector('div.max-h-\\[640px\\]');
    if (box) (box as HTMLElement).scrollTop = 400;
  });
  await page.waitForTimeout(200);

  const before = await listScrollTop(page);
  expect(before, 'the list should be scrollable and scrolled').toBeGreaterThan(300);

  // Open somebody, then come back.
  await page.getByRole('table').getByText('Person Number5', { exact: true }).first().click();
  await page.waitForURL(/\/portal\/employees\/emp-/, { timeout: 15_000 });
  await page.goBack();
  await expect(page.getByRole('table').getByText('EMP-0000')).toBeVisible({ timeout: 15_000 });

  // Give the restore loop its frames.
  await page.waitForTimeout(600);
  const after = await listScrollTop(page);

  console.log(`browser Back: before=${before} after=${after}`);
  expect(after, 'Back should land where the reader left the list').toBeGreaterThan(before - 50);
});

test('Back keeps you on the page of results you were on', async ({ page }) => {
  // Reported after the scroll fix landed: from page 2 or 3 of the list, Back
  // comes home to page 1. Restoring a scroll offset cannot help, because the
  // rows underneath it are different ones.
  await signIn(page);
  await mockApi(page);

  await page.goto('/portal/employees');
  await expect(page.getByRole('table').getByText('EMP-0000')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Page 2' }).first().click();
  await expect(page.getByRole('table').getByText('EMP-0010')).toBeVisible({ timeout: 15_000 });

  // Scrolled down *within* page 2 — the reported case was "on page 2 or 3 the
  // scrolling issue comes back", which is both things at once.
  await page.evaluate(() => {
    const box = document.querySelector('div.max-h-\\[640px\\]');
    if (box) (box as HTMLElement).scrollTop = 350;
  });
  await page.waitForTimeout(200);
  const before = await listScrollTop(page);
  expect(before).toBeGreaterThan(250);

  await page.getByRole('table').getByText('Person Number12', { exact: true }).first().click();
  await page.waitForURL(/\/portal\/employees\/emp-/, { timeout: 15_000 });

  await page.getByRole('button', { name: /back/i }).first().click();
  await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(700);

  const onPage2 = await page.getByRole('button', { name: 'Page 2' }).first()
    .getAttribute('aria-current');
  expect(onPage2, 'Back should return to page 2, not page 1').toBe('page');
  await expect(page.getByRole('table').getByText('EMP-0010')).toBeVisible();

  const after = await listScrollTop(page);
  console.log(`page 2 Back: page=${onPage2} scroll before=${before} after=${after}`);
  expect(after, 'and to the same place within page 2').toBeGreaterThan(before - 60);
});

test.describe('on a phone', () => {
  // Below md the table is replaced by a card list (DataTable.tsx:287
  // `md:hidden`), which has no inner scroll container — the WINDOW scrolls.
  // That is a different code path from the desktop one, so it needs its own
  // test rather than an assumption that fixing one fixed both.
  test.use({ viewport: { width: 360, height: 740 } });

  test('Back restores the card list', async ({ page }) => {
    await signIn(page);
    await mockApi(page);

    await page.goto('/portal/employees');
    await expect(page.getByText('Person Number5').first()).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.scrollY);
    expect(before, 'the phone list should actually scroll').toBeGreaterThan(300);

    // dispatchEvent, not click(): a real click runs actionability checks and
    // scrolls the target into view, which would move the very thing under
    // test, and a blind page.mouse.click at a coordinate is timing-sensitive
    // under parallel workers. Dispatching bubbles to the card's onClick the
    // same way React's root listener sees a real one.
    await page.locator('div.md\\:hidden > div').nth(7).dispatchEvent('click');
    await page.waitForURL(/\/portal\/employees\/emp-/, { timeout: 15_000 });

    await page.getByRole('button', { name: /back/i }).first().click();
    await expect(page.getByText('Person Number5').first()).toBeVisible({ timeout: 15_000 });

    await page.waitForTimeout(800);
    const after = await page.evaluate(() => window.scrollY);
    console.log(`phone Back: before=${before} after=${after}`);
    expect(after, 'Back on a phone must restore the card list too').toBeGreaterThan(before - 60);
  });
});

test("the page's own Back button restores the list too", async ({ page }) => {
  // The one people actually click. It used to navigate('/portal/employees'),
  // which pushes a NEW history entry — so the list reopened as a fresh visit
  // and the saved offset, keyed on the entry we came from, was never found.
  await signIn(page);
  await mockApi(page);

  await page.goto('/portal/employees');
  await expect(page.getByRole('table').getByText('EMP-0000')).toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => {
    const box = document.querySelector('div.max-h-\\[640px\\]');
    if (box) (box as HTMLElement).scrollTop = 400;
  });
  await page.waitForTimeout(200);
  const before = await listScrollTop(page);
  expect(before).toBeGreaterThan(300);

  await page.getByRole('table').getByText('Person Number5', { exact: true }).first().click();
  await page.waitForURL(/\/portal\/employees\/emp-/, { timeout: 15_000 });

  await page.getByRole('button', { name: /back/i }).first().click();
  await expect(page.getByRole('table').getByText('EMP-0000')).toBeVisible({ timeout: 15_000 });

  await page.waitForTimeout(600);
  const after = await listScrollTop(page);
  console.log(`in-app Back: before=${before} after=${after}`);
  expect(after, 'the on-screen Back button must restore the list as well').toBeGreaterThan(before - 50);
});

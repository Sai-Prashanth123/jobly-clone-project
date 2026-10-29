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

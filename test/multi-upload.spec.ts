import { test, expect, signIn, mockApi } from '../playwright-fixture';

/**
 * Picking several documents at once must stage all of them.
 *
 * The unit tests cover the handler; this covers the thing only a real browser
 * can answer — whether the file input actually accepts a multi-selection. That
 * depends on the `multiple` attribute being present on the rendered element,
 * which is precisely what was missing.
 */

const pdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4 ${name}`),
});

test('an I-20 row takes several files in one go', async ({ page }) => {
  await signIn(page);
  await mockApi(page);

  await page.goto('/portal/employees/emp-0/edit');

  // The multi-file rows (I-20, I-983, Other) are the only inputs that carry
  // `multiple`; single-slot rows like the passport deliberately do not.
  const multi = page.locator('input[type="file"][multiple]').first();
  await multi.waitFor({ state: 'attached', timeout: 20_000 });

  await multi.setInputFiles([
    pdf('i20-2024.pdf'),
    pdf('i20-2025.pdf'),
    pdf('i20-2026.pdf'),
  ]);

  // Three chips, each named — the old code produced exactly one.
  for (const name of ['i20-2024.pdf', 'i20-2025.pdf', 'i20-2026.pdf']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10_000 });
  }
});

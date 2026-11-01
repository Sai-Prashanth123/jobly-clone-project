import { test, expect, signIn, mockApi } from '../playwright-fixture';

/**
 * Documents on file are grouped, not listed one after another.
 *
 * HR, twice: *"Still the documents are scattered."* A STEM OPT employee holds
 * up to ten I-20s and ten I-983s, and in a flat list they sit interleaved with
 * the resume and the W-4 in upload order, so finding the current one means
 * reading every row.
 *
 * What has to hold: several documents of one type collapse behind a folder
 * naming the count, a type with a single document does NOT (a disclosure
 * triangle over one file is just an extra click), and opening the folder shows
 * the files newest first.
 */

test('several documents of one type collapse into a folder', async ({ page }) => {
  await signIn(page);
  await mockApi(page);

  await page.goto('/portal/documents');

  // Signed in as HR, so the page asks which employee first.
  await page.getByText('Person Number0', { exact: true }).first().click();

  const folder = page.getByRole('button', { name: /I-983/ });
  await expect(folder).toBeVisible({ timeout: 20_000 });
  await expect(folder).toContainText('3 files');

  // Closed to begin with — that is the whole point of the grouping.
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('I983_Evaluation_24mo.pdf')).toBeHidden();

  await folder.click();
  await expect(folder).toHaveAttribute('aria-expanded', 'true');

  for (const name of ['I983_Initial_2024.pdf', 'I983_Evaluation_12mo.pdf', 'I983_Evaluation_24mo.pdf']) {
    await expect(page.getByText(name)).toBeVisible();
  }
});

test('a type with one document stays a plain row', async ({ page }) => {
  await signIn(page);
  await mockApi(page);

  await page.goto('/portal/documents');
  await page.getByText('Person Number0', { exact: true }).first().click();

  // The offer letter is the only one of its type, so it is readable straight
  // away rather than hidden behind a folder.
  await expect(page.getByText('OfferLetter_SaiPrabhakaraReddyGuduru.pdf'))
    .toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Offer Letter.*files/ })).toHaveCount(0);
});

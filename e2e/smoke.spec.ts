import { expect, test } from '@playwright/test';

test('the production build opens on the month with a heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', /rtl|ltr/);
});

test.describe('first run', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('an empty calendar is greeted once, and "Get started" keeps it away', async ({ page }) => {
    await page.goto('/');
    const card = page.getByRole('region', { name: 'Welcome to Taqweem' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Get started' }).click();
    await expect(card).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(card).toBeHidden();
  });
});

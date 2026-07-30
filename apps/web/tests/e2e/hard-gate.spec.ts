import { test, expect } from '@playwright/test';

test.describe('Day-2 hard gate (mock)', () => {
  test('new chat, composer modes, and shell panes', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator(':text("Lenny Growth Assistant"):visible').first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /new chat/i }).first()).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Auto' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Ask Lenny' })).toBeVisible();
  });

  test('suggested prompts visible on empty chat', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new chat/i }).first().click();
    await expect(
      page.getByRole('button', {
        name: /What patterns do Lenny's guests recommend for finding product-market fit/,
      }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

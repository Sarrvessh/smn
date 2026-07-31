import { test, expect } from '@playwright/test';

test.describe('Signal smoke', () => {
  test('loads the branded three-pane shell', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator(':text("Signal"):visible').first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('textarea').first()).toBeVisible();
  });

  test('composer and new chat controls are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /new chat/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('textarea').first()).toBeVisible();
  });
});

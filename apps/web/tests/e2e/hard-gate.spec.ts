import { test, expect, type Page } from '@playwright/test';

async function resetAndOpen(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
  await expect(page.getByText('Lenny Growth Assistant').first()).toBeVisible({
    timeout: 15_000,
  });
}

async function newChat(page: Page) {
  await page.getByRole('button', { name: /new chat/i }).first().click();
  await expect(page.getByRole('heading', { name: /ask better product growth questions/i })).toBeVisible();
}

async function sendMessage(page: Page, content: string) {
  const composer = page.locator('#composer-input');
  await composer.fill(content);
  await composer.press('Enter');
}

test.describe('Lenny Growth Assistant primary UI flows', () => {
  test('persistent chat survives refresh', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await sendMessage(page, 'Persistent PMF retention test');
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByText('Persistent PMF retention test')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible();
  });

  test('switches between independent sessions', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await sendMessage(page, 'First activation switching test');
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible({
      timeout: 15_000,
    });

    await newChat(page);
    await sendMessage(page, 'Second retention switching test');
    await expect(page.getByText('Second retention switching test')).toBeVisible();

    await page.getByRole('button', { name: /First activation switching test/i }).click();
    await expect(page.getByText('First activation switching test')).toBeVisible();
    await expect(page.getByText('Second retention switching test')).not.toBeVisible();
  });

  test('opens citation source details and exposes safe source link', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await sendMessage(page, 'What do guests say about PMF signals?');
    await expect(page.getByRole('button', { name: /open source S1/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: /open source S1/i }).click();
    await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
    await expect(page.locator('#source-S1')).toContainText('Sample Guest');
    await expect(page.getByRole('link', { name: /open source/i })).toHaveAttribute(
      'href',
      /youtube\.com/,
    );
  });

  test('renders markdown artifact preview, code tab, and copy action', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await page.getByRole('radio', { name: 'Ship30 Essay' }).click();
    await sendMessage(page, 'Turn PMF signals into a Ship30 essay');

    await expect(page.getByText('Ship30 PMF Essay')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: /The PMF Signal/i })).toBeVisible();
    await page.getByRole('tab', { name: 'code' }).click();
    await expect(page.getByText('# The PMF Signal Hiding in Retention')).toBeVisible();
    await page.getByRole('button', { name: /copy artifact/i }).click();
    await expect(page.getByRole('button', { name: /copy artifact/i })).toHaveText('OK');
  });

  test('renders HTML artifact in sandbox and code tab', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await page.getByRole('radio', { name: 'Create Artifact' }).click();
    await sendMessage(page, 'Create an HTML growth strategy dashboard');

    await expect(page.getByText('Growth Strategy Dashboard').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('iframe[title="Growth Strategy Dashboard"]')).toBeVisible();
    const parentScriptRan = await page.evaluate(() =>
      Reflect.has(window, '__artifactScriptRan'),
    );
    expect(parentScriptRan).toBe(false);
    await page.getByRole('tab', { name: 'code' }).click();
    await expect(page.getByText('window.__artifactScriptRan')).toBeVisible();
  });

  test('shows provider error recovery and retries on healthy provider', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await page.getByLabel('LLM provider').selectOption('anthropic');
    await expect(page.getByText(/anthropic is not configured/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

    await page.getByLabel('LLM provider').selectOption('ollama');
    await sendMessage(page, 'Provider recovery test');
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('desktop, tablet, and mobile layouts avoid horizontal overflow', async ({ page }) => {
    await resetAndOpen(page);
    for (const size of [
      { width: 1440, height: 900 },
      { width: 900, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator('#composer-input')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    }
  });
});

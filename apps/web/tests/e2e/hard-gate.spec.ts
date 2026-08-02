import { test, expect, type Page } from '@playwright/test';

async function resetAndOpen(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#composer-input')).toBeVisible({
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

async function selectSkill(page: Page, command: 'essay' | 'artifact') {
  const composer = page.locator('#composer-input');
  await composer.fill(`/${command}`);
  const label = command === 'essay' ? 'Ship30 Essay' : 'Create Artifact';
  await page.getByRole('option', { name: new RegExp(label, 'i') }).click();
}

async function waitForCompletedAnswer(page: Page) {
  await expect(page.getByText('transcript_qa', { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('Signal primary UI flows', () => {
  test('persistent chat survives refresh', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await sendMessage(page, 'Persistent PMF retention test');
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible({
      timeout: 15_000,
    });
    await waitForCompletedAnswer(page);

    await page.reload();
    await expect(
      page.locator('article').getByText('Persistent PMF retention test', { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible();
  });

  test('switches between independent sessions', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await sendMessage(page, 'First activation switching test');
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible({
      timeout: 15_000,
    });
    await waitForCompletedAnswer(page);

    await newChat(page);
    await sendMessage(page, 'Second retention switching test');
    await expect(page.getByText('Second retention switching test')).toBeVisible();
    await waitForCompletedAnswer(page);

    await page
      .getByRole('button', { name: 'First activation switching test', exact: true })
      .click();
    await expect(
      page.locator('article').getByText('First activation switching test', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('article').getByText('Second retention switching test', { exact: true }),
    ).not.toBeVisible();
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
    await selectSkill(page, 'essay');
    await sendMessage(page, 'Turn PMF signals into a Ship30 essay');

    await expect(page.getByText('Ship30 PMF Essay')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page
        .getByLabel('Artifact workspace')
        .getByRole('heading', { name: /The PMF Signal/i }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'code' }).click();
    await expect(page.getByText('# The PMF Signal Hiding in Retention')).toBeVisible();
    await page.getByRole('button', { name: /copy artifact/i }).click();
    await expect(page.getByRole('button', { name: /copy artifact/i })).toHaveAttribute(
      'title',
      'Copied',
    );
  });

  test('renders HTML artifact in sandbox and code tab', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await selectSkill(page, 'artifact');
    await sendMessage(page, 'Create an HTML growth strategy dashboard');

    await expect(page.getByText('Growth Strategy Dashboard').first()).toBeVisible({
      timeout: 15_000,
    });
    const frame = page.locator('iframe[title="Growth Strategy Dashboard"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('sandbox', '');
    await expect(
      page.frameLocator('iframe[title="Growth Strategy Dashboard"]').getByRole('heading', {
        name: 'Growth Strategy Dashboard',
      }),
    ).toBeVisible();
    const parentScriptRan = await page.evaluate(() =>
      Reflect.has(window, '__artifactScriptRan'),
    );
    expect(parentScriptRan).toBe(false);
    await page.getByRole('tab', { name: 'code' }).click();
    await expect(page.getByText(/<main style=/)).toBeVisible();
  });

  test('shows provider error recovery and retries on healthy provider', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await page.getByLabel('LLM provider').selectOption('anthropic');
    await expect(
      page.locator('div[role="status"]').filter({ hasText: 'anthropic is not configured' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

    await page.getByLabel('LLM provider').selectOption('ollama');
    await sendMessage(page, 'Provider recovery test');
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible({
      timeout: 15_000,
    });
    await waitForCompletedAnswer(page);
  });

  test('archives and restores a chat without losing its messages', async ({ page }) => {
    await resetAndOpen(page);
    await newChat(page);
    await sendMessage(page, 'Archive restore persistence test');
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible({
      timeout: 15_000,
    });
    await waitForCompletedAnswer(page);

    await page
      .getByRole('button', { name: 'Open actions for Archive restore persistence test' })
      .click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await page.getByRole('button', { name: 'Library' }).click();
    const library = page.getByRole('dialog', { name: 'Library' });
    await expect(library).toBeVisible();
    await expect(
      library.getByText('Archive restore persistence test', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();

    await expect(
      page.getByRole('button', {
        name: 'Archive restore persistence test',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator('article').getByText('Archive restore persistence test', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/retention and pull problem/i)).toBeVisible();
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

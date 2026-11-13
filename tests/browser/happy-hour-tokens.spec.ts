import { expect, test } from '@playwright/test';
import { connectedAccount } from './fixtures';

for (const width of [320, 393, 800, 1280]) {
  test(`Happy Hours tokens fit the tab at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.route('https://**', (route) => {
      throw new Error(`Unexpected external request: ${new URL(route.request().url()).origin}`);
    });
    await connectedAccount(page);
    await page.goto('/');
    const tab = page.getByRole('tab', { name: 'Happy Hours', exact: true });
    await expect(tab).toContainText('3 tokens');
    await page.evaluate(() => document.fonts.ready);
    await expect(tab).toHaveAccessibleDescription(
      '3 Happy Hours tokens available. Account balance, independent of the selected dates.',
    );
    const fits = await tab.locator('.happy-hour-tokens').evaluate((element) => {
      const badge = element.getBoundingClientRect();
      const button = element.closest('button')?.getBoundingClientRect();
      return (
        button !== undefined &&
        badge.left >= button.left &&
        badge.right <= button.right &&
        badge.top >= button.top &&
        badge.bottom <= button.bottom
      );
    });
    expect(fits).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(tab).toContainText('3 tokens');
  });
}

test('tokens refresh, preserve zero, ignore history filters and recover after failure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route('https://**', (route) => {
    throw new Error(`Unexpected external request: ${new URL(route.request().url()).origin}`);
  });
  await connectedAccount(page);
  let tokenBalance = 0;
  let unavailable = false;
  await page.route('https://api.backend.octopus.energy/**', (route) => {
    if (!route.request().postData()?.includes('HappyHourTokens')) return route.fallback();
    return route.fulfill({
      json: unavailable
        ? { errors: [{ message: 'Unavailable' }] }
        : { data: { savingSessions: { account: { tokenBalance } } } },
    });
  });
  await page.goto('/');
  const tab = page.getByRole('tab', { name: 'Happy Hours', exact: true });
  const refresh = page.getByRole('button', { name: 'Refresh results' });
  await expect(tab).toContainText('0 tokens');
  await expect(refresh).toBeEnabled();
  tokenBalance = 1;
  await refresh.click();
  await expect(tab.locator('.happy-hour-tokens')).toHaveText('1 token');
  await expect(refresh).toBeEnabled();

  await page.getByRole('button', { name: 'Custom dates' }).click();
  await page.getByLabel('From', { exact: true }).fill('2026-11-04');
  await page.getByLabel('To', { exact: true }).fill('2026-11-05');
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await expect(refresh).toBeEnabled();
  await expect(tab.locator('.happy-hour-tokens')).toHaveText('1 token');

  unavailable = true;
  await refresh.click();
  await expect(tab.locator('.happy-hour-tokens')).toHaveText('••• tokens');
  await expect(tab).toHaveAccessibleDescription(
    'Happy Hours token balance unavailable. Refresh results to try again.',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(refresh).toBeEnabled();
  unavailable = false;
  tokenBalance = 3;
  await refresh.click();
  await expect(tab).toContainText('3 tokens');
  await expect(refresh).toBeEnabled();
  await page.getByRole('button', { name: 'Forget account' }).click();
  await expect(tab).toHaveCount(0);
});

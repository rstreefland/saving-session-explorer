import { expect, test } from '@playwright/test';

for (const width of [320, 393, 600]) {
  test(`comparison cards fit at ${width}px and open readings`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try demo' }).click();
    await expect(page.locator('.mobile-session')).not.toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await fits()).toBe(true);
    for (const name of ['Power down', 'Power up', 'Happy Hours']) {
      await page.getByRole('tab', { name, exact: true }).click();
      const button = page.locator('.mobile-details-toggle').first();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await button.click();
      await expect(page.locator('.session-details')).toBeVisible();
      expect(await fits()).toBe(true);
      await button.click();
      await expect(page.locator('.session-details')).toHaveCount(0);
    }
    // Larger screens retain the table.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('.history-table')).toBeVisible();
    await expect(page.locator('.mobile-results')).toHaveCount(0);
  });
}

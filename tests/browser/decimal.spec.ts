import { expect, test } from '@playwright/test';
import { precisionAccount } from './fixtures';

for (const width of [320, 1280]) {
  for (const uniform of [false, true]) {
    test(`exact reference mean at ${width}px, uniform=${uniform}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await precisionAccount(page, uniform);
      await page.goto('/');
      await expect(page.locator('.history-row, .mobile-session')).toHaveCount(1);
      await page.getByRole('button', { name: /Readings for/ }).click();
      const summary = page.getByRole('region', { name: 'Calculation summary' });
      await expect(summary).toContainText('Baseline0.101 kWh');
      await expect(summary).toContainText('Total shifted for rewards0.101 kWh');
      await page.getByText('Days used for baseline (10)', { exact: true }).click();
      await expect(
        page.getByRole('row', { name: 'Average for this half-hour 0.101' }),
      ).toBeVisible();
      const points = page.getByRole('region', { name: 'Octopoints estimate' });
      await expect(points).toContainText('0.1005 kWh × 80 points/kWh = 8.04 points.');
      await expect(points).toContainText('0 Octopoints. Matches Octopus.');
      expect(
        await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
      ).toEqual([]);
    });
  }
}

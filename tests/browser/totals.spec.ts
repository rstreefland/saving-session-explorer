import { expect, test } from '@playwright/test';

for (const width of [393, 768, 1280]) {
  test(`totals stay visible and follow the selected type at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.route('https://**/*', (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'Try demo', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole('button', { name: /Readings for/ })
      .first()
      .click();
    const footer = page.locator('.history-totals');
    await expect(footer).toBeVisible();
    await page
      .locator('.session-tabs')
      .evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expect
      .poll(() => footer.evaluate((element) => element.getBoundingClientRect().bottom))
      .toBe(852);
    await expect(footer).toContainText('results included');
    const typographyMatchesRows = await page.evaluate(() => {
      const energy = document.querySelector('.mobile-energy, .history-row .shifted-energy');
      const reward = document.querySelector(
        '.mobile-source-reward .octopoints-value, .history-row .octopoints-value',
      );
      const totalEnergy = document.querySelector('.history-totals .total-energy');
      const totalReward = document.querySelector('.history-totals .octopoints-value');
      const count = document.querySelector('.history-totals .total-value > small');
      return (
        energy &&
        reward &&
        totalEnergy &&
        totalReward &&
        count &&
        getComputedStyle(energy).fontSize === getComputedStyle(totalEnergy).fontSize &&
        getComputedStyle(reward).fontSize === getComputedStyle(totalReward).fontSize &&
        getComputedStyle(energy).fontSize === getComputedStyle(count).fontSize
      );
    });
    expect(typographyMatchesRows).toBe(true);

    for (const amount of await footer.locator('.octopoints-value').all()) {
      await expect(amount).toHaveCSS('white-space', 'nowrap');
      await expect(amount.locator('.points-unit')).toHaveCSS('display', 'inline');
    }
    await page.getByRole('tab', { name: 'Power up', exact: true }).click();
    await expect(footer.locator('.octopoints-value')).toHaveCount(1);
    await page.getByRole('tab', { name: 'Happy Hours', exact: true }).click();
    await expect(footer.locator('.octopoints-value')).toHaveCount(0);
    await expect(footer).toContainText('kWh');
    await expect(footer).toContainText('p');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

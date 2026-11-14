import { expect, test } from '@playwright/test';

for (const width of [320, 393, 768, 1280]) {
  test(`overview follows the selected layout and session type at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.route('https://**/*', (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'Try demo', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole('button', { name: /Readings for/ })
      .first()
      .click();
    await expect(page.getByRole('region', { name: 'Session summary' })).toHaveCount(0);
    const overview = page.getByRole('region', { name: 'Session overview' });
    await expect(overview).toBeVisible();
    await page
      .locator('.session-tabs')
      .evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expect(overview).toHaveCSS('position', 'static');
    expect(
      await overview.evaluate((element) => element.parentElement?.firstElementChild === element),
    ).toBe(true);
    expect(
      await overview.locator('.overview-heading').evaluate((element) => {
        const heading = element.querySelector('h3');
        const count = element.querySelector('span');
        return (
          heading &&
          count &&
          heading.getBoundingClientRect().top === count.getBoundingClientRect().top &&
          element.scrollWidth <= element.clientWidth
        );
      }),
    ).toBe(true);
    await expect(overview).not.toContainText('results included');
    const typographyMatchesRows = await page.evaluate(() => {
      const energy = document.querySelector('.mobile-energy, .history-row .shifted-energy');
      const reward = document.querySelector(
        '.mobile-source-reward .octopoints-value, .history-row .octopoints-value',
      );
      const totalEnergy = document.querySelector('.session-overview .overview-value');
      const totalReward = document.querySelector('.session-overview .octopoints-value');
      return (
        energy &&
        reward &&
        totalEnergy &&
        totalReward &&
        getComputedStyle(energy).fontSize === getComputedStyle(totalEnergy).fontSize &&
        getComputedStyle(reward).fontSize === getComputedStyle(totalReward).fontSize
      );
    });
    expect(typographyMatchesRows).toBe(true);
    for (const value of await overview.locator('tbody strong').all()) {
      await expect(value).toHaveCSS('font-weight', '400');
    }
    for (const value of await page
      .locator('.history-row .outcome-label, .mobile-source .outcome-label')
      .all()) {
      await expect(value).toHaveCSS('font-weight', '400');
    }
    await expect(overview.getByRole('columnheader', { name: 'Octopus' })).toHaveCSS(
      'font-weight',
      '700',
    );

    for (const amount of await overview.locator('.octopoints-value').all()) {
      await expect(amount).toHaveCSS('white-space', 'nowrap');
      await expect(amount.locator('.points-unit')).toHaveCSS('display', 'inline');
    }
    await page.getByRole('tab', { name: 'Power up', exact: true }).click();
    await expect(overview.locator('.octopoints-value')).toHaveCount(1);
    await expect(overview.getByRole('button', { name: 'Not estimated' })).toBeVisible();
    await page.getByRole('tab', { name: 'Happy Hours', exact: true }).click();
    await expect(overview.locator('.octopoints-value')).toHaveCount(0);
    await expect(overview).toContainText('kWh');
    await expect(overview.getByRole('rowheader', { name: 'Bill credit' })).toBeVisible();
    await expect(
      overview.getByRole('rowheader', { name: 'Achieved or partly achieved' }),
    ).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

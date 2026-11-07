import { expect, test, type Locator, type Page } from '@playwright/test';
import { connectedAccount } from './fixtures';

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();

  expect(bounds).not.toBeNull();

  return bounds!;
}

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    await page
      .locator('.history-scroll, .mobile-results')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  const sizesMatch = await page.evaluate(() => {
    const time = document.querySelector('.mobile-session-time, .history-table .session-time');
    const outcomes = document.querySelectorAll(
      '.mobile-source .outcome-label, .history-row .outcome-label',
    );
    const date = document.querySelector(
      '.mobile-session-heading time, .history-table .session-date time',
    );
    const energy = document.querySelector('.mobile-energy, .history-table .shifted-energy');
    return (
      (!time ||
        [...outcomes].every(
          (outcome) => getComputedStyle(outcome).fontSize === getComputedStyle(time).fontSize,
        )) &&
      (!date || !energy || getComputedStyle(date).fontSize === getComputedStyle(energy).fontSize)
    );
  });
  expect(sizesMatch).toBe(true);
  const rewardsStayTogether = await page.locator('.octopoints-value').evaluateAll((values) =>
    values.every((value) => {
      const range = document.createRange();
      range.selectNode(value.firstChild!);
      const number = range.getBoundingClientRect();
      const unit = value.querySelector('.points-unit')!.getBoundingClientRect();
      const amountStyle = getComputedStyle(value.querySelector('strong')!);
      const unitStyle = getComputedStyle(value.querySelector('.points-unit')!);
      const energy = value.closest('.mobile-source')?.querySelector('.mobile-energy');
      const expectedStyle = energy ? getComputedStyle(energy) : amountStyle;
      return (
        number.bottom > unit.top &&
        unit.bottom > number.top &&
        unitStyle.fontSize === expectedStyle.fontSize &&
        (!energy ||
          (unitStyle.color === expectedStyle.color &&
            unitStyle.fontWeight === expectedStyle.fontWeight)) &&
        Number(amountStyle.fontWeight) >= 700
      );
    }),
  );
  expect(rewardsStayTogether).toBe(true);
}

for (const width of [320, 375, 390, 600, 800, 1280]) {
  test(`results and account controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connectedAccount(page);
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Connected to Octopus', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.history-row, .mobile-session')).toHaveCount(4);

    await page.evaluate(() => document.fonts.ready);
    await fitsViewport(page);

    const summary = page.locator('.connection-summary');
    const container = await box(summary);

    for (const button of await summary.getByRole('button').all()) {
      const bounds = await box(button);

      expect(bounds.x).toBeGreaterThanOrEqual(container.x - 1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(container.x + container.width + 1);
      expect(bounds.height).toBeGreaterThanOrEqual(40);
    }

    const number = await box(summary.getByText('Account number:', { exact: true }));
    const name = await box(summary.getByText('Account holder:', { exact: true }));

    expect(number.y).toBeLessThan(name.y);

    for (const row of await page.locator('.history-row').all()) {
      const time = row.locator('.session-time');

      expect(
        await time.evaluate((element) => {
          const range = document.createRange();

          range.selectNodeContents(element);

          return range.getClientRects().length;
        }),
      ).toBe(1);
      expect(await time.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );

      const timeBox = await box(time);
      const dateBox = await box(row.locator('.session-date'));

      expect(timeBox.x + timeBox.width).toBeLessThanOrEqual(dateBox.x + dateBox.width + 1);

      if (width <= 800) {
        const energies = row.locator('.shifted-energy');
        const estimates = await box(energies.nth(0));
        const actual = await box(energies.nth(1));

        expect(Math.abs(estimates.y - actual.y)).toBeLessThanOrEqual(1);

        const rewards = row.locator('.mobile-reward');
        const a = await box(rewards.nth(0));
        const b = await box(rewards.nth(1));

        expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);

        const toggle = await box(row.getByRole('button'));

        expect(toggle.width).toBeGreaterThanOrEqual(44);
        expect(toggle.height).toBeGreaterThanOrEqual(44);
      }
    }

    await page
      .getByRole('button', { name: /Readings for/ })
      .first()
      .click();

    await expect(page.locator('.session-details')).toBeVisible();

    await fitsViewport(page);
    // Check complete formulas as well as placeholders, including the stacked mobile layout.
    await page
      .getByRole('button', { name: /Readings for/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Readings for/ })
      .nth(1)
      .click();

    const calculation = page.getByRole('region', { name: 'Calculation summary' });
    await expect(calculation).toContainText('Total shifted for rewards');
    await expect(calculation.getByText('Overall change', { exact: true })).toHaveCount(0);

    // Read geometry in one browser evaluation rather than a round-trip for every card.
    const equationsFit = await calculation.evaluate((element) => {
      const outer = element.getBoundingClientRect();
      const cards = [...element.querySelectorAll('.calculation-card')];
      const operators = [...element.querySelectorAll('.calculation-operator')];

      return (
        cards.length === 6 &&
        operators.length === 4 &&
        cards.every((card) => {
          const bounds = card.getBoundingClientRect();

          return bounds.x >= outer.x - 1 && bounds.right <= outer.right + 1;
        }) &&
        operators.every((operator) => {
          const bounds = operator.getBoundingClientRect();

          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            getComputedStyle(operator).visibility === 'visible'
          );
        })
      );
    });

    expect(equationsFit).toBe(true);
    await fitsViewport(page);
    await page.getByRole('tab', { name: 'Happy Hours' }).click();

    await expect(page.locator('.history-row, .mobile-session')).toHaveCount(1);

    await page.getByRole('button', { name: /Readings for/ }).click();
    await expect(page.getByRole('region', { name: 'Calculation summary' })).toContainText(
      'Total imported',
    );
    await fitsViewport(page);

    expect(
      await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
    ).toEqual([]);
  });
}

test('production CSP blocks injected scripts and unapproved requests while tooltips work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await connectedAccount(page);
  await page.goto('/');

  await expect(page.locator('.history-row, .mobile-session')).toHaveCount(4);

  await page.getByRole('button', { name: 'Calculated result', exact: true }).click();

  await expect(page.getByRole('tooltip')).toBeVisible();

  await page.evaluate(() => {
    const script = document.createElement('script');

    script.textContent = 'window.injectedScriptRan = true';
    document.body.appendChild(script);
  });

  expect(
    await page.evaluate(
      () => (window as unknown as { injectedScriptRan?: boolean }).injectedScriptRan,
    ),
  ).toBeUndefined();

  const blocked = await page.evaluate(async () => {
    try {
      await fetch('https://unapproved.invalid/');

      return false;
    } catch {
      return true;
    }
  });

  expect(blocked).toBe(true);

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
    )
    .toEqual(expect.arrayContaining(['script-src-elem', 'connect-src']));
});

for (const width of [320, 1280]) {
  test(`provisional Mini estimates fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connectedAccount(page, true);
    await page.goto('/');
    const row = page.locator('.history-row, .mobile-session').first();
    await expect(row.getByRole('button', { name: 'Provisional reading' })).toBeVisible();
    await fitsViewport(page);
    await row.getByRole('button', { name: /Readings for/ }).click();
    const provisional = page
      .locator('.session-details')
      .getByRole('button', { name: 'Provisional reading' })
      .first();
    // Scroll before activation: tooltips intentionally dismiss when the page scrolls.
    await provisional.scrollIntoViewIfNeeded();
    await expect(provisional).toBeInViewport();
    await provisional.click();
    await expect(page.getByRole('tooltip')).toContainText('Home Mini');
    await fitsViewport(page);
    expect(
      await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
    ).toEqual([]);
  });
}

test('meter notes list gap periods and calculation guides open independently', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await connectedAccount(page, true);
  await page.goto('/');
  await expect(page.locator('.history-row, .mobile-session')).toHaveCount(4);
  await page.getByText('Missing data?', { exact: true }).click();
  const gaps = page.getByRole('table', { name: 'Missing meter readings' });
  await expect(gaps).toContainText('4 Nov 2026');
  await expect(gaps).toContainText('Home Mini data available');
  await expect(gaps).toContainText('Yes');
  const guides = page.getByRole('region', { name: 'Calculation guides' });
  for (const title of [
    'How your baseline is calculated',
    'Understanding your results and rewards',
    'Why estimates can differ from Octopus',
  ]) {
    await expect(guides.getByText(title, { exact: true })).toBeVisible();
    await guides.getByText(title, { exact: true }).click();
    await expect(guides.locator('#methodology')).not.toHaveAttribute('open');
  }
  await fitsViewport(page);
});

for (const width of [320, 1280]) {
  test(`Power up keeps energy estimates without reward estimates at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try demo', exact: true }).click();
    await page.getByRole('tab', { name: 'Power up', exact: true }).click();
    if (width <= 600) {
      const card = page.locator('.mobile-session').first();
      await expect(card.locator('.mobile-source-label').first()).toHaveText('Calculated');
      await expect(
        card.locator('.mobile-source').first().locator('.mobile-source-reward'),
      ).toHaveCount(0);
    } else {
      const table = page.getByRole('table', { name: 'Power up session history' });
      await expect(table.getByRole('columnheader', { name: 'Calculated result' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Calculated reward' })).toHaveCount(0);
    }
    await page.getByRole('button', { name: /Readings for/ }).click();
    await expect(page.getByRole('region', { name: 'Calculation summary' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Octopoints estimate' })).toHaveCount(0);
    await fitsViewport(page);
  });
}

for (const width of [320, 1280]) {
  test(`Octopus missing-data results explain average credits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connectedAccount(page, false, true);
    await page.goto('/');
    const result = page.getByRole('button', { name: 'Missing data', exact: true });
    await expect(result).toBeVisible();
    const row = result.locator('xpath=ancestor::*[self::tr or self::li][1]');
    await result.scrollIntoViewIfNeeded();
    await expect(result).toBeInViewport();
    await result.click();
    await expect(page.getByRole('tooltip')).toContainText('average Octopoints earned');
    await result.press('Escape');
    await row.getByRole('button', { name: /Readings for/ }).click();
    await expect(page.getByRole('note', { name: 'Octopus missing data' })).toContainText(
      'Your own estimate may differ from an average credit',
    );
    await fitsViewport(page);
  });
}

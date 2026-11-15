import { decimal } from '../../src/domain/decimal';
import { expect, test } from 'vitest';
import type { Locator } from 'vitest/browser';
import { page, openApp, connectedAccount } from './fixtures';

function box(locator: Locator) {
  return locator.element().getBoundingClientRect();
}

function fitsViewport() {
  expect(document.documentElement.scrollWidth <= window.innerWidth).toBe(true);
  const results = page.getBySelector('.history-scroll, .mobile-results').element();
  expect(decimal(results.scrollWidth).lte(decimal(results.clientWidth).plus(1))).toBe(true);
  const time = document.querySelector('.mobile-session-time, .history-table .session-time');
  const outcomes = document.querySelectorAll(
    '.mobile-source .outcome-label, .history-row .outcome-label',
  );
  const date = document.querySelector(
    '.mobile-session-heading time, .history-table .session-date time',
  );
  const energy = document.querySelector('.mobile-energy, .history-table .shifted-energy');
  if (time) {
    expect(getComputedStyle(time).fontSize).toBe('14px');
    for (const outcome of outcomes) {
      expect(getComputedStyle(outcome).fontSize).toBe('14px');
    }
  }
  if (date) expect(getComputedStyle(date).fontSize).toBe('12px');
  if (energy)
    expect(getComputedStyle(energy).fontSize).toBe(
      energy.classList.contains('mobile-energy-main') ? '14px' : '12px',
    );
  for (const value of page.getBySelector('.octopoints-value').elements()) {
    const range = document.createRange();
    range.selectNode(value.firstChild!);
    const number = range.getBoundingClientRect();
    const unit = value.querySelector('.points-unit')!;
    const unitBounds = unit.getBoundingClientRect();
    const amountStyle = getComputedStyle(value.querySelector('strong')!);
    const unitStyle = getComputedStyle(unit);
    const energy = value.closest('.mobile-source')?.querySelector('.mobile-energy');
    const reward = value.closest('.mobile-source-reward');
    const expectedStyle = reward ? getComputedStyle(reward) : amountStyle;
    expect(number.bottom).toBeGreaterThan(unitBounds.top);
    expect(unitBounds.bottom).toBeGreaterThan(number.top);
    expect(unitStyle.fontSize).toBe(expectedStyle.fontSize);
    if (energy) {
      expect(unitStyle.color).toBe(expectedStyle.color);
      expect(unitStyle.fontWeight).toBe(expectedStyle.fontWeight);
    }
    if (value.closest('.mobile-results')) {
      expect(amountStyle.fontSize).toBe(unitStyle.fontSize);
      expect(amountStyle.fontWeight).toBe(unitStyle.fontWeight);
      expect(unitStyle.fontWeight).toBe('400');
    } else {
      expect(amountStyle.fontWeight).toBe(
        value.closest('.overview-ledger, .history-row') ? '400' : '700',
      );
    }
  }
}

for (const width of [320, 600, 800, 1280]) {
  test(`results and account controls fit at ${width}px`, async () => {
    await page.viewport(width, 900);
    await connectedAccount();
    await openApp();

    await expect
      .element(page.getByRole('heading', { name: 'Connected to Octopus', exact: true }))
      .toBeVisible();
    await expect
      .poll(() => page.getBySelector('.history-row, .mobile-session').elements().length)
      .toBe(4);

    await document.fonts.ready;
    fitsViewport();

    const summary = page.getBySelector('.connection-summary');
    const container = box(summary);

    for (const button of summary.getByRole('button').all()) {
      const bounds = box(button);

      expect(bounds.x).toBeGreaterThanOrEqual(decimal(container.x).minus(1).toNumber());
      expect(decimal(bounds.x).plus(bounds.width).toNumber()).toBeLessThanOrEqual(
        decimal(container.x).plus(container.width).plus(1).toNumber(),
      );
      expect(bounds.height).toBeGreaterThanOrEqual(40);
    }

    const number = box(summary.getByText('Account number:', { exact: true }));
    const name = box(summary.getByText('Account holder:', { exact: true }));

    expect(number.y).toBeLessThan(name.y);

    for (const row of page.getBySelector('.history-row').all()) {
      const time = row.getBySelector('.session-time');

      const timeElement = time.element();
      const range = document.createRange();
      range.selectNodeContents(timeElement);
      expect(range.getClientRects().length).toBe(1);
      expect(timeElement.scrollWidth <= timeElement.clientWidth).toBe(true);

      const timeBox = box(time);
      const dateBox = box(row.getBySelector('.session-date'));

      expect(decimal(timeBox.x).plus(timeBox.width).toNumber()).toBeLessThanOrEqual(
        decimal(dateBox.x).plus(dateBox.width).plus(1).toNumber(),
      );

      if (width <= 800) {
        const energies = row.getBySelector('.shifted-energy');
        const estimates = box(energies.nth(0));
        const actual = box(energies.nth(1));

        expect(decimal(estimates.y).minus(actual.y).abs().toNumber()).toBeLessThanOrEqual(1);

        const rewards = row.getBySelector('.mobile-reward');
        const a = box(rewards.nth(0));
        const b = box(rewards.nth(1));

        expect(decimal(a.y).minus(b.y).abs().toNumber()).toBeLessThanOrEqual(1);

        const toggle = box(row.getByRole('button'));

        expect(toggle.width).toBeGreaterThanOrEqual(44);
        expect(toggle.height).toBeGreaterThanOrEqual(44);
      }
    }

    await page
      .getByRole('button', { name: /Readings for/ })
      .first()
      .click();

    await expect.element(page.getBySelector('.session-details')).toBeVisible();

    fitsViewport();
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
    await expect.element(calculation).toBeVisible();

    // Read geometry in one browser evaluation rather than a round-trip for every card.
    const calculationElement = calculation.element();
    const outer = calculationElement.getBoundingClientRect();
    const geometry = {
      outer: { x: outer.x, right: outer.right },
      cards: [...calculationElement.querySelectorAll('.calculation-card')].map((card) => {
        const bounds = card.getBoundingClientRect();
        return { x: bounds.x, right: bounds.right };
      }),
      operators: [...calculationElement.querySelectorAll('.calculation-operator')].map(
        (operator) => {
          const bounds = operator.getBoundingClientRect();
          return {
            width: bounds.width,
            height: bounds.height,
            visibility: getComputedStyle(operator).visibility,
          };
        },
      ),
    };

    expect(geometry.cards).toHaveLength(6);
    expect(geometry.operators).toHaveLength(4);
    expect(
      geometry.cards.every(
        (bounds) =>
          decimal(bounds.x).gte(decimal(geometry.outer.x).minus(1)) &&
          decimal(bounds.right).lte(decimal(geometry.outer.right).plus(1)),
      ),
    ).toBe(true);
    expect(
      geometry.operators.every(
        (bounds) => bounds.width > 0 && bounds.height > 0 && bounds.visibility === 'visible',
      ),
    ).toBe(true);
    fitsViewport();
    await page.getByRole('tab', { name: 'Happy Hours' }).click();

    await expect
      .poll(() => page.getBySelector('.history-row, .mobile-session').elements().length)
      .toBe(1);

    await page.getByRole('button', { name: /Readings for/ }).click();
    await expect.element(page.getByRole('region', { name: 'Calculation summary' })).toBeVisible();
    fitsViewport();
  });
}

test('provisional tooltip opens within the mobile viewport after scrolling', async () => {
  await page.viewport(320, 900);
  await connectedAccount({ homeMini: true });
  await openApp();
  const row = page.getBySelector('.history-row, .mobile-session').first();
  await expect.element(row.getByRole('button', { name: 'Provisional reading' })).toBeVisible();
  await document.fonts.ready;
  fitsViewport();
  await row.getByRole('button', { name: /Readings for/ }).click();
  const provisional = page
    .getBySelector('.session-details')
    .getByRole('button', { name: 'Provisional reading' })
    .first();
  // Scroll before activation: tooltips intentionally dismiss when the page scrolls.
  provisional.element().scrollIntoView({ block: 'center' });
  await expect.element(provisional).toBeInViewport();
  await provisional.click();
  await expect.element(page.getByRole('tooltip')).toBeInViewport();
  fitsViewport();
});

test('appearance switch fits a phone and changes the rendered palette', async () => {
  await page.viewport(320, 852);
  await openApp();
  await document.fonts.ready;

  const dark = page.getByRole('button', { name: 'Switch to dark mode' });
  expect(box(dark).width).toBe(44);
  expect(box(dark).height).toBeGreaterThanOrEqual(44);
  expect(getComputedStyle(dark.getBySelector('span').element()).display).toBe('none');

  await dark.click();
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');
  const darkBackground = getComputedStyle(document.body).backgroundColor;

  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(getComputedStyle(document.documentElement).colorScheme).toBe('light');
  expect(getComputedStyle(document.body).backgroundColor).not.toBe(darkBackground);
  expect(document.documentElement.scrollWidth <= innerWidth).toBe(true);

  await page.viewport(1280, 852);
  const desktop = page.getByRole('button', { name: 'Switch to dark mode' });
  expect(getComputedStyle(desktop.getBySelector('span').element()).display).not.toBe('none');
});

test('history header and first row keep the regular height while icons stay circular', async () => {
  await page.viewport(1280, 900);
  await openApp();
  await page.getByRole('button', { name: 'Try demo' }).click();
  await document.fonts.ready;

  const date = page.getByRole('columnheader', { name: 'Date' }).element();
  const result = page
    .getByRole('columnheader', { name: 'Calculated result' })
    .getByRole('button')
    .element();
  const dateText = document.createRange();
  const resultText = document.createRange();
  dateText.selectNodeContents(date);
  resultText.selectNodeContents(result);
  expect(
    decimal(dateText.getBoundingClientRect().top)
      .minus(resultText.getBoundingClientRect().top)
      .abs()
      .toNumber(),
  ).toBeLessThanOrEqual(1);

  for (const width of [1280, 1024, 820, 320]) {
    await page.viewport(width, 900);
    if (width === 320) {
      await expect.element(page.getBySelector('.mobile-results')).toBeVisible();
    } else {
      await expect.element(page.getBySelector('.history-table')).toBeVisible();
      if (width < 1200) {
        await expect.element(page.getBySelector('.history-table .reward-column')).toHaveLength(0);
      }
    }
    if (width >= 800) {
      const header = box(page.getBySelector('.history-table thead tr'));
      const first = box(page.getBySelector('.history-row').first());
      const next = box(page.getBySelector('.history-row').nth(1));
      expect(decimal(first.height).minus(next.height).abs().toNumber()).toBeLessThanOrEqual(1);
      if (width === 1280) {
        expect(decimal(header.height).minus(next.height).abs().toNumber()).toBeLessThanOrEqual(1);
      }
    }
    const icon = page.getByRole('button', { name: 'Session has not ended yet' }).first();
    icon.element().scrollIntoView({ block: 'center' });
    const bounds = box(icon);
    expect(bounds.width).toBe(44);
    expect(bounds.height).toBe(44);
    const circle = getComputedStyle(icon.element(), '::before');
    expect(circle.width).toBe('28px');
    expect(circle.height).toBe('28px');
    expect(circle.borderRadius).toBe('50%');
    if (width >= 800) {
      const dateCell = icon.element().closest('.session-date');
      const sessionTime = dateCell?.querySelector('.session-time');
      const dateText = dateCell?.querySelector('time')?.firstChild;
      if (!sessionTime || !dateText) throw new Error('Upcoming session date is missing');
      const timeRange = document.createRange();
      timeRange.selectNodeContents(sessionTime);
      const dateRange = document.createRange();
      dateRange.selectNodeContents(dateText);
      expect(
        decimal(timeRange.getBoundingClientRect().right).plus(3).toNumber(),
      ).toBeLessThanOrEqual(bounds.left);
      expect(
        decimal(dateRange.getBoundingClientRect().right).plus(3).toNumber(),
      ).toBeLessThanOrEqual(bounds.left);
      icon.element().focus();
      expect(document.activeElement).toBe(icon.element());
    }
    await icon.hover();
    const hovered = box(icon);
    expect(decimal(hovered.x).minus(bounds.x).abs().toNumber()).toBeLessThanOrEqual(1);
    expect(decimal(hovered.y).minus(bounds.y).abs().toNumber()).toBeLessThanOrEqual(1);
    fitsViewport();
  }
});

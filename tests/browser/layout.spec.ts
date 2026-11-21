import { decimal } from '../../src/domain/decimal';
import { Temporal } from '../../src/domain/time';
import { expect, test, vi } from 'vitest';
import { userEvent, type Locator } from 'vitest/browser';
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
    if (value.getClientRects().length === 0) continue;
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
        value.closest('.overview-ledger, .history-row, .points-comparison') ? '400' : '700',
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

    const incompleteCalculation = page.getByRole('region', { name: 'Calculation summary' });
    await expect.element(incompleteCalculation.getByText('Awaiting readings')).toHaveLength(2);
    for (const equation of incompleteCalculation.getBySelector('.calculation-values').all()) {
      const values = equation.getBySelector('.calculation-value dd').elements();
      const first = values[0].getBoundingClientRect();
      for (const value of values) {
        expect(
          decimal(value.getBoundingClientRect().top).minus(first.top).abs().toNumber(),
        ).toBeLessThanOrEqual(1);
      }
      const contribution = box(equation.getBySelector('.calculation-contribution dd'));
      if (width > 600) {
        expect(decimal(contribution.top).minus(first.top).abs().toNumber()).toBeLessThanOrEqual(1);
      }
      expect(box(equation.getByText('Awaiting readings')).top).toBeGreaterThanOrEqual(
        contribution.bottom,
      );
    }
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
      values: [
        ...calculationElement.querySelectorAll('.calculation-value, .calculation-contribution'),
      ].map((value) => {
        const bounds = value.getBoundingClientRect();
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

    expect(geometry.values).toHaveLength(8);
    expect(geometry.operators).toHaveLength(4);
    expect(
      geometry.values.every(
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
    for (const halfHour of calculation.getBySelector('.half-hour-calculation').all()) {
      expect(box(halfHour).height).toBeLessThanOrEqual(width > 1000 ? 100 : 150);
      const values = halfHour.getBySelector('.calculation-value dd').elements();
      const first = values[0].getBoundingClientRect();
      for (const value of values) {
        const bounds = value.getBoundingClientRect();
        expect(decimal(bounds.top).minus(first.top).abs().toNumber()).toBeLessThanOrEqual(1);
        expect(getComputedStyle(value).fontSize).toBe('14px');
        expect(getComputedStyle(value).fontWeight).toBe('400');
      }
      const contribution = box(halfHour.getBySelector('.calculation-contribution'));
      if (width <= 600) expect(contribution.top).toBeGreaterThanOrEqual(first.bottom);
    }
    const explanation = calculation.getByText('How this is calculated');
    explanation.element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(calculation.getBySelector('.reading-disclosure-body')).toBeVisible();
    expect(box(explanation).height).toBeGreaterThanOrEqual(44);
    fitsViewport();
    if (width === 1280) {
      await page.getByRole('tab', { name: 'Octopoints', exact: true }).click();
      const steps = page.getByRole('table', { name: 'Octopoints calculation steps' });
      await expect.element(steps).toBeVisible();
      const calculationHeading = box(steps.getByRole('columnheader', { name: 'Calculation' }));
      const resultHeading = box(steps.getByRole('columnheader', { name: 'Result' }));
      for (const row of steps.getBySelector('tbody tr').all()) {
        const cells = row.getByRole('cell').all();
        expect(box(cells[0]).left).toBe(calculationHeading.left);
        expect(box(cells[1]).right).toBe(resultHeading.right);
        expect(getComputedStyle(cells[1].element()).textAlign).toBe('right');
      }
      fitsViewport();
    }
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

test('overview clocks preserve metric row heights and touch targets', async () => {
  await page.viewport(393, 900);
  await connectedAccount({ homeMini: true });
  await openApp();
  const overview = page.getByRole('region', { name: 'Session overview' });
  const calculated = overview.getByRole('group', { name: 'Calculated' });
  const octopus = overview.getByRole('group', { name: 'Octopus' });
  const clocks = calculated.getByRole('button', { name: 'Provisional reading' });
  await expect.element(clocks).toHaveLength(3);
  await document.fonts.ready;

  for (const width of [393, 1280]) {
    await page.viewport(width, 900);
    const calculatedRows = calculated.getBySelector('.overview-ledger-row').all();
    const octopusRows = octopus.getBySelector('.overview-ledger-row').all();
    expect(calculatedRows.map((row) => box(row).height)).toEqual(
      octopusRows.map((row) => box(row).height),
    );
    for (const clock of clocks.all()) {
      const bounds = box(clock);
      expect(bounds.width).toBe(44);
      expect(bounds.height).toBe(44);
    }
  }
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
  const instant = Temporal.Instant.from('2026-11-05T12:00:00Z');
  vi.spyOn(Temporal.Now, 'instant').mockReturnValue(instant);
  vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(
    instant.toZonedDateTimeISO('Europe/London').toPlainDate(),
  );
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
    const topBeforeHover = decimal(box(icon).top).plus(window.scrollY);
    await icon.hover();
    const hovered = box(icon);
    const topAfterHover = decimal(hovered.top).plus(window.scrollY);
    expect(decimal(hovered.x).minus(bounds.x).abs().toNumber()).toBeLessThanOrEqual(1);
    expect(topAfterHover.minus(topBeforeHover).abs().toNumber()).toBeLessThanOrEqual(1);
    fitsViewport();
  }
});

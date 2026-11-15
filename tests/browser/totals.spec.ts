import { expect, test } from 'vitest';
import { page, openApp } from './fixtures';

for (const width of [320, 393, 768, 1280]) {
  test(`overview follows the selected layout and session type at ${width}px`, async () => {
    await page.viewport(width, 852);
    await openApp();
    await page.getByRole('button', { name: 'Try demo', exact: true }).click();
    await document.fonts.ready;
    const overview = page.getByRole('region', { name: 'Session overview' });
    await expect.element(overview).toBeVisible();
    await expect.element(page.getByRole('region', { name: 'Session summary' })).toHaveLength(0);
    const overviewElement = overview.element();
    expect(overviewElement.parentElement?.firstElementChild).toBe(overviewElement);
    expect(getComputedStyle(overviewElement).position).toBe('static');
    const calculated = overview.getByRole('group', { name: 'Calculated' });
    const octopus = overview.getByRole('group', { name: 'Octopus' });
    const calculatedBox = calculated.element().getBoundingClientRect();
    const octopusBox = octopus.element().getBoundingClientRect();
    if (width <= 600) {
      expect(octopusBox.top).toBeGreaterThan(calculatedBox.bottom);
    } else {
      expect(octopusBox.left).toBeGreaterThan(calculatedBox.right);
    }
    expect(
      getComputedStyle(overview.getBySelector('.overview-footer').element()).borderTopWidth,
    ).toBe('1px');
    const heading = overview.getByRole('heading', { name: 'At a glance' }).element();
    const count = overview.getBySelector('.overview-heading > span').element();
    expect(count.getBoundingClientRect().top).toBeLessThan(heading.getBoundingClientRect().bottom);
    await expect.element(overview).not.toHaveTextContent('results included');
    for (const value of overview.getBySelector('.overview-ledger-row strong').elements()) {
      expect(getComputedStyle(value).fontWeight).toBe('400');
      expect(getComputedStyle(value).fontSize).toBe('14px');
    }
    for (const value of page
      .getBySelector('.history-row .outcome-label, .mobile-source .outcome-label')
      .elements()) {
      expect(getComputedStyle(value).fontWeight).toBe('400');
      expect(getComputedStyle(value).fontSize).toBe('14px');
    }
    expect(getComputedStyle(octopus.element()).backgroundColor).toBe(
      getComputedStyle(calculated.element()).backgroundColor,
    );
    if (width <= 600) {
      await expect.element(overview.getBySelector('.reward-unit-full').first()).toBeVisible();
    }
    for (const amount of overview.getBySelector('.octopoints-value').elements()) {
      expect(getComputedStyle(amount).whiteSpace).toBe('nowrap');
      const unit = amount.querySelector('.points-unit');
      expect(unit).not.toBeNull();
      if (unit) {
        expect(getComputedStyle(unit).display).toBe('inline');
        expect(getComputedStyle(unit).fontSize).toBe('14px');
      }
    }
    await page
      .getByRole('button', { name: /Readings for/ })
      .first()
      .click();
    await expect.element(page.getBySelector('.session-details')).toBeVisible();
    await page.viewport(1280, 852);
    await expect
      .element(page.getByRole('button', { name: /Readings for/ }).first())
      .toHaveAttribute('aria-expanded', 'true');
    await page.viewport(width, 852);
    await expect
      .element(page.getByRole('button', { name: /Readings for/ }).first())
      .toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('tab', { name: 'Power up', exact: true }).click();
    await expect.element(overview.getBySelector('.octopoints-value')).toHaveLength(1);
    await expect.element(overview.getByRole('button', { name: 'Not estimated' })).toBeVisible();
    await page.getByRole('tab', { name: 'Happy Hours', exact: true }).click();
    await expect.element(overview.getBySelector('.octopoints-value')).toHaveLength(0);
    await expect.element(octopus.getByText('Bill credit')).toBeVisible();
    await expect.element(octopus.getByText('Achieved or partly achieved')).toHaveLength(0);
    if (width === 320 || width === 393) {
      await expect.element(page.getBySelector('.mobile-energy-main')).not.toHaveLength(0);
    }
    for (const energy of page.getBySelector('.mobile-energy-main').elements()) {
      expect(getComputedStyle(energy).fontSize).toBe('14px');
    }
    expect(document.documentElement.scrollWidth <= innerWidth).toBe(true);
  });
}

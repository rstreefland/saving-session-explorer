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
    const comparison = overview.getByRole('table', { name: 'Session overview comparison' });
    const comparisonStyle = getComputedStyle(comparison.element());
    expect(comparisonStyle.borderTopWidth).toBe('1px');
    expect(comparisonStyle.borderBottomWidth).toBe('1px');
    expect(
      getComputedStyle(overview.getBySelector('.overview-footer').element()).borderTopWidth,
    ).toBe('0px');
    const heading = overview.getByRole('heading', { name: 'At a glance' }).element();
    const count = overview.getBySelector('.overview-heading > span').element();
    expect(heading.getBoundingClientRect().top).toBe(count.getBoundingClientRect().top);
    await expect.element(overview).not.toHaveTextContent('results included');
    for (const value of overview.getBySelector('tbody strong').elements()) {
      expect(getComputedStyle(value).fontWeight).toBe('400');
      expect(getComputedStyle(value).fontSize).toBe('16px');
    }
    for (const value of page
      .getBySelector('.history-row .outcome-label, .mobile-source .outcome-label')
      .elements()) {
      expect(getComputedStyle(value).fontWeight).toBe('400');
      expect(getComputedStyle(value).fontSize).toBe('16px');
    }
    expect(
      getComputedStyle(overview.getByRole('columnheader', { name: 'Octopus' }).element())
        .fontWeight,
    ).toBe('700');
    for (const amount of overview.getBySelector('.octopoints-value').elements()) {
      expect(getComputedStyle(amount).whiteSpace).toBe('nowrap');
      const unit = amount.querySelector('.points-unit');
      expect(unit).not.toBeNull();
      if (unit) {
        expect(getComputedStyle(unit).display).toBe('inline');
        expect(getComputedStyle(unit).fontSize).toBe('16px');
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
    await expect.element(overview.getByRole('rowheader', { name: 'Bill credit' })).toBeVisible();
    await expect
      .element(overview.getByRole('rowheader', { name: 'Achieved or partly achieved' }))
      .toHaveLength(0);
    if (width === 320 || width === 393) {
      await expect.element(page.getBySelector('.mobile-energy-main')).not.toHaveLength(0);
    }
    for (const energy of page.getBySelector('.mobile-energy-main').elements()) {
      expect(getComputedStyle(energy).fontSize).toBe('16px');
    }
    expect(document.documentElement.scrollWidth <= innerWidth).toBe(true);
  });
}

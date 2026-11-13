import { expect, test } from 'vitest';
import { page, openApp } from './fixtures';

test('mobile tabs fit and expanded readings survive resizing to desktop', async () => {
  await page.viewport(320, 852);
  await openApp();
  await page.getByRole('button', { name: 'Try demo' }).click();
  await expect.element(page.getBySelector('.mobile-session')).not.toHaveLength(0);
  await document.fonts.ready;
  const fits = () => document.documentElement.scrollWidth <= innerWidth;
  expect(fits()).toBe(true);
  for (const name of ['Power down', 'Power up', 'Happy Hours']) {
    await page.getByRole('tab', { name, exact: true }).click();
    const button = page.getBySelector('.mobile-details-toggle').first();
    await expect.element(button).toHaveAttribute('aria-expanded', 'false');
    const box = button.element().getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await button.click();
    await expect.element(page.getBySelector('.session-details')).toBeVisible();
    expect(fits()).toBe(true);
    await button.click();
    await expect.element(page.getBySelector('.session-details')).toHaveLength(0);
  }
  await page
    .getByRole('button', { name: /Readings for/ })
    .first()
    .click();
  // Larger screens retain the table.
  await page.viewport(1280, 900);
  await expect.element(page.getBySelector('.history-table')).toBeVisible();
  await expect.element(page.getBySelector('.mobile-results')).toHaveLength(0);
  await expect.element(page.getBySelector('.session-details')).toBeVisible();
  await expect
    .element(page.getByRole('button', { name: /Readings for/ }).first())
    .toHaveAttribute('aria-expanded', 'true');
});

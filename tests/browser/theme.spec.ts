import { cleanup } from '@testing-library/react';
import axe from 'axe-core';
import { expect, test } from 'vitest';
import { page, openApp } from './fixtures';

test('uses the system color scheme when no preference is saved', async () => {
  await openApp();
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(getComputedStyle(document.documentElement).backgroundColor).toBe(
    dark ? 'rgb(23, 23, 25)' : 'rgb(216, 212, 223)',
  );
});

test('the top bar theme control styles mobile and desktop and restores the saved choice', async () => {
  localStorage.setItem('session-lens.theme', 'light');
  await page.viewport(320, 900);
  await openApp();

  expect(getComputedStyle(document.documentElement).colorScheme).toBe('light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  expect(localStorage.getItem('session-lens.theme')).toBe('dark');
  expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');
  expect(getComputedStyle(page.getBySelector('.app-shell').element()).backgroundColor).toBe(
    'rgb(36, 35, 39)',
  );
  expect(document.documentElement.scrollWidth <= window.innerWidth).toBe(true);

  await page.viewport(1280, 900);
  await page.getByRole('button', { name: 'Try demo' }).click();
  expect(
    getComputedStyle(page.getBySelector('.history-table thead').element()).backgroundColor,
  ).toBe('rgb(55, 50, 57)');

  cleanup();
  await openApp();
  expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  expect(localStorage.getItem('session-lens.theme')).toBe('light');
  expect(getComputedStyle(page.getBySelector('.app-shell').element()).backgroundColor).toBe(
    'rgb(247, 246, 245)',
  );
});

test('dark mode keeps text contrast in the demo and expanded readings', async () => {
  localStorage.setItem('session-lens.theme', 'dark');
  await page.viewport(1280, 900);
  await openApp();
  await page.getByRole('button', { name: 'Try demo' }).click();
  await page
    .getByRole('button', { name: /Readings for/ })
    .first()
    .click();

  for (const width of [1280, 320]) {
    await page.viewport(width, 900);
    const result = await axe.run(document.body, { runOnly: ['color-contrast'] });
    expect(
      result.violations.flatMap((violation) =>
        violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
      ),
    ).toEqual([]);
  }
});

import { cleanup } from '@testing-library/react';
import { expect, test } from 'vitest';
import { page, openApp } from './fixtures';

test('uses the system color scheme when no preference is saved', async () => {
  await openApp();
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(getComputedStyle(document.documentElement).backgroundColor).toBe(
    dark ? 'rgb(24, 21, 29)' : 'rgb(245, 242, 246)',
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
    'rgb(37, 30, 43)',
  );
  expect(document.documentElement.scrollWidth <= window.innerWidth).toBe(true);

  await page.viewport(1280, 900);
  await page.getByRole('button', { name: 'Try demo' }).click();
  expect(
    getComputedStyle(page.getBySelector('.history-table thead').element()).backgroundColor,
  ).toBe('rgb(44, 37, 50)');

  cleanup();
  await openApp();
  expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  expect(localStorage.getItem('session-lens.theme')).toBe('light');
  expect(getComputedStyle(page.getBySelector('.app-shell').element()).backgroundColor).toBe(
    'rgb(255, 253, 253)',
  );
});

test('selected date range keeps its readable colors on hover in dark mode', async () => {
  localStorage.setItem('session-lens.theme', 'dark');
  await page.viewport(1280, 900);
  await openApp();

  const selected = page.getByRole('button', { name: 'Last 30 days' });
  await expect
    .poll(() => getComputedStyle(selected.element()).backgroundColor)
    .toBe(getComputedStyle(page.getBySelector('.app-shell').element()).backgroundColor);
  const background = getComputedStyle(selected.element()).backgroundColor;
  const color = getComputedStyle(selected.element()).color;

  await selected.hover();

  expect(getComputedStyle(selected.element()).backgroundColor).toBe(background);
  expect(getComputedStyle(selected.element()).color).toBe(color);
});

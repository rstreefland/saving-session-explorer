import { cleanup } from '@testing-library/react';
import { expect, test } from 'vitest';
import { page, openApp } from './fixtures';

test('uses the system color scheme when no preference is saved', async () => {
  await openApp();
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(getComputedStyle(document.documentElement).backgroundColor).toBe(
    dark ? 'rgb(23, 19, 30)' : 'rgb(216, 212, 223)',
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
    'rgb(36, 29, 44)',
  );
  expect(document.documentElement.scrollWidth <= window.innerWidth).toBe(true);

  await page.viewport(1280, 900);
  await page.getByRole('button', { name: 'Try demo' }).click();
  expect(
    getComputedStyle(page.getBySelector('.history-table thead').element()).backgroundColor,
  ).toBe('rgb(53, 42, 62)');

  cleanup();
  await openApp();
  expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  expect(localStorage.getItem('session-lens.theme')).toBe('light');
  expect(getComputedStyle(page.getBySelector('.app-shell').element()).backgroundColor).toBe(
    'rgb(247, 246, 245)',
  );
});

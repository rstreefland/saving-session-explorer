import { createElement, StrictMode } from 'react';
import { render } from '@testing-library/react';
import { page, commands, locators } from 'vitest/browser';
import type { Locator } from 'vitest/browser';
import { vi } from 'vitest';
import App from '../../src/App';
import { Temporal } from '../../src/domain/time';

locators.extend({
  getBySelector(selector: string) {
    return selector;
  },
});

declare module 'vitest/browser' {
  interface LocatorSelectors {
    getBySelector(selector: string): Locator;
  }
}

export async function openApp() {
  render(createElement(StrictMode, null, createElement(App)));
  await document.fonts.ready;
}

export async function connectedAccount({ homeMini = false } = {}) {
  const instant = Temporal.Instant.from('2026-11-05T12:00:00Z');
  vi.spyOn(Temporal.Now, 'instant').mockReturnValue(instant);
  vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(
    instant.toZonedDateTimeISO('Europe/London').toPlainDate(),
  );
  localStorage.setItem('session-lens.api-key', 'synthetic-test-key');
  localStorage.setItem('session-lens.account-number', 'A-TEST');
  await commands.accountRoutes({ homeMini });
}

export { page };

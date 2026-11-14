import { expect, test } from 'vitest';
import { page, connectedAccount, openApp } from './fixtures';

test('Happy Hours token badge fits its tab on mobile and desktop', async () => {
  await page.viewport(320, 852);
  await connectedAccount();
  await openApp();
  const tab = page.getByRole('tab', { name: 'Happy Hours', exact: true });
  const badge = tab.getBySelector('.happy-hour-tokens');
  await expect.element(badge).toHaveTextContent('3 tokens');
  for (const width of [320, 1280]) {
    await page.viewport(width, 852);
    await document.fonts.ready;
    const badgeBounds = badge.element().getBoundingClientRect();
    const tabBounds = tab.element().getBoundingClientRect();
    expect(badgeBounds.left).toBeGreaterThanOrEqual(tabBounds.left);
    expect(badgeBounds.right).toBeLessThanOrEqual(tabBounds.right);
    expect(badgeBounds.top).toBeGreaterThanOrEqual(tabBounds.top);
    expect(badgeBounds.bottom).toBeLessThanOrEqual(tabBounds.bottom);
    expect(document.documentElement.scrollWidth <= innerWidth).toBe(true);
    await tab.click();
    await expect.element(tab).toHaveAttribute('aria-selected', 'true');
  }
});

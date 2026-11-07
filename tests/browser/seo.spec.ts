import { expect, test } from '@playwright/test';

const site = 'https://saving-session-explorer.streefland.co.uk';

test('publishes crawlable public content and metadata without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 900 },
  });
  try {
    const page = await context.newPage();
    const response = await page.goto(new URL('/', baseURL).href);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle('Octopus Saving Session Explorer');
    await expect(
      page.getByRole('heading', { name: 'Saving Session Explorer', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/This tool uses your smart meter data/)).toBeVisible();
    await expect(
      page.getByText('JavaScript is required to try the demo or connect your Octopus account.'),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${site}/`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Estimate your Octopus Saving Session results/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${site}/`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${site}/social-card.png`,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      `${site}/social-card.png`,
    );
    expect((await page.request.get(new URL('/favicon.svg', baseURL).href)).status()).toBe(200);
    const image = await page.request.get(new URL('/social-card.png', baseURL).href);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    const bytes = await image.body();
    expect(bytes.readUInt32BE(0)).toBe(0x89504e47);
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
    const robots = await page.request.get(new URL('/robots.txt', baseURL).href);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain(`Sitemap: ${site}/sitemap.xml`);
    const sitemap = await page.request.get(new URL('/sitemap.xml', baseURL).href);
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain(`<loc>${site}/</loc>`);
  } finally {
    await context.close();
  }
});

test('replaces the public fallback with a single working interactive introduction', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try demo', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Saving Session Explorer', exact: true }),
  ).toHaveCount(1);
  await expect(page.locator('#public-intro-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try demo', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(5);
});

import { expect, test } from 'vitest';
import { commands } from 'vitest/browser';

const site = 'https://saving-session-explorer.streefland.co.uk';

test('publishes crawlable public content and metadata without JavaScript', async () => {
  const result = await commands.productionPage({ mode: 'static' });
  if (result.metadata === undefined) throw new Error('Expected static production results');
  expect(result.status).toBe(200);
  expect(result.title).toBe('Octopus Saving Session Explorer');
  expect(result.heading).toBe(true);
  expect(result.introduction).toBe(true);
  expect(result.notice).toBe(true);
  const head = new DOMParser().parseFromString(result.metadata, 'text/html');
  expect(head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${site}/`);
  expect(head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(
    /Estimate your Octopus Saving Session results/,
  );
  expect(head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
  expect(head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(`${site}/`);
  expect(head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
    `${site}/social-card.png`,
  );
  expect(head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
    'summary_large_image',
  );
  expect(head.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
    `${site}/social-card.png`,
  );
  expect(result.faviconStatus).toBe(200);
  expect(result.image).toEqual({
    status: 200,
    contentType: 'image/png',
    signature: 0x89504e47,
    dimensions: [1200, 630],
  });
  expect(result.robots?.status).toBe(200);
  expect(result.robots?.text).toContain(`Sitemap: ${site}/sitemap.xml`);
  expect(result.sitemap?.status).toBe(200);
  expect(result.sitemap?.text).toContain(`<loc>${site}/</loc>`);
  expect(result.unexpectedRequests).toEqual([]);
});

test('production CSP blocks injected scripts and unapproved requests while tooltips work', async () => {
  const result = await commands.productionPage({ mode: 'security' });
  if (!('violations' in result)) throw new Error('Expected interactive production results');
  expect(result.tooltip).toBe(true);
  expect(result.initialViolations).toEqual([]);
  expect(result.injectedScriptRan).toBeUndefined();
  expect(result.violations).toEqual(['script-src-elem', 'connect-src']);
  expect(result.unexpectedRequests).toEqual([]);
});

test('replaces the public fallback with a single working interactive introduction', async () => {
  const result = await commands.productionPage({ mode: 'introduction' });
  expect(result.headingCount).toBe(1);
  expect(result.noticeCount).toBe(0);
  expect(result.historyCount).toBe(5);
  expect(result.unexpectedRequests).toEqual([]);
});

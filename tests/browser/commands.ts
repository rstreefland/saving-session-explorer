import type { BrowserCommandContext } from 'vitest/node';
import { milliseconds } from '../../src/domain/time';
import { connectedAccount } from './accountRoutes';

interface AccountOptions {
  homeMini: boolean;
}

export async function resetRoutes({ page }: BrowserCommandContext) {
  await page.unrouteAll({ behavior: 'wait' });
  await page.route(/^https?:\/\//, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    throw new Error('Unexpected external browser request');
  });
}

export async function accountRoutes({ page }: BrowserCommandContext, options: AccountOptions) {
  await connectedAccount({
    page,
    homeMini: options.homeMini,
  });
}

export async function productionPage(
  { context, project }: BrowserCommandContext,
  options: { mode: 'static' | 'security' | 'introduction' },
) {
  const productionURL = project.getProvidedContext().productionURL;
  const browser = context.browser();
  if (!browser) throw new Error('Production checks require a connected browser');
  const productionContext = await browser.newContext({
    javaScriptEnabled: options.mode !== 'static',
    viewport: { width: 1280, height: 1400 },
  });
  const page = await productionContext.newPage();
  const unexpectedRequests: string[] = [];
  await page.route(/^https?:\/\//, (route) => {
    if (new URL(route.request().url()).origin === productionURL) return route.continue();
    unexpectedRequests.push('Unexpected external production request');
    return route.abort();
  });
  try {
    if (options.mode === 'security') {
      const clock = '2026-11-05T12:00:00Z';
      await page.clock.setFixedTime(milliseconds(clock));
      await page.addInitScript((clock) => {
        // The ponyfill uses native Temporal when available, whose clock is independent of Date.
        const native = globalThis.Temporal;

        if (native) {
          const instant = native.Instant.from(clock);
          native.Now.instant = () => instant;
          native.Now.plainDateISO = (zone) =>
            instant.toZonedDateTimeISO(zone ?? native.Now.timeZoneId()).toPlainDate();
        }

        localStorage.setItem('session-lens.api-key', 'synthetic-test-key');
        localStorage.setItem('session-lens.account-number', 'A-TEST');
        window.cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.cspViolations.push(event.violatedDirective);
        });
      }, clock);

      await connectedAccount({ page });
    }
    const response = await page.goto(productionURL);
    if (options.mode === 'introduction') {
      const demo = page.getByRole('button', { name: 'Try demo', exact: true });
      await demo.waitFor();
      const headingCount = await page
        .getByRole('heading', {
          name: 'Saving Session Explorer',
          exact: true,
        })
        .count();
      const noticeCount = await page.locator('#public-intro-notice').count();
      await demo.click();
      await page.locator('.history-row').first().waitFor();
      return {
        headingCount,
        noticeCount,
        historyCount: await page.locator('.history-row').count(),
        unexpectedRequests,
      };
    }

    if (options.mode === 'security') {
      await page.locator('.history-row').first().waitFor();
      await page.getByRole('button', { name: 'Calculated result', exact: true }).click();
      await page.getByRole('tooltip').waitFor();
      const tooltip = await page.getByRole('tooltip').isVisible();
      const initialViolations = await page.evaluate(() => window.cspViolations);
      await page.evaluate(async () => {
        const script = document.createElement('script');
        script.textContent = 'window.injectedScriptRan = true';
        document.body.appendChild(script);
        try {
          await fetch('https://unapproved.invalid/');
        } catch {}
      });
      await page.waitForFunction(() => window.cspViolations.length === 2);
      return {
        tooltip,
        initialViolations,
        injectedScriptRan: await page.evaluate(() => window.injectedScriptRan),
        violations: await page.evaluate(() => window.cspViolations),
        unexpectedRequests,
      };
    }
    const metadata = await page.locator('head').innerHTML();
    const favicon = await page.request.get(new URL('/favicon.svg', productionURL).href);
    const image = await page.request.get(new URL('/social-card.png', productionURL).href);
    const bytes = await image.body();
    const robots = await page.request.get(new URL('/robots.txt', productionURL).href);
    const sitemap = await page.request.get(new URL('/sitemap.xml', productionURL).href);
    return {
      status: response?.status(),
      title: await page.title(),
      heading: await page
        .getByRole('heading', { name: 'Saving Session Explorer', exact: true })
        .isVisible(),
      introduction: await page.getByText(/This tool uses your smart meter data/).isVisible(),
      notice: await page
        .getByText('JavaScript is required to try the demo or connect your Octopus account.')
        .isVisible(),
      metadata,
      faviconStatus: favicon.status(),
      image: {
        status: image.status(),
        contentType: image.headers()['content-type'],
        signature: bytes.readUInt32BE(0),
        dimensions: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
      },
      robots: { status: robots.status(), text: await robots.text() },
      sitemap: { status: sitemap.status(), text: await sitemap.text() },
      unexpectedRequests,
    };
  } finally {
    await productionContext.close();
  }
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    resetRoutes: () => Promise<void>;
    accountRoutes: (options: AccountOptions) => Promise<void>;
    productionPage: (options: {
      mode: 'static' | 'security' | 'introduction';
    }) => ReturnType<typeof productionPage>;
  }
}

declare module 'vitest' {
  interface ProvidedContext {
    productionURL: string;
  }
}

declare global {
  var Temporal: typeof import('temporal-polyfill').Temporal;
  interface Window {
    cspViolations: string[];
    injectedScriptRan?: boolean;
  }
}

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { accountRoutes, productionPage, resetRoutes } from './tests/browser/commands';

export const browserConfig = defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/browser/**/*.spec.ts'],
    setupFiles: ['./tests/browser/setup.ts'],
    globalSetup: ['./tests/browser/globalSetup.ts'],
    maxWorkers: 2,
    fileParallelism: false,
    testTimeout: 45_000,
    // Temporal and the synthetic meter history are slower on shared WebKit runners.
    expect: { poll: { timeout: 15_000 } },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
      // Keep recordings disabled: these tests must use anonymous fixtures only.
      screenshotFailures: false,
      trace: 'off',
      commands: { accountRoutes, productionPage, resetRoutes },
    },
  },
});

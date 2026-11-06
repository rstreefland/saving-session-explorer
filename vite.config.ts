import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicIntro } from './src/components/PublicIntro';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'public-introduction',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const intro = renderToStaticMarkup(
            createElement(
              'main',
              { className: 'app-shell' },
              createElement(PublicIntro),
              createElement(
                'p',
                { id: 'public-intro-notice', className: 'fine-print' },
                'JavaScript is required to try the demo or connect your Octopus account.',
              ),
            ),
          );
          return html.replace('<!-- public-introduction -->', intro);
        },
      },
    },
    {
      name: 'production-security-policy',
      apply: 'build',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: [
                "default-src 'none'",
                "script-src 'self'",
                "style-src 'self'",
                // Tooltips position themselves using style attributes; scripts stay self-only.
                "style-src-attr 'unsafe-inline'",
                "font-src 'self'",
                "img-src 'self'",
                "connect-src 'self' https://api.oegb-kraken.energy https://api.backend.octopus.energy https://www.gov.uk",
                "base-uri 'none'",
                "form-action 'none'",
                "object-src 'none'",
              ].join('; '),
            },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],
  server: { allowedHosts: ['.trycloudflare.com'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          temporal: ['temporal-polyfill'],
          react: ['react', 'react-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    maxWorkers: 2,
    // Coverage instrumentation and Temporal are slower on shared CI hosts.
    testTimeout: 20_000,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'istanbul',
      include: [
        'src/**/*.tsx',
        'src/components/**/*.ts',
        'src/api/*.ts',
        'src/domain/*.ts',
        'src/hooks/*.ts',
      ],
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/domain/demo.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      reporter: ['text', 'html'],
      thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 },
    },
  },
});

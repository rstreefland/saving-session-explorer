import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { commands } from 'vitest/browser';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '../../src/style.css';
import '../../src/styles/sessionHistory.css';
import '../../src/styles/connection.css';

beforeEach(async () => {
  localStorage.clear();
  await commands.resetRoutes();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

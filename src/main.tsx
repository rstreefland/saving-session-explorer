import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyThemePreference, readThemePreference } from './theme';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import './styles/theme.css';
import './style.css';
import './styles/sessionHistory.css';
import './styles/connection.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');

const preference = readThemePreference();
applyThemePreference(
  preference,
  preference
    ? preference === 'dark'
    : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

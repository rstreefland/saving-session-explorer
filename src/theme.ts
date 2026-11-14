import { z } from 'zod';

const STORAGE_KEY = 'session-lens.theme';
const themePreference = z.enum(['light', 'dark']);

export type ThemePreference = z.infer<typeof themePreference>;

export function readThemePreference(): ThemePreference | null {
  try {
    const stored = themePreference.safeParse(localStorage.getItem(STORAGE_KEY));
    return stored.success ? stored.data : null;
  } catch {
    return null;
  }
}

export function applyThemePreference(preference: ThemePreference | null) {
  if (preference) document.documentElement.dataset.theme = preference;
  else delete document.documentElement.dataset.theme;
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The selected theme still applies for this visit when browser storage is unavailable.
  }
}

import type { BaselineIssue, Dataset } from './types';

export const BASELINE_ISSUES: Record<BaselineIssue, string> = {
  holidays:
    'Bank holidays could not be verified. Power down and Power up estimates are unavailable; Happy Hours use import readings only.',
  exports:
    'Linked export readings could not be loaded. Power down and Power up estimates are unavailable; Happy Hours use import readings only.',
  'event-history':
    'Octopus returned an incomplete event calendar; baseline exclusions cannot be verified.',
};

export function dataWarnings(data: Dataset): string[] {
  return [...data.baselineIssues.map((issue) => BASELINE_ISSUES[issue]), ...data.warnings];
}

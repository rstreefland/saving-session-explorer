import { expect, it } from 'vitest';
import { last30Days, validRange } from './dateRange';
import { Temporal, day, referenceTime, clockTime } from './time';
it('selects rolling ranges including today', () => {
  const today = Temporal.PlainDate.from('2026-11-05');
  expect(last30Days(today)).toEqual({ from: '2026-10-07', to: '2026-11-05' });
});
it('handles month boundaries and leap years as calendar days', () => {
  expect(last30Days(Temporal.PlainDate.from('2026-01-03'))).toEqual({
    from: '2025-12-05',
    to: '2026-01-03',
  });
  expect(last30Days(Temporal.PlainDate.from('2024-03-01'))).toEqual({
    from: '2024-02-01',
    to: '2024-03-01',
  });
});
it('validates custom dates without time-zone or millisecond arithmetic', () => {
  expect(validRange('2026-01-01', '2026-11-05', '2026-11-05')).toBe(true);
  expect(validRange('', '2026-11-05')).toBe(false);
  expect(validRange('2026-02-30', '2026-11-05')).toBe(false);
  expect(validRange('2026-11-06', '2026-11-05')).toBe(false);
  expect(validRange('2020-01-01', '2026-11-05')).toBe(false);
  expect(validRange('2026-11-05', '2026-11-06', '2026-11-05')).toBe(false);
});
it('rejects nonexistent and repeated London wall times', () => {
  const time = Temporal.PlainTime.from('01:30');
  expect(referenceTime('2026-03-29', time)).toBeNull();
  expect(referenceTime('2026-10-25', time)).toBeNull();
  expect(referenceTime('2026-03-28', time)).not.toBeNull();
});
it('uses the UK date when UTC is still on the previous day', () => {
  expect(day('2026-07-01T23:30:00Z')).toBe('2026-07-02');
  expect(clockTime('2026-07-01T23:30:00Z')).toBe('00:30');
});

it('limits inclusive custom ranges to 366 calendar days', () => {
  expect(validRange('2024-01-01', '2024-12-31', '2025-01-01')).toBe(true);
  expect(validRange('2024-01-01', '2025-01-01', '2025-01-01')).toBe(false);
});

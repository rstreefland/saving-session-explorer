import { describe, it, expect } from 'vitest';
import { Temporal, local, midnight, iso } from './time';
import { calculateAll, indexReadings, referenceDays } from './calculate';
import { demoDataset } from './demo';
import type { Session } from './types';

const session = (date = '2026-11-05T17:00:00Z'): Session => ({
  eventId: 1,
  startAt: date,
  endAt: iso(local(date).add({ hours: 1 })),
  eventType: 'TURN_DOWN',
  resultsStatus: 'SUCCESS',
  resultsSetAt: null,
  energyDeltaKwh: 0,
  baselineConsumptionDeltaKwh: 0,
  consumptionDeltaKwh: 0,
  rewardGivenInOctoPoints: 0,
});
describe('baseline date selection', () => {
  it('selects ten weekdays, excluding holidays and event days', () => {
    const days = referenceDays(session(), new Set(['2026-11-04']), new Set(['2026-11-03']));
    expect(days).toHaveLength(10);
    expect(days[0]).toBe('2026-11-02');
    expect(days.every((d) => Temporal.PlainDate.from(d).dayOfWeek < 6)).toBe(true);
  });
  it('uses four weekend references for a weekday bank holiday, excluding holiday and event dates', () => {
    expect(
      referenceDays(
        session('2026-08-31T16:00:00Z'),
        new Set(['2026-08-30']),
        new Set(['2026-08-31', '2026-08-29']),
      ),
    ).toEqual(['2026-08-23', '2026-08-22', '2026-08-16', '2026-08-15']);
  });
  it('selects four weekend days and stops at sixty days', () => {
    expect(referenceDays(session('2026-11-08T17:00:00Z'), new Set(), new Set())).toEqual([
      '2026-11-07',
      '2026-11-01',
      '2026-10-31',
      '2026-10-25',
    ]);
    const excluded = new Set(
      Array.from({ length: 60 }, (_, i) =>
        Temporal.PlainDate.from('2026-11-05')
          .subtract({ days: i + 1 })
          .toString(),
      ),
    );
    expect(referenceDays(session(), excluded, new Set())).toEqual([]);
  });
});
describe('calculations', () => {
  it('compares published results, preserves pending, flags gaps and discrepancy', () => {
    const r = calculateAll(demoDataset());
    expect(r.map((x) => x.state)).toEqual(['pending', 'difference', 'match', 'incomplete']);
    expect(r[0].rewarded).toBeCloseTo(0.9);
    expect(r[1].difference).toBeCloseTo(0.26);
    expect(r[3].actual).toBeNull();
    expect(r[3].rewarded).toBeNull();
  });
  it('calculates a bank holiday from four known weekend days, not weekday usage', () => {
    const data = demoDataset();
    data.sessions = [session('2026-08-31T16:00:00Z')];
    data.eventDays = ['2026-08-30'];
    data.holidays = ['2026-08-31', '2026-08-29'];
    // Independent golden fixture: weekend half-hours average 2.5 kWh each.
    const weekends = ['2026-08-23', '2026-08-22', '2026-08-16', '2026-08-15'];
    data.imports = [];
    for (let offset = 0; offset < 40; offset++) {
      const date = Temporal.PlainDate.from('2026-08-31').subtract({ days: offset }).toString();
      for (const minute of [0, 30]) {
        const start = midnight(date).with({ hour: 17, minute });
        data.imports.push({
          interval_start: iso(start),
          interval_end: iso(start.add({ minutes: 30 })),
          consumption:
            offset === 0 ? 0.5 : weekends.includes(date) ? weekends.indexOf(date) + 1 : 9,
        });
      }
    }
    const [result] = calculateAll(data);
    expect(result.days).toEqual(weekends);
    expect(result.baseline).toBe(5);
    expect(result.actual).toBe(1);
    expect(result.rewarded).toBe(4);
    expect(result.issues).toEqual([]);
    data.imports = data.imports.filter((r) => !r.interval_start.startsWith('2026-08-23'));
    expect(calculateAll(data)[0].baseline).toBeNull();
    expect(calculateAll(data)[0].days).toEqual(weekends);
    expect(calculateAll(data)[0].unavailableReason).toBe('baseline-readings');
    data.eventDays = weekends.slice(1).concat(
      Array.from({ length: 60 }, (_, i) =>
        Temporal.PlainDate.from('2026-08-31')
          .subtract({ days: i + 1 })
          .toString(),
      ),
    );
    expect(calculateAll(data)[0].unavailableReason).toBe('baseline-history');
  });
  it('does not replace missing baseline readings with zero or older dates', () => {
    const data = demoDataset(),
      before = calculateAll(data)[0];
    data.imports = data.imports.filter((r) => !r.interval_start.startsWith(before.days[0]));
    const result = calculateAll(data)[0];
    expect(result.days).toEqual(before.days);
    expect(result.baseline).toBeNull();
    expect(result.issues.join()).toContain('baseline half-hour');
  });
  it('subtracts linked export and requires its readings', () => {
    const data = demoDataset();
    data.exports = data.imports.map((r) => ({ ...r, consumption: 0.1 }));
    expect(calculateAll(data)[0].actual).toBeCloseTo(0.1);
    expect(calculateAll(data)[0].rewarded).toBeCloseTo(0.9);
    data.exports = [];
    expect(calculateAll(data)[0].rewarded).toBeNull();
  });
  it('calculates turn up and clips each half-hour separately', () => {
    const data = demoDataset(),
      s = data.sessions[0];
    s.eventType = 'TURN_UP';
    for (const r of data.imports)
      if (Date.parse(r.interval_start) === Date.parse(s.startAt)) r.consumption = 1.6;
    const r = calculateAll(data)[0];
    expect(r.rewarded).toBeCloseTo(1);
    expect(r.netSaved).toBeCloseTo(-0.55);
  });
  it('zero is a published result, and tolerance is absolute', () => {
    const data = demoDataset();
    data.sessions[0].resultsStatus = 'FAIL';
    data.sessions[0].energyDeltaKwh = 0;
    expect(calculateAll(data)[0].state).toBe('difference');
    data.sessions[0].energyDeltaKwh = 0.91;
    expect(calculateAll(data)[0].state).toBe('match');
    data.sessions[0].energyDeltaKwh = 0.92;
    expect(calculateAll(data)[0].state).toBe('difference');
  });
  it.each(['CALCULATING', 'MISSING_READINGS', null])('does not treat %s as settled', (status) => {
    const data = demoDataset();
    data.sessions[0].resultsStatus = status;
    data.sessions[0].energyDeltaKwh = 0;
    expect(calculateAll(data)[0].difference).toBeNull();
  });
  it('blocks estimates when the event calendar is unverified', () => {
    const data = demoDataset();
    data.baselineIssues = ['event-history'];
    expect(calculateAll(data)[0].rewarded).toBeNull();
  });
  it('rejects unsupported types, historic rules and malformed windows', () => {
    for (const changes of [
      { eventType: 'UNKNOWN' },
      { startAt: '2023-11-01T17:00:00Z' },
      { endAt: '2026-01-01T00:00:00Z' },
      { startAt: '2026-11-05T17:05:00Z' },
    ]) {
      const data = demoDataset();
      Object.assign(data.sessions[0], changes);
      expect(calculateAll(data)[0].state).toBe('unsupported');
    }
  });
  it('rejects duplicate, negative and non-half-hour readings', () => {
    const good = {
      interval_start: '2026-01-01T00:00:00Z',
      interval_end: '2026-01-01T00:30:00Z',
      consumption: 0,
    };
    expect(indexReadings([good]).get(Date.parse(good.interval_start))).toBe(0);
    for (const readings of [
      [good, good],
      [{ ...good, consumption: -1 }],
      [{ ...good, interval_end: '2026-01-01T01:00:00Z' }],
    ])
      expect([...indexReadings(readings).values()]).toEqual([null]);
  });
  it('uses London wall time across GMT/BST rather than fixed UTC offsets', () => {
    const data = demoDataset();
    data.sessions = [session('2026-10-27T17:00:00Z')];
    data.eventDays = [];
    data.imports = [];
    const days = referenceDays(data.sessions[0], new Set(), new Set());
    for (const date of [...days, '2026-10-27'])
      for (const minute of [0, 30]) {
        const d = midnight(date).with({ hour: 17, minute });
        data.imports.push({
          interval_start: iso(d),
          interval_end: iso(d.add({ minutes: 30 })),
          consumption: 1,
        });
      }
    expect(calculateAll(data)[0].baseline).toBe(2);
  });
  it('flags ambiguous autumn clock-change references', () => {
    const data = demoDataset();
    data.sessions = [session('2026-10-25T01:00:00+01:00')];
    data.eventDays = [];
    expect(calculateAll(data)[0].issues.join()).toContain('ambiguous');
  });
  it('handles insufficient eligible history', () => {
    const data = demoDataset(),
      s = data.sessions[0];
    data.eventDays = Array.from({ length: 61 }, (_, i) =>
      local(s.startAt).toPlainDate().subtract({ days: i }).toString(),
    );
    expect(calculateAll(data)[0].issues.join()).toContain('Not enough');
  });
});

describe('Happy Hours', () => {
  it('compares imported usage without a baseline, export readings or event calendar', () => {
    const data = demoDataset(),
      s = data.sessions[0];
    s.eventType = 'WEEKEND_HAPPY_HOUR';
    s.resultsStatus = 'SUCCESS';
    s.energyUsedInKwh = 0.3;
    s.energyDeltaKwh = 0;
    data.exports = [];
    data.baselineIssues = ['event-history'];
    const result = calculateAll(data)[0];
    expect(result.state).toBe('match');
    expect(result.rewarded).toBeCloseTo(0.3);
    expect(result.actual).toBeCloseTo(0.3);
    expect(result.baseline).toBeNull();
    expect(result.days).toEqual([]);
    expect(result.slots.every((slot) => slot.references.length === 0)).toBe(true);
    expect(result.netSaved).toBeNull();
  });
  it('does not clip imported usage to the reward cap or subtract export', () => {
    const data = demoDataset(),
      s = data.sessions[0];
    s.eventType = 'WEEKEND_HAPPY_HOUR';
    s.resultsStatus = 'SUCCESS';
    s.energyUsedInKwh = 20;
    s.energyDeltaKwh = 16;
    for (const reading of data.imports)
      if (
        Date.parse(reading.interval_start) >= Date.parse(s.startAt) &&
        Date.parse(reading.interval_start) < Date.parse(s.endAt)
      )
        reading.consumption = 10;
    data.exports = data.imports.map((reading) => ({ ...reading, consumption: 1 }));
    const result = calculateAll(data)[0];
    expect(result.rewarded).toBe(20);
    expect(result.difference).toBe(0);
  });
  it('flags missing imported readings and leaves unpublished results pending', () => {
    const data = demoDataset();
    for (const s of data.sessions) s.eventType = 'WEEKEND_HAPPY_HOUR';
    expect(calculateAll(data)[0].state).toBe('pending');
    expect(calculateAll(data)[3].state).toBe('incomplete');
  });
});

it('informational warnings do not change estimates', () => {
  const data = demoDataset();
  const before = calculateAll(data);
  data.warnings = ['Optional account profile unavailable'];
  expect(calculateAll(data)).toEqual(before);
});
it.each(['holidays', 'exports', 'event-history'] as const)(
  'explains the unavailable %s dependency',
  (issue) => {
    const data = demoDataset();
    data.baselineIssues = [issue];
    expect(calculateAll(data)[0]).toMatchObject({
      rewarded: null,
      unavailableReason: issue,
      state: 'incomplete',
    });
  },
);

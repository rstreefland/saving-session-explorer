import type { Dataset, Session } from '../domain/types';
import { Temporal, midnight, iso } from '../domain/time';

// Selected weekdays worked out independently, with no events or holidays.
export const referenceDates = [
  '2026-11-04',
  '2026-11-03',
  '2026-11-02',
  '2026-10-30',
  '2026-10-29',
  '2026-10-28',
  '2026-10-27',
  '2026-10-26',
  '2026-10-23',
  '2026-10-22',
];
export function precisionFixture(uniform = false): Dataset {
  const session: Session = {
    eventId: 1,
    startAt: '2026-11-05T17:00:00Z',
    endAt: '2026-11-05T17:30:00Z',
    eventType: 'TURN_DOWN',
    resultsStatus: 'SUCCESS',
    resultsSetAt: null,
    energyDeltaKwh: '0.1005',
    baselineConsumptionDeltaKwh: '0.1005',
    consumptionDeltaKwh: '0',
    rewardGivenInOctoPoints: 16,
    rewardPerKwhInOctoPoints: '80',
  };
  return {
    sessions: [session],
    imports: [
      ...referenceDates.map((date, index) => ({
        interval_start: iso(midnight(date).with({ hour: 17 })),
        interval_end: iso(midnight(date).with({ hour: 17, minute: 30 })),
        consumption: uniform ? '0.1005' : index < 5 ? '0.100' : '0.101',
      })),
      { interval_start: session.startAt, interval_end: session.endAt, consumption: '0' },
    ],
    exports: null,
    eventDays: ['2026-11-05'],
    holidays: [],
    baselineIssues: [],
    warnings: [],
    mpan: 'SYNTHETIC',
    fetchedAt: Temporal.Instant.from('2026-11-06T12:00:00Z').toString(),
  };
}

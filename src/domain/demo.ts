import { Temporal, todayInLondon, midnight, iso, milliseconds, day } from './time';
import type { Dataset, Session, Reading } from './types';

const fixtures = new Map<string, Dataset>();
let fixtureDay = '';

export function demoDataset(allTypes = false): Dataset {
  const date = todayInLondon().toString();

  if (fixtureDay !== date) {
    fixtures.clear();
    fixtureDay = date;
  }

  const cacheKey = String(allTypes);
  const cached = fixtures.get(cacheKey);

  if (cached) return { ...structuredClone(cached), fetchedAt: Temporal.Now.instant().toString() };

  const today = midnight(date);

  const sessions: Session[] = [2, 5, 9, 12].map((offset, i) => {
    const start = today.subtract({ days: offset }).with({ hour: 17 });

    return {
      eventId: i + 1,
      startAt: iso(start),
      endAt: iso(start.add({ hours: 1 })),
      eventType: 'TURN_DOWN',
      resultsStatus: i === 0 ? 'CALCULATING' : 'SUCCESS',
      resultsSetAt: null,
      energyDeltaKwh: i === 0 ? null : i === 1 ? 0.64 : 0.9,
      baselineConsumptionDeltaKwh: i === 0 ? null : 1.2,
      consumptionDeltaKwh: i === 0 ? null : 0.3,
      rewardGivenInOctoPoints: i === 0 ? null : 72,
      rewardPerKwhInOctoPoints: 80,
    };
  });

  if (allTypes) {
    const start = today.subtract({ days: 3 }).with({ hour: 12 });
    const upcomingStart = today.with({ hour: 18 });

    sessions.push(
      {
        ...sessions[1],
        eventId: 101,
        startAt: iso(start),
        endAt: iso(start.add({ hours: 1 })),
        eventType: 'TURN_UP',
        rewardPerKwhInOctoPoints: 0,
        energyDeltaKwh: 0,
        rewardGivenInOctoPoints: 0,
        resultsStatus: 'FAIL',
      },
      {
        ...sessions[1],
        eventId: 102,
        startAt: iso(start.subtract({ days: 1 })),
        endAt: iso(start.subtract({ days: 1 }).add({ hours: 1 })),
        eventType: 'WEEKEND_HAPPY_HOUR',
        rewardPerKwhInOctoPoints: 0,
        energyUsedInKwh: 0.3,
        rewardGivenInPence: 8,
      },
      {
        ...sessions[0],
        eventId: 103,
        startAt: iso(upcomingStart),
        endAt: iso(upcomingStart.add({ hours: 1 })),
        resultsStatus: 'UPCOMING',
      },
    );
  }

  const imports: Reading[] = [];

  const periods = sessions.map((session) => ({
    start: milliseconds(session.startAt),
    end: milliseconds(session.endAt),
  }));

  const halfHour = 1_800_000;

  for (
    let time = today.subtract({ days: 75 }).epochMilliseconds;
    time < today.epochMilliseconds;
    time += halfHour
  ) {
    const sessionIndex = periods.findIndex((period) => time >= period.start && time < period.end);

    if (sessionIndex === 3 && time - periods[3].start === halfHour) continue;

    imports.push({
      interval_start: Temporal.Instant.fromEpochMilliseconds(time).toString(),
      interval_end: Temporal.Instant.fromEpochMilliseconds(time + halfHour).toString(),
      consumption: sessionIndex >= 0 ? 0.15 : 0.6,
    });
  }

  const dataset: Dataset = {
    sessions,
    imports,
    exports: null,
    eventDays: sessions.map((s) => day(s.startAt)),
    holidays: [],
    baselineIssues: [],
    warnings: [],
    mpan: 'DEMO',
    fetchedAt: Temporal.Now.instant().toString(),
  };

  fixtures.set(cacheKey, structuredClone(dataset));

  return dataset;
}

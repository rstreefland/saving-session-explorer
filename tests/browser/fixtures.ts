import { precisionFixture } from '../../src/test/precisionFixture';
import {
  addMilliseconds,
  Temporal as Clock,
  instantString,
  milliseconds,
} from '../../src/domain/time';
import { decimal } from '../../src/domain/decimal';
import type { Page } from '@playwright/test';
import type { Temporal } from 'temporal-polyfill';

// Entirely synthetic account and meter data. No requests reach external services.
export async function connectedAccount(
  page: Page,
  homeMini = false,
  missingResult = false,
  clock = '2026-11-05T12:00:00Z',
) {
  await page.clock.setFixedTime(milliseconds(clock));
  await page.addInitScript((clock) => {
    // The ponyfill uses native Temporal when available, whose clock is independent of Date.
    const native = (globalThis as typeof globalThis & { Temporal?: typeof Temporal }).Temporal;

    if (native) {
      const instant = native.Instant.from(clock);
      native.Now.instant = () => instant;
      native.Now.plainDateISO = (zone) =>
        instant.toZonedDateTimeISO(zone ?? native.Now.timeZoneId()).toPlainDate();
    }

    localStorage.setItem('session-lens.api-key', 'synthetic-test-key');
    localStorage.setItem('session-lens.account-number', 'A-TEST');
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(
        event.violatedDirective,
      );
    });
  }, clock);

  const sessions = [
    { id: 1, date: '2026-11-04', hour: 14, status: 'CALCULATING' },
    { id: 2, date: '2026-11-03', hour: 17, status: 'CALCULATING' },
    { id: 3, date: '2026-10-27', hour: 18, status: 'FAIL' },
    { id: 4, date: '2026-10-26', hour: 18, status: 'SUCCESS' },
    { id: 5, date: '2026-10-25', hour: 11, status: 'SUCCESS', happy: true },
  ].map((s) => ({
    eventId: s.id,
    startAt: s.id === 4 ? `${s.date}T11:30:00Z` : `${s.date}T${s.hour}:00:00Z`,
    endAt:
      s.id === 4
        ? `${s.date}T12:30:00Z`
        : Clock.Instant.from(`${s.date}T${s.hour}:00:00Z`).add({ hours: 1 }).toString(),
    eventType: s.happy ? 'WEEKEND_HAPPY_HOUR' : 'TURN_DOWN',
    resultsStatus: missingResult && s.id === 3 ? 'MISSING_READINGS' : s.status,
    resultsSetAt: null,
    baselineConsumptionDeltaKwh: s.status === 'SUCCESS' ? 1.2 : null,
    consumptionDeltaKwh: s.status === 'SUCCESS' ? 0.2 : null,
    energyDeltaKwh: s.status === 'SUCCESS' ? 1 : s.status === 'FAIL' ? 0 : null,
    rewardGivenInOctoPoints: s.status === 'SUCCESS' ? 80 : s.status === 'FAIL' ? 0 : null,
    rewardGivenInPence: s.happy ? 4 : null,
    energyUsedInKwh: s.happy ? 0.2 : null,
  }));

  const readings = [];

  for (
    let time = milliseconds('2026-08-01T00:00:00Z');
    time < milliseconds('2026-11-05T00:00:00Z');
    time = addMilliseconds(time, 1_800_000)
  ) {
    const session = sessions.find(
      (s) => time >= milliseconds(s.startAt) && time < milliseconds(s.endAt),
    );

    if (session?.eventId === 1) continue;

    readings.push({
      interval_start: instantString(time),
      interval_end: instantString(addMilliseconds(time, 1_800_000)),
      consumption: session && session.eventId !== 3 ? 0.1 : 0.6,
    });
  }

  await page.route('https://api.oegb-kraken.energy/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/graphql/')) {
      const query = route.request().postDataJSON().query;

      if (query.includes('HomeMiniDevices'))
        return route.fulfill({
          json: {
            data: {
              account: {
                electricityAgreements: homeMini
                  ? [
                      {
                        meterPoint: {
                          mpan: '123',
                          meters: [
                            {
                              serialNumber: 'SYNTHETIC',
                              smartImportElectricityMeter: { deviceId: 'mini-test' },
                            },
                          ],
                        },
                      },
                    ]
                  : [],
              },
            },
          },
        });
      if (query.includes('HomeMiniReadings'))
        return route.fulfill({
          json: {
            data: {
              smartMeterTelemetry: [0, 1].map((offset) => ({
                readAt: instantString(
                  Clock.Instant.from(sessions[0].startAt).add({
                    minutes: decimal(offset).times(30).toNumber(),
                  }).epochMilliseconds,
                ),
                consumptionDelta: '100',
              })),
            },
          },
        });

      return route.fulfill({
        json: {
          data: query.includes('obtainKrakenToken')
            ? { obtainKrakenToken: { token: 'synthetic-token' } }
            : {
                account: {
                  number: 'A-TEST',
                  billingName: 'Example Account Holder With A Longer Name',
                },
              },
        },
      });
    }

    if (url.includes('/accounts/'))
      return route.fulfill({
        json: {
          properties: [
            {
              electricity_meter_points: [
                {
                  mpan: '123',
                  is_export: false,
                  meters: [{ serial_number: 'SYNTHETIC' }],
                },
              ],
            },
          ],
        },
      });

    return route.fulfill({ json: { next: null, results: readings } });
  });
  await page.route('https://api.backend.octopus.energy/**', (route) =>
    route.fulfill({
      json: {
        data: {
          savingSessions: {
            events: [
              { id: 0, startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-01T01:00:00Z' },
              ...sessions.map((s) => ({
                id: s.eventId,
                startAt: s.startAt,
                endAt: s.endAt,
                rewardPerKwhInOctoPoints: 80,
              })),
            ],
            eventCount: decimal(sessions.length).plus(1).toNumber(),
            account: {
              signedUpMeterPoint: { mpan: '123', gspGroupId: '_A' },
              joinedEvents: sessions,
            },
          },
        },
      },
    }),
  );
  await page.route('https://www.gov.uk/**', (route) =>
    route.fulfill({ json: { 'england-and-wales': { events: [{ date: '2026-08-31' }] } } }),
  );
}

export async function precisionAccount(page: Page, uniform: boolean) {
  await connectedAccount(page, false, false, '2026-11-06T12:00:00Z');
  const data = precisionFixture(uniform);
  await page.route('https://api.oegb-kraken.energy/v1/electricity-meter-points/**', (route) =>
    route.fulfill({ json: { next: null, results: data.imports } }),
  );
  await page.route('https://api.backend.octopus.energy/**', (route) =>
    route.fulfill({
      json: {
        data: {
          savingSessions: {
            events: data.sessions.map((session) => ({
              id: session.eventId,
              startAt: session.startAt,
              endAt: session.endAt,
              rewardPerKwhInOctoPoints: session.rewardPerKwhInOctoPoints,
            })),
            eventCount: 1,
            account: {
              signedUpMeterPoint: { mpan: '123', gspGroupId: '_A' },
              joinedEvents: data.sessions,
            },
          },
        },
      },
    }),
  );
}

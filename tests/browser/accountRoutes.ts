import {
  addMilliseconds,
  Temporal as Clock,
  instantString,
  milliseconds,
} from '../../src/domain/time';
import { decimal } from '../../src/domain/decimal';
import { z } from 'zod';
import type { Page, Route } from 'playwright';

const graphqlRequestSchema = z.object({ query: z.string() });

function operationName(route: Route) {
  const { query } = graphqlRequestSchema.parse(route.request().postDataJSON());
  const operation = /^\s*(?:query|mutation)\s+(\w+)\s*[( {]/.exec(query);
  if (!operation) throw new Error('Unexpected browser fixture GraphQL request');
  return operation[1];
}

// Entirely synthetic account and meter data. No requests reach external services.
export async function connectedAccount({
  page,
  homeMini = false,
}: {
  page: Page;
  homeMini?: boolean;
}) {
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
    resultsStatus: s.status,
    resultsSetAt: null,
    baselineConsumptionDeltaKwh: s.status === 'SUCCESS' ? 1.2 : null,
    consumptionDeltaKwh: s.status === 'SUCCESS' ? 0.2 : null,
    energyDeltaKwh: s.status === 'SUCCESS' ? 1 : s.status === 'FAIL' ? 0 : null,
    rewardGivenInOctoPoints: s.status === 'SUCCESS' ? 80 : s.status === 'FAIL' ? 0 : null,
    rewardGivenInPence: s.happy ? 4 : null,
    energyUsedInKwh: s.happy ? 0.2 : null,
  }));

  const readings: {
    interval_start: string;
    interval_end: string;
    consumption: number;
  }[] = [];

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
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === '/v1/graphql/' && request.method() === 'POST') {
      const operation = operationName(route);

      if (operation === 'HomeMiniDevices')
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
      if (operation === 'HomeMiniReadings')
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

      if (operation === 'Token') {
        return route.fulfill({
          json: { data: { obtainKrakenToken: { token: 'synthetic-token' } } },
        });
      }
      if (operation === 'AccountProfile') {
        return route.fulfill({
          json: {
            data: {
              account: {
                number: 'A-TEST',
                billingName: 'Example Account Holder With A Longer Name',
              },
            },
          },
        });
      }
      throw new Error('Unexpected browser fixture authentication operation');
    }

    if (pathname === '/v1/accounts/A-TEST/' && request.method() === 'GET')
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

    if (
      pathname === '/v1/electricity-meter-points/123/meters/SYNTHETIC/consumption/' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { next: null, results: readings } });
    }
    throw new Error('Unexpected browser fixture meter request');
  });
  await page.route('https://api.backend.octopus.energy/**', (route) => {
    if (
      new URL(route.request().url()).pathname !== '/v1/graphql/' ||
      route.request().method() !== 'POST'
    ) {
      throw new Error('Unexpected browser fixture session request');
    }
    const operation = operationName(route);
    if (operation === 'HappyHourTokens') {
      return route.fulfill({
        json: { data: { savingSessions: { account: { tokenBalance: 3 } } } },
      });
    }
    if (operation !== 'Sessions') throw new Error('Unexpected browser fixture session operation');
    return route.fulfill({
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
    });
  });
  await page.route('https://www.gov.uk/**', (route) => {
    if (
      new URL(route.request().url()).pathname !== '/bank-holidays.json' ||
      route.request().method() !== 'GET'
    ) {
      throw new Error('Unexpected browser fixture holiday request');
    }
    return route.fulfill({ json: { 'england-and-wales': { events: [{ date: '2026-08-31' }] } } });
  });
}

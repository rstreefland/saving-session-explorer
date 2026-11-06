import type { Page } from '@playwright/test';

// Entirely synthetic account and meter data. No requests reach external services.
export async function connectedAccount(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('session-lens.api-key', 'synthetic-test-key');
    localStorage.setItem('session-lens.account-number', 'A-TEST');
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(
        event.violatedDirective,
      );
    });
  });

  const sessions = [
    { id: 1, date: '2026-11-04', hour: 14, status: 'CALCULATING' },
    { id: 2, date: '2026-11-03', hour: 17, status: 'CALCULATING' },
    { id: 3, date: '2026-10-27', hour: 18, status: 'FAIL' },
    { id: 4, date: '2026-10-26', hour: 18, status: 'SUCCESS' },
    { id: 5, date: '2026-10-25', hour: 11, status: 'SUCCESS', happy: true },
  ].map((s) => ({
    eventId: s.id,
    startAt: s.id === 4 ? `${s.date}T11:30:00Z` : `${s.date}T${s.hour}:00:00Z`,
    endAt: s.id === 4 ? `${s.date}T12:30:00Z` : `${s.date}T${s.hour + 1}:00:00Z`,
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

  const readings = [];

  for (
    let time = Date.parse('2026-08-01T00:00:00Z');
    time < Date.parse('2026-11-05T00:00:00Z');
    time += 1_800_000
  ) {
    const session = sessions.find(
      (s) => time >= Date.parse(s.startAt) && time < Date.parse(s.endAt),
    );

    if (session?.eventId === 1) continue;

    readings.push({
      interval_start: new Date(time).toISOString(),
      interval_end: new Date(time + 1_800_000).toISOString(),
      consumption: session && session.eventId !== 3 ? 0.1 : 0.6,
    });
  }

  await page.route('https://api.oegb-kraken.energy/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/graphql/')) {
      const query = route.request().postDataJSON().query;

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
                { mpan: '123', is_export: false, meters: [{ serial_number: 'SYNTHETIC' }] },
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
            eventCount: sessions.length + 1,
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

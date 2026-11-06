export interface Reading {
  interval_start: string;
  interval_end: string;
  consumption: number;
}

export interface Session {
  eventId: number;
  startAt: string;
  endAt: string;
  eventType: string;
  resultsStatus: string | null;
  resultsSetAt: string | null;
  energyDeltaKwh: number | null;
  baselineConsumptionDeltaKwh: number | null;
  consumptionDeltaKwh: number | null;
  rewardGivenInOctoPoints: number | null;
  /** Published event rate, matched by eventId, independent of the account reward. */
  rewardPerKwhInOctoPoints?: number | null;
  rewardGivenInPence?: number | null;
  energyUsedInKwh?: number | null;
}

export type BaselineIssue = 'holidays' | 'exports' | 'event-history';

export interface Dataset {
  accountNumber?: string;
  accountHolderName?: string | null;
  meterSerials?: { import: string; export: string | null };
  holidayRegion?: string;
  holidayRegionSource?: string;
  sessions: Session[];
  eventDays: string[];
  imports: Reading[];
  /** null means no linked meter; unavailable linked exports use [] plus an exports issue. */
  exports: Reading[] | null;
  holidays: string[];
  baselineIssues: BaselineIssue[];
  /** Informational messages never affect calculation eligibility. */
  warnings: string[];
  fetchedAt: string;
  mpan: string;
}

export interface Slot {
  start: string;
  baseline: number | null;
  actual: number | null;
  references: { date: string; value: number | null }[];
}

export interface Calculation {
  session: Session;
  slots: Slot[];
  days: string[];
  issues: string[];
  baseline: number | null;
  actual: number | null;
  rewarded: number | null;
  netSaved: number | null;
  difference: number | null;
  unavailableReason:
    | 'session-readings'
    | 'baseline-readings'
    | 'baseline-history'
    | 'event-history'
    | 'holidays'
    | 'exports'
    | 'clock-change'
    | 'unsupported'
    | null;
  state: 'incomplete' | 'pending' | 'difference' | 'match' | 'unsupported';
}

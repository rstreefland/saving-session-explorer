import type { Decimal, Numeric } from './decimal';

export interface Reading {
  source?: 'home-mini';
  interval_start: string;
  interval_end: string;
  consumption: Numeric;
}

export interface Session {
  eventId: number;
  startAt: string;
  endAt: string;
  eventType: string;
  resultsStatus: string | null;
  resultsSetAt: string | null;
  energyDeltaKwh: Numeric | null;
  baselineConsumptionDeltaKwh: Numeric | null;
  consumptionDeltaKwh: Numeric | null;
  rewardGivenInOctoPoints: Numeric | null;
  /** Published event rate, matched by eventId, independent of the account reward. */
  rewardPerKwhInOctoPoints?: Numeric | null;
  rewardGivenInPence?: Numeric | null;
  energyUsedInKwh?: Numeric | null;
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
  actualProvisional?: boolean;
  start: string;
  baseline: Decimal | null;
  actual: Decimal | null;
  references: { date: string; value: Decimal | null }[];
}

export interface Calculation {
  /** True when session or baseline inputs include Home Mini telemetry. */
  provisional?: boolean;
  session: Session;
  slots: Slot[];
  days: string[];
  issues: string[];
  baseline: Decimal | null;
  actual: Decimal | null;
  rewarded: Decimal | null;
  netSaved: Decimal | null;
  difference: Decimal | null;
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

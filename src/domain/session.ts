import type { Session } from './types';

export const SESSION_TYPES = [
  { value: 'TURN_DOWN', label: 'Power down' },
  { value: 'TURN_UP', label: 'Power up' },
  { value: 'WEEKEND_HAPPY_HOUR', label: 'Happy Hours' },
] as const;

export type SessionType = (typeof SESSION_TYPES)[number]['value'];

export const isHappyHour = (session: Session) => session.eventType === 'WEEKEND_HAPPY_HOUR';

export const isPublished = (session: Session) =>
  ['SUCCESS', 'PARTIAL_SUCCESS', 'FAIL'].includes(session.resultsStatus ?? '');

export function reportedShifted(session: Session) {
  if (!isPublished(session)) return null;

  return isHappyHour(session)
    ? (session.energyUsedInKwh ?? session.energyDeltaKwh)
    : (session.energyDeltaKwh ?? (session.resultsStatus === 'FAIL' ? 0 : null));
}

export const MISSING_SESSION_EXPLANATION =
  'Octopus couldn’t get readings for this Session. If you opted in, Octopus says it will credit the average Octopoints earned in that Session.';

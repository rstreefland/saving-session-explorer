import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SessionSummary } from './SessionSummary';
import { calculateAll } from '../domain/calculate';
import { demoDataset } from '../domain/demo';

const base = calculateAll(demoDataset())[1];

it('counts estimated and official achievement independently, including estimates before publication', () => {
  const results = [
    {
      ...base,
      session: { ...base.session, resultsStatus: 'CALCULATING', rewardGivenInOctoPoints: 0 },
    },
    { ...base, netSaved: 0, session: { ...base.session, resultsStatus: 'PARTIAL_SUCCESS' } },
    base,
    { ...base, rewarded: null, netSaved: null },
    { ...base, session: { ...base.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: 0 } },
  ];

  render(<SessionSummary results={results} type="TURN_DOWN" />);

  expect(screen.getByText('Sessions').nextElementSibling).toHaveTextContent('5');
  expect(screen.getByText('Achieved or partly achieved').nextElementSibling).toHaveTextContent(
    '3 / 4',
  );
  expect(screen.getByText('Possible missed rewards').nextElementSibling).toHaveTextContent('1');
});

it('includes partly achieved sessions in both actual and estimated counts', () => {
  render(
    <SessionSummary
      results={[
        { ...base, netSaved: 0, session: { ...base.session, resultsStatus: 'PARTIAL_SUCCESS' } },
      ]}
      type="TURN_DOWN"
    />,
  );

  expect(screen.getByText('Achieved or partly achieved').nextElementSibling).toHaveTextContent(
    '1 / 1',
  );
});

it('uses the Power up direction for the estimated count', () => {
  render(
    <SessionSummary
      results={[
        {
          ...base,
          netSaved: -0.5,
          session: { ...base.session, eventType: 'TURN_UP', resultsStatus: 'FAIL' },
        },
      ]}
      type="TURN_UP"
    />,
  );

  expect(screen.getByText('Achieved or partly achieved').nextElementSibling).toHaveTextContent(
    '0 / 1',
  );
});

it('keeps Happy Hours as usage readiness without claiming achievement', () => {
  render(
    <SessionSummary results={[base, { ...base, rewarded: null }]} type="WEEKEND_HAPPY_HOUR" />,
  );

  expect(screen.getByText('Usage ready').nextElementSibling).toHaveTextContent('1');
  expect(screen.queryByText('Achieved or partly achieved')).not.toBeInTheDocument();
});

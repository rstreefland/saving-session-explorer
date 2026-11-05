import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Methodology } from './Methodology';

it('documents reward-equivalent kWh as an observed pattern, rather than a guaranteed policy', async () => {
  render(<Methodology />);
  const user = userEvent.setup();
  await user.click(screen.getByText('How the calculation works'));
  const explanation = screen.getByText('Why the kWh figures can differ');
  await user.click(explanation);
  expect(explanation.closest('details')).toHaveAttribute('open');
  expect(
    screen.getByText(/Octopus appears to round the reward before converting it back into kWh/),
  ).toBeVisible();
  expect(
    screen.getByText(
      /The exact formula could not be confirmed because it has not been published by Octopus/,
    ),
  ).toBeVisible();
  expect(screen.getByText(/The meter estimate is kept separate from Octopus/)).toBeVisible();
});

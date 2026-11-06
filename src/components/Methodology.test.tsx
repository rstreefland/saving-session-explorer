import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Methodology } from './Methodology';

it('explains differences as observations and makes the Power up reward limitation explicit', async () => {
  render(<Methodology />);
  const user = userEvent.setup();
  await user.click(screen.getByText('Why estimates can differ from Octopus'));
  expect(
    screen.getByText(/Octopus appears to round rewards before converting them back to kWh/),
  ).toBeVisible();
  expect(screen.getByText(/Clock-marked estimates use Home Mini data/)).toBeVisible();
  await user.click(screen.getByText('Understanding your results and rewards'));
  expect(
    screen.getByText(
      /These rounding assumptions fit the results checked but aren’t confirmed by Octopus/,
    ),
  ).toBeVisible();
  expect(
    screen.getByText(/Power up energy use is estimated, but rewards aren’t estimated/),
  ).toBeVisible();
});

it('exposes all four guides independently and keeps official links visible', async () => {
  render(<Methodology />);
  const user = userEvent.setup();
  const main = screen.getByText('How your usage is calculated').closest('details')!;
  for (const label of [
    'How your baseline is calculated',
    'Understanding your results and rewards',
    'Why estimates can differ from Octopus',
  ]) {
    const toggle = screen.getByText(label);
    expect(toggle).toBeVisible();
    expect(main).not.toContainElement(toggle);
    await user.click(toggle);
    expect(toggle.closest('details')).toHaveAttribute('open');
    expect(main).not.toHaveAttribute('open');
  }
  expect(screen.getByRole('link', { name: /Octopus FAQs/ })).toBeVisible();
  expect(screen.getByRole('link', { name: /Official terms/ })).toBeVisible();
});

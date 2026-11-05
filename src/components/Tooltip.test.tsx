import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

const text =
  'Estimated figures produced by looking at your smart meter data. May differ to the actual figures from Octopus Energy.';
const view = () => render(<Tooltip label="Calculated result" text={text} />);

it('shows the explanation on hover and lets the pointer move onto it', async () => {
  const user = userEvent.setup();
  view();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await user.hover(screen.getByRole('button', { name: 'Calculated result' }));
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent(text);
  await user.hover(tooltip);
  expect(tooltip).toBeInTheDocument();
  await user.unhover(tooltip);
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
});

it('provides the explanation to keyboard users and dismisses it with Escape or blur', async () => {
  const user = userEvent.setup();
  view();
  await user.tab();
  expect(screen.getByRole('button')).toHaveAccessibleDescription(text);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await user.tab();
  await user.tab();
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  await user.tab();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('opens on tap and closes on scroll or resize so it cannot become detached', () => {
  view();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.scroll(window);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  fireEvent.resize(window);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('keeps a long explanation above its trigger when there is no space below', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('role') === 'tooltip'
      ? new DOMRect(0, 0, 320, 160)
      : new DOMRect(40, window.innerHeight - 50, 100, 30);
  });
  view();
  await userEvent.click(screen.getByRole('button'));
  const tooltip = screen.getByRole('tooltip');
  expect(Number.parseFloat(tooltip.style.top) + 160).toBeLessThan(window.innerHeight - 50);
  expect(tooltip).toHaveTextContent(text);
  // Reopening while already focused must not move it back below the viewport.
  await userEvent.click(screen.getByRole('button'));
  expect(Number.parseFloat(tooltip.style.top) + 160).toBeLessThan(window.innerHeight - 50);
});

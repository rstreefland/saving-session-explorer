import { fetchHappyHourTokens } from '../api/happyHourTokens';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { createQueryClient } from '../api/queryClient';
import { useSessionData } from './useSessionData';
import { demoDataset } from '../domain/demo';
import type { loadDataset } from '../api/client';

vi.mock('../api/happyHourTokens', () => ({ fetchHappyHourTokens: vi.fn() }));

beforeEach(() => {
  vi.mocked(fetchHappyHourTokens).mockReset().mockResolvedValue(3);
});

const options = {
  key: 'secret-key',
  account: 'A-123',
  region: 'auto',
  from: '2026-10-01',
  to: '2026-11-05',
};

function setup(load: typeof loadDataset) {
  const client = createQueryClient();

  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, ...renderHook(() => useSessionData(load), { wrapper }) };
}

it('reuses fresh ranges, refreshes explicitly, and keeps secrets out of cache keys', async () => {
  const load = vi.fn<typeof loadDataset>().mockResolvedValue(demoDataset());
  const view = setup(load);

  act(() => view.result.current.connect(options));
  await waitFor(() => expect(view.result.current.data).not.toBeNull());

  expect(load).toHaveBeenCalledTimes(1);

  act(() => view.result.current.changeRange('2026-11-01', options.to));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(view.result.current.busy).toBe(false));
  act(() => view.result.current.changeRange(options.from, options.to));
  await waitFor(() => expect(view.result.current.data).not.toBeNull());

  expect(load).toHaveBeenCalledTimes(2);
  expect(
    JSON.stringify(
      view.client
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey),
    ),
  ).not.toMatch(/secret-key|A-123/);

  act(() => view.result.current.connect(options));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
  view.unmount();
  view.client.clear();
});

it('clears cached data when credentials change and when forgotten', async () => {
  const load = vi.fn<typeof loadDataset>().mockResolvedValue(demoDataset());
  const view = setup(load);

  act(() => view.result.current.connect(options));
  await waitFor(() => expect(view.result.current.data).not.toBeNull());

  const oldKey = view.client
    .getQueryCache()
    .getAll()
    .find((q) => q.state.data)?.queryKey;

  act(() => view.result.current.connect({ ...options, key: 'different-key' }));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

  expect(view.client.getQueryData(oldKey!)).toBeUndefined();

  act(() => view.result.current.reset(true));

  expect(view.result.current.data).toBeNull();
  expect(
    view.client
      .getQueryCache()
      .getAll()
      .some((q) => q.state.data),
  ).toBe(false);

  view.unmount();
  view.client.clear();
});

it('cancels the transport and ignores late responses on a range change', async () => {
  const load = vi.fn<typeof loadDataset>().mockImplementation(() => new Promise(() => {}));
  const view = setup(load);

  act(() => view.result.current.connect(options));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

  const firstSignal = load.mock.calls[0][1];

  act(() => view.result.current.changeRange('2026-11-01', options.to));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

  expect(firstSignal.aborted).toBe(true);

  act(() => view.result.current.reset(true));

  expect(load.mock.calls[1][1].aborted).toBe(true);

  view.unmount();
  view.client.clear();
});

it('does not retry failed credentials automatically', async () => {
  const load = vi.fn<typeof loadDataset>().mockRejectedValue(new Error('Invalid credentials'));
  const view = setup(load);

  act(() => view.result.current.connect(options));
  await waitFor(() => expect(view.result.current.error).toBe('Invalid credentials'));

  expect(load).toHaveBeenCalledTimes(1);

  view.unmount();
  view.client.clear();
});

it('loads sessions without waiting for tokens and keeps the balance outside date-range queries', async () => {
  vi.mocked(fetchHappyHourTokens).mockImplementation(() => new Promise(() => {}));
  const load = vi.fn<typeof loadDataset>().mockResolvedValue(demoDataset());
  const view = setup(load);

  act(() => view.result.current.connect(options));
  await waitFor(() => expect(view.result.current.data).not.toBeNull());
  expect(view.result.current.busy).toBe(false);
  expect(view.result.current.happyHourTokens).toBeNull();
  expect(view.result.current.happyHourTokensLoading).toBe(true);
  act(() => view.result.current.changeRange('2026-11-01', options.to));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  expect(fetchHappyHourTokens).toHaveBeenCalledTimes(1);
  const tokenRequest = vi.mocked(fetchHappyHourTokens).mock.calls[0][0];
  act(() => view.result.current.reset(true));
  expect(tokenRequest.signal.aborted).toBe(true);
  expect(view.result.current.happyHourTokens).toBeNull();
  view.unmount();
  view.client.clear();
});

it('discards a late token response after switching accounts', async () => {
  let finish: (balance: number) => void = () => {
    throw new Error('Expected token request');
  };
  vi.mocked(fetchHappyHourTokens)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(2);
  const view = setup(vi.fn<typeof loadDataset>().mockResolvedValue(demoDataset()));
  act(() => view.result.current.connect(options));
  await waitFor(() => expect(fetchHappyHourTokens).toHaveBeenCalledTimes(1));
  const firstSignal = vi.mocked(fetchHappyHourTokens).mock.calls[0][0].signal;
  act(() => view.result.current.connect({ ...options, account: 'A-OTHER' }));
  await waitFor(() => expect(view.result.current.happyHourTokens).toBe(2));
  expect(firstSignal.aborted).toBe(true);
  await act(async () => finish(99));
  expect(view.result.current.happyHourTokens).toBe(2);
  act(() => view.result.current.reset(true));
  expect(view.result.current.happyHourTokens).toBeNull();
  view.unmount();
  view.client.clear();
});

it('refreshes tokens independently and replaces a failed balance with a valid zero', async () => {
  const view = setup(vi.fn<typeof loadDataset>().mockResolvedValue(demoDataset()));
  act(() => view.result.current.connect(options));
  await waitFor(() => expect(view.result.current.happyHourTokens).toBe(3));
  vi.mocked(fetchHappyHourTokens).mockRejectedValueOnce(new Error('Unavailable'));
  act(() => view.result.current.connect(options));
  await waitFor(() => expect(view.result.current.happyHourTokens).toBeNull());
  expect(view.result.current.data).not.toBeNull();
  expect(view.result.current.error).toBe('');
  vi.mocked(fetchHappyHourTokens).mockResolvedValueOnce(0);
  act(() => view.result.current.connect(options));
  await waitFor(() => expect(view.result.current.happyHourTokens).toBe(0));
  view.unmount();
  view.client.clear();
});

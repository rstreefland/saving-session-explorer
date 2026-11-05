import { expect, it, vi } from 'vitest';
import { MeterDiscoveryCache } from './meterDiscovery';
const signal = () => new AbortController().signal;
it('expires discovery after five minutes and invalidates on meter list or MPAN changes', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(0);
  const cache = new MeterDiscoveryCache();
  const discover = vi.fn().mockResolvedValue('NEW');
  await cache.select('123', ['OLD', 'NEW'], signal(), discover);
  await cache.select('123', ['NEW', 'OLD', 'OLD'], signal(), discover);
  expect(discover).toHaveBeenCalledTimes(1);
  now.mockReturnValue(300_000);
  await cache.select('123', ['OLD', 'NEW'], signal(), discover);
  await cache.select('123', ['OLD', 'NEW', 'NEWER'], signal(), discover);
  await cache.select('456', ['OLD', 'NEW'], signal(), discover);
  expect(discover).toHaveBeenCalledTimes(4);
});
it('does not cache failures or completions after cancellation', async () => {
  const cache = new MeterDiscoveryCache();
  const discover = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('NEW');
  await expect(cache.select('123', ['OLD', 'NEW'], signal(), discover)).rejects.toThrow('offline');
  const controller = new AbortController();
  const delayed = () =>
    new Promise<string>((resolve) => {
      controller.abort();
      resolve('OLD');
    });
  await expect(cache.select('123', ['OLD', 'NEW'], controller.signal, delayed)).rejects.toThrow();
  expect(await cache.select('123', ['OLD', 'NEW'], signal(), discover)).toBe('NEW');
  expect(discover).toHaveBeenCalledTimes(2);
});
it('keeps simultaneous requests independently cancellable', async () => {
  const cache = new MeterDiscoveryCache();
  const first = new AbortController();
  let finish!: (serial: string) => void;
  const stale = cache.select(
    '123',
    ['OLD', 'NEW'],
    first.signal,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  first.abort();
  expect(await cache.select('123', ['OLD', 'NEW'], signal(), async () => 'NEW')).toBe('NEW');
  finish('OLD');
  await expect(stale).rejects.toThrow();
  expect(await cache.select('123', ['OLD', 'NEW'], signal(), async () => 'WRONG')).toBe('NEW');
});

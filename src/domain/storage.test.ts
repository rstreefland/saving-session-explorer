import { it, expect, vi } from 'vitest';
import { readKey, saveKey, forgetAccount } from './storage';

it('handles blocked storage reads and removal', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error();
  });
  expect(readKey()).toBe('');
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error();
  });
  expect(() => saveKey('')).toThrow('storage');
});

it('attempts to remove both saved fields when the first removal fails', () => {
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
    throw Error();
  });
  expect(forgetAccount).toThrow('saved details could not be removed');
  expect(remove.mock.calls).toEqual([['session-lens.api-key'], ['session-lens.account-number']]);
});

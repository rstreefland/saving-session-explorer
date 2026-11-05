import { it, expect, vi } from 'vitest';
import { readKey, saveKey } from './storage';

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

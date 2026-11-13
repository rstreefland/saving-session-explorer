import { expect, it, vi } from 'vitest';
import { fetchHappyHourTokens } from './happyHourTokens';
import { GRAPHQL } from './transport';

it.each([0, 1, 1234])(
  'validates a token balance of %s and passes authentication and cancellation',
  async (tokenBalance) => {
    const signal = new AbortController().signal;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ data: { savingSessions: { account: { tokenBalance } } } }),
        ),
    );

    expect(await fetchHappyHourTokens({ account: 'A-TEST', token: 'test-token', signal })).toBe(
      tokenBalance,
    );
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(GRAPHQL);
    expect(init?.signal).toBe(signal);
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'test-token',
    });
    const request = JSON.parse(String(init?.body));
    expect(request.variables).toEqual({ account: 'A-TEST' });
    expect(request.query).toContain('tokenBalance');
  },
);

it.each([null, undefined, -1, 1.5, '3', true, 9007199254740992])(
  'rejects an invalid token balance: %s',
  async (tokenBalance) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ data: { savingSessions: { account: { tokenBalance } } } }),
        ),
    );

    await expect(
      fetchHappyHourTokens({
        account: 'A-TEST',
        token: 'test-token',
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  },
);

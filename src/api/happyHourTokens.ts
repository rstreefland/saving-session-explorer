import { z } from 'zod';
import { AUTH, GRAPHQL, graphql } from './transport';

z.config({ jitless: true });

export async function fetchHappyHourTokens({
  account,
  key,
  signal,
}: {
  account: string;
  key: string;
  signal: AbortSignal;
}): Promise<number> {
  const auth = z
    .object({ obtainKrakenToken: z.object({ token: z.string() }) })
    .parse(
      await graphql(
        AUTH,
        'mutation Token($key: String!) { obtainKrakenToken(input: { APIKey: $key }) { token } }',
        { key },
        signal,
      ),
    );

  const data = z
    .object({
      savingSessions: z.object({
        account: z.object({ tokenBalance: z.number().int().nonnegative().safe() }),
      }),
    })
    .parse(
      await graphql(
        GRAPHQL,
        `
          query HappyHourTokens($account: String!) {
            savingSessions {
              account(accountNumber: $account) {
                tokenBalance
              }
            }
          }
        `,
        { account },
        signal,
        auth.obtainKrakenToken.token,
      ),
    );

  return data.savingSessions.account.tokenBalance;
}

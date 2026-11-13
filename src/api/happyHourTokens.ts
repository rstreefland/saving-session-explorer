import { z } from 'zod';
import { GRAPHQL, graphql } from './transport';

z.config({ jitless: true });

export async function fetchHappyHourTokens({
  account,
  token,
  signal,
}: {
  account: string;
  token: string;
  signal: AbortSignal;
}): Promise<number> {
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
        token,
      ),
    );

  return data.savingSessions.account.tokenBalance;
}

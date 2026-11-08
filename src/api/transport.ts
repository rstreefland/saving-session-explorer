import { z } from 'zod';
z.config({ jitless: true });
export const GRAPHQL = 'https://api.backend.octopus.energy/v1/graphql/';
export const AUTH = 'https://api.oegb-kraken.energy/v1/graphql/';

export async function json(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, { ...init, signal });
  } catch (e) {
    if (signal.aborted) throw e;

    throw new Error(
      'Could not reach Octopus or GOV.UK. Check your connection; browser CORS restrictions may also block access.',
    );
  }

  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Octopus rejected these credentials. Check your API key and account number.'
        : response.status === 429
          ? 'Octopus rate limit reached. Please wait before refreshing.'
          : `Service returned HTTP ${response.status}. Please try again.`,
    );

  return response.json();
}

export async function graphql(
  url: string,
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
  token?: string,
) {
  const raw = await json(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: JSON.stringify({ query, variables }),
    },
    signal,
  );

  const envelope = z
    .object({ data: z.unknown().optional(), errors: z.array(z.unknown()).optional() })
    .parse(raw);

  // Never echo upstream error messages: these can contain personal data or credentials.
  if (envelope.errors?.length || !envelope.data)
    throw new Error(
      'Octopus could not complete the query. Check credentials and account access; its API may have changed.',
    );

  return envelope.data;
}

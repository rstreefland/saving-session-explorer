import { decimal } from '../domain/decimal';
import { useRef, useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadDataset, type LoadOptions } from '../api/client';

interface Request {
  options: LoadOptions;
  scope: number;
}

const queryKey = (request: Request | null) =>
  request
    ? ['sessions', request.scope, request.options.region, request.options.from, request.options.to]
    : ['sessions', 'idle'];

/** Credentials live in closures, never query keys or persisted caches. */
export function useSessionData(
  load: typeof loadDataset = loadDataset,
  initialOptions: () => LoadOptions | null = () => null,
) {
  const client = useQueryClient();

  const [request, setRequest] = useState<Request | null>(() => {
    const options = initialOptions();

    return options ? { options, scope: 1 } : null;
  });

  const identity = useRef<{ key: string; account: string; scope: number } | null>(
    request ? { key: request.options.key, account: request.options.account, scope: 1 } : null,
  );

  const nextScope = useRef(request ? 1 : 0);

  const query = useQuery({
    queryKey: queryKey(request),
    enabled: request !== null,
    queryFn: request ? ({ signal }) => load(request.options, signal) : skipToken,
  });

  function reset(forget = false) {
    void client.cancelQueries({ queryKey: ['sessions'] });
    setRequest(null);

    if (forget) {
      client.clear();
      identity.current = null;
    }
  }

  function connect(options: LoadOptions) {
    let current = identity.current;

    if (!current || current.key !== options.key || current.account !== options.account) {
      client.clear();
      current = {
        key: options.key,
        account: options.account,
        scope: (nextScope.current = decimal(nextScope.current).plus(1).toNumber()),
      };
    }

    identity.current = current;
    const next = { options, scope: current.scope };

    if (JSON.stringify(queryKey(next)) === JSON.stringify(queryKey(request))) {
      void query.refetch();
    } else {
      setRequest(next);
    }
  }

  function changeRange(from: string, to: string) {
    if (request) setRequest({ ...request, options: { ...request.options, from, to } });
  }

  return {
    changeRange,
    data: request ? (query.data ?? null) : null,
    busy: request !== null && query.isFetching,
    error: request && query.error ? query.error.message : '',
    connect,
    reset,
  };
}

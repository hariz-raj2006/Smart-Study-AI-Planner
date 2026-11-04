console.log('[useFetch] MODULE LOADED');
import { useCallback, useEffect, useState } from 'react';

export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState((s) => ({
      ...s,
      loading: true,
      error: null,
    }));

    fetcher(controller.signal)
      .then((data) => {
        if (active) {
          console.log('[useFetch] RESOLVED:', data);
          setState({
            data,
            loading: false,
            error: null,
          });
        }
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return;

        console.error('[useFetch] ERROR:', error);
        console.log('[useFetch] START');
        setState((s) => ({
          ...s,
          loading: false,
          error,
        }));
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(
    () => setTick((t) => t + 1),
    [],
  );

  const setData = useCallback(
    (updater) =>
      setState((s) => ({
        ...s,
        data:
          typeof updater === 'function'
            ? updater(s.data)
            : updater,
      })),
    [],
  );

  return {
    ...state,
    reload,
    setData,
  };
}

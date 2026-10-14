import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data when the screen opens (and again when `deps` change or reload() is called).
 *   const { data, loading, error, reload, setData } = useFetch((signal) => subjectsApi.list({ signal }), []);
 * Requests are cancelled when the component unmounts, so stale answers never overwrite new ones.
 */
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!active || (error && error.name === 'AbortError')) return;
        setState((s) => ({ ...s, loading: false, error }));
      });
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback(
    (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })),
    []
  );
  return { ...state, reload, setData };
}
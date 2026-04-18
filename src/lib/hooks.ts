import { useEffect, useState, useCallback } from "react";
import { eventBus } from "./events";

/** Subscribe to mock-store changes — re-runs the selector on every emit. */
export function useStore<T>(selector: () => T): T {
  const [v, setV] = useState<T>(selector);
  const refresh = useCallback(() => setV(selector()), [selector]);
  useEffect(() => {
    const unsub = eventBus.subscribe(refresh);
    return () => {
      unsub();
    };
  }, [refresh]);
  return v;
}

/** Re-renders every `ms` ms — used for live countdowns. */
export function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

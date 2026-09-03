import { useCallback, useSyncExternalStore } from "react";

/**
 * True while the viewport is narrower than `px`.
 *
 * Lives here because three call sites now ask the same question — the plaza
 * header, the composer, and the wall — and the answer has to be the same one.
 * Two copies were still cheap to keep in step; three is where they start
 * drifting, and a header that reflows on one rule while the wall below it
 * reflows on a slightly different one is visible in a single glance.
 *
 * `useSyncExternalStore` rather than useState plus an effect: it is React 18's
 * own subscription primitive, so there is no effect setting state on mount and
 * no window between the first paint and the listener attaching. The third
 * argument is the server snapshot — `false`, the desktop layout — because
 * nothing here is server-rendered and the question cannot be answered without
 * a window.
 */
export const useNarrowerThan = (px) => {
  const query = `(max-width: ${px - 1}px)`;

  const subscribe = useCallback(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
};

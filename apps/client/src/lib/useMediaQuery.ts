import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a media query and re-renders when its answer changes.
 *
 * Lives here because four call sites now ask one of these — the plaza header,
 * the composer, the presence strip and the wall — and they have to agree. Two
 * copies were still cheap to keep in step; more than that is where they drift,
 * and a header that reflows on one rule while the wall below it reflows on a
 * slightly different one is visible in a single glance.
 *
 * `useSyncExternalStore` rather than useState plus an effect: it is React 18’s
 * own subscription primitive, so there is no effect setting state on mount and
 * no window between the first paint and the listener attaching. The third
 * argument is the server snapshot — `false` — because nothing here is
 * server-rendered and neither question can be answered without a window.
 */
const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
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

/**
 * True while the viewport is narrower than `px`.
 */
export const useNarrowerThan = (px: number): boolean =>
  useMediaQuery(`(max-width: ${px - 1}px)`);

/**
 * True while the reader is in Slate Night.
 *
 * Needed because two of the palette's surfaces do NOT move together: a notice
 * stays light paper in both themes, but the paved ground flips from pale
 * bluestone to dark slate. Anything drawn ON the ground — the presence strip is
 * the only one today — has to know which of the two it is standing on, and
 * `avatarColor`'s `ground` argument names the surface rather than the theme.
 * There is no CSS-only answer: the choice is a value passed to a function, not
 * a declaration a media query could override.
 */
export const usePrefersDark = (): boolean =>
  useMediaQuery("(prefers-color-scheme: dark)");

import { QueryClient } from "@tanstack/react-query";

/**
 * The hand-rolled fetch effects this client is replacing never retried a
 * failed request and never refetched on window focus. TanStack Query's own
 * defaults do both (3 retries with backoff; refetch when the tab regains
 * focus), so leaving them on would add two user-observable behaviors —
 * delayed error surfacing and silent background refetches — that the app
 * never had. Both are turned off here so this refactor changes how data is
 * fetched, not what the user sees.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

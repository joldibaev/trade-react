import { QueryClient } from "@tanstack/react-query"

import { isApiError } from "./errors"

/** Repeats only what may pass on a second try: no network, a server failure. A 4xx answer stays the same. */
function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 2 || !isApiError(error)) return false
  return (
    error.code === "NETWORK_ERROR" ||
    (error.status >= 500 && error.code !== "INTERNAL_SERVER_ERROR")
  )
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      // A write is never repeated on its own: a repeat may cost money or stock (TradeNet ADR-0011).
      mutations: { retry: false },
    },
  })
}

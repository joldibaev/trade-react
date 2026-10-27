import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { isApiError } from "@/api/errors"
import type { components } from "@/api/schema"

export type Me = components["schemas"]["MeResponse"]
export type LoginRequest = components["schemas"]["LoginRequest"]

/**
 * Who is signed in, or null. The session lives in an HttpOnly cookie that scripts never see (TradeNet
 * authentication.md); this read is how the app learns it. A 401 here is "not signed in", not an error.
 */
export const meQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await unwrap(api.GET("/api/auth/me"))
    } catch (error) {
      if (isApiError(error) && error.status === 401) return null
      throw error
    }
  },
  // Changes only by signing in or out, or by a 401 from any request (main.tsx).
  staleTime: "static",
})

export async function signIn(queryClient: QueryClient, body: LoginRequest) {
  const me = await unwrap(api.POST("/api/auth/login", { body }))
  // Nothing of a previous person may stay on screen.
  queryClient.removeQueries()
  queryClient.setQueryData(meQuery.queryKey, me)
}

export async function signOut(queryClient: QueryClient) {
  await unwrap(api.DELETE("/api/auth/sessions/current"))
  queryClient.removeQueries()
  queryClient.setQueryData(meQuery.queryKey, null)
}

/** Only a path of this app: `?redirect=https://evil.example` must not send anyone away after sign-in. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : undefined
}

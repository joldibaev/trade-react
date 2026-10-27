import createClient, { type Middleware } from "openapi-fetch"

import { ApiError, toApiError } from "./errors"
import type { paths } from "./schema"

/**
 * The one way to call TradeNet: paths, parameters and bodies are typed from its OpenAPI document
 * (`npm run api` regenerates schema.d.ts). Same origin: in development Vite forwards /api to the API.
 */
export const api = createClient<paths>({ baseUrl: "" })

let onUnauthenticated: (() => void) | null = null
let onForbidden: (() => void) | null = null

/** Registered once by the app (main.tsx): what to do when the session ended in the middle of work. */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler
}

/** Registered once by the app (main.tsx): what to do when a permission the screen counted on is gone. */
export function setForbiddenHandler(handler: () => void) {
  onForbidden = handler
}

const sessionChecks = new Set(["/api/auth/login", "/api/auth/me"])

const sessionEnded: Middleware = {
  async onResponse({ response, schemaPath }) {
    // A 401 at sign-in is a wrong password to show, and at /me it means "not signed in yet": neither ended a session.
    if (response.status === 401 && !sessionChecks.has(schemaPath))
      onUnauthenticated?.()
    // A plain FORBIDDEN means the group lost a permission since the menu was drawn (business 403s such as
    // ALL_STORES_REQUIRED have their own codes). The app reads the permissions again and hides what is gone.
    if (response.status === 403) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null)
      if (
        typeof body === "object" &&
        body !== null &&
        "code" in body &&
        body.code === "FORBIDDEN"
      )
        onForbidden?.()
    }
  },
  onError() {
    // fetch itself failed: no network, or the dev proxy found no API.
    return new ApiError(0, "NETWORK_ERROR")
  },
}
api.use(sessionEnded)

/**
 * The body of a successful answer, or an `ApiError` thrown for TanStack Query to hold.
 * A 204 has no body: its `T` is `never` in the schema, and the value is undefined.
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>
): Promise<T> {
  const result = await call
  if (!result.response.ok) throw toApiError(result.response, result.error)
  return result.data as T
}

import type { components } from "./schema"

export type Problem = components["schemas"]["ProblemDetails"]
export type ProblemCode = components["schemas"]["ProblemCode"]
/** What is wrong with one field, as TradeNet says it. */
export type ServerFieldCode = components["schemas"]["FieldCode"]
/** Field codes the client gives itself, for what only the screen can check (a password typed twice). */
export type ClientFieldCode = "PASSWORDS_DIFFER" | "BARCODE_TAKEN"
/** Every code a field may show: each catalog has one text per code (src/i18n). */
export type FieldCode = ServerFieldCode | ClientFieldCode

/** Codes the client gives itself when there is no problem body to read. */
export type ClientErrorCode = "NETWORK_ERROR" | "UNEXPECTED_RESPONSE"

/** Every code the screen may have to translate: each catalog has one text per code (src/i18n). */
export type ErrorCode = ProblemCode | ClientErrorCode

/**
 * A failed API call. The screen branches on `code` and shows the catalog's text for it, never `problem.title`
 * (TradeNet ADR-0004: the API has no translations). `problem` is the RFC 9457 body when the API sent one.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly problem: Problem | null
  /** Seconds to wait before a retry, from `Retry-After` (429, 503). */
  readonly retryAfter: number | null

  constructor(
    status: number,
    code: ErrorCode,
    problem: Problem | null = null,
    retryAfter: number | null = null
  ) {
    super(problem ? `${code}: ${problem.title}` : code)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.problem = problem
    this.retryAfter = retryAfter
  }

  /** Field (its JSON name) to its codes, from a 400 `VALIDATION_ERROR`. */
  get fieldErrors(): Record<string, ServerFieldCode[]> {
    return this.problem?.errors ?? {}
  }
}

function isProblem(body: unknown): body is Problem {
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
  )
}

export function toApiError(response: Response, body: unknown): ApiError {
  const retryAfter = response.headers.get("Retry-After")
  const seconds =
    retryAfter !== null && /^\d+$/.test(retryAfter)
      ? // eslint-disable-next-line no-restricted-syntax -- Retry-After is a count of seconds, not money.
        Number.parseInt(retryAfter, 10)
      : null
  if (isProblem(body))
    return new ApiError(response.status, body.code, body, seconds)
  // No problem body: the proxy answered for the API (Caddy, or Vite in development) because the API is stopped or
  // restarting. For the person that is "the server is unavailable", not a strange answer.
  const code = gatewayStatuses.has(response.status)
    ? "SERVICE_UNAVAILABLE"
    : "UNEXPECTED_RESPONSE"
  return new ApiError(response.status, code, null, seconds)
}

const gatewayStatuses = new Set([502, 503, 504])

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * What some codes carry besides the problem itself; the OpenAPI document declares each response as
 * `allOf: [ProblemDetails, X]`.
 */
type ProblemExtensions = {
  PRICES_CHANGED: components["schemas"]["PriceConflicts"]
  PRICES_CHANGED_LATER: components["schemas"]["PriceConflicts"]
  BARCODE_TAKEN: components["schemas"]["TakenBarcode"]
}

/**
 * The problem with its extensions when the error has this code, else null. The extension members are optional in
 * the contract, so a problem body without them still fits; the code is what promises which ones may be there.
 */
export function problemWith<C extends keyof ProblemExtensions>(
  error: unknown,
  code: C
): (Problem & ProblemExtensions[C]) | null {
  return isApiError(error) && error.code === code && error.problem
    ? error.problem
    : null
}

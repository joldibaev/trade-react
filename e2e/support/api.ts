import type { Page, Route } from "@playwright/test"

import type { components } from "../../src/api/schema"

type Me = components["schemas"]["MeResponse"]
type Product = components["schemas"]["ProductListItem"]
type ProblemCode = components["schemas"]["ProblemCode"]

export const admin: Me = {
  id: "00000000-0000-7000-8000-000000000001",
  login: "admin",
  fullName: "Азиз Каримов",
  phone: "+998901234567",
  group: { id: "00000000-0000-7000-8000-000000000002", name: "ADMIN" },
  permissions: [
    "USERS_MANAGE",
    "STORES_MANAGE",
    "CATALOG_MANAGE",
    "PRICES_MANAGE",
  ],
  stores: { all: true, storeIds: [] },
  version: 1,
}

export function problem(route: Route, status: number, code: ProblemCode) {
  return route.fulfill({
    status,
    contentType: "application/problem+json",
    json: { title: code, status, code, traceId: "00-e2e-trace-01" },
  })
}

/**
 * The browser's session as TradeNet would report it: signed in as `me`, or not (401).
 *
 * It also answers every /api request no test mocked with a 404, so a test never reaches a real API through the
 * dev proxy (the owner's TradeNet may be running on 5129). Routes added later take precedence over this one.
 */
export async function mockSession(page: Page, me: Me | null) {
  // Anchored at the path's start: the app's own modules live under /src/api/ and must load.
  await page.route(/^https?:\/\/[^/]+\/api\//, (route) =>
    problem(route, 404, "ROUTE_NOT_FOUND")
  )
  await page.route("**/api/auth/me", (route) =>
    me ? route.fulfill({ json: me }) : problem(route, 401, "UNAUTHENTICATED")
  )
}

export function product(index: number): Product {
  return {
    id: `00000000-0000-7000-8000-${String(index).padStart(12, "0")}`,
    code: 10000 + index,
    name: `Товар ${index}`,
    categoryId: null,
    isActive: index % 10 !== 0,
    barcode: `478${String(index).padStart(10, "0")}`,
    version: 1,
  }
}

type ProductsMock = {
  total: number
  /** Answers this page (0-based) with an error once instead of rows. */
  failPage?: { page: number; status: number; code: ProblemCode }
}

/**
 * GET /api/products over `total` generated products, in cursor pages of the requested `limit`, like TradeNet:
 * a search answers one page with `nextCursor: null`. Returns the requests seen, for assertions.
 */
export async function mockProducts(
  page: Page,
  { total, failPage }: ProductsMock
) {
  const requests: URL[] = []
  let failed = false
  await page.route("**/api/products?**", async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const limit = Number(url.searchParams.get("limit") ?? "50")
    const search = url.searchParams.get("search")
    if (search) {
      const items = Array.from({ length: total }, (_, i) => product(i + 1))
        .filter((p) => p.name.includes(search))
        .slice(0, limit)
      return route.fulfill({ json: { items, nextCursor: null } })
    }
    const offset = Number(url.searchParams.get("cursor") ?? "0")
    if (failPage && !failed && offset === failPage.page * limit) {
      failed = true
      return problem(route, failPage.status, failPage.code)
    }
    const end = Math.min(offset + limit, total)
    const items = Array.from({ length: end - offset }, (_, i) =>
      product(offset + i + 1)
    )
    return route.fulfill({
      json: { items, nextCursor: end < total ? String(end) : null },
    })
  })
  return requests
}

/** A store manager bound to one store: stores, catalog and prices, no people. */
export const manager: Me = {
  ...admin,
  id: "00000000-0000-7000-8000-000000000011",
  login: "manager",
  fullName: "Дилноза Юсупова",
  group: { id: "00000000-0000-7000-8000-000000000012", name: "Менеджеры" },
  permissions: ["STORES_MANAGE", "CATALOG_MANAGE", "PRICES_MANAGE"],
  stores: { all: false, storeIds: ["00000000-0000-7000-8000-000000001003"] },
}

/** A cashier: signed in, no permissions. */
export const cashier: Me = {
  ...admin,
  id: "00000000-0000-7000-8000-000000000021",
  login: "cashier",
  fullName: "Шахло Рахимова",
  group: { id: "00000000-0000-7000-8000-000000000022", name: "Кассиры" },
  permissions: [],
  stores: { all: false, storeIds: [] },
}

export const uuid = (n: number) =>
  `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`

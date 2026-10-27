import type { Page, Route } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { problem, uuid } from "./api"

type Store = components["schemas"]["StoreResponse"]

export function store(
  n: number,
  name: string,
  cashboxes: string[] = []
): Store {
  const id = uuid(1000 + n)
  return {
    id,
    name,
    address: `Ташкент, ${name}`,
    phone: null,
    isActive: true,
    version: 1,
    cashboxes: cashboxes.map((cashbox, i) => ({
      id: uuid(2000 + n * 10 + i),
      storeId: id,
      name: cashbox,
      isActive: true,
      version: 1,
    })),
  }
}

/**
 * The stores API over an in-memory list, with TradeNet's rules that a screen must handle: versions (409
 * VERSION_CONFLICT), names unique regardless of case (409), cashboxes inside the store's answer.
 */
export async function mockStores(page: Page, stores: Store[]) {
  let nextId = 9000
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, json: body })
  const bump = (s: { version: number }) => (s.version += 1)

  await page.route(/\/api\/(stores|cashboxes)(\/|\?|$)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const parts = url.pathname.split("/").filter(Boolean) // api, stores, id, cashboxes
    const body = request.postDataJSON() as {
      name?: string
      version?: number
      isActive?: boolean
    } | null
    const method = request.method()

    if (parts[1] === "cashboxes") {
      const owner = stores.find((s) =>
        s.cashboxes.some((c) => c.id === parts[2])
      )
      const cashbox = owner?.cashboxes.find((c) => c.id === parts[2])
      if (!owner || !cashbox) return problem(route, 404, "CASHBOX_NOT_FOUND")
      if (body?.version !== cashbox.version)
        return problem(route, 409, "VERSION_CONFLICT")
      Object.assign(cashbox, { ...body, version: cashbox.version })
      bump(cashbox)
      bump(owner)
      return json(route, cashbox)
    }

    const target = stores.find((s) => s.id === parts[2])
    if (parts[3] === "cashboxes" && method === "POST") {
      if (!target) return problem(route, 404, "STORE_NOT_FOUND")
      const name = body?.name ?? ""
      if (
        target.cashboxes.some(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        )
      )
        return problem(route, 409, "CASHBOX_NAME_TAKEN")
      const cashbox = {
        id: uuid(nextId++),
        storeId: target.id,
        name,
        isActive: true,
        version: 1,
      }
      target.cashboxes.push(cashbox)
      bump(target)
      return json(route, cashbox, 201)
    }
    if (parts[2] === undefined && method === "GET") {
      const active = url.searchParams.get("isActive")
      return json(route, {
        items: stores.filter(
          (s) => active === null || String(s.isActive) === active
        ),
        nextCursor: null,
      })
    }
    if (parts[2] === undefined && method === "POST") {
      const name = body?.name ?? ""
      if (!name)
        return route.fulfill({
          status: 400,
          json: {
            title: "x",
            status: 400,
            code: "VALIDATION_ERROR",
            traceId: "t",
            errors: { name: ["REQUIRED"] },
          },
        })
      const created: Store = { ...store(nextId++, name), ...body, version: 1 }
      stores.push(created)
      return json(route, created, 201)
    }
    if (!target) return problem(route, 404, "STORE_NOT_FOUND")
    if (method === "GET") return json(route, target)
    if (body?.version !== target.version)
      return problem(route, 409, "VERSION_CONFLICT")
    Object.assign(target, { ...body, version: target.version })
    bump(target)
    return json(route, target)
  })
  return stores
}

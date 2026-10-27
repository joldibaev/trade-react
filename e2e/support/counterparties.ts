import type { Page } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { problem, uuid } from "./api"

type Counterparty = components["schemas"]["CounterpartyResponse"]
type Request = Partial<Counterparty> & {
  version?: number
  priceType?: { id: string | null }
}

export function counterparty(
  n: number,
  name: string,
  details: Partial<Counterparty> = {}
): Counterparty {
  return {
    id: uuid(6000 + n),
    name,
    isSupplier: false,
    isCustomer: true,
    priceTypeId: null,
    phone: null,
    taxId: null,
    address: null,
    note: null,
    isActive: true,
    version: 1,
    ...details,
  }
}

/**
 * The counterparties API over an in-memory list, with the TradeNet rules a screen must handle: at least one role
 * (400 VALIDATION_ERROR on `isCustomer`), a tax id of 9 or 14 digits (400 on `taxId`), names unique regardless of
 * case (409), a tax id unique (409 naming its holder), versions (409 VERSION_CONFLICT). A search answers one page by name, phone or tax id. Returns the
 * requests sent: the list's query strings and every write with its body.
 */
export async function mockCounterparties(page: Page, list: Counterparty[]) {
  const writes: { method: string; path: string; body: unknown }[] = []
  const queries: URLSearchParams[] = []
  let nextId = 6900

  const invalid = (body: Request) => {
    const errors: Record<string, string[]> = {}
    if (body.isSupplier === false && body.isCustomer === false)
      errors.isCustomer = ["REQUIRED"]
    if (body.taxId && !/^(\d{9}|\d{14})$/.test(body.taxId))
      errors.taxId = ["INVALID_FORMAT"]
    return Object.keys(errors).length > 0 ? errors : null
  }
  const nameTaken = (name: string | undefined, except?: string) =>
    name !== undefined &&
    list.some(
      (c) => c.id !== except && c.name.toLowerCase() === name.toLowerCase()
    )

  /** 409 COUNTERPARTY_TAX_ID_TAKEN naming the holder, as TradeNet answers; null when the tax id is free. */
  const taxIdTaken = (taxId: string | null | undefined, except?: string) => {
    const holder = taxId
      ? list.find((c) => c.id !== except && c.taxId === taxId)
      : undefined
    return holder
      ? {
          status: 409,
          contentType: "application/problem+json",
          json: {
            title: "x",
            status: 409,
            code: "COUNTERPARTY_TAX_ID_TAKEN",
            traceId: "t",
            taxId,
            counterparty: { id: holder.id, name: holder.name },
          },
        }
      : null
  }

  await page.route(/\/api\/counterparties(\/[^?]*)?(\?.*)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const id = url.pathname.split("/")[3]
    const method = request.method()
    const body = (request.postDataJSON() ?? {}) as Request
    if (method !== "GET")
      writes.push({ method, path: url.pathname + url.search, body })

    if (!id && method === "GET") {
      queries.push(url.searchParams)
      const search = url.searchParams.get("search")?.toLowerCase()
      const role = url.searchParams.get("role")
      const isActive = url.searchParams.get("isActive")
      const items = list
        .filter((c) => role !== "SUPPLIER" || c.isSupplier)
        .filter((c) => role !== "CUSTOMER" || c.isCustomer)
        .filter((c) => isActive === null || String(c.isActive) === isActive)
        .filter(
          (c) =>
            !search ||
            c.name.toLowerCase().includes(search) ||
            (c.phone ?? "").includes(search) ||
            c.taxId === search
        )
        .sort((a, b) => a.name.localeCompare(b.name))
      return route.fulfill({ json: { items, nextCursor: null } })
    }
    if (!id) {
      const errors = invalid(body)
      if (errors)
        return route.fulfill({
          status: 400,
          contentType: "application/problem+json",
          json: {
            title: "x",
            status: 400,
            code: "VALIDATION_ERROR",
            traceId: "t",
            errors,
          },
        })
      if (nameTaken(body.name))
        return problem(route, 409, "COUNTERPARTY_NAME_TAKEN")
      const taken = taxIdTaken(body.taxId)
      if (taken) return route.fulfill(taken)
      const created = counterparty(++nextId, body.name ?? "", {
        ...body,
        version: 1,
      })
      list.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    const target = list.find((c) => c.id === id)
    if (!target) return problem(route, 404, "COUNTERPARTY_NOT_FOUND")
    if (method === "GET") return route.fulfill({ json: target })
    const version =
      method === "DELETE" ? url.searchParams.get("version") : body.version
    if (String(version) !== String(target.version))
      return problem(route, 409, "VERSION_CONFLICT")
    if (method === "DELETE") {
      list.splice(list.indexOf(target), 1)
      return route.fulfill({ status: 204 })
    }
    if (nameTaken(body.name, target.id))
      return problem(route, 409, "COUNTERPARTY_NAME_TAKEN")
    const taken = taxIdTaken(body.taxId, target.id)
    if (taken) return route.fulfill(taken)
    const { priceType, ...fields } = body
    const merged = {
      ...target,
      ...fields,
      ...(priceType && { priceTypeId: priceType.id }),
    }
    // "" removes an optional text.
    for (const key of ["phone", "taxId", "address", "note"] as const)
      if (merged[key] === "") merged[key] = null
    const errors = invalid(merged)
    if (errors)
      return route.fulfill({
        status: 400,
        contentType: "application/problem+json",
        json: {
          title: "x",
          status: 400,
          code: "VALIDATION_ERROR",
          traceId: "t",
          errors,
        },
      })
    Object.assign(target, merged, { version: target.version + 1 })
    return route.fulfill({ json: target })
  })
  return { writes, queries }
}

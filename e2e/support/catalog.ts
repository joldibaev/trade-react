import type { Page } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { problem, uuid } from "./api"

type Category = components["schemas"]["CategoryResponse"]
type Product = components["schemas"]["ProductResponse"]

export function category(
  n: number,
  name: string,
  parentId: string | null = null
): Category {
  return { id: uuid(3000 + n), name, parentId, version: 1 }
}

/** Канцелярия → Тетради, Ручки; Игрушки; Сувениры (empty). */
export function categoryTree(): Category[] {
  const office = category(1, "Канцелярия")
  return [
    office,
    category(2, "Тетради", office.id),
    category(3, "Ручки", office.id),
    category(4, "Игрушки"),
    category(5, "Сувениры"),
  ]
}

/**
 * The categories API over an in-memory list: a category with children or products cannot be deleted (409
 * CATEGORY_NOT_EMPTY), as in TradeNet. `nonEmpty` lists the ids that hold products.
 */
export async function mockCategories(
  page: Page,
  categories: Category[],
  nonEmpty: string[] = []
) {
  const requests: { method: string; body: unknown }[] = []
  let next = 100
  await page.route(/\/api\/categories(\/|\?|$)/, async (route) => {
    const request = route.request()
    const id = new URL(request.url()).pathname.split("/")[3]
    const body = request.postDataJSON() as Record<string, unknown> | null
    requests.push({ method: request.method(), body })
    if (request.method() === "GET")
      return route.fulfill({ json: { items: categories, nextCursor: null } })
    if (request.method() === "POST") {
      const created = category(
        next++,
        typeof body?.name === "string" ? body.name : "",
        typeof body?.parentId === "string" ? body.parentId : null
      )
      categories.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    const target = categories.find((c) => c.id === id)
    if (!target) return problem(route, 404, "CATEGORY_NOT_FOUND")
    if (request.method() === "DELETE") {
      if (
        nonEmpty.includes(target.id) ||
        categories.some((c) => c.parentId === target.id)
      )
        return problem(route, 409, "CATEGORY_NOT_EMPTY")
      categories.splice(categories.indexOf(target), 1)
      return route.fulfill({ status: 204 })
    }
    if (typeof body?.name === "string") target.name = body.name
    target.version += 1
    return route.fulfill({ json: target })
  })
  return requests
}

/** POST, GET and PATCH of one product, kept in memory; returns the bodies sent, for assertions. */
export async function mockProductWrites(
  page: Page,
  existing: Product[] = [],
  /** Barcodes another product already has: a create with one answers 409 BARCODE_TAKEN, saying whose. */
  taken: Record<string, { id: string; code: number; name: string }> = {}
) {
  const bodies: Record<string, unknown>[] = []
  let code = 20000
  await page.route(/\/api\/products(\/[^?]+)?$/, async (route) => {
    const request = route.request()
    const id = new URL(request.url()).pathname.split("/")[3]
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>
      bodies.push(body)
      const clash = ((body.barcodes ?? []) as { value: string }[]).find(
        (b) => b.value in taken
      )
      if (clash)
        return route.fulfill({
          status: 409,
          json: {
            title: "x",
            status: 409,
            code: "BARCODE_TAKEN",
            traceId: "t",
            barcode: clash.value,
            product: taken[clash.value],
          },
        })
      const created = {
        id: uuid(code),
        code: code++,
        name: String(body.name),
        categoryId: (body.categoryId as string | null | undefined) ?? null,
        isActive: true,
        packages: (body.packages ?? []) as Product["packages"],
        barcodes: (body.barcodes ?? []) as Product["barcodes"],
        prices: [],
        version: 1,
      } satisfies Product
      existing.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    const product = existing.find((p) => p.id === id)
    if (!product) return problem(route, 404, "PRODUCT_NOT_FOUND")
    if (request.method() === "GET") return route.fulfill({ json: product })
    const body = request.postDataJSON() as Record<string, unknown>
    bodies.push(body)
    Object.assign(product, body, { version: product.version + 1 })
    return route.fulfill({ json: product })
  })
  return bodies
}

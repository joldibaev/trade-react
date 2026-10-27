import type { Page } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { admin, problem, product, uuid } from "./api"

type PriceType = components["schemas"]["PriceTypeResponse"]
type Revaluation = components["schemas"]["RevaluationResponse"]
type Line = components["schemas"]["RevaluationLineRequest"]

export function priceTypes(): PriceType[] {
  return [
    {
      id: uuid(4001),
      name: "Розница",
      isActive: true,
      isDefault: true,
      version: 1,
    },
    {
      id: uuid(4002),
      name: "Опт",
      isActive: true,
      isDefault: false,
      version: 1,
    },
  ]
}

/** The price types API: PATCH applies the change and keeps exactly one default, as TradeNet does. */
export async function mockPriceTypes(page: Page, types: PriceType[]) {
  const patches: unknown[] = []
  await page.route(/\/api\/price-types(\/[^?]*)?$/, async (route) => {
    const request = route.request()
    if (request.method() === "GET")
      return route.fulfill({ json: { items: types, nextCursor: null } })
    const id = new URL(request.url()).pathname.split("/")[3]
    const body = request.postDataJSON() as Partial<PriceType>
    patches.push(body)
    const target = types.find((t) => t.id === id)
    if (!target) return problem(route, 404, "PRICE_TYPE_NOT_FOUND")
    if (body.isDefault) for (const t of types) t.isDefault = false
    Object.assign(target, body, { version: target.version + 1 })
    return route.fulfill({ json: target })
  })
  return patches
}

type RevaluationsMock = {
  /** The current prices, `${productId}|${typeId}` → price. */
  prices?: Map<string, string>
  /** The first posting answers 409 PRICES_CHANGED for this line, with this current price. */
  changedOnPost?: { productIndex: number; currentPrice: string }
}

/**
 * Revaluations in memory: create, edit, post, refresh. The server fills old prices from the current ones and
 * answers with product codes and names, as TradeNet does. Returns the bodies sent, by path.
 */
export async function mockRevaluations(
  page: Page,
  options: RevaluationsMock = {}
) {
  const prices = options.prices ?? new Map<string, string>()
  const sent: { path: string; body: unknown }[] = []
  const documents = new Map<string, Revaluation>()
  let number = 1
  let conflicted = false

  const withOldPrices = (lines: Line[] = []) =>
    lines.map((line) => {
      const index = Number(line.productId.slice(-12))
      const p = product(index)
      return {
        ...line,
        productCode: p.code,
        productName: p.name,
        oldPrice: prices.get(`${line.productId}|${line.priceTypeId}`) ?? null,
      }
    })

  await page.route(/\/api\/revaluations(\/[^?]*)?(\?.*)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const [, , , id, action] = url.pathname.split("/")
    const body = request.postDataJSON() as {
      comment?: string | null
      lines?: Line[]
      version?: number
    } | null
    if (request.method() !== "GET") sent.push({ path: url.pathname, body })

    if (!id && request.method() === "GET")
      return route.fulfill({
        json: {
          items: [...documents.values()].map((d) => ({
            ...d,
            lineCount: d.lines.length,
          })),
          nextCursor: null,
        },
      })
    if (!id) {
      const created: Revaluation = {
        id: uuid(5000 + number),
        number: number++,
        status: "DRAFT",
        comment: body?.comment ?? null,
        createdAt: "2026-10-27T09:30:00Z",
        createdBy: { id: admin.id, fullName: admin.fullName },
        postedAt: null,
        postedBy: null,
        reversedAt: null,
        reversedBy: null,
        lines: withOldPrices(body?.lines),
        version: 1,
      }
      documents.set(created.id, created)
      return route.fulfill({ status: 201, json: created })
    }
    const document = documents.get(id)
    if (!document) return problem(route, 404, "REVALUATION_NOT_FOUND")
    if (request.method() === "GET") return route.fulfill({ json: document })
    if (body?.version !== undefined && body.version !== document.version)
      return problem(route, 409, "VERSION_CONFLICT")
    document.version += 1
    if (request.method() === "PATCH") {
      document.comment = body?.comment ?? null
      document.lines = withOldPrices(body?.lines)
    } else if (action === "refresh") {
      document.lines = withOldPrices(document.lines)
    } else if (action === "post") {
      const changed = options.changedOnPost
      if (changed && !conflicted) {
        conflicted = true
        const line = document.lines[changed.productIndex]
        if (line)
          prices.set(
            `${line.productId}|${line.priceTypeId}`,
            changed.currentPrice
          )
        document.version -= 1
        return route.fulfill({
          status: 409,
          json: {
            title: "x",
            status: 409,
            code: "PRICES_CHANGED",
            traceId: "t",
            lines: line
              ? [
                  {
                    productId: line.productId,
                    priceTypeId: line.priceTypeId,
                    currentPrice: changed.currentPrice,
                  },
                ]
              : [],
          },
        })
      }
      document.status = "POSTED"
      document.postedAt = "2026-10-27T09:40:00Z"
      document.postedBy = { id: admin.id, fullName: admin.fullName }
    }
    return route.fulfill({ json: document })
  })
  return sent
}

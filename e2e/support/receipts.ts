import type { Page } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { problem, uuid } from "./api"

type Template = components["schemas"]["ReceiptTemplateResponse"]
type Layout = Template["layout"]

export function standardReceiptLayout(paperWidthMm: 58 | 80): Layout {
  return {
    paperWidthMm,
    fontSizePt: 9,
    blocks: [
      {
        type: "STORE",
        name: true,
        address: true,
        phone: true,
        align: "CENTER",
        size: "NORMAL",
      },
      {
        type: "DOCUMENT",
        title: "Товарный чек",
        size: "NORMAL",
        dateTime: true,
        cashbox: true,
      },
      {
        type: "ITEMS",
        layout: "LINES",
        size: "NORMAL",
        nameBold: false,
        lineNumbers: true,
        discounts: true,
      },
      {
        type: "TOTALS",
        subtotal: true,
        discount: true,
        size: "NORMAL",
        totalSize: "LARGE",
      },
      { type: "PAYMENTS", change: true, size: "NORMAL" },
      { type: "BARCODE", digits: true },
      {
        type: "TEXT",
        text: "Спасибо за покупку!",
        align: "CENTER",
        size: "SMALL",
        bold: false,
      },
    ],
  }
}

/** TradeNet's dev seed shape: one template per roll, by name. */
export function receiptTemplates(): Template[] {
  return [
    {
      id: uuid(7001),
      name: "Стандарт 58 мм",
      layout: standardReceiptLayout(58),
      isActive: true,
      version: 1,
    },
    {
      id: uuid(7002),
      name: "Стандарт 80 мм",
      layout: standardReceiptLayout(80),
      isActive: true,
      version: 1,
    },
  ]
}

type Refusal = Record<string, string[]>

/**
 * The receipt templates API in memory: list, read, create, change (with the version check and the unique name,
 * regardless of case), delete. `refuse.next` makes the next write answer 400 with these field codes, as TradeNet does
 * for a layout it does not accept. Returns the bodies written.
 */
export async function mockReceiptTemplates(
  page: Page,
  templates: Template[],
  refuse: { next: Refusal | null } = { next: null }
) {
  const sent: { method: string; body: Record<string, unknown> }[] = []
  let next = 7100
  await page.route(
    /\/api\/receipt-templates(\/[^?]*)?(\?.*)?$/,
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const id = url.pathname.split("/")[3]
      const method = request.method()
      if (method === "GET" && !id)
        return route.fulfill({
          json: {
            items: templates.map((t) => ({
              id: t.id,
              name: t.name,
              paperWidthMm: t.layout.paperWidthMm,
              isActive: t.isActive,
              version: t.version,
            })),
            nextCursor: null,
          },
        })
      const target = templates.find((t) => t.id === id)
      if (method === "GET")
        return target
          ? route.fulfill({ json: target })
          : problem(route, 404, "RECEIPT_TEMPLATE_NOT_FOUND")
      if (method === "DELETE") {
        const version = url.searchParams.get("version")
        sent.push({ method, body: { id, version } })
        if (!target) return problem(route, 404, "RECEIPT_TEMPLATE_NOT_FOUND")
        if (version !== String(target.version))
          return problem(route, 409, "VERSION_CONFLICT")
        templates.splice(templates.indexOf(target), 1)
        return route.fulfill({ status: 204 })
      }
      const body = request.postDataJSON() as Record<string, unknown>
      sent.push({ method, body })
      if (refuse.next) {
        const errors = refuse.next
        refuse.next = null
        return route.fulfill({
          status: 400,
          contentType: "application/problem+json",
          json: {
            title: "x",
            status: 400,
            code: "VALIDATION_ERROR",
            traceId: "00-e2e-trace-01",
            errors,
          },
        })
      }
      const name = typeof body.name === "string" ? body.name : undefined
      if (
        name &&
        templates.some(
          (t) => t.id !== id && t.name.toLowerCase() === name.toLowerCase()
        )
      )
        return problem(route, 409, "RECEIPT_TEMPLATE_NAME_TAKEN")
      if (method === "POST") {
        const created: Template = {
          id: uuid(next++),
          name: name ?? "",
          layout: body.layout as Layout,
          isActive: true,
          version: 1,
        }
        templates.push(created)
        return route.fulfill({ status: 201, json: created })
      }
      if (!target) return problem(route, 404, "RECEIPT_TEMPLATE_NOT_FOUND")
      if (body.version !== target.version)
        return problem(route, 409, "VERSION_CONFLICT")
      Object.assign(target, body, { version: target.version + 1 })
      return route.fulfill({ json: target })
    }
  )
  return sent
}

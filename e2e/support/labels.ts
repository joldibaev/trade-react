import type { Page } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { problem, uuid } from "./api"

type Template = components["schemas"]["LabelTemplateResponse"]
type Layout = Template["layout"]
type Element = Layout["elements"][number]
type Style = Extract<Element, { type: "TEXT" }>["style"]

const style: Style = {
  font: "SANS",
  fontSizePt: 9,
  bold: true,
  italic: false,
  underline: false,
  strike: false,
  align: "CENTER",
  verticalAlign: "TOP",
  fit: true,
  inverted: false,
}

const box = (x: number, y: number, w: number, h: number) => ({
  xMm: x.toFixed(2),
  yMm: y.toFixed(2),
  widthMm: w.toFixed(2),
  heightMm: h.toFixed(2),
})

/** A name, the price of the type chosen at printing, a barcode: TradeNet's dev seed, in two sizes. */
export function standardLayout(
  width: number,
  height: number,
  options: { split: boolean; barcodeWidth?: number }
): Layout {
  const third = height / 3
  return {
    widthMm: width.toFixed(2),
    heightMm: height.toFixed(2),
    elements: [
      {
        type: "TEXT",
        text: "{name}",
        style,
        ...box(1, 1, width - 2, third - 1),
      },
      {
        type: "PRICE",
        priceTypeId: null,
        split: options.split,
        currency: true,
        style: { ...style, fontSizePt: 18, verticalAlign: "MIDDLE" },
        ...box(1, third, width - 2, third),
      },
      {
        type: "BARCODE",
        digits: true,
        ...box(1, 2 * third, options.barcodeWidth ?? width - 2, third - 1),
      },
    ],
  }
}

/** The dev seed's templates, in the server's order (by name). */
export function labelTemplates(): Template[] {
  return [
    {
      id: uuid(6001),
      name: "Маленькая 40×30",
      layout: standardLayout(40, 30, { split: false }),
      isActive: true,
      version: 1,
    },
    {
      id: uuid(6002),
      name: "Стандарт 58×40",
      layout: standardLayout(58, 40, { split: true }),
      isActive: true,
      version: 1,
    },
  ]
}

/**
 * The label templates API in memory: list, read, create, change (with the version check and the unique name).
 * Returns the bodies written, by method.
 */
export async function mockLabelTemplates(page: Page, templates: Template[]) {
  const sent: { method: string; body: Record<string, unknown> }[] = []
  let next = 6100
  await page.route(
    /\/api\/label-templates(\/[^?]*)?(\?.*)?$/,
    async (route) => {
      const request = route.request()
      const id = new URL(request.url()).pathname.split("/")[3]
      const method = request.method()
      if (method === "GET" && !id)
        return route.fulfill({
          json: {
            items: templates.map((t) => ({
              id: t.id,
              name: t.name,
              widthMm: t.layout.widthMm,
              heightMm: t.layout.heightMm,
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
          : problem(route, 404, "LABEL_TEMPLATE_NOT_FOUND")
      const body = request.postDataJSON() as Record<string, unknown>
      sent.push({ method, body })
      const name = typeof body.name === "string" ? body.name : undefined
      if (name && templates.some((t) => t.name === name && t.id !== id))
        return problem(route, 409, "LABEL_TEMPLATE_NAME_TAKEN")
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
      if (!target) return problem(route, 404, "LABEL_TEMPLATE_NOT_FOUND")
      if (body.version !== target.version)
        return problem(route, 409, "VERSION_CONFLICT")
      Object.assign(target, body, { version: target.version + 1 })
      return route.fulfill({ json: target })
    }
  )
  return sent
}

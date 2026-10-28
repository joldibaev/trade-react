import type { Page } from "@playwright/test"

import type { components } from "../../src/api/schema"
import { problem, uuid } from "./api"

type PaymentMethod = components["schemas"]["PaymentMethodResponse"]

export function paymentMethods(): PaymentMethod[] {
  return [
    {
      id: uuid(5001),
      name: "Наличные",
      isCash: true,
      isActive: true,
      version: 1,
    },
    {
      id: uuid(5002),
      name: "Карта",
      isCash: false,
      isActive: true,
      version: 1,
    },
  ]
}

/**
 * The payment methods API in memory, as TradeNet answers it: names are unique regardless of case, a stale
 * `version` is a 409. Returns the writes it received, in order.
 */
export async function mockPaymentMethods(page: Page, methods: PaymentMethod[]) {
  const sent: { method: string; body: unknown }[] = []
  await page.route(
    /\/api\/payment-methods(\/[^?]*)?(\?.*)?$/,
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() === "GET")
        return route.fulfill({ json: { items: methods, nextCursor: null } })

      const taken = (name: string | undefined, exceptId?: string) =>
        name !== undefined &&
        methods.some(
          (m) =>
            m.id !== exceptId && m.name.toLowerCase() === name.toLowerCase()
        )

      if (request.method() === "POST") {
        const body = request.postDataJSON() as { name: string; isCash: boolean }
        sent.push({ method: "POST", body })
        if (taken(body.name))
          return problem(route, 409, "PAYMENT_METHOD_NAME_TAKEN")
        const created = {
          id: uuid(5100 + methods.length),
          isActive: true,
          version: 1,
          ...body,
        }
        methods.push(created)
        return route.fulfill({ status: 201, json: created })
      }

      const id = url.pathname.split("/")[3]
      const target = methods.find((m) => m.id === id)
      if (!target) return problem(route, 404, "PAYMENT_METHOD_NOT_FOUND")
      if (request.method() === "DELETE") {
        sent.push({
          method: "DELETE",
          body: { id, version: url.searchParams.get("version") },
        })
        if (url.searchParams.get("version") !== String(target.version))
          return problem(route, 409, "VERSION_CONFLICT")
        methods.splice(methods.indexOf(target), 1)
        return route.fulfill({ status: 204 })
      }
      const body = request.postDataJSON() as Partial<PaymentMethod> & {
        version: number
      }
      sent.push({ method: "PATCH", body })
      if (body.version !== target.version)
        return problem(route, 409, "VERSION_CONFLICT")
      if (taken(body.name, target.id))
        return problem(route, 409, "PAYMENT_METHOD_NAME_TAKEN")
      const changes = { ...body, version: target.version + 1 }
      Object.assign(target, changes)
      return route.fulfill({ json: target })
    }
  )
  return sent
}

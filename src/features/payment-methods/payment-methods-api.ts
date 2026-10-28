import type { QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { wholeListOptions } from "@/api/cursor-pages"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"

export type PaymentMethod = components["schemas"]["PaymentMethodResponse"]
export type PaymentMethodChanges = Omit<
  components["schemas"]["UpdatePaymentMethodRequest"],
  "version"
>

const key = ["payment-methods"]

/** How the till takes money, for the whole chain: one page, inactive ones too, cash first and then by name. */
export const paymentMethodsQuery = wholeListOptions(key, () =>
  unwrap(api.GET("/api/payment-methods"))
)

export async function createPaymentMethod(
  queryClient: QueryClient,
  body: components["schemas"]["CreatePaymentMethodRequest"]
) {
  const created = await unwrap(api.POST("/api/payment-methods", { body }))
  await queryClient.invalidateQueries({ queryKey: key })
  return created
}

/** Renames, flips "cash" or switches on and off; only the changed fields travel, with the version that was read. */
export async function updatePaymentMethod(
  queryClient: QueryClient,
  method: Pick<PaymentMethod, "id" | "version">,
  changes: PaymentMethodChanges
) {
  const updated = await readAgainOnConflict(
    queryClient,
    key,
    unwrap(
      api.PATCH("/api/payment-methods/{id}", {
        params: { path: { id: method.id } },
        body: { version: method.version, ...changes },
      })
    )
  )
  await queryClient.invalidateQueries({ queryKey: key })
  return updated
}

export async function deletePaymentMethod(
  queryClient: QueryClient,
  method: Pick<PaymentMethod, "id" | "version">
) {
  await readAgainOnConflict(
    queryClient,
    key,
    unwrap(
      api.DELETE("/api/payment-methods/{id}", {
        params: {
          path: { id: method.id },
          query: { version: method.version },
        },
      })
    )
  )
  await queryClient.invalidateQueries({ queryKey: key })
}

import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { wholeListOptions } from "@/api/cursor-pages"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"

export type ReceiptTemplateListItem =
  components["schemas"]["ReceiptTemplateListItem"]
export type ReceiptTemplate = components["schemas"]["ReceiptTemplateResponse"]

/** Every template, inactive ones too, by name; the list carries the roll only (TradeNet receipts.md). */
export const receiptTemplatesQuery = wholeListOptions(
  ["receipt-templates", "list"],
  () => unwrap(api.GET("/api/receipt-templates"))
)

/** One template with its blocks: what the editor edits and what the till prints with. */
export function receiptTemplateQuery(id: string) {
  return queryOptions({
    queryKey: ["receipt-templates", "one", id],
    queryFn: () =>
      unwrap(
        api.GET("/api/receipt-templates/{id}", { params: { path: { id } } })
      ),
  })
}

function remember(queryClient: QueryClient, template: ReceiptTemplate) {
  queryClient.setQueryData(receiptTemplateQuery(template.id).queryKey, template)
  void queryClient.invalidateQueries({
    queryKey: ["receipt-templates", "list"],
  })
  return template
}

export async function createReceiptTemplate(
  queryClient: QueryClient,
  body: components["schemas"]["CreateReceiptTemplateRequest"]
) {
  return remember(
    queryClient,
    await unwrap(api.POST("/api/receipt-templates", { body }))
  )
}

/** `layout` replaces the roll, the text size and every block together. */
export async function updateReceiptTemplate(
  queryClient: QueryClient,
  template: Pick<ReceiptTemplate, "id" | "version">,
  changes: Omit<
    components["schemas"]["UpdateReceiptTemplateRequest"],
    "version"
  >
) {
  return remember(
    queryClient,
    await readAgainOnConflict(
      queryClient,
      ["receipt-templates"],
      unwrap(
        api.PATCH("/api/receipt-templates/{id}", {
          params: { path: { id: template.id } },
          body: { version: template.version, ...changes },
        })
      )
    )
  )
}

export async function deleteReceiptTemplate(
  queryClient: QueryClient,
  template: Pick<ReceiptTemplate, "id" | "version">
) {
  await readAgainOnConflict(
    queryClient,
    ["receipt-templates"],
    unwrap(
      api.DELETE("/api/receipt-templates/{id}", {
        params: {
          path: { id: template.id },
          query: { version: template.version },
        },
      })
    )
  )
  queryClient.removeQueries({
    queryKey: receiptTemplateQuery(template.id).queryKey,
  })
  await queryClient.invalidateQueries({
    queryKey: ["receipt-templates", "list"],
  })
}

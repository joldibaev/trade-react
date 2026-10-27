import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { wholeListOptions } from "@/api/cursor-pages"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"

export type LabelTemplateListItem =
  components["schemas"]["LabelTemplateListItem"]
export type LabelTemplate = components["schemas"]["LabelTemplateResponse"]
export type LabelLayout = components["schemas"]["LabelLayout"]
export type LabelElement = components["schemas"]["LabelElement"]
export type LabelTextStyle = components["schemas"]["LabelTextStyle"]

/** Every template, inactive ones too, by name; the list carries the size only (TradeNet labels.md). */
export const templatesQuery = wholeListOptions(
  ["label-templates", "list"],
  () => unwrap(api.GET("/api/label-templates"))
)

/** One template with its elements: what the editor edits and what printing draws. */
export function templateQuery(id: string) {
  return queryOptions({
    queryKey: ["label-templates", "one", id],
    queryFn: () =>
      unwrap(
        api.GET("/api/label-templates/{id}", { params: { path: { id } } })
      ),
  })
}

function remember(queryClient: QueryClient, template: LabelTemplate) {
  queryClient.setQueryData(templateQuery(template.id).queryKey, template)
  void queryClient.invalidateQueries({ queryKey: ["label-templates", "list"] })
  return template
}

export async function createTemplate(
  queryClient: QueryClient,
  body: components["schemas"]["CreateLabelTemplateRequest"]
) {
  return remember(
    queryClient,
    await unwrap(api.POST("/api/label-templates", { body }))
  )
}

/** `layout` replaces the size and every element together; a template is deactivated, never deleted. */
export async function updateTemplate(
  queryClient: QueryClient,
  template: Pick<LabelTemplate, "id" | "version">,
  changes: Omit<components["schemas"]["UpdateLabelTemplateRequest"], "version">
) {
  return remember(
    queryClient,
    await readAgainOnConflict(
      queryClient,
      ["label-templates"],
      unwrap(
        api.PATCH("/api/label-templates/{id}", {
          params: { path: { id: template.id } },
          body: { version: template.version, ...changes },
        })
      )
    )
  )
}

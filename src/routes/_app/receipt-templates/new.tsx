import { createFileRoute } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth/permissions"
import { ReceiptTemplateEditorPage } from "@/features/receipts/editor/template-editor-page"

export const Route = createFileRoute("/_app/receipt-templates/new")({
  // `?from=<id>`: a copy of that template, saved as a new one.
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from !== ""
      ? { from: search.from }
      : {},
  beforeLoad: ({ context }) => {
    requirePermission(context.me, "TILL_SETTINGS_MANAGE")
  },
  component: function NewReceiptTemplate() {
    const { from } = Route.useSearch()
    return <ReceiptTemplateEditorPage key={from ?? "new"} copyFrom={from} />
  },
})

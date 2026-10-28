import { createFileRoute } from "@tanstack/react-router"

import { ReceiptTemplatesPage } from "@/features/receipts/templates-page"

export const Route = createFileRoute("/_app/receipt-templates/")({
  component: ReceiptTemplatesPage,
})

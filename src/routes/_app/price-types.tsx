import { createFileRoute } from "@tanstack/react-router"

import { PriceTypesPage } from "@/features/prices/price-types-page"

export const Route = createFileRoute("/_app/price-types")({
  component: PriceTypesPage,
})

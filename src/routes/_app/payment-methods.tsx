import { createFileRoute } from "@tanstack/react-router"

import { PaymentMethodsPage } from "@/features/payment-methods/payment-methods-page"

export const Route = createFileRoute("/_app/payment-methods")({
  component: PaymentMethodsPage,
})

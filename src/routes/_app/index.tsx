import { createFileRoute, redirect } from "@tanstack/react-router"

// No dashboard yet: the start page is the product list.
export const Route = createFileRoute("/_app/")({
  beforeLoad: () => {
    throw redirect({ to: "/products", replace: true })
  },
})

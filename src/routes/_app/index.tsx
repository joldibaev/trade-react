import { createFileRoute } from "@tanstack/react-router"

// No screen yet: the start page is the menu.
export const Route = createFileRoute("/_app/")({
  component: () => null,
})

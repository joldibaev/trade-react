import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { lazy, Suspense } from "react"

import { RouteError } from "@/components/route-error"

export type RouterContext = { queryClient: QueryClient }

// Development only: the import is never reached in a production build, so the devtools are not shipped.
const Devtools = import.meta.env.DEV
  ? lazy(() => import("@/components/devtools"))
  : () => null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  ),
  errorComponent: RouteError,
})

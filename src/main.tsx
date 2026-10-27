import { QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { setForbiddenHandler, setUnauthenticatedHandler } from "@/api/client"
import { createQueryClient } from "@/api/query-client"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { meQuery } from "@/features/auth/session"
import { I18nProvider, loadLanguage, storedLanguage } from "@/i18n/i18n"
import { RouteError } from "@/components/route-error"
import { routeTree } from "./routeTree.gen"

const queryClient = createQueryClient()
const router = createRouter({
  routeTree,
  context: { queryClient },
  // Route data lives in TanStack Query; the router asks it every time instead of keeping its own copy.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  // A failed page shows inside the layout, so the menu stays and the person can go elsewhere.
  defaultErrorComponent: RouteError,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// The session ended in the middle of work (deactivated, signed out elsewhere, 30 days idle): forget the person and
// let the signed-in layout send them to sign-in, with this page as the way back. One place for every request.
setUnauthenticatedHandler(() => {
  queryClient.setQueryData(meQuery.queryKey, null)
  void router.invalidate()
})

// A permission was taken away while the page was open: read the person again, so the menu, the buttons and the
// route guards follow at once instead of after the next sign-in.
setForbiddenHandler(() => {
  void queryClient
    .query({ ...meQuery, staleTime: 0 })
    .then(() => router.invalidate())
})

const language = await loadLanguage(storedLanguage())
const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root.")

createRoot(root).render(
  <StrictMode>
    <I18nProvider initial={language}>
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
)

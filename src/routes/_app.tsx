import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/app-shell"
import { meQuery } from "@/features/auth/session"

/** Every page inside needs a session: without one, sign-in, then back to the page that was asked for. */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.query(meQuery)
    if (!me)
      throw redirect({ to: "/login", search: { redirect: location.href } })
    return { me }
  },
  component: AppLayout,
})

function AppLayout() {
  const { me } = Route.useRouteContext()
  return (
    <AppShell me={me}>
      <Outlet />
    </AppShell>
  )
}

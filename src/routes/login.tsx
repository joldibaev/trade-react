import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { LanguageMenu, ThemeMenu } from "@/components/preference-menus"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoginForm } from "@/features/auth/login-form"
import { meQuery, safeRedirect } from "@/features/auth/session"
import { useT } from "@/i18n/i18n"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = safeRedirect(search.redirect)
    return target ? { redirect: target } : {}
  },
  beforeLoad: async ({ context, search }) => {
    const me = await context.queryClient.query(meQuery)
    if (me) throw redirect({ href: search.redirect ?? "/products" })
  },
  component: LoginPage,
})

function LoginPage() {
  const t = useT()
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>{t.auth.title}</h1>
          </CardTitle>
          <CardDescription>{t.auth.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            onSignedIn={() =>
              void navigate({ href: target ?? "/products", replace: true })
            }
          />
        </CardContent>
      </Card>
      <div className="flex gap-1">
        <LanguageMenu />
        <ThemeMenu />
      </div>
    </main>
  )
}

import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, type LinkProps } from "@tanstack/react-router"
import { LogOutIcon, StoreIcon } from "lucide-react"
import type { ReactNode } from "react"

import { LanguageMenu, ThemeMenu } from "@/components/preference-menus"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Permission } from "@/features/auth/permissions"
import { signOut, type Me } from "@/features/auth/session"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

type NavItem = {
  to: NonNullable<LinkProps["to"]>
  label: (t: Messages) => string
  icon: ReactNode
  /** Shown only to people with this permission; everyone signed in sees the rest. */
  permission?: Permission
}

type NavGroup = { label: (t: Messages) => string; items: NavItem[] }

const navigation: NavGroup[] = [
  {
    label: (t) => t.shell.settings,
    items: [
      {
        to: "/stores",
        label: (t) => t.shell.stores,
        icon: <StoreIcon aria-hidden />,
      },
    ],
  },
]

/**
 * The frame of every signed-in page: the menu on the left (a sheet behind a button on phones and tablets),
 * the page on the right. A list page fills the height itself, so a long list scrolls inside its table, not the
 * page; a details page taller than the screen scrolls as a whole.
 */
export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const t = useT()

  return (
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t.shell.skipToContent}
      </a>
      <Sidebar label={t.shell.navigation}>
        <SidebarHeader className="px-4 py-3 font-heading text-base font-semibold">
          {t.common.appName}
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label={t.shell.navigation}>
            {navigation.map((group) => {
              // A menu item the person may not use is not shown; the server refuses it anyway.
              const items = group.items.filter(
                (item) =>
                  !item.permission || me.permissions.includes(item.permission)
              )
              if (items.length === 0) return null
              const label = group.label(t)
              return (
                <SidebarGroup key={label}>
                  <SidebarGroupLabel>{label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          icon={item.icon}
                          label={item.label(t)}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )
            })}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <p className="truncate px-2 text-sm text-muted-foreground">
            {me.fullName}
          </p>
          <div className="flex flex-wrap gap-1">
            <LanguageMenu />
            <ThemeMenu />
          </div>
          <SignOutButton />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="h-dvh overflow-hidden">
        <header className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <SidebarTrigger label={t.shell.openMenu} />
          <span className="font-heading font-semibold">{t.common.appName}</span>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 outline-none md:p-6"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function NavLink({
  to,
  icon,
  label,
}: {
  to: NavItem["to"]
  icon: ReactNode
  label: string
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            to={to}
            activeProps={{ "aria-current": "page", "data-active": true }}
            onClick={() => {
              setOpenMobile(false)
            }}
          />
        }
      >
        {icon}
        {label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SignOutButton() {
  const t = useT()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => {
            void signOut(queryClient).then(() => navigate({ to: "/login" }))
          }}
        >
          <LogOutIcon aria-hidden />
          {t.common.signOut}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

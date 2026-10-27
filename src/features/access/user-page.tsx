import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, PencilIcon } from "lucide-react"
import { useState } from "react"

import { ActiveBadge, DetailsList, PageHeader } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMe } from "@/features/auth/permissions"
import { storesQuery } from "@/features/stores/stores-api"
import { useT } from "@/i18n/i18n"
import { formatInstant } from "@/lib/instant"
import { formatPhone } from "@/lib/phone"

import {
  securityEventsOptions,
  userQuery,
  type SecurityAction,
  type User,
} from "./access-api"
import { SecurityEvents } from "./security-events"
import { UserSessions } from "./user-sessions"
import {
  ResetPasswordDialog,
  UserActivationDialog,
  UserFormDialog,
} from "./user-dialogs"

/** One person: their data, the admin's actions on them, and their security history. */
type AuditFilter = {
  action: SecurityAction | undefined
  onActionChange: (action: SecurityAction | undefined) => void
}

export function UserPage({
  userId,
  ...audit
}: { userId: string } & AuditFilter) {
  const t = useT()
  const query = useQuery(userQuery(userId))
  return (
    <>
      <Link
        to="/users"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "self-start",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {t.users.title}
      </Link>
      {query.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : query.isError ? (
        <ProblemAlert
          title={t.users.loadFailed}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <UserDetails user={query.data} {...audit} />
      )}
    </>
  )
}

function UserDetails({
  user,
  action,
  onActionChange,
}: { user: User } & AuditFilter) {
  const t = useT()
  const me = useMe()
  const own = user.id === me.id
  const stores = useQuery(storesQuery()).data ?? []
  const [dialog, setDialog] = useState<
    "edit" | "password" | "activation" | null
  >(null)
  const close = () => {
    setDialog(null)
  }

  const storeNames = user.stores.all
    ? t.users.allStores
    : user.stores.storeIds.length === 0
      ? t.users.noStores
      : user.stores.storeIds
          .map((id) => stores.find((s) => s.id === id)?.name ?? id)
          .join(", ")

  return (
    <>
      <PageHeader
        title={user.fullName}
        badge={
          <>
            <ActiveBadge
              active={user.isActive}
              activeLabel={t.users.active}
              inactiveLabel={t.users.inactive}
            />
            {own && <Badge variant="secondary">{t.users.you}</Badge>}
          </>
        }
      >
        {/* Nobody changes their own account here (403 OWN_ACCOUNT): an admin cannot lock themselves out. */}
        {own ? (
          <Link
            to="/account"
            className={buttonVariants({ variant: "outline" })}
          >
            {t.account.title}
          </Link>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialog("edit")
              }}
            >
              <PencilIcon data-icon="inline-start" aria-hidden />
              {t.common.edit}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDialog("password")
              }}
            >
              {t.users.resetPassword}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDialog("activation")
              }}
            >
              {user.isActive ? t.users.deactivate : t.users.activate}
            </Button>
          </>
        )}
      </PageHeader>
      <Card>
        <CardContent>
          <DetailsList
            items={[
              { label: t.users.login, value: user.login },
              { label: t.users.phone, value: formatPhone(user.phone) },
              {
                label: t.users.group,
                value: (
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: user.group.id }}
                    className="underline underline-offset-4"
                  >
                    {user.group.name}
                  </Link>
                ),
              },
              { label: t.users.stores, value: storeNames },
              {
                label: t.users.createdAt,
                value: formatInstant(user.createdAt),
              },
            ]}
          />
        </CardContent>
      </Card>
      {!own && <UserSessions user={user} />}
      <SecurityEvents
        options={securityEventsOptions({ userId: user.id }, action)}
        subjectId={user.id}
        action={action}
        onActionChange={onActionChange}
      />
      {dialog === "edit" && (
        <UserFormDialog user={user} open onOpenChange={close} />
      )}
      {dialog === "password" && (
        <ResetPasswordDialog user={user} open onOpenChange={close} />
      )}
      {dialog === "activation" && (
        <UserActivationDialog user={user} open onOpenChange={close} />
      )}
    </>
  )
}

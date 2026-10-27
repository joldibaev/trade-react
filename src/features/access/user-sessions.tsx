import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useArraySource } from "@/components/data-table/sources"
import { useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { formatInstant } from "@/lib/instant"

import {
  endUserSession,
  userSessionsQuery,
  type Session,
  type User,
} from "./access-api"

const column = dataTableColumns<Session>()

function sessionColumns(t: Messages, end: (session: Session) => void) {
  return column.columns([
    column.accessor("userAgent", {
      header: t.account.device,
      size: 300,
      meta: { grow: true },
      cell: (info) => {
        const agent = info.getValue() ?? t.account.unknownDevice
        return <span title={agent}>{agent}</span>
      },
    }),
    column.accessor("ipAddress", {
      header: t.audit.ip,
      size: 130,
      cell: (info) => info.getValue() ?? "",
    }),
    column.accessor("createdAt", {
      header: t.account.signedInAt,
      size: 150,
      cell: (info) => formatInstant(info.getValue()),
    }),
    column.accessor("lastSeenAt", {
      header: t.account.lastSeenAt,
      size: 150,
      cell: (info) => formatInstant(info.getValue()),
    }),
    column.display({
      id: "end",
      size: 130,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`${t.account.endSession}: ${info.row.original.userAgent ?? t.account.unknownDevice}`}
          onClick={() => {
            end(info.row.original)
          }}
        >
          {t.account.endSession}
        </Button>
      ),
    }),
  ])
}

/**
 * Where another person is signed in, for an admin. Ending one session signs out that device only (a lost phone);
 * a password reset would end them all.
 */
export function UserSessions({ user }: { user: User }) {
  const t = useT()
  const [ending, setEnding] = useState<Session | null>(null)
  const columns = useMemo(() => sessionColumns(t, setEnding), [t])
  const source = useArraySource(useQuery(userSessionsQuery(user.id)))

  return (
    <>
      <h2 className="font-heading text-lg font-semibold">{t.users.sessions}</h2>
      <DataTable
        label={t.users.sessions}
        columns={columns}
        source={source}
        className="max-h-80 min-h-32"
        empty={
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{t.users.noSessions}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {ending && (
        <EndSessionDialog
          user={user}
          session={ending}
          onOpenChange={() => {
            setEnding(null)
          }}
        />
      )}
    </>
  )
}

function EndSessionDialog({
  user,
  session,
  onOpenChange,
}: {
  user: User
  session: Session
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const form = useAppForm({
    defaultValues: { reason: "" },
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      try {
        await endUserSession(
          queryClient,
          user.id,
          session.id,
          value.reason.trim() || null
        )
        onOpenChange(false)
      } catch (error) {
        refusal.show(formApi, error)
      }
    },
  })

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`${t.users.endSession}: ${user.fullName}`}
      description={`${session.userAgent ?? t.account.unknownDevice}. ${t.users.endSessionHint}`}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton label={t.users.endSession} />
        </form.AppForm>
      }
    >
      <form.AppField name="reason">
        {(field) => (
          <field.TextareaField
            label={t.users.reason}
            description={t.users.reasonHint}
          />
        )}
      </form.AppField>
    </FormDialog>
  )
}

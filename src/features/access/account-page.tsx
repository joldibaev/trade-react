import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useArraySource } from "@/components/data-table/sources"
import {
  FormChecksProvider,
  useFormChecks,
} from "@/components/form/form-checks"
import {
  allOf,
  focusFirstInvalid,
  required,
  useAppForm,
} from "@/components/form/form"
import { useRefusal } from "@/components/form/form-dialog"
import { DetailsList, PageHeader } from "@/components/page"
import { LanguageMenu, ThemeMenu } from "@/components/preference-menus"
import { ProblemAlert } from "@/components/problem-alert"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { useMe } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { changedFields } from "@/lib/changes"
import { formatInstant } from "@/lib/instant"

import {
  changePassword,
  endOtherSessions,
  endSession,
  sessionsQuery,
  updateProfile,
  type Session,
} from "./access-api"
import { longPassword, passwordsDiffer } from "./user-dialogs"

/** The person's own account: name and phone, password, and where they are signed in. */
export function AccountPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t.account.title} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.account.appearance}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {/* Kept in this browser, like trade4's profile settings; the same menus are under the side menu. */}
          <LanguageMenu />
          <ThemeMenu />
        </CardContent>
      </Card>
      <SessionsSection />
    </>
  )
}

function ProfileCard() {
  const t = useT()
  const me = useMe()
  const queryClient = useQueryClient()
  const { refusal, formRef, show, clear } = useRefusal()
  const [saved, setSaved] = useState(false)
  const initial = { fullName: me.fullName, phone: me.phone }
  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      clear()
      setSaved(false)
      try {
        const fresh = await updateProfile(
          queryClient,
          me.version,
          changedFields(initial, {
            fullName: value.fullName.trim(),
            phone: value.phone.trim(),
          })
        )
        formApi.reset({ fullName: fresh.fullName, phone: fresh.phone })
        setSaved(true)
      } catch (error) {
        show(formApi, error)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.account.profile}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit().then(() => {
              focusFirstInvalid(formRef.current)
            })
          }}
        >
          <FieldGroup>
            <DetailsList
              items={[
                { label: t.users.login, value: me.login },
                { label: t.users.group, value: me.group.name },
              ]}
            />
            {refusal !== null && (
              <ProblemAlert title={t.common.saveFailed} error={refusal} />
            )}
            {saved && (
              <Alert role="status">
                <AlertDescription>{t.account.saved}</AlertDescription>
              </Alert>
            )}
            <form.AppField
              name="fullName"
              validators={{ onChange: required, onBlur: required }}
            >
              {(field) => (
                <field.TextField
                  label={t.users.fullName}
                  autoComplete="name"
                  required
                />
              )}
            </form.AppField>
            <form.AppField
              name="phone"
              validators={{ onChange: required, onBlur: required }}
            >
              {(field) => (
                <field.TextField
                  label={t.users.phone}
                  description={t.common.phoneHint}
                  type="tel"
                  autoComplete="tel"
                  required
                />
              )}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton label={t.common.save} className="self-start" />
            </form.AppForm>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const t = useT()
  const queryClient = useQueryClient()
  const { refusal, formRef, show, clear } = useRefusal()
  const checks = useFormChecks()
  const [saved, setSaved] = useState(false)
  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "", repeat: "" },
    onSubmit: async ({ value, formApi }) => {
      clear()
      setSaved(false)
      if (
        checks.refuse(
          passwordsDiffer(value.newPassword, value.repeat, "repeat")
        )
      )
        return
      try {
        await changePassword(queryClient, {
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        })
        formApi.reset()
        setSaved(true)
      } catch (error) {
        show(formApi, error)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.account.password}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit().then(() => {
              focusFirstInvalid(formRef.current)
            })
          }}
        >
          <FormChecksProvider value={checks}>
            <FieldGroup>
              <p className="text-sm text-muted-foreground">
                {t.account.passwordHint}
              </p>
              {refusal !== null && (
                <ProblemAlert title={t.common.saveFailed} error={refusal} />
              )}
              {saved && (
                <Alert role="status">
                  <AlertDescription>
                    {t.account.passwordChanged}
                  </AlertDescription>
                </Alert>
              )}
              <form.AppField
                name="currentPassword"
                validators={{ onChange: required, onBlur: required }}
              >
                {(field) => (
                  <field.TextField
                    label={t.account.currentPassword}
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                )}
              </form.AppField>
              <form.AppField
                name="newPassword"
                validators={{
                  onChange: allOf(required, longPassword),
                  onBlur: allOf(required, longPassword),
                }}
              >
                {(field) => (
                  <field.TextField
                    label={t.users.newPassword}
                    description={t.users.passwordHint}
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                )}
              </form.AppField>
              <form.AppField
                name="repeat"
                validators={{ onChange: required, onBlur: required }}
              >
                {(field) => (
                  <field.TextField
                    label={t.users.repeatPassword}
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                )}
              </form.AppField>
              <form.AppForm>
                <form.SubmitButton
                  label={t.account.changePassword}
                  className="self-start"
                />
              </form.AppForm>
            </FieldGroup>
          </FormChecksProvider>
        </form>
      </CardContent>
    </Card>
  )
}

const column = dataTableColumns<Session>()

function sessionColumns(t: Messages, end: (session: Session) => void) {
  return column.columns([
    column.accessor("userAgent", {
      header: t.account.device,
      size: 300,
      meta: { grow: true },
      cell: (info) => {
        const agent = info.getValue() ?? t.account.unknownDevice
        return (
          <span className="flex items-center gap-2">
            <span className="truncate" title={agent}>
              {agent}
            </span>
            {info.row.original.current && (
              <Badge variant="secondary">{t.account.thisSession}</Badge>
            )}
          </span>
        )
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
      cell: (info) =>
        info.row.original.current ? null : (
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

/** Where the person is signed in (at most 10 devices); ending a session signs that device out at once. */
function SessionsSection() {
  const t = useT()
  const queryClient = useQueryClient()
  const query = useQuery(sessionsQuery)
  const [ending, setEnding] = useState<Session | "others" | null>(null)
  const columns = useMemo(() => sessionColumns(t, setEnding), [t])
  const source = useArraySource(query)
  const others = (query.data ?? []).filter((s) => !s.current).length

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">
          {t.account.sessions}
        </h2>
        {others > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              setEnding("others")
            }}
          >
            {t.account.endOthers}
          </Button>
        )}
      </div>
      <DataTable
        label={t.account.sessions}
        columns={columns}
        source={source}
        className="min-h-48 flex-1"
        empty={null}
      />
      {ending !== null && (
        <ConfirmDialog
          open
          onOpenChange={() => {
            setEnding(null)
          }}
          title={
            ending === "others" ? t.account.endOthers : t.account.endSession
          }
          description={
            ending === "others"
              ? t.account.endOthersHint
              : t.account.endSessionHint
          }
          confirmLabel={
            ending === "others" ? t.account.endOthers : t.account.endSession
          }
          destructive
          failedTitle={t.common.saveFailed}
          action={() =>
            ending === "others"
              ? endOtherSessions(queryClient)
              : endSession(queryClient, ending.id)
          }
        />
      )}
    </>
  )
}

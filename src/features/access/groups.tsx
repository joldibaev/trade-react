import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useArraySource } from "@/components/data-table/sources"
import {
  FormChecksProvider,
  useFormChecks,
} from "@/components/form/form-checks"
import { required, useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { DetailsList, PageHeader } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import {
  createGroup,
  deleteGroup,
  grantablePermissionsQuery,
  securityEventsOptions,
  type SecurityAction,
  groupQuery,
  groupsQuery,
  updateGroup,
  type Group,
  type Permission,
} from "./access-api"
import { SecurityEvents } from "./security-events"

const column = dataTableColumns<Group>()

function permissionList(t: Messages, permissions: readonly Permission[]) {
  return permissions.length === 0
    ? t.groups.noPermissions
    : permissions.map((p) => t.permissions[p]).join(", ")
}

function groupColumns(t: Messages) {
  return column.columns([
    column.accessor("name", {
      header: t.groups.name,
      size: 220,
      cell: (info) => (
        <span className="flex items-center gap-2">
          <Link
            to="/groups/$groupId"
            params={{ groupId: info.row.original.id }}
            className="truncate font-medium underline-offset-4 hover:underline"
          >
            {info.getValue()}
          </Link>
          {info.row.original.builtIn && (
            <Badge variant="secondary">{t.groups.builtIn}</Badge>
          )}
        </span>
      ),
    }),
    column.accessor("permissions", {
      header: t.groups.permissions,
      size: 360,
      meta: { grow: true },
      cell: (info) => permissionList(t, info.getValue()),
    }),
    column.accessor("users", {
      header: t.groups.users,
      size: 120,
      meta: { align: "end" },
    }),
  ])
}

/** The groups a person can be in; each grants permissions. ADMIN is built in and has them all. */
export function GroupsPage() {
  const t = useT()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const columns = useMemo(() => groupColumns(t), [t])
  const source = useArraySource(useQuery(groupsQuery))

  return (
    <>
      <PageHeader title={t.groups.title}>
        <Button
          onClick={() => {
            setCreating(true)
          }}
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          {t.groups.create}
        </Button>
      </PageHeader>
      <DataTable
        label={t.groups.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.groups.empty}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {creating && (
        <GroupFormDialog
          open
          onOpenChange={setCreating}
          onSaved={(group) => {
            void navigate({
              to: "/groups/$groupId",
              params: { groupId: group.id },
            })
          }}
        />
      )}
    </>
  )
}

type AuditFilter = {
  action: SecurityAction | undefined
  onActionChange: (action: SecurityAction | undefined) => void
}

export function GroupPage({
  groupId,
  ...audit
}: { groupId: string } & AuditFilter) {
  const t = useT()
  const query = useQuery(groupQuery(groupId))
  return (
    <>
      <Link
        to="/groups"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "self-start",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {t.groups.title}
      </Link>
      {query.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError ? (
        <ProblemAlert
          title={t.groups.loadFailed}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <GroupDetails group={query.data} {...audit} />
      )}
    </>
  )
}

function GroupDetails({
  group,
  action,
  onActionChange,
}: { group: Group } & AuditFilter) {
  const t = useT()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const close = () => {
    setDialog(null)
  }

  return (
    <>
      <PageHeader
        title={group.name}
        badge={
          group.builtIn && <Badge variant="secondary">{t.groups.builtIn}</Badge>
        }
      >
        {/* The built-in ADMIN is never edited. */}
        {!group.builtIn && (
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
              disabled={group.users > 0}
              aria-describedby={
                group.users > 0 ? "group-delete-hint" : undefined
              }
              onClick={() => {
                setDialog("delete")
              }}
            >
              {t.groups.delete}
            </Button>
          </>
        )}
      </PageHeader>
      {!group.builtIn && group.users > 0 && (
        <p id="group-delete-hint" className="text-sm text-muted-foreground">
          {t.groups.deleteNeedsEmpty}
        </p>
      )}
      <Card>
        <CardContent>
          <DetailsList
            items={[
              {
                label: t.groups.permissions,
                value: group.builtIn
                  ? t.groups.allPermissions
                  : permissionList(t, group.permissions),
              },
              {
                label: t.groups.users,
                value: (
                  <Link
                    to="/users"
                    search={{ groupId: group.id }}
                    className="underline underline-offset-4"
                  >
                    {String(group.users)}
                  </Link>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
      <SecurityEvents
        options={securityEventsOptions({ groupId: group.id }, action)}
        action={action}
        onActionChange={onActionChange}
      />
      {dialog === "edit" && (
        <GroupFormDialog group={group} open onOpenChange={close} />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${t.groups.delete}: ${group.name}`}
          description={t.groups.deleteHint}
          confirmLabel={t.groups.delete}
          destructive
          failedTitle={t.groups.deleteFailed}
          action={async () => {
            await deleteGroup(queryClient, group)
            await navigate({ to: "/groups" })
          }}
        />
      )}
    </>
  )
}

/** A group's name and permissions; a change of permissions needs a reason and applies on the members' next click. */
function GroupFormDialog({
  group,
  open,
  onOpenChange,
  onSaved,
}: {
  group?: Group
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (group: Group) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const checks = useFormChecks()
  const grantable = useQuery(grantablePermissionsQuery).data ?? []
  const [base, setBase] = useState(group)
  const valuesOf = (g: Group | undefined) => ({
    name: g?.name ?? "",
    permissions: g?.permissions ?? ([] as string[]),
    reason: "",
  })

  const form = useAppForm({
    defaultValues: valuesOf(base),
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      const name = value.name.trim()
      const permissions = value.permissions as Permission[]
      const reason = value.reason.trim() || null
      try {
        let saved: Group
        if (base) {
          const permissionsChanged =
            [...permissions].sort().join() !==
            [...base.permissions].sort().join()
          if (permissionsChanged && !reason) {
            checks.refuse({ reason: "REQUIRED" })
            return
          }
          saved = await updateGroup(queryClient, base, {
            ...(name !== base.name && { name }),
            ...(permissionsChanged && { permissions }),
            reason,
          })
        } else
          saved = await createGroup(queryClient, { name, permissions, reason })
        onOpenChange(false)
        onSaved?.(saved)
      } catch (error) {
        refusal.show(formApi, error)
      }
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={group ? t.groups.editTitle : t.groups.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      onReload={() => {
        if (!base) return
        void queryClient
          .query({ ...groupQuery(base.id), staleTime: 0 })
          .then((fresh) => {
            setBase(fresh)
            form.reset(valuesOf(fresh))
            refusal.clear()
          })
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton label={group ? t.common.save : t.common.create} />
        </form.AppForm>
      }
    >
      <FormChecksProvider value={checks}>
        <form.AppField
          name="name"
          validators={{ onChange: required, onBlur: required }}
        >
          {(field) => <field.TextField label={t.groups.name} required />}
        </form.AppField>
        <form.AppField name="permissions">
          {(field) => (
            <field.CheckboxListField
              legend={t.groups.permissions}
              options={grantable.map((p) => ({
                value: p,
                label: t.permissions[p],
                hint: t.permissionHints[p],
              }))}
            />
          )}
        </form.AppField>
        <form.AppField name="reason">
          {(field) => (
            <field.TextareaField
              label={t.users.reason}
              description={t.groups.reasonHint}
            />
          )}
        </form.AppField>
      </FormChecksProvider>
    </FormDialog>
  )
}

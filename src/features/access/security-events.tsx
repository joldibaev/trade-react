import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useCursorSource } from "@/components/data-table/sources"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { storesQuery } from "@/features/stores/stores-api"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { formatInstant } from "@/lib/instant"

import {
  groupsQuery,
  securityActions,
  type Permission,
  type SecurityAction,
  type SecurityEvent,
  type securityEventsOptions,
} from "./access-api"

type Names = {
  t: Messages
  groups: ReadonlyMap<string, string>
  stores: ReadonlyMap<string, string>
}

function formatValue(key: string, value: unknown, names: Names): string {
  const { t } = names
  if (value === null || value === undefined) return "—"
  if (key === "groupId" && typeof value === "string")
    return names.groups.get(value) ?? value
  if (key === "stores" && typeof value === "object") {
    const access = value as { all?: boolean; storeIds?: string[] }
    if (access.all) return t.users.allStores
    const ids = access.storeIds ?? []
    return ids.length === 0
      ? t.users.noStores
      : ids.map((id) => names.stores.get(id) ?? id).join(", ")
  }
  if (key === "permissions" && Array.isArray(value))
    return value.length === 0
      ? t.groups.noPermissions
      : value
          .map((p) =>
            typeof p === "string" && p in t.permissions
              ? t.permissions[p as Permission]
              : String(p)
          )
          .join(", ")
  if (typeof value === "boolean") return value ? t.common.yes : t.common.no
  if (typeof value === "string" || typeof value === "number")
    return String(value)
  return JSON.stringify(value)
}

/** `details` has no schema: known keys get their words, `{from, to}` becomes "old → new", the rest stays readable. */
export function describeDetails(details: unknown, names: Names): string {
  if (typeof details !== "object" || details === null) return ""
  return Object.entries(details as Record<string, unknown>)
    .map(([key, value]) => {
      const label =
        (names.t.audit.fields as Record<string, string | undefined>)[key] ?? key
      if (
        typeof value === "object" &&
        value !== null &&
        "from" in value &&
        "to" in value
      )
        return `${label}: ${formatValue(key, value.from, names)} → ${formatValue(key, value.to, names)}`
      return `${label}: ${formatValue(key, value, names)}`
    })
    .join("; ")
}

const column = dataTableColumns<SecurityEvent>()

function eventColumns(t: Messages, names: Names, subjectId?: string) {
  return column.columns([
    column.accessor("at", {
      header: t.audit.at,
      size: 150,
      cell: (info) => formatInstant(info.getValue()),
    }),
    column.accessor("action", {
      header: t.audit.action,
      size: 200,
      cell: (info) => t.audit.actions[info.getValue()],
    }),
    column.accessor("actor", {
      header: t.audit.actor,
      size: 170,
      cell: (info) => {
        const actor = info.getValue()
        if (actor === null) return "—"
        // The person acted on their own account: a sign-in, a password change.
        return actor.id === subjectId ? t.audit.self : actor.fullName
      },
    }),
    column.accessor("reason", {
      header: t.audit.reason,
      size: 200,
      cell: (info) => info.getValue() ?? "",
    }),
    column.accessor("details", {
      header: t.audit.details,
      size: 320,
      meta: { grow: true },
      cell: (info) => {
        const text = describeDetails(info.getValue(), names)
        // The row has one line; the whole text is in the tooltip and for screen readers.
        return <span title={text}>{text}</span>
      },
    }),
    column.accessor("ipAddress", {
      header: t.audit.ip,
      size: 130,
      cell: (info) => info.getValue() ?? "",
    }),
  ])
}

/**
 * The security history of a person or of a group, newest first; rows are only ever added. The event filter lives in
 * the page's URL (`?action=LOGIN_FAILED`), like every list filter.
 */
export function SecurityEvents({
  options,
  subjectId,
  action,
  onActionChange,
}: {
  options: ReturnType<typeof securityEventsOptions>
  /** The person the history is about: their own actions read "сам". */
  subjectId?: string
  action: SecurityAction | undefined
  onActionChange: (action: SecurityAction | undefined) => void
}) {
  const t = useT()
  const groups = useQuery(groupsQuery).data
  const stores = useQuery(storesQuery()).data
  const names = useMemo(
    () => ({
      t,
      groups: new Map((groups ?? []).map((g) => [g.id, g.name])),
      stores: new Map((stores ?? []).map((s) => [s.id, s.name])),
    }),
    [t, groups, stores]
  )
  const columns = useMemo(
    () => eventColumns(t, names, subjectId),
    [t, names, subjectId]
  )
  const source = useCursorSource(useInfiniteQuery(options))
  const all = "all"

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{t.audit.title}</h2>
        <Select
          value={action ?? all}
          items={[
            { value: all, label: t.audit.allActions },
            ...securityActions.map((a) => ({
              value: a,
              label: t.audit.actions[a],
            })),
          ]}
          onValueChange={(value) => {
            onActionChange(securityActions.find((a) => a === value))
          }}
        >
          <SelectTrigger aria-label={t.audit.action} className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={all}>{t.audit.allActions}</SelectItem>
            {securityActions.map((a) => (
              <SelectItem key={a} value={a}>
                {t.audit.actions[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        label={t.audit.title}
        columns={columns}
        source={source}
        className="min-h-60 flex-1"
        empty={
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>
                {action ? t.common.nothingFound : t.audit.empty}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
    </>
  )
}

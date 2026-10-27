import { useInfiniteQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { useId, useMemo } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useCursorSource } from "@/components/data-table/sources"
import { PageHeader } from "@/components/page"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCan } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { formatInstant } from "@/lib/instant"

import {
  revaluationsListOptions,
  type RevaluationFilters,
  type RevaluationListItem,
  type RevaluationStatus,
} from "./prices-api"
import { RevaluationStatusBadge } from "./revaluation-status"

export const revaluationStatuses = [
  "DRAFT",
  "POSTED",
  "REVERSED",
] as const satisfies readonly RevaluationStatus[]

const column = dataTableColumns<RevaluationListItem>()

function revaluationColumns(t: Messages) {
  return column.columns([
    column.accessor("number", {
      header: t.revaluations.number,
      size: 140,
      cell: (info) => (
        <Link
          to="/revaluations/$revaluationId"
          params={{ revaluationId: info.row.original.id }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {`№${String(info.getValue())}`}
        </Link>
      ),
    }),
    column.accessor("status", {
      header: t.common.status,
      size: 140,
      cell: (info) => <RevaluationStatusBadge status={info.getValue()} />,
    }),
    column.accessor("comment", {
      header: t.revaluations.comment,
      size: 240,
      meta: { grow: true },
      cell: (info) => info.getValue() ?? "",
    }),
    column.accessor("lineCount", {
      header: t.revaluations.lineCount,
      size: 96,
      meta: { align: "end" },
    }),
    column.accessor("createdAt", {
      header: t.revaluations.createdAt,
      size: 150,
      cell: (info) => formatInstant(info.getValue()),
    }),
    column.accessor((row) => row.createdBy.fullName, {
      id: "createdBy",
      header: t.revaluations.createdBy,
      size: 180,
    }),
    column.accessor("postedAt", {
      header: t.revaluations.postedAt,
      size: 150,
      cell: (info) => formatInstant(info.getValue()),
    }),
  ])
}

/** Every revaluation, newest first, filtered by status and by the period it was created in, through the URL. */
export function RevaluationsPage({ filters }: { filters: RevaluationFilters }) {
  const { status } = filters
  const filtered = Object.keys(filters).length > 0
  const t = useT()
  const can = useCan()
  const navigate = useNavigate({ from: "/revaluations/" })
  const columns = useMemo(() => revaluationColumns(t), [t])
  const source = useCursorSource(
    useInfiniteQuery(revaluationsListOptions(filters))
  )

  return (
    <>
      <PageHeader title={t.revaluations.title}>
        {can("PRICES_MANAGE") && (
          <Link to="/revaluations/new" className={buttonVariants()}>
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.revaluations.create}
          </Link>
        )}
      </PageHeader>
      <ToggleGroup
        variant="outline"
        aria-label={t.common.status}
        value={[status ?? "all"]}
        onValueChange={(values: string[]) => {
          const next = values[0]
          if (next === undefined) return
          void navigate({
            search: (prev) => ({
              ...prev,
              status: next === "all" ? undefined : (next as RevaluationStatus),
            }),
          })
        }}
        className="flex-wrap"
      >
        <ToggleGroupItem value="all">{t.common.all}</ToggleGroupItem>
        {revaluationStatuses.map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {t.revaluations.statuses[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="sr-only">{t.revaluations.period}</legend>
        <DayInput
          label={t.revaluations.from}
          value={filters.from}
          max={filters.to}
          onChange={(from) => {
            void navigate({ search: (prev) => ({ ...prev, from }) })
          }}
        />
        <DayInput
          label={t.revaluations.to}
          value={filters.to}
          min={filters.from}
          onChange={(to) => {
            void navigate({ search: (prev) => ({ ...prev, to }) })
          }}
        />
      </fieldset>
      <DataTable
        label={t.revaluations.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {filtered ? t.common.nothingFound : t.revaluations.empty}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
    </>
  )
}

/** A day of the period, the browser's own date picker; an emptied field drops that end of the period. */
function DayInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string | undefined
  min?: string | undefined
  max?: string | undefined
  onChange: (day: string | undefined) => void
}) {
  const id = useId()
  return (
    <Field className="w-44">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(event) => {
          onChange(event.target.value || undefined)
        }}
      />
    </Field>
  )
}

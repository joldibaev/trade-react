import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { HandshakeIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useCursorSource } from "@/components/data-table/sources"
import {
  ActiveBadge,
  ActiveStatusFilter,
  PageHeader,
  RowActions,
} from "@/components/page"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCan } from "@/features/auth/permissions"
import { priceTypesQuery } from "@/features/prices/prices-api"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { formatPhone } from "@/lib/phone"

import {
  counterpartiesListOptions,
  deleteCounterparty,
  parseCounterpartyRole,
  updateCounterparty,
  type Counterparty,
  type CounterpartyFilters,
  type CounterpartyRole,
} from "./counterparties-api"
import { CounterpartyFormDialog } from "./counterparty-form-dialog"

const column = dataTableColumns<Counterparty>()

type RowCommand = {
  kind: "edit" | "activation" | "delete"
  counterparty: Counterparty
}

function roleText(
  t: Messages,
  counterparty: Pick<Counterparty, "isSupplier" | "isCustomer">
) {
  return [
    counterparty.isSupplier && t.counterparties.supplier,
    counterparty.isCustomer && t.counterparties.customer,
  ]
    .filter(Boolean)
    .join(", ")
}

function counterpartyColumns(
  t: Messages,
  /** Price type names by id, inactive ones included: a type deactivated later stays on the card. */
  priceTypeNames: ReadonlyMap<string, string>,
  canManage: boolean,
  run: (command: RowCommand) => void
) {
  return column.columns([
    column.accessor("name", {
      header: t.counterparties.name,
      size: 260,
      meta: { grow: true },
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    column.display({
      id: "role",
      header: t.counterparties.role,
      size: 170,
      cell: (info) => roleText(t, info.row.original),
    }),
    column.accessor("phone", {
      header: t.counterparties.phone,
      size: 170,
      cell: (info) => {
        const phone = info.getValue()
        return phone === null ? "" : formatPhone(phone)
      },
    }),
    column.accessor("taxId", {
      header: t.counterparties.taxId,
      size: 150,
      cell: (info) => info.getValue() ?? "",
    }),
    column.accessor("priceTypeId", {
      header: t.counterparties.priceType,
      size: 150,
      cell: (info) => {
        const id = info.getValue()
        return id === null ? "" : (priceTypeNames.get(id) ?? "")
      },
    }),
    column.accessor("isActive", {
      header: t.common.status,
      size: 128,
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          activeLabel={t.counterparties.active}
          inactiveLabel={t.counterparties.inactive}
        />
      ),
    }),
    column.display({
      id: "actions",
      size: 56,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const counterparty = info.row.original
        return (
          <RowActions
            label={counterparty.name}
            actions={
              canManage
                ? [
                    {
                      label: t.common.edit,
                      onSelect: () => {
                        run({ kind: "edit", counterparty })
                      },
                    },
                    {
                      label: counterparty.isActive
                        ? t.counterparties.deactivate
                        : t.counterparties.activate,
                      destructive: counterparty.isActive,
                      onSelect: () => {
                        run({ kind: "activation", counterparty })
                      },
                    },
                    {
                      label: t.counterparties.delete,
                      destructive: true,
                      onSelect: () => {
                        run({ kind: "delete", counterparty })
                      },
                    },
                  ]
                : []
            }
          />
        )
      },
    }),
  ])
}

/** Suppliers and clients of the whole chain. Everyone reads it; COUNTERPARTIES_MANAGE changes it. */
export function CounterpartiesPage({
  filters,
}: {
  filters: CounterpartyFilters
}) {
  const t = useT()
  const can = useCan()
  const canManage = can("COUNTERPARTIES_MANAGE")
  const navigate = useNavigate({ from: "/counterparties" })
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [command, setCommand] = useState<RowCommand | null>(null)
  const close = () => {
    setCommand(null)
  }
  const priceTypes = useQuery(priceTypesQuery).data
  const priceTypeNames = useMemo(
    () => new Map((priceTypes ?? []).map((p) => [p.id, p.name])),
    [priceTypes]
  )
  const columns = useMemo(
    () => counterpartyColumns(t, priceTypeNames, canManage, setCommand),
    [t, priceTypeNames, canManage]
  )
  const source = useCursorSource(
    useInfiniteQuery(counterpartiesListOptions(filters))
  )
  const filtered = Object.keys(filters).length > 0

  return (
    <>
      <PageHeader title={t.counterparties.title}>
        {canManage && (
          <Button
            onClick={() => {
              setCreating(true)
            }}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.counterparties.create}
          </Button>
        )}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox key={filters.search} initial={filters.search ?? ""} />
        <RoleFilter
          value={filters.role}
          onChange={(role) => {
            void navigate({ search: (prev) => ({ ...prev, role }) })
          }}
        />
        <ActiveStatusFilter
          value={filters.status}
          onChange={(status) => {
            void navigate({ search: (prev) => ({ ...prev, status }) })
          }}
        />
      </div>
      <DataTable
        label={t.counterparties.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HandshakeIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>
                {filtered ? t.common.nothingFound : t.counterparties.empty}
              </EmptyTitle>
            </EmptyHeader>
            {filtered && (
              <EmptyContent>
                <Link
                  to="/counterparties"
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t.common.resetFilters}
                </Link>
              </EmptyContent>
            )}
          </Empty>
        }
      />
      {creating && <CounterpartyFormDialog open onOpenChange={setCreating} />}
      {command?.kind === "edit" && (
        <CounterpartyFormDialog
          counterparty={command.counterparty}
          open
          onOpenChange={close}
        />
      )}
      {command?.kind === "activation" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${command.counterparty.isActive ? t.counterparties.deactivate : t.counterparties.activate}: ${command.counterparty.name}`}
          description={
            command.counterparty.isActive
              ? t.counterparties.deactivateHint
              : t.counterparties.activateHint
          }
          confirmLabel={
            command.counterparty.isActive
              ? t.counterparties.deactivate
              : t.counterparties.activate
          }
          destructive={command.counterparty.isActive}
          failedTitle={t.common.saveFailed}
          action={() =>
            updateCounterparty(queryClient, command.counterparty, {
              isActive: !command.counterparty.isActive,
            })
          }
        />
      )}
      {command?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${t.counterparties.delete}: ${command.counterparty.name}`}
          description={t.counterparties.deleteHint}
          confirmLabel={t.counterparties.delete}
          destructive
          failedTitle={t.common.deleteFailed}
          action={() => deleteCounterparty(queryClient, command.counterparty)}
        />
      )}
    </>
  )
}

/** All / suppliers / clients; a counterparty that is both shows under either. */
function RoleFilter({
  value,
  onChange,
}: {
  value: CounterpartyRole | undefined
  onChange: (role: CounterpartyRole | undefined) => void
}) {
  const t = useT()
  const options = [
    { value: "all", label: t.common.all },
    { value: "supplier", label: t.counterparties.suppliers },
    { value: "customer", label: t.counterparties.customers },
  ] as const

  return (
    <ToggleGroup
      variant="outline"
      aria-label={t.counterparties.role}
      value={[value ?? "all"]}
      onValueChange={(values: string[]) => {
        const next = values[0]
        // Pressing the chosen item again would leave nothing chosen; the filter always has one.
        if (next === undefined) return
        onChange(parseCounterpartyRole(next))
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** The search lives in the URL (`?search=`), so Back and a shared link restore it. Sent on Enter, as for products. */
function SearchBox({ initial }: { initial: string }) {
  const t = useT()
  const navigate = useNavigate({ from: "/counterparties" })
  const [value, setValue] = useState(initial)

  return (
    <form
      role="search"
      className="w-full sm:w-80"
      onSubmit={(event) => {
        event.preventDefault()
        const search = value.trim()
        void navigate({
          search: (prev) => ({ ...prev, search: search || undefined }),
        })
      }}
    >
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label={t.counterparties.search}
          placeholder={t.counterparties.search}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
        />
      </InputGroup>
    </form>
  )
}

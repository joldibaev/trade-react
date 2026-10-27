import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { PlusIcon, StoreIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useArraySource } from "@/components/data-table/sources"
import {
  ActiveBadge,
  ActiveStatusFilter,
  isActiveFilter,
  PageHeader,
  RowActions,
  type ActiveStatus,
} from "@/components/page"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useCan, useMe } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { formatPhone } from "@/lib/phone"

import { StoreActivationDialog } from "./store-activation-dialog"
import { StoreFormDialog } from "./store-form-dialog"
import { deleteStore, storesQuery, type Store } from "./stores-api"

const column = dataTableColumns<Store>()

type RowCommand = { kind: "edit" | "activation" | "delete"; store: Store }

function storeColumns(
  t: Messages,
  canManage: boolean,
  /** Opening, closing and reopening a store is a chain decision: it needs all stores (TradeNet stores.md). */
  canOpenClose: boolean,
  run: (command: RowCommand) => void
) {
  return column.columns([
    column.accessor("name", {
      header: t.stores.name,
      size: 200,
      cell: (info) => (
        <Link
          to="/stores/$storeId"
          params={{ storeId: info.row.original.id }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    column.accessor("address", {
      header: t.stores.address,
      size: 240,
      meta: { grow: true },
      cell: (info) => info.getValue() ?? "",
    }),
    column.accessor("phone", {
      header: t.stores.phone,
      size: 160,
      cell: (info) => {
        const phone = info.getValue()
        return phone === null ? "" : formatPhone(phone)
      },
    }),
    column.accessor("cashboxes", {
      header: t.stores.cashboxes,
      size: 120,
      meta: { align: "end" },
      cell: (info) => {
        const cashboxes = info.getValue()
        if (cashboxes.length === 0) return t.stores.noCashboxes
        const active = cashboxes.filter((c) => c.isActive).length
        return `${String(active)} / ${String(cashboxes.length)}`
      },
    }),
    column.accessor("isActive", {
      header: t.common.status,
      size: 128,
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          activeLabel={t.stores.active}
          inactiveLabel={t.stores.inactive}
        />
      ),
    }),
    column.display({
      id: "actions",
      size: 56,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const store = info.row.original
        return (
          <RowActions
            label={store.name}
            actions={
              canManage
                ? [
                    {
                      label: t.common.edit,
                      onSelect: () => {
                        run({ kind: "edit", store })
                      },
                    },
                    ...(canOpenClose
                      ? [
                          {
                            label: store.isActive
                              ? t.stores.deactivate
                              : t.stores.activate,
                            destructive: store.isActive,
                            onSelect: () => {
                              run({ kind: "activation", store })
                            },
                          },
                          {
                            label: t.stores.delete,
                            destructive: true,
                            onSelect: () => {
                              run({ kind: "delete", store })
                            },
                          },
                        ]
                      : []),
                  ]
                : []
            }
          />
        )
      },
    }),
  ])
}

/** Every store the person works with, the main warehouse included. */
export function StoresPage({ status }: { status: ActiveStatus | undefined }) {
  const t = useT()
  const can = useCan()
  const me = useMe()
  const canManage = can("STORES_MANAGE")
  const canOpenClose = canManage && me.stores.all
  const navigate = useNavigate({ from: "/stores/" })
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [command, setCommand] = useState<RowCommand | null>(null)
  const columns = useMemo(
    () => storeColumns(t, canManage, canOpenClose, setCommand),
    [t, canManage, canOpenClose]
  )
  const source = useArraySource(
    useQuery(storesQuery({ isActive: isActiveFilter(status) }))
  )

  return (
    <>
      <PageHeader title={t.stores.title}>
        {canOpenClose && (
          <Button
            onClick={() => {
              setCreating(true)
            }}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.stores.create}
          </Button>
        )}
      </PageHeader>
      <ActiveStatusFilter
        value={status}
        onChange={(next) => {
          void navigate({ search: next ? { status: next } : {} })
        }}
      />
      <DataTable
        label={t.stores.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>
                {status ? t.common.nothingFound : t.stores.empty}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {creating && (
        <StoreFormDialog
          open
          onOpenChange={setCreating}
          onSaved={(store) => {
            void navigate({
              to: "/stores/$storeId",
              params: { storeId: store.id },
            })
          }}
        />
      )}
      {command?.kind === "edit" && (
        <StoreFormDialog
          store={command.store}
          open
          onOpenChange={() => {
            setCommand(null)
          }}
        />
      )}
      {command?.kind === "activation" && (
        <StoreActivationDialog
          store={command.store}
          open
          onOpenChange={() => {
            setCommand(null)
          }}
        />
      )}
      {command?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={() => {
            setCommand(null)
          }}
          title={`${t.stores.delete}: ${command.store.name}`}
          description={t.stores.deleteHint}
          confirmLabel={t.stores.delete}
          destructive
          failedTitle={t.common.deleteFailed}
          action={() => deleteStore(queryClient, command.store)}
        />
      )}
    </>
  )
}

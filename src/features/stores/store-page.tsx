import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { loadedSource } from "@/components/data-table/sources"
import {
  ActiveBadge,
  DetailsList,
  PageHeader,
  RowActions,
} from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan, useMe } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import { CashboxFormDialog } from "./cashbox-form-dialog"
import {
  CashboxActivationDialog,
  StoreActivationDialog,
} from "./store-activation-dialog"
import { StoreFormDialog } from "./store-form-dialog"
import { storeQuery, type Cashbox, type Store } from "./stores-api"

const column = dataTableColumns<Cashbox>()

type CashboxCommand = { kind: "rename" | "activation"; cashbox: Cashbox }

function cashboxColumns(
  t: Messages,
  canManage: boolean,
  run: (command: CashboxCommand) => void
) {
  return column.columns([
    column.accessor("name", {
      header: t.cashboxes.name,
      size: 240,
      meta: { grow: true },
    }),
    column.accessor("isActive", {
      header: t.common.status,
      size: 128,
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          activeLabel={t.cashboxes.active}
          inactiveLabel={t.cashboxes.inactive}
        />
      ),
    }),
    column.display({
      id: "actions",
      size: 56,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const cashbox = info.row.original
        return (
          <RowActions
            label={cashbox.name}
            actions={
              canManage
                ? [
                    {
                      label: t.cashboxes.rename,
                      onSelect: () => {
                        run({ kind: "rename", cashbox })
                      },
                    },
                    {
                      label: cashbox.isActive
                        ? t.cashboxes.deactivate
                        : t.cashboxes.activate,
                      destructive: cashbox.isActive,
                      onSelect: () => {
                        run({ kind: "activation", cashbox })
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

/** One store: its details and its cashboxes (tills). */
export function StorePage({ storeId }: { storeId: string }) {
  const t = useT()
  const query = useQuery(storeQuery(storeId))

  return (
    <>
      <Link
        to="/stores"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "self-start",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {t.stores.title}
      </Link>
      {query.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError ? (
        <ProblemAlert
          title={t.stores.loadFailed}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <StoreDetails store={query.data} />
      )}
    </>
  )
}

function StoreDetails({ store }: { store: Store }) {
  const t = useT()
  const can = useCan()
  // A manager bound to some stores edits them and their tills, but only someone with all stores closes one.
  const me = useMe()
  const canManage = can("STORES_MANAGE")
  const [dialog, setDialog] = useState<
    "edit" | "activation" | "newCashbox" | null
  >(null)
  const [command, setCommand] = useState<CashboxCommand | null>(null)
  const columns = useMemo(
    () => cashboxColumns(t, canManage, setCommand),
    [t, canManage]
  )
  const close = () => {
    setDialog(null)
  }
  const source = loadedSource(store.cashboxes)

  return (
    <>
      <PageHeader
        title={store.name}
        badge={
          <ActiveBadge
            active={store.isActive}
            activeLabel={t.stores.active}
            inactiveLabel={t.stores.inactive}
          />
        }
      >
        {canManage && (
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
            {me.stores.all && (
              <Button
                variant="outline"
                onClick={() => {
                  setDialog("activation")
                }}
              >
                {store.isActive ? t.stores.deactivate : t.stores.activate}
              </Button>
            )}
          </>
        )}
      </PageHeader>
      <Card>
        <CardContent>
          <DetailsList
            items={[
              { label: t.stores.address, value: store.address ?? "—" },
              { label: t.stores.phone, value: store.phone ?? "—" },
            ]}
          />
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {t.stores.cashboxes}
        </h2>
        {canManage && (
          <Button
            variant="outline"
            onClick={() => {
              setDialog("newCashbox")
            }}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.cashboxes.create}
          </Button>
        )}
      </div>
      <DataTable
        label={t.stores.cashboxes}
        columns={columns}
        source={source}
        className="min-h-48 flex-1"
        empty={
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{t.cashboxes.empty}</EmptyTitle>
              <EmptyDescription>{t.cashboxes.emptyHint}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
      {dialog === "edit" && (
        <StoreFormDialog store={store} open onOpenChange={close} />
      )}
      {dialog === "activation" && (
        <StoreActivationDialog store={store} open onOpenChange={close} />
      )}
      {dialog === "newCashbox" && (
        <CashboxFormDialog storeId={store.id} open onOpenChange={close} />
      )}
      {command?.kind === "rename" && (
        <CashboxFormDialog
          storeId={store.id}
          cashbox={command.cashbox}
          open
          onOpenChange={() => {
            setCommand(null)
          }}
        />
      )}
      {command?.kind === "activation" && (
        <CashboxActivationDialog
          cashbox={command.cashbox}
          open
          onOpenChange={() => {
            setCommand(null)
          }}
        />
      )}
    </>
  )
}

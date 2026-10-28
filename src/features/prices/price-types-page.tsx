import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { problemWith } from "@/api/errors"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useArraySource } from "@/components/data-table/sources"
import { useAppForm } from "@/components/form/form"
import { FormDialog, useRefusal } from "@/components/form/form-dialog"
import { ActiveBadge, PageHeader, RowActions } from "@/components/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useCan } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { textRule, textValidator } from "@/lib/text-rules"

import {
  createPriceType,
  deletePriceType,
  priceTypesQuery,
  updatePriceType,
  type PriceType,
} from "./prices-api"

const createPriceTypeNameCheck = textValidator(
  textRule("CreatePriceTypeRequest", "name")
)

const column = dataTableColumns<PriceType>()

type Command = {
  kind: "rename" | "makeDefault" | "activation" | "delete"
  priceType: PriceType
}

function priceTypeColumns(
  t: Messages,
  canManage: boolean,
  run: (command: Command) => void
) {
  return column.columns([
    column.accessor("name", {
      header: t.priceTypes.name,
      size: 240,
      meta: { grow: true },
      cell: (info) => (
        <span className="flex items-center gap-2">
          <span className="truncate">{info.getValue()}</span>
          {info.row.original.isDefault && <Badge>{t.priceTypes.default}</Badge>}
        </span>
      ),
    }),
    column.accessor("isActive", {
      header: t.common.status,
      size: 128,
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          activeLabel={t.priceTypes.active}
          inactiveLabel={t.priceTypes.inactive}
        />
      ),
    }),
    column.display({
      id: "actions",
      size: 56,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const priceType = info.row.original
        const actions = [
          {
            label: t.priceTypes.rename,
            onSelect: () => {
              run({ kind: "rename", priceType })
            },
          },
          // An inactive type cannot become the default, and the default can be neither deactivated nor deleted
          // (TradeNet prices.md).
          ...(priceType.isActive && !priceType.isDefault
            ? [
                {
                  label: t.priceTypes.makeDefault,
                  onSelect: () => {
                    run({ kind: "makeDefault", priceType })
                  },
                },
              ]
            : []),
          ...(!priceType.isDefault
            ? [
                {
                  label: priceType.isActive
                    ? t.priceTypes.deactivate
                    : t.priceTypes.activate,
                  destructive: priceType.isActive,
                  onSelect: () => {
                    run({ kind: "activation", priceType })
                  },
                },
                {
                  label: t.priceTypes.delete,
                  destructive: true,
                  onSelect: () => {
                    run({ kind: "delete", priceType })
                  },
                },
              ]
            : []),
        ]
        return (
          <RowActions
            label={priceType.name}
            actions={canManage ? actions : []}
          />
        )
      },
    }),
  ])
}

/** Retail, wholesale…: the price columns of the chain. Exactly one is the default, the one a receipt starts with. */
export function PriceTypesPage() {
  const t = useT()
  const can = useCan()
  const canManage = can("PRICES_MANAGE")
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [command, setCommand] = useState<Command | null>(null)
  const close = () => {
    setCommand(null)
  }
  const columns = useMemo(
    () => priceTypeColumns(t, canManage, setCommand),
    [t, canManage]
  )
  const source = useArraySource(useQuery(priceTypesQuery))

  return (
    <>
      <PageHeader title={t.priceTypes.title}>
        {canManage && (
          <Button
            onClick={() => {
              setCreating(true)
            }}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.priceTypes.create}
          </Button>
        )}
      </PageHeader>
      <p className="text-sm text-muted-foreground">{t.priceTypes.hint}</p>
      <DataTable
        label={t.priceTypes.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.priceTypes.empty}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {creating && <PriceTypeFormDialog open onOpenChange={setCreating} />}
      {command?.kind === "rename" && (
        <PriceTypeFormDialog
          priceType={command.priceType}
          open
          onOpenChange={close}
        />
      )}
      {command?.kind === "makeDefault" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${t.priceTypes.makeDefault}: ${command.priceType.name}`}
          description={t.priceTypes.makeDefaultHint}
          confirmLabel={t.priceTypes.makeDefault}
          failedTitle={t.common.saveFailed}
          action={() =>
            updatePriceType(queryClient, command.priceType, {
              isDefault: true,
            })
          }
        />
      )}
      {command?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${t.priceTypes.delete}: ${command.priceType.name}`}
          description={t.priceTypes.deleteHint}
          confirmLabel={t.priceTypes.delete}
          destructive
          failedTitle={t.common.deleteFailed}
          refusalDetails={(error) => <UsedByCounterparties error={error} />}
          action={() => deletePriceType(queryClient, command.priceType)}
        />
      )}
      {command?.kind === "activation" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${command.priceType.isActive ? t.priceTypes.deactivate : t.priceTypes.activate}: ${command.priceType.name}`}
          description={
            command.priceType.isActive
              ? t.priceTypes.deactivateHint
              : t.priceTypes.activateHint
          }
          confirmLabel={
            command.priceType.isActive
              ? t.priceTypes.deactivate
              : t.priceTypes.activate
          }
          destructive={command.priceType.isActive}
          failedTitle={t.common.saveFailed}
          action={() =>
            updatePriceType(queryClient, command.priceType, {
              isActive: !command.priceType.isActive,
            })
          }
        />
      )}
    </>
  )
}

/** TradeNet names up to 20 counterparties (by name) that still have the type; that many means there may be more. */
const namedCounterparties = 20

/** The counterparties that keep a price type from being deleted, so the person knows whom to change. */
function UsedByCounterparties({ error }: { error: unknown }) {
  const t = useT()
  const names = (
    problemWith(error, "PRICE_TYPE_HAS_COUNTERPARTIES")?.counterparties ?? []
  ).map((c) => c.name)
  if (names.length === 0) return null
  return (
    <p>
      {`${t.priceTypes.usedByCounterparties} ${names.join(", ")}${names.length >= namedCounterparties ? ", …" : ""}`}
    </p>
  )
}

function PriceTypeFormDialog({
  priceType,
  open,
  onOpenChange,
}: {
  priceType?: PriceType
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  const form = useAppForm({
    defaultValues: { name: priceType?.name ?? "" },
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      const name = value.name.trim()
      try {
        if (priceType) await updatePriceType(queryClient, priceType, { name })
        else await createPriceType(queryClient, name)
        onOpenChange(false)
      } catch (error) {
        refusal.show(formApi, error)
      }
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={priceType ? t.priceTypes.renameTitle : t.priceTypes.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      // The conflict read the types again; reopening starts from them.
      onReload={() => {
        onOpenChange(false)
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton
            label={priceType ? t.common.save : t.common.create}
          />
        </form.AppForm>
      }
    >
      <form.AppField
        name="name"
        validators={{
          onChange: createPriceTypeNameCheck,
          onBlur: createPriceTypeNameCheck,
        }}
      >
        {(field) => (
          <field.TextField
            label={t.priceTypes.name}
            description={t.priceTypes.nameHint}
            required
          />
        )}
      </form.AppField>
    </FormDialog>
  )
}

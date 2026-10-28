import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { dataTableColumns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
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
import { changedFields } from "@/lib/changes"
import { nameError } from "@/lib/text-rules"

import {
  createPaymentMethod,
  deletePaymentMethod,
  paymentMethodsQuery,
  updatePaymentMethod,
  type PaymentMethod,
} from "./payment-methods-api"

const column = dataTableColumns<PaymentMethod>()

type Command = {
  kind: "edit" | "activation" | "delete"
  method: PaymentMethod
}

function paymentMethodColumns(
  t: Messages,
  canManage: boolean,
  run: (command: Command) => void
) {
  return column.columns([
    column.accessor("name", {
      header: t.paymentMethods.name,
      size: 240,
      meta: { grow: true },
      cell: (info) => (
        <span className="flex items-center gap-2">
          <span className="truncate">{info.getValue()}</span>
          {info.row.original.isCash && <Badge>{t.paymentMethods.cash}</Badge>}
        </span>
      ),
    }),
    column.accessor("isActive", {
      header: t.common.status,
      size: 128,
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          activeLabel={t.paymentMethods.active}
          inactiveLabel={t.paymentMethods.inactive}
        />
      ),
    }),
    column.display({
      id: "actions",
      size: 56,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const method = info.row.original
        return (
          <RowActions
            label={method.name}
            actions={
              canManage
                ? [
                    {
                      label: t.paymentMethods.edit,
                      onSelect: () => {
                        run({ kind: "edit", method })
                      },
                    },
                    {
                      label: method.isActive
                        ? t.paymentMethods.deactivate
                        : t.paymentMethods.activate,
                      destructive: method.isActive,
                      onSelect: () => {
                        run({ kind: "activation", method })
                      },
                    },
                    {
                      label: t.paymentMethods.delete,
                      destructive: true,
                      onSelect: () => {
                        run({ kind: "delete", method })
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

/** How the till takes money: cash, card… Everyone reads the list; `TILL_SETTINGS_MANAGE` changes it. */
export function PaymentMethodsPage() {
  const t = useT()
  const can = useCan()
  const canManage = can("TILL_SETTINGS_MANAGE")
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [command, setCommand] = useState<Command | null>(null)
  const close = () => {
    setCommand(null)
  }
  const columns = useMemo(
    () => paymentMethodColumns(t, canManage, setCommand),
    [t, canManage]
  )
  const source = useArraySource(useQuery(paymentMethodsQuery))

  return (
    <>
      <PageHeader title={t.paymentMethods.title}>
        {canManage && (
          <Button
            onClick={() => {
              setCreating(true)
            }}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.paymentMethods.create}
          </Button>
        )}
      </PageHeader>
      <p className="text-sm text-muted-foreground">{t.paymentMethods.hint}</p>
      <DataTable
        label={t.paymentMethods.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.paymentMethods.empty}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {creating && <PaymentMethodFormDialog open onOpenChange={setCreating} />}
      {command?.kind === "edit" && (
        <PaymentMethodFormDialog
          method={command.method}
          open
          onOpenChange={close}
        />
      )}
      {command?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${t.paymentMethods.delete}: ${command.method.name}`}
          description={t.paymentMethods.deleteHint}
          confirmLabel={t.paymentMethods.delete}
          destructive
          failedTitle={t.common.deleteFailed}
          action={() => deletePaymentMethod(queryClient, command.method)}
        />
      )}
      {command?.kind === "activation" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${command.method.isActive ? t.paymentMethods.deactivate : t.paymentMethods.activate}: ${command.method.name}`}
          description={
            command.method.isActive
              ? t.paymentMethods.deactivateHint
              : t.paymentMethods.activateHint
          }
          confirmLabel={
            command.method.isActive
              ? t.paymentMethods.deactivate
              : t.paymentMethods.activate
          }
          destructive={command.method.isActive}
          failedTitle={t.common.saveFailed}
          action={() =>
            updatePaymentMethod(queryClient, command.method, {
              isActive: !command.method.isActive,
            })
          }
        />
      )}
    </>
  )
}

const valuesOf = (method?: PaymentMethod) => ({
  name: method?.name ?? "",
  isCash: method?.isCash ?? false,
})

function PaymentMethodFormDialog({
  method,
  open,
  onOpenChange,
}: {
  method?: PaymentMethod
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const refusal = useRefusal()
  // What the form started from; a version conflict replaces it with what is saved now.
  const [base, setBase] = useState(method)
  const form = useAppForm({
    defaultValues: valuesOf(base),
    onSubmit: async ({ value, formApi }) => {
      refusal.clear()
      const next = { name: value.name.trim(), isCash: value.isCash }
      try {
        if (base)
          await updatePaymentMethod(
            queryClient,
            base,
            changedFields(valuesOf(base), next)
          )
        else await createPaymentMethod(queryClient, next)
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
      title={method ? t.paymentMethods.editTitle : t.paymentMethods.createTitle}
      refusal={refusal.refusal}
      refusalTitle={t.common.saveFailed}
      onReload={() => {
        if (!base) return
        void queryClient
          .query({ ...paymentMethodsQuery, staleTime: 0 })
          .then((list) => {
            const fresh = list.find((m) => m.id === base.id)
            if (!fresh) {
              onOpenChange(false)
              return
            }
            setBase(fresh)
            form.reset(valuesOf(fresh))
            refusal.clear()
          })
      }}
      formRef={refusal.formRef}
      onSubmit={() => form.handleSubmit()}
      submit={
        <form.AppForm>
          <form.SubmitButton label={method ? t.common.save : t.common.create} />
        </form.AppForm>
      }
    >
      <form.AppField
        name="name"
        validators={{ onChange: nameError, onBlur: nameError }}
      >
        {(field) => (
          <field.TextField
            label={t.paymentMethods.name}
            description={t.paymentMethods.nameHint}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="isCash">
        {(field) => (
          <field.CheckboxField
            label={t.paymentMethods.cash}
            description={t.paymentMethods.cashHint}
          />
        )}
      </form.AppField>
    </FormDialog>
  )
}

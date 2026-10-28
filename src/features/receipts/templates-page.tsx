import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { dataTableColumns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import { useArraySource } from "@/components/data-table/sources"
import { ActiveBadge, PageHeader, RowActions } from "@/components/page"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useCan } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import { ActivationConfirm, DeleteConfirm } from "./template-commands"
import {
  receiptTemplatesQuery,
  type ReceiptTemplateListItem,
} from "./templates-api"

const column = dataTableColumns<ReceiptTemplateListItem>()

type Command = {
  kind: "activation" | "delete"
  template: ReceiptTemplateListItem
}

function templateColumns(
  t: Messages,
  canManage: boolean,
  run: (command: Command) => void,
  edit: (id: string, copy: boolean) => void
) {
  return column.columns([
    // The status sits in the name cell, so the name, the roll and the actions fit a phone without scrolling.
    column.accessor("name", {
      header: t.receiptTemplates.name,
      size: 176,
      meta: { grow: true },
      cell: (info) => (
        <span className="flex min-w-0 items-center gap-2">
          {canManage ? (
            <Link
              to="/receipt-templates/$templateId"
              params={{ templateId: info.row.original.id }}
              className="truncate font-medium underline-offset-4 hover:underline"
            >
              {info.getValue()}
            </Link>
          ) : (
            <span className="truncate">{info.getValue()}</span>
          )}
          {!info.row.original.isActive && (
            <ActiveBadge
              active={false}
              activeLabel={t.receiptTemplates.active}
              inactiveLabel={t.receiptTemplates.inactive}
            />
          )}
        </span>
      ),
    }),
    column.accessor("paperWidthMm", {
      header: t.receiptTemplates.roll,
      size: 104,
      cell: (info) => `${String(info.getValue())} ${t.receiptTemplates.mm}`,
    }),
    column.display({
      id: "actions",
      size: 56,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const template = info.row.original
        return (
          <RowActions
            label={template.name}
            actions={
              canManage
                ? [
                    {
                      label: t.common.edit,
                      onSelect: () => {
                        edit(template.id, false)
                      },
                    },
                    {
                      label: t.receiptTemplates.makeCopy,
                      onSelect: () => {
                        edit(template.id, true)
                      },
                    },
                    {
                      label: template.isActive
                        ? t.receiptTemplates.deactivate
                        : t.receiptTemplates.activate,
                      destructive: template.isActive,
                      onSelect: () => {
                        run({ kind: "activation", template })
                      },
                    },
                    {
                      label: t.receiptTemplates.delete,
                      destructive: true,
                      onSelect: () => {
                        run({ kind: "delete", template })
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

/** The receipt templates; everyone reads them (the till prints with them), `TILL_SETTINGS_MANAGE` changes them. */
export function ReceiptTemplatesPage() {
  const t = useT()
  const can = useCan()
  const canManage = can("TILL_SETTINGS_MANAGE")
  const navigate = useNavigate()
  const [command, setCommand] = useState<Command | null>(null)
  const close = () => {
    setCommand(null)
  }
  const columns = useMemo(
    () =>
      templateColumns(t, canManage, setCommand, (id, copy) => {
        void (copy
          ? navigate({ to: "/receipt-templates/new", search: { from: id } })
          : navigate({
              to: "/receipt-templates/$templateId",
              params: { templateId: id },
            }))
      }),
    [t, canManage, navigate]
  )
  const source = useArraySource(useQuery(receiptTemplatesQuery))

  return (
    <>
      <PageHeader title={t.receiptTemplates.title}>
        {canManage && (
          <Link to="/receipt-templates/new" className={buttonVariants()}>
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.receiptTemplates.create}
          </Link>
        )}
      </PageHeader>
      <p className="text-sm text-muted-foreground">{t.receiptTemplates.hint}</p>
      <DataTable
        label={t.receiptTemplates.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.receiptTemplates.empty}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {command?.kind === "delete" && (
        <DeleteConfirm template={command.template} onClose={close} />
      )}
      {command?.kind === "activation" && (
        <ActivationConfirm template={command.template} onClose={close} />
      )}
    </>
  )
}

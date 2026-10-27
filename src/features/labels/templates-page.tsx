import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { PlusIcon, PrinterIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useArraySource } from "@/components/data-table/sources"
import { ActiveBadge, PageHeader, RowActions } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/permissions"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { trimDecimal } from "@/lib/decimal"

import { sampleData } from "./editor/sample"
import { LabelPreview } from "./label-preview"
import { printLabels } from "./print-frame"
import { PriceTypeSelect, usePriceTypeChoice } from "./print-job"
import {
  deleteTemplate,
  templateQuery,
  templatesQuery,
  updateTemplate,
  type LabelTemplateListItem,
} from "./templates-api"

const column = dataTableColumns<LabelTemplateListItem>()

type Command = {
  kind: "test" | "activation" | "delete"
  template: LabelTemplateListItem
}

export const templateSize = (item: { widthMm: string; heightMm: string }) =>
  `${trimDecimal(item.widthMm)} × ${trimDecimal(item.heightMm)}`

function templateColumns(
  t: Messages,
  canManage: boolean,
  run: (command: Command) => void,
  edit: (id: string, copy: boolean) => void
) {
  return column.columns([
    // The status sits in the name cell, so name, size and the actions (test print) fit a phone without scrolling.
    column.accessor("name", {
      header: t.labelTemplates.name,
      size: 176,
      meta: { grow: true },
      cell: (info) => (
        <span className="flex min-w-0 items-center gap-2">
          {canManage ? (
            <Link
              to="/label-templates/$templateId"
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
              activeLabel={t.labelTemplates.active}
              inactiveLabel={t.labelTemplates.inactive}
            />
          )}
        </span>
      ),
    }),
    column.display({
      id: "size",
      header: t.labelTemplates.size,
      size: 104,
      cell: (info) => `${templateSize(info.row.original)} ${t.labelEditor.mm}`,
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
            actions={[
              {
                label: t.labelEditor.testPrint,
                onSelect: () => {
                  run({ kind: "test", template })
                },
              },
              ...(canManage
                ? [
                    {
                      label: t.common.edit,
                      onSelect: () => {
                        edit(template.id, false)
                      },
                    },
                    {
                      label: t.labelEditor.makeCopy,
                      onSelect: () => {
                        edit(template.id, true)
                      },
                    },
                    {
                      label: template.isActive
                        ? t.labelTemplates.deactivate
                        : t.labelTemplates.activate,
                      destructive: template.isActive,
                      onSelect: () => {
                        run({ kind: "activation", template })
                      },
                    },
                    {
                      label: t.labelTemplates.delete,
                      destructive: true,
                      onSelect: () => {
                        run({ kind: "delete", template })
                      },
                    },
                  ]
                : []),
            ]}
          />
        )
      },
    }),
  ])
}

/** The label templates; everyone may test-print one, `CATALOG_MANAGE` draws, changes and deletes them. */
export function TemplatesPage() {
  const t = useT()
  const can = useCan()
  const canManage = can("CATALOG_MANAGE")
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [command, setCommand] = useState<Command | null>(null)
  const close = () => {
    setCommand(null)
  }
  const columns = useMemo(
    () =>
      templateColumns(t, canManage, setCommand, (id, copy) => {
        void (copy
          ? navigate({ to: "/label-templates/new", search: { from: id } })
          : navigate({
              to: "/label-templates/$templateId",
              params: { templateId: id },
            }))
      }),
    [t, canManage, navigate]
  )
  const source = useArraySource(useQuery(templatesQuery))

  return (
    <>
      <PageHeader title={t.labelTemplates.title}>
        {canManage && (
          <Link to="/label-templates/new" className={buttonVariants()}>
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.labelTemplates.create}
          </Link>
        )}
      </PageHeader>
      <DataTable
        label={t.labelTemplates.title}
        columns={columns}
        source={source}
        className="flex-1"
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.labelTemplates.empty}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
      {command?.kind === "test" && (
        <TestPrintDialog id={command.template.id} onClose={close} />
      )}
      {command?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${t.labelTemplates.delete}: ${command.template.name}`}
          description={t.labelTemplates.deleteHint}
          confirmLabel={t.labelTemplates.delete}
          destructive
          failedTitle={t.common.deleteFailed}
          action={() => deleteTemplate(queryClient, command.template)}
        />
      )}
      {command?.kind === "activation" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`${command.template.isActive ? t.labelTemplates.deactivate : t.labelTemplates.activate}: ${command.template.name}`}
          description={
            command.template.isActive
              ? t.labelTemplates.deactivateHint
              : t.labelTemplates.activateHint
          }
          confirmLabel={
            command.template.isActive
              ? t.labelTemplates.deactivate
              : t.labelTemplates.activate
          }
          destructive={command.template.isActive}
          failedTitle={t.common.saveFailed}
          action={() =>
            updateTemplate(queryClient, command.template, {
              isActive: !command.template.isActive,
            })
          }
        />
      )}
    </>
  )
}

/** One label of a template on the sample product: to check a printer and its driver settings, phone or desktop. */
function TestPrintDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT()
  const template = useQuery({ ...templateQuery(id), staleTime: 0 })
  const priceTypes = usePriceTypeChoice()
  const [error, setError] = useState<unknown>(null)
  const data = sampleData(t, {
    product: null,
    priceTypeId: priceTypes.value,
    priceTypes: priceTypes.types,
    category: "",
  })
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent closeLabel={t.common.close} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {`${t.labelEditor.testPrint}: ${template.data?.name ?? ""}`}
          </DialogTitle>
        </DialogHeader>
        <PriceTypeSelect choice={priceTypes} />
        {template.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : template.isError ? (
          <ProblemAlert
            title={t.labelEditor.loadFailed}
            error={template.error}
            onRetry={() => void template.refetch()}
          />
        ) : (
          <LabelPreview layout={template.data.layout} data={data} />
        )}
        {error !== null && (
          <ProblemAlert title={t.labels.printFailed} error={error} />
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t.common.close}
          </DialogClose>
          <Button
            disabled={!template.data}
            onClick={() => {
              if (!template.data) return
              setError(null)
              printLabels(template.data.layout, [data]).catch(
                (reason: unknown) => {
                  setError(reason)
                }
              )
            }}
          >
            <PrinterIcon data-icon="inline-start" aria-hidden />
            {t.labels.print}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

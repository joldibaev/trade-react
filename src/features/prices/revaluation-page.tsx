import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSelector } from "@tanstack/react-form"
import { Link, useBlocker, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  PlusIcon,
  Undo2Icon,
} from "lucide-react"
import { useCallback, useMemo, useState, type ReactNode } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { loadedSource } from "@/components/data-table/sources"
import { isApiError } from "@/api/errors"
import {
  FormChecksProvider,
  useFormChecks,
} from "@/components/form/form-checks"
import { focusFirstInvalid, useAppForm } from "@/components/form/form"
import { useRefusal } from "@/components/form/form-dialog"
import { DetailsList, PageHeader, RowActions } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/permissions"
import { ProductPickerDialog } from "@/features/products/product-picker-dialog"
import type { ProductListItem } from "@/features/products/products-query"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { formatDecimal } from "@/lib/decimal"
import { formatInstant } from "@/lib/instant"

import { priceKey, useCurrentPrices } from "./current-prices"
import {
  changedPrices,
  createRevaluation,
  deleteRevaluation,
  postRevaluation,
  priceTypesQuery,
  refreshRevaluation,
  reverseRevaluation,
  revaluationQuery,
  updateRevaluation,
  type PriceType,
  type Revaluation,
} from "./prices-api"
import {
  cellField,
  columnTypes,
  emptyRow,
  invalidCells,
  linesFromRows,
  rowsFromLines,
  serverFieldName,
  type GridRow,
} from "./revaluation-grid"
import { RevaluationStatusBadge } from "./revaluation-status"

/** An existing revaluation: a draft to edit, or a posted or reversed one to read (and reverse). */
export function RevaluationPage({ revaluationId }: { revaluationId: string }) {
  const t = useT()
  const query = useQuery(revaluationQuery(revaluationId))
  const types = useQuery(priceTypesQuery)

  return (
    <Frame>
      {query.isPending || types.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError || types.isError ? (
        <ProblemAlert
          title={t.revaluations.loadFailed}
          error={query.error ?? types.error}
          onRetry={() => {
            void query.refetch()
            void types.refetch()
          }}
        />
      ) : (
        // Posting or reversing changes what the screen is: it starts over from the new state.
        <RevaluationEditor
          key={`${query.data.id}:${query.data.status}`}
          revaluation={query.data}
          priceTypes={types.data}
        />
      )}
    </Frame>
  )
}

/** A revaluation not saved yet: saving creates the draft and moves to its address. */
export function NewRevaluationPage() {
  const t = useT()
  const types = useQuery(priceTypesQuery)
  return (
    <Frame>
      {types.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : types.isError ? (
        <ProblemAlert
          title={t.revaluations.loadFailed}
          error={types.error}
          onRetry={() => void types.refetch()}
        />
      ) : (
        <RevaluationEditor priceTypes={types.data} />
      )}
    </Frame>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <>
      <Link
        to="/revaluations"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "self-start",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {t.revaluations.title}
      </Link>
      {children}
    </>
  )
}

type Dialog = "post" | "delete" | "reverse" | "pick" | null

function RevaluationEditor({
  revaluation,
  priceTypes,
}: {
  revaluation?: Revaluation
  priceTypes: PriceType[]
}) {
  const t = useT()
  const can = useCan()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { refusal, formRef, show, clear } = useRefusal()
  const [dialog, setDialog] = useState<Dialog>(null)
  // Refused cells: kept outside the field meta, since a row scrolled out of view unmounts its fields.
  const checks = useFormChecks()
  const cellsInvalid = Object.keys(checks.errors).length > 0
  const close = () => {
    setDialog(null)
  }
  // The latest saved state of the draft: its version for the next write, its lines' old prices for the grid.
  const [saved, setSaved] = useState(revaluation)
  const editable =
    (!revaluation || revaluation.status === "DRAFT") && can("PRICES_MANAGE")
  // The columns are fixed while the screen is open, so a cell's field name (`rows[0].cells[1]`) keeps its meaning.
  const [types] = useState(() => columnTypes(priceTypes, revaluation?.lines))

  const initialValues = (draft: Revaluation | undefined) => ({
    comment: draft?.comment ?? "",
    rows: rowsFromLines(draft?.lines ?? [], types),
  })

  const form = useAppForm({
    defaultValues: initialValues(revaluation),
    onSubmit: async ({ value, formApi }) => {
      clear()
      // Over the whole grid, not per cell: a row scrolled out of view has no mounted field to check it.
      if (checks.refuse(invalidCells(value.rows))) return
      const { lines, fieldOfLine } = linesFromRows(value.rows)
      const comment = value.comment.trim() || null
      try {
        if (saved) {
          const updated = await updateRevaluation(queryClient, saved, {
            comment,
            lines,
          })
          setSaved(updated)
          formApi.reset(initialValues(updated))
        } else {
          const created = await createRevaluation(queryClient, {
            comment,
            lines,
          })
          formApi.reset(initialValues(created))
          await navigate({
            to: "/revaluations/$revaluationId",
            params: { revaluationId: created.id },
            replace: true,
          })
        }
      } catch (error) {
        const rename = (key: string) => serverFieldName(key, fieldOfLine)
        if (isApiError(error))
          checks.refuse(
            Object.fromEntries(
              Object.entries(error.fieldErrors)
                .filter(([key]) => rename(key).startsWith("rows["))
                .flatMap(([key, codes]) =>
                  codes[0] ? [[rename(key), codes[0]]] : []
                )
            )
          )
        show(formApi, error, rename)
      }
    },
  })

  const rows = useSelector(form.store, (state) => state.values.rows)
  const dirty = useSelector(form.store, (state) => state.isDirty)

  useBlocker({
    shouldBlockFn: () =>
      form.state.isDirty && !window.confirm(t.common.leaveUnsaved),
    enableBeforeUnload: () => form.state.isDirty,
  })

  // "Was": the old price the server wrote into a saved line; for a cell not saved yet, the current price.
  const productIds = useMemo(() => rows.map((row) => row.productId), [rows])
  // Only products with a cell no saved line covers: a saved line carries its old price, and a 5,000-line draft
  // would otherwise open with 50 requests.
  const unpriced = useMemo(() => {
    const savedCells = new Set(
      (saved?.lines ?? []).map((l) => priceKey(l.productId, l.priceTypeId))
    )
    return rows
      .filter((row) =>
        types.some((type) => !savedCells.has(priceKey(row.productId, type.id)))
      )
      .map((row) => row.productId)
  }, [rows, saved, types])
  const current = useCurrentPrices(editable ? unpriced : [])
  const oldPrice = useCallback(
    (productId: string, priceTypeId: string): string | null | undefined => {
      const line = saved?.lines.find(
        (l) => l.productId === productId && l.priceTypeId === priceTypeId
      )
      if (line) return line.oldPrice
      if (!editable) return undefined
      return current.prices.get(priceKey(productId, priceTypeId)) ?? null
    },
    [saved, editable, current.prices]
  )

  const chosen = useMemo(() => new Set(productIds), [productIds])
  const pick = useCallback(
    (product: ProductListItem) => {
      form.pushFieldValue("rows", emptyRow(product, types))
    },
    [form, types]
  )

  const columns = useMemo(
    () =>
      gridColumns({
        t,
        types,
        editable,
        oldPrice,
        renderPriceInput: (row, cell, label) => (
          <form.AppField name={cellField(row, cell)}>
            {(field) => <field.DecimalField compact label={label} />}
          </form.AppField>
        ),
        setRemoved: (row, cell, remove) => {
          form.setFieldValue(`rows[${row}].cells[${cell}].remove`, remove)
          if (remove) form.setFieldValue(cellField(row, cell), "")
        },
        removeRow: (row) => {
          void form.removeFieldValue("rows", row)
        },
      }),
    [t, types, editable, oldPrice, form]
  )

  const status = revaluation?.status ?? "DRAFT"
  const title = revaluation
    ? `${t.revaluations.document} №${String(revaluation.number)}`
    : t.revaluations.createTitle

  return (
    <form
      ref={formRef}
      noValidate
      className="flex min-h-0 flex-1 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit().then(() => {
          focusFirstInvalid(formRef.current)
        })
      }}
    >
      <FormChecksProvider value={checks}>
        <PageHeader
          title={title}
          badge={<RevaluationStatusBadge status={status} />}
        >
          {editable && (
            <>
              <form.AppForm>
                <form.SubmitButton label={t.common.save} />
              </form.AppForm>
              {saved && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={dirty}
                    aria-describedby={dirty ? "post-needs-save" : undefined}
                    onClick={() => {
                      setDialog("post")
                    }}
                  >
                    {t.revaluations.post}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDialog("delete")
                    }}
                  >
                    {t.revaluations.deleteDraft}
                  </Button>
                </>
              )}
            </>
          )}
          {revaluation?.status === "POSTED" && can("PRICES_MANAGE") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialog("reverse")
              }}
            >
              {t.revaluations.reverse}
            </Button>
          )}
        </PageHeader>
        {editable && saved && dirty && (
          <p id="post-needs-save" className="text-sm text-muted-foreground">
            {t.revaluations.saveBeforePost}
          </p>
        )}

        {revaluation && <DocumentDetails revaluation={revaluation} />}
        {editable ? (
          <form.AppField name="comment">
            {(field) => <field.TextField label={t.revaluations.comment} />}
          </form.AppField>
        ) : null}

        {refusal !== null && (
          <ProblemAlert title={t.common.saveFailed} error={refusal} />
        )}
        {cellsInvalid && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>{t.revaluations.fixCells}</AlertTitle>
            <AlertDescription>{t.revaluations.fixCellsHint}</AlertDescription>
          </Alert>
        )}
        {current.error !== null && (
          <ProblemAlert
            title={t.revaluations.currentPricesFailed}
            error={current.error}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">
            {t.revaluations.lines}
          </h2>
          {editable && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialog("pick")
              }}
            >
              <PlusIcon data-icon="inline-start" aria-hidden />
              {t.revaluations.addProducts}
            </Button>
          )}
        </div>
        <DataTable
          label={t.revaluations.lines}
          columns={columns}
          source={loadedSource(rows)}
          className="min-h-60 flex-1"
          empty={
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{t.revaluations.noLines}</EmptyTitle>
                {editable && (
                  <EmptyDescription>
                    {t.revaluations.noLinesHint}
                  </EmptyDescription>
                )}
              </EmptyHeader>
              {editable && (
                <EmptyContent>
                  <Button
                    type="button"
                    onClick={() => {
                      setDialog("pick")
                    }}
                  >
                    {t.revaluations.addProducts}
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          }
        />

        {dialog === "pick" && (
          <ProductPickerDialog
            open
            onOpenChange={close}
            chosen={chosen}
            onPick={pick}
          />
        )}
        {dialog === "post" && saved && (
          <ConfirmDialog
            open
            onOpenChange={close}
            title={`${t.revaluations.post}: №${String(saved.number)}`}
            description={t.revaluations.postHint}
            confirmLabel={t.revaluations.post}
            failedTitle={t.revaluations.postFailed}
            action={() => postRevaluation(queryClient, saved)}
            refusalDetails={(error) => (
              <ChangedPricesList
                error={error}
                revaluation={saved}
                types={types}
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      void refreshRevaluation(queryClient, saved).then(
                        (fresh) => {
                          setSaved(fresh)
                          form.reset(initialValues(fresh))
                          close()
                        }
                      )
                    }}
                  >
                    {t.revaluations.refresh}
                  </Button>
                }
              />
            )}
          />
        )}
        {dialog === "delete" && saved && (
          <ConfirmDialog
            open
            onOpenChange={close}
            title={`${t.revaluations.deleteDraft}: №${String(saved.number)}`}
            description={t.revaluations.deleteHint}
            confirmLabel={t.revaluations.deleteDraft}
            destructive
            failedTitle={t.common.saveFailed}
            action={async () => {
              await deleteRevaluation(queryClient, saved)
              form.reset()
              await navigate({ to: "/revaluations" })
            }}
          />
        )}
        {dialog === "reverse" && revaluation && (
          <ConfirmDialog
            open
            onOpenChange={close}
            title={`${t.revaluations.reverse}: №${String(revaluation.number)}`}
            description={t.revaluations.reverseHint}
            confirmLabel={t.revaluations.reverse}
            destructive
            failedTitle={t.revaluations.reverseFailed}
            action={() => reverseRevaluation(queryClient, revaluation)}
            refusalDetails={(error) => (
              <ChangedPricesList
                error={error}
                revaluation={revaluation}
                types={types}
              />
            )}
          />
        )}
      </FormChecksProvider>
    </form>
  )
}

/** Who made the document and when, and what happened to it since. */
function DocumentDetails({ revaluation }: { revaluation: Revaluation }) {
  const t = useT()
  const by = (name: string | undefined, at: string | null) =>
    name ? `${formatInstant(at)}, ${name}` : "—"
  return (
    <Card>
      <CardContent>
        <DetailsList
          items={[
            {
              label: t.revaluations.createdAt,
              value: by(revaluation.createdBy.fullName, revaluation.createdAt),
            },
            ...(revaluation.status !== "DRAFT"
              ? [
                  {
                    label: t.revaluations.postedAt,
                    value: by(
                      revaluation.postedBy?.fullName,
                      revaluation.postedAt
                    ),
                  },
                ]
              : []),
            ...(revaluation.status === "REVERSED"
              ? [
                  {
                    label: t.revaluations.reversedAt,
                    value: by(
                      revaluation.reversedBy?.fullName,
                      revaluation.reversedAt
                    ),
                  },
                ]
              : []),
            ...(revaluation.status !== "DRAFT"
              ? [
                  {
                    label: t.revaluations.comment,
                    value: revaluation.comment ?? "—",
                  },
                ]
              : []),
          ]}
        />
      </CardContent>
    </Card>
  )
}

/** The prices that stopped a posting or a storno, by product and type, with what they are now. */
function ChangedPricesList({
  error,
  revaluation,
  types,
  action,
}: {
  error: unknown
  revaluation: Revaluation
  types: readonly PriceType[]
  action?: ReactNode
}) {
  const t = useT()
  const changed = changedPrices(error)
  if (changed.length === 0) return null
  const names = new Map(revaluation.lines.map((l) => [l.productId, l]))
  const typeNames = new Map(types.map((type) => [type.id, type.name]))
  return (
    <>
      <ul className="mt-2 list-disc pl-5">
        {changed.map((line) => {
          const product = names.get(line.productId)
          return (
            <li key={priceKey(line.productId, line.priceTypeId)}>
              {product
                ? `${String(product.productCode)} ${product.productName}`
                : line.productId}
              {`, ${typeNames.get(line.priceTypeId) ?? ""}: ${t.revaluations.now} `}
              {line.currentPrice === null
                ? t.revaluations.noPrice
                : formatDecimal(line.currentPrice)}
            </li>
          )
        })}
      </ul>
      {action}
    </>
  )
}

const column = dataTableColumns<GridRow>()

function gridColumns({
  t,
  types,
  editable,
  oldPrice,
  renderPriceInput,
  setRemoved,
  removeRow,
}: {
  t: Messages
  types: readonly PriceType[]
  editable: boolean
  oldPrice: (
    productId: string,
    priceTypeId: string
  ) => string | null | undefined
  renderPriceInput: (row: number, cell: number, label: string) => ReactNode
  setRemoved: (row: number, cell: number, remove: boolean) => void
  removeRow: (row: number) => void
}) {
  const money = (value: string | null | undefined) =>
    value === undefined ? "" : value === null ? "—" : formatDecimal(value)

  return column.columns([
    column.accessor("code", {
      header: t.products.code,
      size: 80,
      meta: { align: "end" },
    }),
    column.accessor("name", {
      header: t.products.name,
      size: 220,
      meta: { grow: true },
    }),
    ...types.flatMap((type, c) => [
      column.display({
        id: `${type.id}-was`,
        header: `${type.name}: ${t.revaluations.was}`,
        size: 120,
        meta: { align: "end" },
        cell: (info) => money(oldPrice(info.row.original.productId, type.id)),
      }),
      column.display({
        id: `${type.id}-becomes`,
        header: `${type.name}: ${t.revaluations.becomes}`,
        size: 150,
        meta: { align: "end" },
        cell: (info) => {
          const row = info.row.original
          const cell = row.cells[c]
          if (!cell) return null
          const label = `${row.name}, ${type.name}`
          if (cell.remove)
            return (
              <span className="flex items-center justify-end gap-1">
                <Badge variant="destructive">{t.revaluations.removed}</Badge>
                {editable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${t.revaluations.undoRemove}: ${label}`}
                    onClick={() => {
                      setRemoved(info.row.index, c, false)
                    }}
                  >
                    <Undo2Icon aria-hidden />
                  </Button>
                )}
              </span>
            )
          if (editable) return renderPriceInput(info.row.index, c, label)
          // Read only: the saved price, as every price is shown ("12 500,00").
          return cell.price === ""
            ? ""
            : formatDecimal(cell.price.replace(",", "."))
        },
      }),
    ]),
    ...(editable
      ? [
          column.display({
            id: "actions",
            size: 56,
            header: () => <span className="sr-only">{t.common.actions}</span>,
            cell: (info) => {
              const row = info.row.original
              return (
                <RowActions
                  label={row.name}
                  actions={[
                    ...types.flatMap((type, c) =>
                      row.cells[c]?.remove
                        ? []
                        : [
                            {
                              label: `${t.revaluations.removePrice}: ${type.name}`,
                              onSelect: () => {
                                setRemoved(info.row.index, c, true)
                              },
                            },
                          ]
                    ),
                    {
                      label: t.revaluations.removeProduct,
                      destructive: true,
                      onSelect: () => {
                        removeRow(info.row.index)
                      },
                    },
                  ]}
                />
              )
            },
          }),
        ]
      : []),
  ])
}

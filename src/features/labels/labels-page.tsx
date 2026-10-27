import { useQueryClient } from "@tanstack/react-query"
import { useBlocker } from "@tanstack/react-router"
import { EyeIcon, PrinterIcon, ScanBarcodeIcon, SearchIcon } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { cn } from "cn"

import { ProblemAlert } from "@/components/problem-alert"
import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { loadedSource } from "@/components/data-table/sources"
import { PageHeader, RowActions } from "@/components/page"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ProductPickerDialog } from "@/features/products/product-picker-dialog"
import { productQuery, type Product } from "@/features/products/products-query"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import { findExact } from "./find-product"
import { LabelPreview } from "./label-preview"
import { maxLabelsPerJob, type LabelLine } from "./prepare"
import {
  CopiesInput,
  JobProblem,
  PriceTypeSelect,
  TemplateSelect,
  useLabelJob,
  useLabelSettings,
} from "./print-job"

type Row = LabelLine & { id: string }

const noneChosen: ReadonlySet<string> = new Set()

const column = dataTableColumns<Row>()

type RowEvents = {
  setBarcode: (id: string, barcode: string) => void
  setCopies: (id: string, copies: number) => void
  show: (id: string) => void
  remove: (id: string) => void
}

function rowColumns(t: Messages, events: RowEvents) {
  return column.columns([
    column.display({
      id: "line",
      header: t.labels.lineShort,
      size: 56,
      meta: { align: "end" },
      cell: (info) => String(info.row.index + 1),
    }),
    column.accessor((row) => row.product.code, {
      id: "code",
      header: t.products.code,
      size: 88,
      meta: { align: "end" },
    }),
    column.accessor((row) => row.product.name, {
      id: "name",
      header: t.products.name,
      size: 240,
      meta: { grow: true },
    }),
    column.display({
      id: "barcode",
      header: t.labels.barcode,
      size: 200,
      cell: (info) => {
        const row = info.row.original
        if (row.product.barcodes.length === 0) return t.labels.noBarcodes
        return (
          <Select
            value={row.barcode ?? ""}
            items={row.product.barcodes.map((b) => ({
              value: b.value,
              label: b.value,
            }))}
            onValueChange={(value) => {
              if (value) events.setBarcode(row.id, value)
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={`${t.labels.barcode}: ${row.product.name}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {row.product.barcodes.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
    }),
    column.display({
      id: "copies",
      header: t.labels.copies,
      size: 112,
      cell: (info) => {
        const row = info.row.original
        return (
          <CopiesInput
            id={`copies-${row.id}`}
            label={`${t.labels.copies}: ${row.product.name}`}
            hideLabel
            value={row.copies}
            onChange={(copies) => {
              events.setCopies(row.id, copies)
            }}
          />
        )
      },
    }),
    column.display({
      id: "actions",
      size: 56,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const row = info.row.original
        return (
          <RowActions
            label={row.product.name}
            actions={[
              {
                label: t.labels.showPreview,
                onSelect: () => {
                  events.show(row.id)
                },
              },
              {
                label: t.labels.removeLine,
                destructive: true,
                onSelect: () => {
                  events.remove(row.id)
                },
              },
            ]}
          />
        )
      },
    }),
  ])
}

/**
 * The print list: products added by scanner or search, a barcode and copies per line, one price type for all, and one
 * print job. The list stays after printing: the browser cannot know whether the labels came out.
 */
export function LabelsPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const labels = useLabelSettings()
  const job = useLabelJob()
  const [rows, setRows] = useState<Row[]>([])
  const [shown, setShown] = useState<string | null>(null)
  const [scan, setScan] = useState("")
  const [finding, setFinding] = useState(false)
  const [findError, setFindError] = useState<unknown>(null)
  const [picker, setPicker] = useState<{ search: string } | null>(null)
  const nextId = useRef(1)
  const scanInput = useRef<HTMLInputElement>(null)
  const total = rows.reduce((sum, row) => sum + row.copies, 0)

  useBlocker({
    shouldBlockFn: () => rows.length > 0 && !window.confirm(t.labels.leaveList),
    enableBeforeUnload: () => rows.length > 0,
  })

  /** The same product with the same barcode gets one more copy; another barcode is its own line. */
  const add = (product: Product, scanned: string | null) => {
    const barcode = scanned ?? product.barcodes[0]?.value ?? null
    setRows((current) => {
      const same = current.find(
        (row) => row.product.id === product.id && row.barcode === barcode
      )
      if (same) {
        setShown(same.id)
        return current.map((row) =>
          row === same
            ? { ...row, copies: Math.min(row.copies + 1, maxLabelsPerJob) }
            : row
        )
      }
      const id = String(nextId.current++)
      setShown(id)
      return [...current, { id, product, barcode, copies: 1 }]
    })
  }

  const events: RowEvents = useMemo(
    () => ({
      setBarcode: (id, barcode) => {
        setRows((current) =>
          current.map((row) => (row.id === id ? { ...row, barcode } : row))
        )
      },
      setCopies: (id, copies) => {
        setRows((current) =>
          current.map((row) => (row.id === id ? { ...row, copies } : row))
        )
      },
      show: setShown,
      remove: (id) => {
        setRows((current) => current.filter((row) => row.id !== id))
      },
    }),
    []
  )
  const columns = useMemo(() => rowColumns(t, events), [t, events])
  const shownRow = rows.find((row) => row.id === shown) ?? rows.at(-1)
  const preview = shownRow
    ? labels.dataFor(shownRow.product, shownRow.barcode)
    : null

  return (
    <>
      <PageHeader title={t.labels.pageTitle}>
        <Button
          disabled={
            job.printing || rows.length === 0 || labels.settings === null
          }
          onClick={() => {
            if (labels.settings) job.print(rows, labels.settings)
          }}
        >
          {job.printing ? (
            <Spinner data-icon="inline-start" aria-hidden />
          ) : (
            <PrinterIcon data-icon="inline-start" aria-hidden />
          )}
          {`${t.labels.print} (${String(total)})`}
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-end gap-3">
        <form
          role="search"
          className="w-full sm:w-80"
          onSubmit={(event) => {
            event.preventDefault()
            const text = scan.trim()
            if (!text || finding) return
            setFinding(true)
            setFindError(null)
            findExact(queryClient, text)
              .then((found) => {
                if (found) add(found.product, found.barcode)
                else setPicker({ search: text })
                setScan("")
              })
              .catch((error: unknown) => {
                setFindError(error)
              })
              .finally(() => {
                setFinding(false)
                scanInput.current?.focus()
              })
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              {finding ? (
                <Spinner aria-hidden />
              ) : (
                <ScanBarcodeIcon aria-hidden />
              )}
            </InputGroupAddon>
            <InputGroupInput
              ref={scanInput}
              type="search"
              autoComplete="off"
              aria-label={t.labels.scan}
              placeholder={t.labels.scan}
              value={scan}
              onChange={(event) => {
                setScan(event.target.value)
              }}
            />
          </InputGroup>
        </form>
        <Button
          variant="outline"
          onClick={() => {
            setPicker({ search: "" })
          }}
        >
          <SearchIcon data-icon="inline-start" aria-hidden />
          {t.labels.findProduct}
        </Button>
        <TemplateSelect choice={labels.template} />
        <PriceTypeSelect choice={labels.priceType} />
      </div>
      {findError !== null && (
        <ProblemAlert title={t.labels.findFailed} error={findError} />
      )}
      <JobProblem job={job} />
      {job.sent && (
        <Alert role="status">
          <AlertDescription>{t.labels.sent}</AlertDescription>
        </Alert>
      )}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_auto]">
        <DataTable
          label={t.labels.pageTitle}
          columns={columns}
          source={loadedSource(rows)}
          className="min-h-48"
          empty={
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{t.labels.emptyList}</EmptyTitle>
                <EmptyDescription>{t.labels.emptyListHint}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
        <section
          aria-label={t.labels.preview}
          className={cn("flex flex-col gap-2", !shownRow && "hidden lg:flex")}
        >
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
            <EyeIcon aria-hidden className="size-4" />
            {shownRow ? shownRow.product.name : t.labels.preview}
          </h2>
          <LabelPreview layout={labels.layout} data={preview} />
        </section>
      </div>
      {picker && (
        <ProductPickerDialog
          open
          initialSearch={picker.search}
          onOpenChange={() => {
            setPicker(null)
          }}
          // A product can be picked again: each pick adds one more copy of it.
          chosen={noneChosen}
          onPick={(item) => {
            void queryClient
              .query({ ...productQuery(item.id), staleTime: 0 })
              .then((product) => {
                add(product, null)
              })
              .catch((error: unknown) => {
                setFindError(error)
              })
          }}
        />
      )}
    </>
  )
}

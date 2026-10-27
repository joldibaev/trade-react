import { useInfiniteQuery } from "@tanstack/react-query"
import { CheckIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useCursorSource } from "@/components/data-table/sources"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import { productsListOptions, type ProductListItem } from "./products-query"

const column = dataTableColumns<ProductListItem>()

function pickerColumns(
  t: Messages,
  chosen: ReadonlySet<string>,
  pick: (product: ProductListItem) => void
) {
  return column.columns([
    column.accessor("code", {
      header: t.products.code,
      size: 88,
      meta: { align: "end" },
    }),
    column.accessor("name", {
      header: t.products.name,
      size: 240,
      meta: { grow: true },
    }),
    column.display({
      id: "pick",
      size: 132,
      header: () => <span className="sr-only">{t.common.actions}</span>,
      cell: (info) => {
        const product = info.row.original
        const added = chosen.has(product.id)
        return (
          <Button
            size="sm"
            variant={added ? "ghost" : "outline"}
            disabled={added}
            aria-label={`${added ? t.productPicker.added : t.productPicker.add}: ${product.name}`}
            onClick={() => {
              pick(product)
            }}
          >
            {added && <CheckIcon data-icon="inline-start" aria-hidden />}
            {added ? t.productPicker.added : t.productPicker.add}
          </Button>
        )
      },
    }),
  ])
}

/**
 * Finds products by name, code or barcode (TradeNet's search, typos and the wrong keyboard layout included) and adds
 * them to a document one by one; the dialog stays open for the next one.
 */
export function ProductPickerDialog({
  open,
  onOpenChange,
  chosen,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Products already in the document: shown as added. */
  chosen: ReadonlySet<string>
  onPick: (product: ProductListItem) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState("")
  const [search, setSearch] = useState<string | undefined>(undefined)
  const columns = useMemo(
    () => pickerColumns(t, chosen, onPick),
    [t, chosen, onPick]
  )
  const source = useCursorSource(
    useInfiniteQuery(productsListOptions({ search, status: "active" }))
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t.common.close}
        className="flex h-[min(40rem,calc(100dvh-2rem))] flex-col sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t.productPicker.title}</DialogTitle>
          <DialogDescription>{t.productPicker.hint}</DialogDescription>
        </DialogHeader>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            // React passes a submit up through the dialog's portal: the document form around must not get it.
            event.stopPropagation()
            setSearch(draft.trim() || undefined)
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label={t.products.search}
              placeholder={t.products.search}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
              }}
            />
          </InputGroup>
        </form>
        <DataTable
          label={t.productPicker.title}
          columns={columns}
          source={source}
          className="min-h-0 flex-1"
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t.products.nothingFound}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

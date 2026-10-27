import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { FolderTreeIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useCursorSource } from "@/components/data-table/sources"
import { ActiveBadge, ActiveStatusFilter, PageHeader } from "@/components/page"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCan } from "@/features/auth/permissions"
import { categoriesQuery } from "@/features/catalog/categories-api"
import { CategoryPanel } from "@/features/catalog/category-panel"
import { categoryPath, type Category } from "@/features/catalog/category-tree"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"

import { ProductFormDialog } from "./product-form-dialog"
import {
  productsListOptions,
  type ProductFilters,
  type ProductListItem,
} from "./products-query"

const column = dataTableColumns<ProductListItem>()

function productColumns(
  t: Messages,
  categories: ReadonlyMap<string, Category>
) {
  return column.columns([
    column.accessor("code", {
      header: t.products.code,
      size: 96,
      meta: { align: "end" },
    }),
    column.accessor("name", {
      header: t.products.name,
      size: 280,
      meta: { grow: true },
      cell: (info) => (
        <Link
          to="/products/$productId"
          params={{ productId: info.row.original.id }}
          className="underline-offset-4 hover:underline"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    column.accessor("categoryId", {
      header: t.products.category,
      size: 200,
      cell: (info) => {
        const id = info.getValue()
        return id === null ? "" : categoryPath(id, categories)
      },
    }),
    column.accessor("barcode", {
      header: t.products.barcode,
      size: 150,
      cell: (info) => info.getValue() ?? "",
    }),
    column.accessor("isActive", {
      header: t.products.status,
      size: 120,
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          activeLabel={t.products.active}
          inactiveLabel={t.products.inactive}
        />
      ),
    }),
  ])
}

/**
 * The catalog as trade4 laid it out: the category tree on the left (behind a button on narrow screens), the
 * products of the chosen category on the right. Every filter lives in the URL.
 */
export function ProductsPage({ filters }: { filters: ProductFilters }) {
  const t = useT()
  const can = useCan()
  const navigate = useNavigate({ from: "/products/" })
  const [creating, setCreating] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const categories = useQuery(categoriesQuery).data
  const byId = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  )
  const columns = useMemo(() => productColumns(t, byId), [t, byId])
  const source = useCursorSource(useInfiniteQuery(productsListOptions(filters)))
  const filtered = Object.keys(filters).length > 0
  const choice = {
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.withoutCategory && { withoutCategory: true as const }),
  }
  const chosenName = filters.withoutCategory
    ? t.categories.without
    : filters.categoryId
      ? (byId.get(filters.categoryId)?.name ?? "")
      : t.categories.all

  return (
    <>
      <PageHeader title={t.products.title}>
        {can("CATALOG_MANAGE") && (
          <Button
            onClick={() => {
              setCreating(true)
            }}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t.products.create}
          </Button>
        )}
      </PageHeader>
      <div className="flex min-h-0 flex-1 gap-6">
        <aside className="hidden w-64 shrink-0 flex-col lg:flex">
          <CategoryPanel selected={choice} />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="max-w-full lg:hidden"
              onClick={() => {
                setCategoriesOpen(true)
              }}
            >
              <FolderTreeIcon data-icon="inline-start" aria-hidden />
              <span className="sr-only">{t.categories.title}:</span>
              <span className="truncate">{chosenName}</span>
            </Button>
            <SearchBox key={filters.search} initial={filters.search ?? ""} />
            <ActiveStatusFilter
              value={filters.status}
              onChange={(status) => {
                void navigate({ search: (prev) => ({ ...prev, status }) })
              }}
            />
          </div>
          <DataTable
            label={t.products.title}
            columns={columns}
            source={source}
            className="flex-1"
            empty={
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    {filtered ? t.products.nothingFound : t.products.empty}
                  </EmptyTitle>
                </EmptyHeader>
                {filtered && (
                  <EmptyContent>
                    <Link
                      to="/products"
                      className={buttonVariants({ variant: "outline" })}
                    >
                      {t.common.resetFilters}
                    </Link>
                  </EmptyContent>
                )}
              </Empty>
            }
          />
        </div>
      </div>
      <Sheet open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <SheetContent
          side="left"
          closeLabel={t.common.close}
          // Below the close button in the corner, which would cover the tree's "+".
          className="p-4 pt-14"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t.categories.title}</SheetTitle>
          </SheetHeader>
          <CategoryPanel
            selected={choice}
            onNavigate={() => {
              setCategoriesOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>
      {creating && (
        <ProductFormDialog
          open
          onOpenChange={setCreating}
          defaultCategoryId={filters.categoryId}
          onSaved={(product) => {
            void navigate({
              to: "/products/$productId",
              params: { productId: product.id },
            })
          }}
        />
      )}
    </>
  )
}

/** The search lives in the URL (`?search=`), so Back and a shared link restore it. Sent on Enter, not per letter. */
function SearchBox({ initial }: { initial: string }) {
  const t = useT()
  const navigate = useNavigate({ from: "/products/" })
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
          aria-label={t.products.search}
          placeholder={t.products.search}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
        />
      </InputGroup>
    </form>
  )
}

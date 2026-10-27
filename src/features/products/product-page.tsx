import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, PencilIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ActiveBadge, DetailsList, PageHeader } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/permissions"
import {
  CurrentPricesCard,
  PriceHistory,
} from "@/features/prices/product-prices"
import { categoriesQuery } from "@/features/catalog/categories-api"
import { categoryPath } from "@/features/catalog/category-tree"
import { useT } from "@/i18n/i18n"
import { formatDecimal, trimDecimal } from "@/lib/decimal"

import { ProductFormDialog } from "./product-form-dialog"
import { productQuery, type Product } from "./products-query"

/** One product: its number, category, packages and barcodes. */
export function ProductPage({ productId }: { productId: string }) {
  const t = useT()
  const query = useQuery(productQuery(productId))

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        // Back to the list as it was (its category and search), not to an unfiltered one.
        onClick={() => {
          history.back()
        }}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {t.products.title}
      </Button>
      {query.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : query.isError ? (
        <ProblemAlert
          title={t.products.loadFailed}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ProductDetails product={query.data} />
      )}
    </>
  )
}

function ProductDetails({ product }: { product: Product }) {
  const t = useT()
  const can = useCan()
  const [editing, setEditing] = useState(false)
  const categories = useQuery(categoriesQuery).data
  const byId = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  )

  return (
    <>
      <PageHeader
        title={product.name}
        badge={
          <ActiveBadge
            active={product.isActive}
            activeLabel={t.products.active}
            inactiveLabel={t.products.inactive}
          />
        }
      >
        {can("CATALOG_MANAGE") && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing(true)
            }}
          >
            <PencilIcon data-icon="inline-start" aria-hidden />
            {t.common.edit}
          </Button>
        )}
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.products.details}</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailsList
              items={[
                { label: t.products.code, value: String(product.code) },
                {
                  label: t.products.category,
                  value:
                    product.categoryId === null ? (
                      t.products.noCategory
                    ) : (
                      <Link
                        to="/products"
                        search={{ categoryId: product.categoryId }}
                        className="underline underline-offset-4"
                      >
                        {categoryPath(product.categoryId, byId)}
                      </Link>
                    ),
                },
                {
                  label: t.products.packages,
                  value:
                    product.packages.length === 0 ? (
                      t.products.onlyPieces
                    ) : (
                      <ul>
                        {product.packages.map((p) => (
                          <li key={p.name}>
                            {p.name}: {formatDecimal(trimDecimal(p.size))}{" "}
                            {t.products.pieces}
                          </li>
                        ))}
                      </ul>
                    ),
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.products.barcodes}</CardTitle>
          </CardHeader>
          <CardContent>
            {product.barcodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.products.noBarcodes}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {product.barcodes.map((barcode, index) => (
                  <li
                    key={barcode.value}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-mono tabular-nums">
                      {barcode.value}
                    </span>
                    <span className="text-muted-foreground">
                      {barcode.package ?? t.products.piece}
                    </span>
                    {index === 0 && (
                      <Badge variant="secondary">{t.products.primary}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <CurrentPricesCard productId={product.id} />
      <PriceHistory productId={product.id} />
      {editing && (
        <ProductFormDialog product={product} open onOpenChange={setEditing} />
      )}
    </>
  )
}

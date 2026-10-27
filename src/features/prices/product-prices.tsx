import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useMemo } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { dataTableColumns } from "@/components/data-table/columns"
import { useCursorSource } from "@/components/data-table/sources"
import { DetailsList } from "@/components/page"
import { ProblemAlert } from "@/components/problem-alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/i18n/i18n"
import type { Messages } from "@/i18n/messages/ru"
import { formatDecimal } from "@/lib/decimal"
import { formatInstant } from "@/lib/instant"

import {
  priceHistoryOptions,
  priceTypesQuery,
  type PriceHistoryItem,
  type ProductPrice,
} from "./prices-api"

/** A product's price of every type, as the till reads it now; the prices come with the product. */
export function CurrentPricesCard({ prices }: { prices: ProductPrice[] }) {
  const t = useT()
  const types = useQuery(priceTypesQuery)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.prices.current}</CardTitle>
      </CardHeader>
      <CardContent>
        {types.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : types.isError ? (
          <ProblemAlert
            title={t.prices.loadFailed}
            error={types.error}
            onRetry={() => void types.refetch()}
          />
        ) : types.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.prices.noTypes}</p>
        ) : (
          <DetailsList
            items={types.data
              .filter(
                (type) =>
                  type.isActive || prices.some((p) => p.priceTypeId === type.id)
              )
              .map((type) => {
                const price = prices.find((p) => p.priceTypeId === type.id)
                return {
                  label: type.name,
                  value: price ? (
                    <span className="tabular-nums">
                      {formatDecimal(price.price)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t.prices.notSet}
                    </span>
                  ),
                }
              })}
          />
        )}
      </CardContent>
    </Card>
  )
}

const column = dataTableColumns<PriceHistoryItem>()

function historyColumns(t: Messages, typeNames: ReadonlyMap<string, string>) {
  const money = (value: string | null) =>
    value === null ? "—" : formatDecimal(value)
  return column.columns([
    column.accessor("at", {
      header: t.prices.at,
      size: 150,
      cell: (info) => formatInstant(info.getValue()),
    }),
    column.accessor("priceTypeId", {
      header: t.prices.type,
      size: 140,
      cell: (info) => typeNames.get(info.getValue()) ?? "",
    }),
    column.accessor("oldPrice", {
      header: t.revaluations.was,
      size: 120,
      meta: { align: "end" },
      cell: (info) => money(info.getValue()),
    }),
    column.accessor("newPrice", {
      header: t.revaluations.becomes,
      size: 120,
      meta: { align: "end" },
      cell: (info) => money(info.getValue()),
    }),
    column.accessor("revaluationNumber", {
      header: t.prices.document,
      size: 170,
      cell: (info) => (
        <span className="flex items-center gap-2">
          <Link
            to="/revaluations/$revaluationId"
            params={{ revaluationId: info.row.original.revaluationId }}
            className="underline-offset-4 hover:underline"
          >
            {`№${String(info.getValue())}`}
          </Link>
          {info.row.original.isReversal && (
            <Badge variant="destructive">{t.prices.reversal}</Badge>
          )}
        </span>
      ),
    }),
    column.accessor((row) => row.by.fullName, {
      id: "by",
      header: t.prices.by,
      size: 180,
      meta: { grow: true },
    }),
  ])
}

/** Every change of every price of the product, newest first; a storno shows as its own row. */
export function PriceHistory({ productId }: { productId: string }) {
  const t = useT()
  const types = useQuery(priceTypesQuery).data
  const typeNames = useMemo(
    () => new Map((types ?? []).map((type) => [type.id, type.name])),
    [types]
  )
  const columns = useMemo(() => historyColumns(t, typeNames), [t, typeNames])
  const source = useCursorSource(
    useInfiniteQuery(priceHistoryOptions(productId))
  )

  return (
    <>
      <h2 className="font-heading text-lg font-semibold">{t.prices.history}</h2>
      <DataTable
        label={t.prices.history}
        columns={columns}
        source={source}
        className="min-h-60 flex-1"
        empty={
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{t.prices.noHistory}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
    </>
  )
}

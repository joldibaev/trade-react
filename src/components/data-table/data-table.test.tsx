import { useInfiniteQuery } from "@tanstack/react-query"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/api/errors"
import { cursorListOptions, type CursorPage } from "@/api/cursor-pages"
import { renderWithProviders } from "@/test/render"

import { dataTableColumns } from "./columns"
import { DataTable } from "./data-table"
import { useCursorSource } from "./sources"

type Row = { id: string; name: string }
const column = dataTableColumns<Row>()
const columns = column.columns([column.accessor("name", { header: "Name" })])

function Harness({
  fetchPage,
}: {
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<Row>>
}) {
  const source = useCursorSource(
    useInfiniteQuery(cursorListOptions(["test"], fetchPage))
  )
  return (
    <DataTable
      label="Rows"
      columns={columns}
      source={source}
      empty={<p>No rows</p>}
    />
  )
}

// jsdom has no layout, so the virtual rows themselves are checked in the browser (e2e/products.spec.ts).
describe("DataTable", () => {
  it("shows the headers over skeleton rows while the first page loads", () => {
    renderWithProviders(<Harness fetchPage={() => new Promise(() => {})} />)

    expect(
      screen.getByRole("columnheader", { name: "Name" })
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Rows" })).toBeInTheDocument()
  })

  it("shows the empty state for a list with no rows", async () => {
    renderWithProviders(
      <Harness
        fetchPage={() => Promise.resolve({ items: [], nextCursor: null })}
      />
    )

    expect(await screen.findByText("No rows")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("replaces the table with the translated error and retries on request", async () => {
    const fetchPage = vi
      .fn<(cursor: string | undefined) => Promise<CursorPage<Row>>>()
      .mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"))
      .mockResolvedValueOnce({ items: [], nextCursor: null })
    renderWithProviders(<Harness fetchPage={fetchPage} />)

    expect(
      await screen.findByText(
        "Нет связи с сервером. Проверьте интернет и повторите."
      )
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }))

    expect(await screen.findByText("No rows")).toBeInTheDocument()
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
})

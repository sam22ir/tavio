import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import type { EntityDef, Row } from "@/core/entities/types"
import { err, ok } from "@/core/result"
import { Kanban } from "@/ui/views/kanban"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}))

const entity: EntityDef = {
  name: "crm.lead",
  labelField: "title",
  fields: [],
  kanban: { groupBy: "stage", titleField: "title", subtitleField: "owner" },
}

const columns = [
  { id: "new", label: "New" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
]

const rows: Row[] = [
  { id: "a", title: "Alpha deal", owner: "Yacine", stage: "new" },
  { id: "b", title: "Beta deal", owner: "Amel", stage: "won" },
  { id: "c", title: "Gamma deal", owner: "Karim", stage: "new" },
]

function column(label: string) {
  return screen.getByRole("region", { name: label })
}

afterEach(cleanup)

beforeEach(() => {
  toastError.mockClear()
})

describe("Kanban", () => {
  it("puts each card in the column matching its groupBy value", () => {
    render(
      <Kanban
        entity={entity}
        columns={columns}
        rows={rows}
        onMove={async () => ok(null)}
        rowHref={(r) => `/leads/${r.id}`}
      />,
    )

    const newCol = within(column("New"))
    expect(newCol.getByText("Alpha deal")).toBeTruthy()
    expect(newCol.getByText("Gamma deal")).toBeTruthy()
    expect(newCol.queryByText("Beta deal")).toBeNull()

    const wonCol = within(column("Won"))
    expect(wonCol.getByText("Beta deal")).toBeTruthy()
    expect(wonCol.getByText("Amel")).toBeTruthy()

    const lostCol = within(column("Lost"))
    expect(lostCol.getByText("kanban.empty_column")).toBeTruthy()
  })

  it("restores a card to its column and shows a toast when the move fails", async () => {
    const onMove = vi.fn(async () => err("STATE", "Cannot move this lead"))
    render(
      <Kanban
        entity={entity}
        columns={columns}
        rows={rows}
        onMove={onMove}
        rowHref={(r) => `/leads/${r.id}`}
      />,
    )

    const card = screen.getByText("Alpha deal").closest("li") as HTMLElement
    const target = column("Won")
    fireEvent.dragStart(card)
    fireEvent.dragOver(target)
    fireEvent.drop(target)

    expect(onMove).toHaveBeenCalledWith("a", "won")

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Cannot move this lead"))
    await waitFor(() => {
      expect(within(column("New")).getByText("Alpha deal")).toBeTruthy()
      expect(within(column("Won")).queryByText("Alpha deal")).toBeNull()
    })
  })
})

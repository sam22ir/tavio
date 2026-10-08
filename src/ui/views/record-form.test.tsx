import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { EntityDef, FormState } from "@/core/entities/types"
import { RecordForm } from "@/ui/views/record-form"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

afterEach(() => {
  cleanup()
  push.mockReset()
})

const entity: EntityDef = {
  name: "contacts.partner",
  labelField: "name",
  fields: [
    { name: "name", type: "text", label: "fields.name", required: true },
    { name: "email", type: "email", label: "fields.email" },
    { name: "secret", type: "text", label: "fields.secret", readonly: true },
    { name: "hiddenField", type: "text", label: "fields.hidden", form: false },
  ],
}

describe("RecordForm", () => {
  it("renders one widget per editable field", () => {
    render(<RecordForm entity={entity} action={vi.fn()} />)
    expect(screen.getByLabelText(/^fields.name/)).toBeTruthy()
    expect(screen.getByLabelText("fields.email")).toBeTruthy()
    expect(screen.queryByLabelText("fields.secret")).toBeNull()
    expect(screen.queryByLabelText("fields.hidden")).toBeNull()
  })

  it("pre-fills values and uses the submit label", () => {
    render(
      <RecordForm
        entity={entity}
        values={{ id: "1", name: "Amina" }}
        action={vi.fn()}
        submitLabel="custom.submit"
      />,
    )
    expect((screen.getByLabelText(/^fields.name/) as HTMLInputElement).value).toBe("Amina")
    expect(screen.getByRole("button", { name: "custom.submit" })).toBeTruthy()
  })

  it("shows a field error returned by the action", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({
      fieldErrors: { name: "fields.required_error" },
    }))
    render(<RecordForm entity={entity} action={action} />)
    fireEvent.submit(screen.getByRole("button").closest("form") as HTMLFormElement)
    expect(await screen.findByText("fields.required_error")).toBeTruthy()
    expect(action).toHaveBeenCalled()
  })

  it("navigates when the action returns redirectTo", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({ ok: true, redirectTo: "/en/contacts" }))
    render(<RecordForm entity={entity} action={action} />)
    fireEvent.submit(screen.getByRole("button").closest("form") as HTMLFormElement)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/contacts"))
  })
})

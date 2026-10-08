import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { Button } from "@/ui/primitives/button"

afterEach(cleanup)

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy()
  })

  it("meets the 44px touch target minimum", () => {
    render(<Button size="sm">Small</Button>)
    const className = screen.getByRole("button").className
    expect(className).toContain("min-h-11")
  })

  it("calls onClick when clicked", () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole("button", { name: "Go" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

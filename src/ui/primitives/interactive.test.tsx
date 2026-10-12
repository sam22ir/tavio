import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import { Button } from "@/ui/primitives/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/primitives/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/primitives/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs"

// jsdom has no ResizeObserver or getAnimations; HeroUI Tabs (scroll shadow, selection indicator) needs both.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.getAnimations ??= () => []
})

afterEach(cleanup)

describe("Dialog", () => {
  it("opens from an asChild Button trigger without submitting the enclosing form", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </form>
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(screen.getByText("Record payment")).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("reports open state changes for a controlled dialog", async () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Body</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})

describe("Select inside a Dialog", () => {
  it("opens the list, picks an item and reports the value", async () => {
    const onValueChange = vi.fn()
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Pay</DialogTitle>
          <Select value="cash" onValueChange={onValueChange} aria-label="method">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>
    )
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: /Cash|method/ }))
    const option = await screen.findByRole("option", { name: "Cheque" })
    fireEvent.click(option)
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("cheque"))
  })
})

describe("Tabs", () => {
  it("switches panels when another tab is clicked", async () => {
    render(
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>
        <TabsContent value="info">info panel</TabsContent>
        <TabsContent value="edit">edit panel</TabsContent>
      </Tabs>
    )
    expect(screen.getByText("info panel")).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: "Edit" }))
    await waitFor(() => expect(screen.getByText("edit panel")).toBeTruthy())
    expect(screen.queryByText("info panel")).toBeNull()
  })

  it("reports the selected value", async () => {
    const onValueChange = vi.fn()
    render(
      <Tabs defaultValue="a" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">a</TabsContent>
        <TabsContent value="b">b</TabsContent>
      </Tabs>
    )
    fireEvent.click(screen.getByRole("tab", { name: "B" }))
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("b"))
  })
})

describe("DropdownMenu", () => {
  it("opens from an asChild Button, fires onSelect and renders asChild links with their href", async () => {
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Do it</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/fr/settings">Settings</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const trigger = screen.getByRole("button", { name: "Menu" })
    expect(trigger.getAttribute("type")).toBe("button")
    fireEvent.click(trigger)
    const link = await screen.findByRole("menuitem", { name: "Settings" })
    expect(link.getAttribute("href")).toBe("/fr/settings")
    fireEvent.click(screen.getByRole("menuitem", { name: "Do it" }))
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
  })
})

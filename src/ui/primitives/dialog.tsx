"use client"

import * as React from "react"
import { Modal } from "@heroui/react"
import { Slot } from "radix-ui"
import { cn } from "@/ui/lib/cn"

// Radix-shaped API (open/onOpenChange, asChild trigger, Header/Title/Description/Footer) on top of HeroUI's Modal.

interface DialogState {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogState | null>(null)

function useDialog(): DialogState {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error("Dialog parts must be rendered inside <Dialog>")
  return ctx
}

function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [inner, setInner] = React.useState(defaultOpen)
  const controlled = open !== undefined
  const current = controlled ? open : inner
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setInner(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange]
  )
  const value = React.useMemo(() => ({ open: current, setOpen }), [current, setOpen])
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

function DialogTrigger({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDialog()
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="dialog-trigger"
      // Radix sets type="button" on the trigger (child included); without it a trigger inside a form would submit that form.
      type="button"
      {...props}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        setOpen(true)
      }}
    />
  )
}

function DialogContent({ className, children }: React.ComponentProps<"div">) {
  const { open, setOpen } = useDialog()
  // Call sites ask for a wider dialog with max-w-lg / sm:max-w-lg; HeroUI sizes the container instead.
  const size = className && /max-w-(lg|xl|2xl)/.test(className) ? "lg" : "md"
  return (
    <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
      <Modal.Container size={size}>
        <Modal.Dialog data-slot="dialog-content" className={cn("gap-4", className?.replace(/(sm:)?max-w-\S+/g, ""))}>
          {children}
          <Modal.CloseTrigger />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 text-start", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <Modal.Heading data-slot="dialog-title" className={cn("text-lg leading-none font-semibold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="dialog-description" className={cn("text-sm text-muted", className)} {...props} />
}

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger }

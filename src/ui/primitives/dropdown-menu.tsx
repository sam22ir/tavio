"use client"

import * as React from "react"
import { Dropdown, Separator } from "@heroui/react"
import { cn } from "@/ui/lib/cn"

// Radix-shaped API (Trigger asChild, Content, Item onSelect/asChild link, Label, Separator) on top of HeroUI's Dropdown.
// React Aria menus accept only collection items, so a Label is a disabled item styled as a heading.

function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <Dropdown>{children}</Dropdown>
}

function DropdownMenuTrigger({ asChild = false, children, className }: { asChild?: boolean; children: React.ReactNode; className?: string }) {
  // With asChild the child is already a pressable HeroUI Button: the menu trigger context reaches it without a wrapper.
  if (asChild && React.isValidElement<{ type?: string }>(children)) {
    // Same as Radix: the trigger never submits an enclosing form.
    return <>{React.cloneElement(children, { type: "button" })}</>
  }
  return <Dropdown.Trigger className={className}>{children}</Dropdown.Trigger>
}

function DropdownMenuContent({
  align = "start",
  className,
  children,
}: {
  align?: "start" | "center" | "end"
  className?: string
  children: React.ReactNode
}) {
  return (
    <Dropdown.Popover placement={align === "end" ? "bottom end" : "bottom start"} className={cn("min-w-48", className)}>
      <Dropdown.Menu data-slot="dropdown-menu-content">{children}</Dropdown.Menu>
    </Dropdown.Popover>
  )
}

interface DropdownMenuItemProps {
  onSelect?: () => void
  asChild?: boolean
  className?: string
  children: React.ReactNode
  "aria-current"?: React.AriaAttributes["aria-current"]
}

function DropdownMenuItem({ onSelect, asChild = false, className, children, ...rest }: DropdownMenuItemProps) {
  const id = React.useId()
  if (asChild && React.isValidElement<{ href?: string; hrefLang?: string; target?: string; children?: React.ReactNode }>(children)) {
    const link = children.props
    return (
      <Dropdown.Item id={id} textValue={typeof link.children === "string" ? link.children : id} href={link.href} hrefLang={link.hrefLang} target={link.target} className={className} {...rest}>
        {link.children}
      </Dropdown.Item>
    )
  }
  return (
    <Dropdown.Item id={id} textValue={typeof children === "string" ? children : id} onAction={onSelect} className={className} {...rest}>
      {children}
    </Dropdown.Item>
  )
}

function DropdownMenuLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <Dropdown.Item id={id} textValue={id} isDisabled className={cn("pointer-events-none text-xs font-normal text-muted opacity-100", className)}>
      {children}
    </Dropdown.Item>
  )
}

function DropdownMenuSeparator() {
  return <Separator />
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger }

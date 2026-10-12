"use client"

import * as React from "react"
import { ListBox, Select as HeroSelect } from "@heroui/react"
import { cn } from "@/ui/lib/cn"

// Radix-shaped API (value/onValueChange, Trigger/Value/Content/Item) on top of HeroUI's Select + ListBox.

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  children,
  "aria-label": ariaLabel,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  name?: string
  children: React.ReactNode
  "aria-label"?: string
}) {
  return (
    <HeroSelect
      data-slot="select"
      fullWidth
      aria-label={ariaLabel ?? name ?? "select"}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => {
        if (key !== null) onValueChange?.(String(key))
      }}
      isDisabled={disabled}
      name={name}
    >
      {children}
    </HeroSelect>
  )
}

function SelectTrigger({ className, children }: React.ComponentProps<"button">) {
  return (
    <HeroSelect.Trigger data-slot="select-trigger" className={cn("min-h-11", className)}>
      {children}
      <HeroSelect.Indicator />
    </HeroSelect.Trigger>
  )
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  return <HeroSelect.Value data-slot="select-value">{placeholder ? ({ isPlaceholder, defaultChildren }) => (isPlaceholder ? placeholder : defaultChildren) : undefined}</HeroSelect.Value>
}

function SelectContent({ children }: React.ComponentProps<"div">) {
  return (
    <HeroSelect.Popover data-slot="select-content">
      <ListBox>{children}</ListBox>
    </HeroSelect.Popover>
  )
}

function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <ListBox.Item
      id={value}
      textValue={typeof children === "string" ? children : value}
      data-slot="select-item"
      className={className}
    >
      {children}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }

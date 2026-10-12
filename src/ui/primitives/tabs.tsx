"use client"

import * as React from "react"
import { Tabs as HeroTabs } from "@heroui/react"
import { cn } from "@/ui/lib/cn"

// Radix-shaped API (value/onValueChange, List/Trigger/Content) on top of HeroUI's Tabs.

function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <HeroTabs
      data-slot="tabs"
      className={className}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onValueChange?.(String(key))}
    >
      {children}
    </HeroTabs>
  )
}

function TabsList({ className, children }: React.ComponentProps<"div">) {
  return (
    <HeroTabs.ListContainer>
      <HeroTabs.List data-slot="tabs-list" aria-label="tabs" className={cn("min-h-11", className)}>
        {children}
      </HeroTabs.List>
    </HeroTabs.ListContainer>
  )
}

function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <HeroTabs.Tab id={value} data-slot="tabs-trigger" className={className}>
      {children}
      <HeroTabs.Indicator />
    </HeroTabs.Tab>
  )
}

function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <HeroTabs.Panel id={value} data-slot="tabs-content" className={className}>
      {children}
    </HeroTabs.Panel>
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }

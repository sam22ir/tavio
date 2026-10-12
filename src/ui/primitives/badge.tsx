import * as React from "react"
import { chipVariants } from "@heroui/styles"
import { Slot } from "radix-ui"
import { cn } from "@/ui/lib/cn"

type Variant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"

// Soft pastel chips, as in the design references. Native span so it stays usable from server pages.
const CHIP = {
  default: { color: "accent", variant: "soft" },
  secondary: { color: "default", variant: "soft" },
  destructive: { color: "danger", variant: "soft" },
  outline: { color: "default", variant: "tertiary" },
  ghost: { color: "default", variant: "tertiary" },
  link: { color: "accent", variant: "tertiary" },
} as const

function badgeVariants({ variant }: { variant?: Variant | null } = {}) {
  const chip = CHIP[variant ?? "default"]
  const slots = chipVariants({ color: chip.color, variant: chip.variant, size: "sm" })
  return cn(slots.base(), "w-fit shrink-0 whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3")
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & { variant?: Variant | null; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

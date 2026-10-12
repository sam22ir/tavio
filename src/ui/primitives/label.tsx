import * as React from "react"
import { labelVariants } from "@heroui/styles"
import { cn } from "@/ui/lib/cn"

// Native <label>: no client boundary needed, so server pages can render it directly.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(labelVariants(), "flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50", className)}
      {...props}
    />
  )
}

export { Label }

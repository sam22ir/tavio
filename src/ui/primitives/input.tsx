import * as React from "react"
import { inputVariants } from "@heroui/styles"
import { cn } from "@/ui/lib/cn"

// Native <input> carrying HeroUI's field classes: server-action forms rely on name/defaultValue/FormData, so no RAC wrapper here.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant: "primary" }), "min-h-11 w-full min-w-0 text-base md:text-sm", className)}
      {...props}
    />
  )
}

export { Input }

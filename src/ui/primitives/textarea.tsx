import * as React from "react"
import { textAreaVariants } from "@heroui/styles"
import { cn } from "@/ui/lib/cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textAreaVariants({ variant: "primary" }), "flex field-sizing-content min-h-16 w-full text-base md:text-sm", className)}
      {...props}
    />
  )
}

export { Textarea }

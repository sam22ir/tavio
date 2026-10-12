import * as React from "react"
import { Button as HeroButton } from "@heroui/react"
import { buttonVariants as heroButtonVariants } from "@heroui/styles"
import { Slot } from "radix-ui"
import { cn } from "@/ui/lib/cn"

// No "use client" on purpose: server pages call buttonVariants() on <Link>, and HeroUI's Button carries its own client boundary.

type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type Size = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

const VARIANT = {
  default: "primary",
  destructive: "danger",
  outline: "outline",
  secondary: "secondary",
  ghost: "ghost",
  link: "ghost",
} as const

const SIZE = {
  default: "md",
  xs: "sm",
  sm: "sm",
  lg: "lg",
  icon: "md",
  "icon-xs": "sm",
  "icon-sm": "sm",
  "icon-lg": "lg",
} as const

interface ButtonVariantOptions {
  variant?: Variant | null
  size?: Size | null
  className?: string
}

/** HeroUI button classes with the app's 44px touch-target floor. Usable from server components. */
function buttonVariants({ variant, size, className }: ButtonVariantOptions = {}) {
  const v = variant ?? "default"
  const s = size ?? "default"
  const iconOnly = s.startsWith("icon")
  return cn(
    heroButtonVariants({ variant: VARIANT[v], size: SIZE[s], isIconOnly: iconOnly }),
    iconOnly ? "size-11" : "min-h-11",
    v === "link" && "underline-offset-4 hover:underline",
    className
  )
}

type ButtonProps = Omit<React.ComponentProps<"button">, "onClick" | "disabled" | "type" | "color"> &
  ButtonVariantOptions & {
    asChild?: boolean
    disabled?: boolean
    type?: "button" | "submit" | "reset"
    // onClick keeps the old call-site API; it is wired to HeroUI's onPress. No call site reads the event.
    onClick?: () => void
  }

function Button({ className, variant, size, asChild = false, disabled, type, onClick, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant ?? "default"}
        data-size={size ?? "default"}
        className={buttonVariants({ variant, size, className })}
        onClick={onClick}
        {...props}
      />
    )
  }

  // HeroUI's Button adds its own variant classes from these props; only the touch-target floor and caller classes go in className.
  const iconOnly = (size ?? "default").startsWith("icon")
  return (
    <HeroButton
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      variant={VARIANT[variant ?? "default"]}
      size={SIZE[size ?? "default"]}
      isIconOnly={iconOnly}
      className={cn(iconOnly ? "size-11" : "min-h-11", variant === "link" && "underline-offset-4 hover:underline", className)}
      // A native <button> inside a form submits by default; keep that so forms posting server actions are unchanged.
      type={type ?? "submit"}
      isDisabled={disabled}
      onPress={onClick}
      {...(props as Record<string, unknown>)}
    />
  )
}

export { Button, buttonVariants }

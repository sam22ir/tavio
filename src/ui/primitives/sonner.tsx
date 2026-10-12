"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "1rem",
          "--success-bg": "var(--tint-success)",
          "--success-text": "var(--tint-success-fg)",
          "--success-border": "transparent",
          "--error-bg": "var(--tint-danger)",
          "--error-text": "var(--tint-danger-fg)",
          "--error-border": "transparent",
          "--warning-bg": "var(--tint-warning)",
          "--warning-text": "var(--tint-warning-fg)",
          "--warning-border": "transparent",
          "--info-bg": "var(--tint-info)",
          "--info-text": "var(--tint-info-fg)",
          "--info-border": "transparent",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

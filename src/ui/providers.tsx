"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { I18nProvider, RouterProvider } from "@heroui/react"

// React Aria reads direction and number/date formats from I18nProvider, not from <html dir>, and navigates links through RouterProvider.
// The DZ regions keep Latin digits for Arabic.
const REGION: Record<string, string> = { ar: "ar-DZ", fr: "fr-DZ", en: "en-DZ" }

export function HeroProviders({ locale, children }: { locale: string; children: ReactNode }) {
  const router = useRouter()
  return (
    <I18nProvider locale={REGION[locale] ?? locale}>
      <RouterProvider navigate={(href, options) => router.push(href, options)} useHref={(href) => href}>
        {children}
      </RouterProvider>
    </I18nProvider>
  )
}

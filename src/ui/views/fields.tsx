"use client"

import * as React from "react"
import type { FieldDef } from "@/core/entities/types"
import { Input } from "@/ui/primitives/input"
import { Label } from "@/ui/primitives/label"
import { Textarea } from "@/ui/primitives/textarea"

export interface FieldOptionItem {
  value: string
  label: string
}

export interface FieldWidgetProps {
  field: FieldDef
  label: string
  defaultValue?: unknown
  error?: string
  options?: readonly FieldOptionItem[]
}

const INPUT_TYPES: Partial<Record<FieldDef["type"], string>> = {
  email: "email",
  phone: "tel",
  number: "number",
  money: "text",
  date: "date",
  datetime: "datetime-local",
}

function toInputValue(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return v.toISOString().slice(0, 16)
  return String(v)
}

/** One labelled form control for a field definition. Renders a native control so FormData carries its value. */
export function FieldWidget({ field, label, defaultValue, error, options }: FieldWidgetProps) {
  const id = React.useId()
  const errorId = `${id}-error`
  const describedBy = error ? errorId : undefined
  const required = field.required || undefined
  const name = field.name

  let control: React.ReactNode
  if (field.type === "boolean") {
    control = (
      <input
        id={id}
        name={name}
        type="checkbox"
        value="on"
        defaultChecked={Boolean(defaultValue)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="size-5 accent-primary"
      />
    )
  } else if (field.type === "textarea") {
    control = (
      <Textarea
        id={id}
        name={name}
        required={required}
        defaultValue={toInputValue(defaultValue)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
    )
  } else if (field.type === "select" || field.type === "relation") {
    const opts = options ?? []
    control = (
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={toInputValue(defaultValue)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
      >
        <option value="" />
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  } else {
    control = (
      <Input
        id={id}
        name={name}
        type={INPUT_TYPES[field.type] ?? "text"}
        required={required}
        inputMode={field.type === "money" ? "decimal" : undefined}
        placeholder={field.type === "money" ? "DZD" : undefined}
        defaultValue={toInputValue(defaultValue)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}

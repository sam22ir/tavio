"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useFormErrorToast } from '@/ui/feedback/use-form-error-toast';
import type { EntityDef, FormState, Row } from "@/core/entities/types"
import { Button } from "@/ui/primitives/button"
import { FieldWidget } from "@/ui/views/fields"

export interface RecordFormProps {
  entity: EntityDef
  values?: Partial<Row>
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  submitLabel?: string
  hidden?: Record<string, string>
  relationOptions?: Record<string, { value: string; label: string }[]>
}

const INITIAL_STATE: FormState = {}

export function RecordForm({
  entity,
  values,
  action,
  submitLabel,
  hidden,
  relationOptions,
}: RecordFormProps) {
  const t = useTranslations()
  const router = useRouter()
  const [state, formAction, pending] = React.useActionState(action, INITIAL_STATE)
  useFormErrorToast(state, state.ok === false && state.message ? (t.has(state.message) ? t(state.message) : state.message) : '')

  React.useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo)
  }, [state.redirectTo, router])

  const fields = entity.fields.filter((f) => f.form !== false && !f.readonly)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      {fields.map((field) => (
        <FieldWidget
          key={field.name}
          field={field}
          label={t(field.label)}
          defaultValue={values?.[field.name]}
          error={state.fieldErrors?.[field.name]}
          options={
            field.type === "relation"
              ? relationOptions?.[field.name]
              : field.options?.map((o) => ({ value: o.value, label: t(o.label) }))
          }
        />
      ))}

      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className="text-sm">
          {state.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {submitLabel ?? t("views.save")}
        </Button>
      </div>
    </form>
  )
}

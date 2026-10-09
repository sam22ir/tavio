"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"
import type { FormState } from "@/core/entities/types"
import { Button } from "@/ui/primitives/button"
import { Input } from "@/ui/primitives/input"
import { Label } from "@/ui/primitives/label"

export interface TeamFormMember {
  userId: string
  name: string
}

export interface TeamFormProps {
  team?: { id: string; name: string; leaderId: string | null; memberIds: string[] }
  members: TeamFormMember[]
  action: (prev: FormState, fd: FormData) => Promise<FormState>
}

const INITIAL_STATE: FormState = {}

export function TeamForm({ team, members, action }: TeamFormProps) {
  const t = useTranslations("crm.ui")
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, INITIAL_STATE)
  const nameId = `team-name-${team?.id ?? "new"}`
  const leaderId = `team-leader-${team?.id ?? "new"}`

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border p-4">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>{t("teamName")}</Label>
        <Input id={nameId} name="name" required maxLength={120} defaultValue={team?.name ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={leaderId}>{t("teamLeader")}</Label>
        <select
          id={leaderId}
          name="leaderId"
          defaultValue={team?.leaderId ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">{t("noLeader")}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("teamMembers")}</legend>
        {members.map((m) => (
          <label key={m.userId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="userIds"
              value={m.userId}
              defaultChecked={team?.memberIds.includes(m.userId) ?? false}
            />
            {m.name}
          </label>
        ))}
      </fieldset>

      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("teamSaved")}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {t("saveTeam")}
        </Button>
      </div>
    </form>
  )
}

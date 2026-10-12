"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOptimistic, useRef, useState, startTransition } from "react"
import { toast } from "sonner"

import type { EntityDef, Row } from "@/core/entities/types"
import type { Result } from "@/core/result"
import { Button } from "@/ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu"
import { cn } from "@/ui/lib/cn"

export interface KanbanColumn {
  id: string
  label: string
}

export interface KanbanProps {
  entity: EntityDef
  columns: KanbanColumn[]
  rows: Row[]
  onMove: (rowId: string, toColumn: string) => Promise<Result<unknown>>
  rowHref: (r: Row) => string
}

type MoveAction = { id: string; to: string }

function text(value: unknown, fallback: string): string {
  return value === null || value === undefined || value === "" ? fallback : String(value)
}

export function Kanban({ entity, columns, rows, onMove, rowHref }: KanbanProps) {
  const t = useTranslations("views")
  const groupBy = entity.kanban?.groupBy ?? ""
  const titleField = entity.kanban?.titleField ?? entity.labelField
  const subtitleField = entity.kanban?.subtitleField

  const [optimisticRows, applyMove] = useOptimistic(
    rows,
    (current: Row[], action: MoveAction) =>
      current.map((r) => (r.id === action.id ? { ...r, [groupBy]: action.to } : r)),
  )

  const [activeStage, setActiveStage] = useState(columns[0]?.id ?? "")
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)

  const move = (rowId: string, toColumn: string) => {
    const row = optimisticRows.find((r) => r.id === rowId)
    if (!row || row[groupBy] === toColumn) return
    startTransition(async () => {
      applyMove({ id: rowId, to: toColumn })
      const result = await onMove(rowId, toColumn)
      // On failure the optimistic state reverts to the `rows` prop once the transition ends.
      if (!result.ok) toast.error(result.error.message || t("error"))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={entity.name} className="flex gap-1 overflow-x-auto md:hidden">
        {columns.map((col) => (
          <Button
            key={col.id}
            role="tab"
            aria-selected={activeStage === col.id}
            variant={activeStage === col.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveStage(col.id)}
          >
            {col.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2">
        {columns.map((col) => {
          const cards = optimisticRows.filter((r) => r[groupBy] === col.id)
          const isActive = activeStage === col.id
          return (
            <section
              key={col.id}
              aria-label={col.label}
              data-column={col.id}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(col.id)
              }}
              onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(null)
                const id = dragIdRef.current
                dragIdRef.current = null
                if (id) move(id, col.id)
              }}
              className={cn(
                "min-w-0 flex-col gap-2 rounded-3xl bg-surface-secondary p-3 md:flex md:w-72 md:shrink-0",
                isActive ? "flex" : "hidden",
                dragOver === col.id && "ring-2 ring-ring",
              )}
            >
              <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
                {col.label}
                <span className="rounded-full bg-tint-neutral px-2 py-0.5 text-xs text-tint-neutral-fg tabular-nums">
                  {cards.length}
                </span>
              </h3>
              {cards.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted">
                  {t("kanban.empty_column")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((row) => (
                    <li
                      key={row.id}
                      draggable
                      onDragStart={(e) => {
                        dragIdRef.current = row.id
                        e.dataTransfer?.setData("text/plain", row.id)
                      }}
                      onDragEnd={() => {
                        dragIdRef.current = null
                      }}
                      className="flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-[0_1px_2px_rgb(20_23_28/0.04)]"
                    >
                      <Link href={rowHref(row)} className="font-medium hover:underline">
                        {text(row[titleField], row.id)}
                      </Link>
                      {subtitleField && row[subtitleField] != null ? (
                        <span className="text-sm text-muted">
                          {text(row[subtitleField], "")}
                        </span>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="xs" className="self-start">
                            {t("kanban.move")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {columns
                            .filter((c) => c.id !== col.id)
                            .map((target) => (
                              <DropdownMenuItem
                                key={target.id}
                                onSelect={() => move(row.id, target.id)}
                              >
                                {target.label}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

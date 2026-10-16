"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOptimistic, useRef, useState, startTransition } from "react"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import type { EntityDef, Row } from "@/core/entities/types"
import type { Result } from "@/core/result"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu"
import { Button } from "@/ui/primitives/button"
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
  /** Optional extra line on each card (amount, badge...). */
  cardMeta?: (r: Row) => React.ReactNode
}

type MoveAction = { id: string; to: string }

function text(value: unknown, fallback: string): string {
  return value === null || value === undefined || value === "" ? fallback : String(value)
}

export function Kanban({ entity, columns, rows, onMove, rowHref, cardMeta }: KanbanProps) {
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
      <div role="tablist" aria-label={entity.name} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:hidden">
        {columns.map((col) => {
          const active = activeStage === col.id
          return (
            <button
              key={col.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveStage(col.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
                active ? "bg-accent font-medium text-accent-foreground" : "bg-surface text-muted",
              )}
            >
              {col.label}
              <span className="tabular-nums opacity-70">
                {optimisticRows.filter((r) => r[groupBy] === col.id).length}
              </span>
            </button>
          )
        })}
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
                "min-w-0 flex-col gap-3 rounded-3xl bg-default/50 p-3 md:flex md:w-72 md:shrink-0",
                isActive ? "flex" : "hidden",
                dragOver === col.id && "bg-accent-soft ring-2 ring-accent",
              )}
            >
              <h3 className="flex items-center gap-2 px-1 pt-1 text-sm font-semibold">
                <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
                {col.label}
                <span className="ms-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
                  {cards.length}
                </span>
              </h3>
              {cards.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-separator px-1 py-6 text-center text-sm text-muted">
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
                      className="group flex cursor-grab flex-col gap-2 rounded-2xl bg-surface p-3 shadow-[0_1px_2px_rgb(20_23_28/0.04)] transition-shadow hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={rowHref(row)} className="text-sm leading-snug font-medium hover:underline">
                          {text(row[titleField], row.id)}
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("kanban.move")}
                              title={t("kanban.move")}
                              className="-m-2 size-10 min-h-0 shrink-0 rounded-full text-muted"
                            >
                              <MoreHorizontal aria-hidden="true" className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {columns
                              .filter((c) => c.id !== col.id)
                              .map((target) => (
                                <DropdownMenuItem key={target.id} onSelect={() => move(row.id, target.id)}>
                                  {target.label}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {subtitleField && row[subtitleField] != null ? (
                        <span className="text-xs text-muted">{text(row[subtitleField], "")}</span>
                      ) : null}
                      {cardMeta ? cardMeta(row) : null}
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

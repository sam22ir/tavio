'use client';

import { useState } from 'react';
import { Faq } from '@/site/components';
import { cn } from '@/ui/lib/cn';

type Group = { title: string; items: { question: string; answer: string }[] };

/**
 * Category chips filter the grouped questions. Each visible group keeps its own Accordion.
 * Chips are real buttons with aria-pressed. Chips wrap on mobile and are RTL safe.
 */
export function FaqFilter({ groups, allLabel }: { groups: Group[]; allLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const visible = active === null ? groups : groups.filter((_, i) => i === active);

  return (
    <div className="flex flex-col gap-12">
      <div role="group" aria-label={allLabel} className="flex flex-wrap gap-2">
        {[{ label: allLabel, index: null as number | null }, ...groups.map((g, i) => ({ label: g.title, index: i as number | null }))].map(
          (chip) => {
            const pressed = chip.index === active;
            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={pressed}
                onClick={() => setActive(chip.index)}
                className={cn('s-btn rounded-full px-5 py-2.5 text-sm font-medium', pressed ? 's-btn-dark' : 's-btn-light')}
              >
                {chip.label}
              </button>
            );
          },
        )}
      </div>

      {visible.map((group) => (
        <div key={group.title} className="flex flex-col gap-5">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{group.title}</h2>
          <Faq items={group.items} />
        </div>
      ))}
    </div>
  );
}

'use client';

import { Accordion } from '@heroui/react';

/**
 * FAQ built on HeroUI Accordion. Rows sit in one white panel with hairline dividers.
 * Mobile: full width.
 */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <Accordion className="s-panel overflow-hidden px-2" variant="surface">
      {items.map((item, i) => (
        <Accordion.Item key={item.question} id={String(i)}>
          <Accordion.Heading>
            <Accordion.Trigger className="px-4 py-5 text-[17px] font-medium md:px-6">
              {item.question}
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="px-4 pb-5 leading-relaxed text-[color:var(--s-muted)] md:px-6">
              <p className="max-w-[65ch]">{item.answer}</p>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

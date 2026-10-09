/**
 * Accordion built on native details/summary (no JavaScript).
 * Mobile: full width.
 */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item) => (
        <details key={item.question} className="group p-5 md:p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            {item.question}
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 max-w-[65ch] leading-relaxed text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

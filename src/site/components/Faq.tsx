/**
 * Accordion built on native details/summary (no JavaScript).
 * Mobile: full width. Rows sit in one white panel with hairline dividers.
 */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="s-panel divide-y divide-[rgba(15,26,23,0.08)] overflow-hidden px-2">
      {items.map((item) => (
        <details key={item.question} className="group px-4 py-5 md:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            {item.question}
            <span aria-hidden className="s-btn-icon !size-7 !bg-[var(--s-accent-soft)] !text-[var(--s-accent)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 max-w-[65ch] leading-relaxed text-[color:var(--s-muted)]">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

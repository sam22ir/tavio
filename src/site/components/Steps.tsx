/**
 * Numbered steps. Shows a numeral only, no "Step" prefix.
 * Mobile: 1 column. Desktop: 3 columns.
 */
export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
      {steps.map((step, i) => (
        <li key={step.title} className="flex flex-col gap-4">
          <span className="s-numeral">{i + 1}</span>
          <h3 className="text-xl">{step.title}</h3>
          <p className="leading-relaxed text-[color:var(--s-muted)]">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

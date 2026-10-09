/**
 * Numbered steps. Shows a numeral only, no "Step" prefix.
 * Mobile: 1 column. Desktop: 3 columns.
 */
export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex flex-col gap-4">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <h3 className="text-xl font-semibold">{step.title}</h3>
          <p className="leading-relaxed text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

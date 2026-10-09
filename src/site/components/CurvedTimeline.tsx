/**
 * Steps set along a hand-drawn-looking wave (desktop). Numerals drop and rise along the curve.
 * The SVG mirrors under RTL. Mobile: a plain vertical list.
 */
export function CurvedTimeline({ steps }: { steps: { title: string; body: string }[] }) {
  const offsets = ['md:translate-y-0', 'md:translate-y-14', 'md:translate-y-2', 'md:translate-y-16'];
  return (
    <div className="relative">
      <svg
        aria-hidden
        viewBox="0 0 1000 160"
        preserveAspectRatio="none"
        className="s-flip-rtl pointer-events-none absolute inset-x-0 top-10 hidden h-40 w-full md:block"
      >
        <path className="s-timeline-path" d="M20 110 C 180 20, 300 150, 470 80 S 760 10, 980 70" />
      </svg>
      <ol className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <li key={step.title} className={`flex flex-col gap-4 ${offsets[i % offsets.length]}`}>
            <span className="s-numeral">{i + 1}</span>
            <h3 className="text-xl">{step.title}</h3>
            <p className="leading-relaxed text-[color:var(--s-muted)]">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

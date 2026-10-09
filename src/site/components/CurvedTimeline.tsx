/**
 * Steps set on a wave that runs in its own band above the step texts. Markers sit on the wave at column centres.
 * Desktop: wave band over three columns. Mobile: a dashed vertical line on the start edge (mirrors in RTL).
 */
export function CurvedTimeline({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <div className="relative">
      <svg
        aria-hidden
        viewBox="0 0 1000 80"
        preserveAspectRatio="none"
        className="s-flip-rtl pointer-events-none absolute inset-x-0 top-0 hidden h-20 w-full md:block"
      >
        <path className="s-timeline-path" d="M0 40 Q 83 0 166.67 40 T 500 40 T 833.33 40 T 1000 40" />
      </svg>
      <div aria-hidden className="pointer-events-none absolute inset-y-5 start-[1.375rem] w-0 border-s-2 border-dashed border-[color:var(--s-accent)] md:hidden" />
      <ol className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex flex-col gap-4 ps-16 md:ps-0">
            <div className="absolute start-0 top-0 flex h-11 items-center md:static md:h-20 md:justify-center">
              <span className="s-numeral">{i + 1}</span>
            </div>
            <h3 className="text-xl">{step.title}</h3>
            <p className="leading-relaxed text-[color:var(--s-muted)]">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

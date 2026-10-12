import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';

/** Dashboard assistant card: a greeting and a few starter questions that open the existing /assistant page. */
export function AssistantPanel({
  href,
  title,
  hint,
  prompts,
  openLabel,
}: {
  href: string;
  title: string;
  hint: string;
  prompts: string[];
  openLabel: string;
}) {
  return (
    <section className="app-panel flex flex-col gap-4 p-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7fb2ff] to-accent text-accent-foreground shadow-[0_8px_20px_-8px_rgb(8_64_157/0.6)]"
        >
          <Sparkles className="size-6" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {prompts.map((p) => (
          <li key={p}>
            <Link
              href={href}
              className="flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2.5 text-sm transition-colors hover:bg-default"
            >
              <Sparkles aria-hidden="true" className="size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">{p}</span>
              <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted rtl:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href} className="text-center text-sm font-medium text-accent hover:underline">
        {openLabel}
      </Link>
    </section>
  );
}

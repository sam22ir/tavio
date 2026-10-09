import { Fragment } from 'react';

/** Renders `*word*` segments in the accent style (Instrument Serif italic, or Aref Ruqaa for Arabic). */
export function Emphasis({ text }: { text: string }) {
  return text.split('*').map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="s-accent">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

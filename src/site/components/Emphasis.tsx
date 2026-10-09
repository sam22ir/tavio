import { Fragment } from 'react';

/**
 * Renders `*word*` segments as emphasis: same font, bold, sky on blue or navy, Revora blue on white (see site.css).
 */
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

import { MARK_PATH, MARK_VIEWBOX } from './logo-paths';

/**
 * Huge R mark at about 6% opacity, absolutely positioned and cropped at the end side.
 * Place it inside a `relative overflow-hidden` parent. It mirrors in RTL (see `.s-watermark` in site.css).
 */
export function Watermark() {
  return (
    <div className="s-watermark" aria-hidden>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={MARK_VIEWBOX} fill="currentColor">
        <path d={MARK_PATH} />
      </svg>
    </div>
  );
}

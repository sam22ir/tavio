import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/ui/lib/cn';

const SIZE = { laptop: { w: 1440, h: 900 }, phone: { w: 390, h: 844 } } as const;

/** `/screens/<name>-<locale>.png`. Every screen ships in fr, ar and en. */
export function screenSrc(name: string, locale: string): string {
  return `/screens/${name}-${locale}.png`;
}

/**
 * Real app screenshot inside a double-bezel frame.
 * `badge` floats over one corner (start edge, mirrored in RTL). Mobile: full width of its column.
 */
export function DeviceFrame({
  name,
  locale,
  device = 'laptop',
  alt = '',
  priority = false,
  className,
  badge,
}: {
  name: string;
  locale: string;
  device?: 'laptop' | 'phone';
  alt?: string;
  priority?: boolean;
  className?: string;
  badge?: ReactNode;
}) {
  const { w, h } = SIZE[device];
  return (
    <div className={cn('relative', className)}>
      <div className="s-shell">
        <div className="s-core">
          <Image
            src={screenSrc(name, locale)}
            alt={alt}
            width={w}
            height={h}
            priority={priority}
            sizes={device === 'phone' ? '(min-width: 768px) 260px, 60vw' : '(min-width: 1024px) 760px, 92vw'}
            className="block h-auto w-full"
          />
        </div>
      </div>
      {badge ? <div className="absolute -bottom-6 end-4 md:-end-6">{badge}</div> : null}
    </div>
  );
}

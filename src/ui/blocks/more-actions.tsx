'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/ui/primitives/button';

/**
 * "More" disclosure for secondary page actions. The panel stays mounted while hidden: the buttons inside own their dialogs,
 * and unmounting them (as a popover does on close) would close a dialog the moment the user clicks inside it.
 */
export function MoreActions({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button type="button" variant="outline" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal aria-hidden="true" className="size-4" />
        {label}
      </Button>
      <div
        hidden={!open}
        className="absolute end-0 top-full z-30 mt-2 flex min-w-56 flex-col gap-2 rounded-2xl bg-surface p-3 shadow-[0_8px_30px_-8px_rgb(20_23_28/0.25)] [&_a]:w-full [&_a]:justify-start [&_button]:w-full [&_button]:justify-start"
      >
        {children}
      </div>
    </div>
  );
}

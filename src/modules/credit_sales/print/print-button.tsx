'use client';

import type { ReactNode } from 'react';

export function PrintButton({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
      >
        {label}
      </button>
      {children}
    </div>
  );
}

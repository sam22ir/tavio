'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Shows an error toast once when the page mounts. Pages render it when a server action redirected
 * back with a failure code, so the failure is never silent.
 */
export function ErrorToast({ message }: { message: string }) {
  useEffect(() => {
    toast.error(message);
  }, [message]);
  return null;
}

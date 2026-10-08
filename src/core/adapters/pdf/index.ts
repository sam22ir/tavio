import { createBrowserRenderingPdfRenderer } from './browser-rendering';
import { createGotenbergPdfRenderer } from './gotenberg';
import { PdfError, type PdfRenderer } from './types';

export type { PdfFormat, PdfOptions, PdfRenderer } from './types';
export { PdfError } from './types';

// Picks the renderer from PDF_PROVIDER. Unset or misconfigured providers throw PDF_NOT_CONFIGURED on use.
export function getPdfRenderer(env: Record<string, string | undefined> = process.env): PdfRenderer {
  const provider = env.PDF_PROVIDER;

  if (provider === 'browser-rendering') {
    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_API_TOKEN;
    if (accountId && apiToken) {
      return createBrowserRenderingPdfRenderer({ accountId, apiToken });
    }
    return notConfigured('PDF_PROVIDER=browser-rendering needs CF_ACCOUNT_ID and CF_API_TOKEN');
  }

  if (provider === 'gotenberg') {
    const baseUrl = env.GOTENBERG_URL;
    if (baseUrl) return createGotenbergPdfRenderer({ baseUrl });
    return notConfigured('PDF_PROVIDER=gotenberg needs GOTENBERG_URL');
  }

  return notConfigured('PDF_PROVIDER is not set');
}

function notConfigured(message: string): PdfRenderer {
  return {
    async fromHtml() {
      throw new PdfError('PDF_NOT_CONFIGURED', message);
    },
  };
}

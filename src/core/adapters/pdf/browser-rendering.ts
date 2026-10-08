import { PdfError, type PdfOptions, type PdfRenderer } from './types';

export interface BrowserRenderingConfig {
  accountId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
}

// Cloudflare Browser Rendering REST API: POST /accounts/{id}/browser-rendering/pdf
// Returns the PDF binary. pdfOptions.format uses lowercase values ("a4", "a5").
export function createBrowserRenderingPdfRenderer(config: BrowserRenderingConfig): PdfRenderer {
  const fetchImpl = config.fetchImpl ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/browser-rendering/pdf`;

  return {
    async fromHtml(html: string, opts: PdfOptions = {}): Promise<Uint8Array> {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          html,
          pdfOptions: {
            format: (opts.format ?? 'A4').toLowerCase(),
            landscape: opts.landscape ?? false,
            printBackground: true,
          },
        }),
      });
      if (!res.ok) {
        // Body may echo request details; only the status is surfaced.
        throw new PdfError('PDF_RENDER_FAILED', `Browser Rendering PDF failed with HTTP ${res.status}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

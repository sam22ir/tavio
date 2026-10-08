import { PdfError, type PdfOptions, type PdfRenderer } from './types';

export interface GotenbergConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

// Paper sizes in inches, as Gotenberg expects them.
const PAPER_SIZES = {
  A4: { width: '8.27', height: '11.7' },
  A5: { width: '5.83', height: '8.27' },
} as const;

// Gotenberg Chromium: multipart POST to /forms/chromium/convert/html with index.html.
export function createGotenbergPdfRenderer(config: GotenbergConfig): PdfRenderer {
  const fetchImpl = config.fetchImpl ?? fetch;
  const url = `${config.baseUrl.replace(/\/+$/, '')}/forms/chromium/convert/html`;

  return {
    async fromHtml(html: string, opts: PdfOptions = {}): Promise<Uint8Array> {
      const paper = PAPER_SIZES[opts.format ?? 'A4'];
      const form = new FormData();
      form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
      form.append('paperWidth', paper.width);
      form.append('paperHeight', paper.height);
      form.append('landscape', String(opts.landscape ?? false));
      form.append('printBackground', 'true');

      const res = await fetchImpl(url, { method: 'POST', body: form });
      if (!res.ok) {
        throw new PdfError('PDF_RENDER_FAILED', `Gotenberg PDF failed with HTTP ${res.status}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

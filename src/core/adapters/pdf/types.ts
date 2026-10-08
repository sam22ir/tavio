export type PdfFormat = 'A4' | 'A5';

export interface PdfOptions {
  format?: PdfFormat;
  landscape?: boolean;
}

export interface PdfRenderer {
  fromHtml(html: string, opts?: PdfOptions): Promise<Uint8Array>;
}

export class PdfError extends Error {
  constructor(
    readonly code: 'PDF_NOT_CONFIGURED' | 'PDF_RENDER_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

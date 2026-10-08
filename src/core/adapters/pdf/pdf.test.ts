import { describe, expect, it, vi } from 'vitest';
import { createBrowserRenderingPdfRenderer } from './browser-rendering';
import { createGotenbergPdfRenderer } from './gotenberg';
import { getPdfRenderer, PdfError } from './index';

function okResponse(bytes: number[]): Response {
  return new Response(new Uint8Array(bytes), { status: 200 });
}

describe('browser rendering renderer', () => {
  it('posts html and pdfOptions with a bearer token and returns the bytes', async () => {
    const fetchImpl = vi.fn(async () => okResponse([37, 80, 68, 70]));
    const renderer = createBrowserRenderingPdfRenderer({
      accountId: 'acc123',
      apiToken: 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const out = await renderer.fromHtml('<p>hi</p>', { format: 'A5', landscape: true });

    expect(Array.from(out)).toEqual([37, 80, 68, 70]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc123/browser-rendering/pdf');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({
      html: '<p>hi</p>',
      pdfOptions: { format: 'a5', landscape: true, printBackground: true },
    });
  });

  it('throws PDF_RENDER_FAILED on HTTP error without leaking the token', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 403 }));
    const renderer = createBrowserRenderingPdfRenderer({
      accountId: 'acc',
      apiToken: 'secret-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const err = await renderer.fromHtml('<p>x</p>').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PdfError);
    expect((err as PdfError).code).toBe('PDF_RENDER_FAILED');
    expect((err as Error).message).not.toContain('secret-token');
  });
});

describe('gotenberg renderer', () => {
  it('posts multipart index.html to the convert endpoint', async () => {
    const fetchImpl = vi.fn(async () => okResponse([1, 2, 3]));
    const renderer = createGotenbergPdfRenderer({
      baseUrl: 'http://gotenberg:3000/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const out = await renderer.fromHtml('<p>hi</p>', { landscape: true });

    expect(Array.from(out)).toEqual([1, 2, 3]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://gotenberg:3000/forms/chromium/convert/html');
    const form = init.body as FormData;
    const file = form.get('files') as File;
    expect(file.name).toBe('index.html');
    expect(await file.text()).toBe('<p>hi</p>');
    expect(form.get('landscape')).toBe('true');
    expect(form.get('paperWidth')).toBe('8.27');
  });
});

describe('getPdfRenderer', () => {
  it('throws PDF_NOT_CONFIGURED when PDF_PROVIDER is unset', async () => {
    const renderer = getPdfRenderer({});
    const err = await renderer.fromHtml('<p>x</p>').catch((e: unknown) => e);
    expect((err as PdfError).code).toBe('PDF_NOT_CONFIGURED');
  });

  it('throws PDF_NOT_CONFIGURED when the chosen provider lacks its variables', async () => {
    const renderer = getPdfRenderer({ PDF_PROVIDER: 'gotenberg' });
    const err = await renderer.fromHtml('<p>x</p>').catch((e: unknown) => e);
    expect((err as PdfError).code).toBe('PDF_NOT_CONFIGURED');
  });

  it('returns a working gotenberg renderer when configured', async () => {
    const fetchImpl = vi.fn(async () => okResponse([9]));
    vi.stubGlobal('fetch', fetchImpl);
    try {
      const out = await getPdfRenderer({ PDF_PROVIDER: 'gotenberg', GOTENBERG_URL: 'http://g:3000' }).fromHtml('<p/>');
      expect(Array.from(out)).toEqual([9]);
      expect((fetchImpl.mock.calls as unknown as [string, RequestInit][])[0]?.[0]).toBe('http://g:3000/forms/chromium/convert/html');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

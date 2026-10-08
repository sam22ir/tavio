import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getPdfRenderer, PdfError } from '@/core/adapters/pdf';
import { buildReceiptHtml } from '@/modules/credit_sales/print/receipt-html';
import { loadReceiptPrint } from '@/modules/credit_sales/print/queries';


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const locale = (await getLocale()) as Locale;
  if (!UUID_RE.test(id)) return new Response('Not found', { status: 404 });

  const input = await withPageCtx((ctx) => loadReceiptPrint(ctx, id));
  if (!input) return new Response('Not found', { status: 404 });

  const html = buildReceiptHtml(input);
  try {
    const pdf = await getPdfRenderer().fromHtml(html, { format: 'A5' });
    return new Response(pdf as BodyInit, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="receipt-${input.number}.pdf"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof PdfError && error.code === 'PDF_NOT_CONFIGURED') {
      redirect(`/${locale}/credit/receipts/${id}/print`);
    }
    throw error;
  }
}

import { getDb } from '@/core/db/client';
import { withTenant } from '@/core/db/tenant';
import { err, type AppError, type Result } from '@/core/result';
import { authenticateApiKey } from '@/modules/platform/service/api-keys';
import { parseBearer, hasScope, type ApiScope } from '@/modules/platform/service/api-keys-crypto';
import { buildOpenApiDocument } from '@/modules/platform/service/openapi';
import {
  apiTenantArgs,
  createProductRest,
  listContactsRest,
  listInvoicesRest,
  listProductsRest,
  pageQuery,
  productBody,
} from '@/modules/platform/service/rest';

export const dynamic = 'force-dynamic';

type Route = { method: 'GET' | 'POST'; path: string; scope: ApiScope };
const ROUTES: readonly Route[] = [
  { method: 'GET', path: 'contacts', scope: 'contacts:read' },
  { method: 'GET', path: 'products', scope: 'products:read' },
  { method: 'POST', path: 'products', scope: 'products:write' },
  { method: 'GET', path: 'invoices', scope: 'invoices:read' },
];

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function fail(error: AppError): Response {
  const status: Record<AppError['code'], number> = {
    VALIDATION: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    STATE: 409,
    POSTED_IMMUTABLE: 409,
    MODULE_DISABLED: 403,
    INTERNAL: 500,
  };
  // Never echo internal messages for server errors.
  return json(status[error.code] ?? 500, {
    error: { code: error.code, message: error.code === 'INTERNAL' ? 'Internal error' : error.message },
  });
}

async function handle(request: Request, segments: string[]): Promise<Response> {
  const url = new URL(request.url);
  const route = segments.join('/');

  if (request.method === 'GET' && route === 'openapi.json') {
    return json(200, buildOpenApiDocument(url.origin));
  }

  const match = ROUTES.find((r) => r.path === route && r.method === request.method);
  if (!match) return json(404, { error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } });

  const token = parseBearer(request.headers.get('authorization'));
  if (!token) return json(401, { error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid API key' } });

  const db = getDb();
  const key = await authenticateApiKey(db, token);
  if (!key) return json(401, { error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid API key' } });
  if (!hasScope(key.scopes, match.scope)) {
    return json(403, { error: { code: 'FORBIDDEN', message: `Key lacks scope ${match.scope}` } });
  }

  const args = await apiTenantArgs(db, key.companyId, key.scopes);
  if (!args.ok) return fail(args.error);

  const page = pageQuery.safeParse(Object.fromEntries(url.searchParams));
  if (request.method === 'GET' && !page.success) return fail({ code: 'VALIDATION', message: 'invalid paging' });

  let body: unknown = null;
  if (request.method === 'POST') {
    const raw = await request.json().catch(() => null);
    const parsed = productBody.safeParse(raw);
    if (!parsed.success) return fail({ code: 'VALIDATION', message: 'invalid product body' });
    body = parsed.data;
  }

  const result: Result<unknown> = await withTenant(args.value, async (ctx) => {
    switch (route) {
      case 'contacts':
        return listContactsRest(ctx, page.data ?? pageQuery.parse({}));
      case 'products':
        return request.method === 'POST' && body
          ? createProductRest(ctx, body as Parameters<typeof createProductRest>[1])
          : listProductsRest(ctx, page.data ?? pageQuery.parse({}));
      case 'invoices':
        return listInvoicesRest(ctx, page.data ?? pageQuery.parse({}));
      default:
        return err('NOT_FOUND', 'Unknown endpoint');
    }
  }).catch((e: unknown) => {
    console.error('api route failed', { name: e instanceof Error ? e.name : 'unknown' });
    return err('INTERNAL', 'Internal error');
  });

  if (!result.ok) return fail(result.error);
  if (request.method === 'POST') return json(201, { data: result.value });
  return json(200, { data: result.value, limit: page.data?.limit ?? 50, offset: page.data?.offset ?? 0 });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function run(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { path } = await context.params;
    return await handle(request, path);
  } catch (e) {
    console.error('api request failed', { name: e instanceof Error ? e.name : 'unknown' });
    return json(500, { error: { code: 'INTERNAL', message: 'Internal error' } });
  }
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return run(request, context);
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return run(request, context);
}

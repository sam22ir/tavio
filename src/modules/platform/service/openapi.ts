/** OpenAPI 3.1 description of the public REST API (W5-K). Pure: no I/O. */
export function buildOpenApiDocument(baseUrl: string): Record<string, unknown> {
  const pageParams = [
    { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
    { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
  ];
  const ok = (description: string, ref: string) => ({
    '200': { description, content: { 'application/json': { schema: { $ref: ref } } } },
    '401': { description: 'Missing or invalid API key' },
    '403': { description: 'Key lacks the required scope' },
  });
  return {
    openapi: '3.1.0',
    info: { title: 'Revora REST API', version: '1.0.0' },
    servers: [{ url: baseUrl }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key starting with tav_' },
      },
      schemas: {
        Page: {
          type: 'object',
          properties: { data: { type: 'array', items: {} }, limit: { type: 'integer' }, offset: { type: 'integer' } },
        },
        Contact: { type: 'object' },
        Product: { type: 'object' },
        Invoice: { type: 'object' },
      },
    },
    paths: {
      '/api/v1/contacts': {
        get: { summary: 'List contacts', 'x-scope': 'contacts:read', parameters: pageParams, responses: ok('Contacts', '#/components/schemas/Page') },
      },
      '/api/v1/products': {
        get: { summary: 'List products', 'x-scope': 'products:read', parameters: pageParams, responses: ok('Products', '#/components/schemas/Page') },
        post: {
          summary: 'Create a product',
          'x-scope': 'products:write',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['name', 'kind', 'uomId', 'salePrice'] } } },
          },
          responses: { '201': { description: 'Created' }, '400': { description: 'Validation error' } },
        },
      },
      '/api/v1/invoices': {
        get: { summary: 'List invoices', 'x-scope': 'invoices:read', parameters: pageParams, responses: ok('Invoices', '#/components/schemas/Page') },
      },
      '/api/v1/openapi.json': {
        get: { summary: 'This document', security: [], responses: { '200': { description: 'OpenAPI document' } } },
      },
    },
  };
}

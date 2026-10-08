const PATHS: Record<string, (id: string) => string> = {
  'contacts.partner': (id) => `/contacts/${id}`,
  'credit_sales.contract': (id) => `/credit/contracts/${id}`,
  'crm.lead': (id) => `/crm/${id}`,
};

/** Path of a record page for a chatter entity, or null when the entity has no page. */
export function entityPath(entity: string, recordId: string): string | null {
  const build = PATHS[entity];
  return build ? build(recordId) : null;
}

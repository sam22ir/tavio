import type { Ctx } from '@/core/ctx';
import type { EntityDef, ListQuery, ListResult, Row } from '@/core/entities/types';
import { ok, type Result } from '@/core/result';
import { leadEntity } from '@/modules/crm/entities';
import { listLeads } from '@/modules/crm/service/leads';
import { partnerEntity } from '@/modules/contacts/entities';
import { listPartners } from '@/modules/contacts/service/partners';
import { productEntity } from '@/modules/products/entities';
import { listProducts } from '@/modules/products/service/products';
import { webOrderEntity } from '@/modules/website/entities';
import { listWebOrders } from '@/modules/website/service/orders';
import { employeeEntity } from '@/modules/hr/entities';
import { listEmployees } from '@/modules/hr/service/employees';
import { saleOrderEntity } from '@/modules/sales/entities';
import { listSaleOrders } from '@/modules/sales/service/orders';
import { accountEntity, entryEntity } from '@/modules/accounting/entities';
import { listAccounts } from '@/modules/accounting/service/chart';
import { listEntries } from '@/modules/accounting/service/entries';
import { purchaseOrderEntity } from '@/modules/purchases/entities';
import { listOrders } from '@/modules/purchases/service/orders';
import { campaignEntity } from '@/modules/marketing/entities';
import { listCampaigns } from '@/modules/marketing/service/campaigns';
import { paymentEntity, contractEntity } from '@/modules/credit_sales/entities';
import { listPayments } from '@/modules/credit_sales/service/payments';
import { listContracts } from '@/modules/credit_sales/service/contracts';
import { projectEntity } from '@/modules/projects/entities';
import { listProjects } from '@/modules/projects/service/projects';
import { ticketEntity } from '@/modules/helpdesk/entities';
import { listTickets } from '@/modules/helpdesk/service/tickets';
import type { ExportableEntityName } from '@/ui/views/io-columns';

export const MAX_EXPORT_ROWS = 10000;

export interface ExportSource {
  entity: EntityDef;
  fileSlug: string;   // file name prefix, e.g. contacts-2026-10-10.xlsx
  readPerm: string;   // checked by the export route before the list runs
  list: (ctx: Ctx, query: ListQuery) => Promise<Result<ListResult<Row>>>;
}

type ListOutcome = Result<ListResult<Row>> | ListResult<Row>;

/** Some list services return the page directly and others a Result. Both become a Result here. */
function asResult(outcome: ListOutcome): Result<ListResult<Row>> {
  return 'ok' in outcome ? outcome : ok(outcome);
}

// Typed as a full record, so adding an exportable entity without a source is a compile error.
export const EXPORT_SOURCES: Record<ExportableEntityName, ExportSource> = {
  'contacts.partner': { entity: partnerEntity, fileSlug: 'contacts', readPerm: 'contacts.partner.read', list: listPartners },
  'products.product': { entity: productEntity, fileSlug: 'products', readPerm: 'products.product.read', list: listProducts },
  'crm.lead': { entity: leadEntity, fileSlug: 'leads', readPerm: 'crm.lead.read', list: listLeads },
  'website.web_order': { entity: webOrderEntity, fileSlug: 'web-orders', readPerm: 'website.order.read', list: listWebOrders },
  'hr.employee': { entity: employeeEntity, fileSlug: 'employees', readPerm: 'hr.employee.read', list: listEmployees },
  'sales.order': { entity: saleOrderEntity, fileSlug: 'sales', readPerm: 'sales.order.read', list: (ctx, q) => listSaleOrders(ctx, q) },
  'accounting.account': { entity: accountEntity, fileSlug: 'accounts', readPerm: 'accounting.account.read', list: async (ctx, q) => asResult(await listAccounts(ctx, q)) },
  'accounting.entry': { entity: entryEntity, fileSlug: 'entries', readPerm: 'accounting.entry.read', list: async (ctx, q) => asResult(await listEntries(ctx, q)) },
  'purchases.order': { entity: purchaseOrderEntity, fileSlug: 'purchases', readPerm: 'purchases.order.read', list: (ctx, q) => listOrders(ctx, q) },
  'marketing.campaign': { entity: campaignEntity, fileSlug: 'campaigns', readPerm: 'marketing.campaign.read', list: (ctx, q) => listCampaigns(ctx, q) },
  'credit_sales.payment': { entity: paymentEntity, fileSlug: 'payments', readPerm: 'credit_sales.payment.read', list: async (ctx, q) => asResult(await listPayments(ctx, q)) },
  'credit_sales.contract': { entity: contractEntity, fileSlug: 'contracts', readPerm: 'credit_sales.contract.read', list: async (ctx, q) => asResult(await listContracts(ctx, q)) },
  'projects.project': { entity: projectEntity, fileSlug: 'projects', readPerm: 'projects.project.read', list: (ctx, q) => listProjects(ctx, q) },
  'helpdesk.ticket': { entity: ticketEntity, fileSlug: 'tickets', readPerm: 'helpdesk.ticket.read', list: (ctx, q) => listTickets(ctx, q) },
};

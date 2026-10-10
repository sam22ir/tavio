// Side-effect module: registers every related-record link (smart button) once.
// Imported by the detail pages that mount RelatedLinks, before any count runs.
import '@/modules/contacts/relations';
import '@/modules/products/relations';
import '@/modules/projects/relations';
import '@/modules/sales/relations';
import '@/modules/purchases/relations';
import '@/modules/credit_sales/relations';
import '@/modules/hr/relations';
import '@/modules/crm/relations';
import '@/modules/invoicing/relations';

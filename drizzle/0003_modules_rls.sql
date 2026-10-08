-- Tenant isolation for every module table that has company_id, plus cross-module FKs.
-- Tables with a nullable company_id (global seed rows, e.g. activity_types) are readable when company_id is null.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.is_nullable
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'company_id'
      AND c.table_name IN ('partners','partner_contacts','product_categories','products','taxes',
        'messages','activity_types','activities','followers',
        'contracts','contract_lines','installments','payments','payment_allocations','receipts','guarantors','client_scores',
        'pipelines','stages','lost_reasons','leads','tags','tag_links')
  LOOP
    EXECUTE format('alter table %I enable row level security', r.table_name);
    EXECUTE format('drop policy if exists tenant_isolation on %I', r.table_name);
    IF r.is_nullable = 'YES' THEN
      EXECUTE format($p$create policy tenant_isolation on %I for all
        using (company_id is null or company_id = nullif(current_setting('app.company_id', true), '')::uuid)
        with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)$p$, r.table_name);
    ELSE
      EXECUTE format($p$create policy tenant_isolation on %I for all
        using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
        with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)$p$, r.table_name);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tavio_app;
--> statement-breakpoint
REVOKE ALL ON users, sessions, accounts, verifications FROM tavio_app;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON uoms, currencies FROM tavio_app;
--> statement-breakpoint
-- created_by → users on every module table that has it
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'created_by'
      AND c.table_name NOT IN ('users','sessions','accounts','verifications')
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage k
        JOIN information_schema.table_constraints tc ON tc.constraint_name = k.constraint_name AND tc.constraint_type = 'FOREIGN KEY'
        WHERE k.table_name = c.table_name AND k.column_name = 'created_by')
  LOOP
    EXECUTE format('alter table %I add constraint %I foreign key (created_by) references users(id) on delete set null',
      r.table_name, r.table_name || '_created_by_fk');
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE products ADD CONSTRAINT products_default_tax_fk FOREIGN KEY (default_tax_id) REFERENCES taxes(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE partners ADD CONSTRAINT partners_salesperson_fk FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE activities ADD CONSTRAINT activities_assignee_fk FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE activities ADD CONSTRAINT activities_done_by_fk FOREIGN KEY (done_by) REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE followers ADD CONSTRAINT followers_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE followers ADD CONSTRAINT followers_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE leads ADD CONSTRAINT leads_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE leads ADD CONSTRAINT leads_salesperson_fk FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE leads ADD CONSTRAINT leads_converted_contract_fk FOREIGN KEY (converted_contract_id) REFERENCES contracts(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE leads ADD CONSTRAINT leads_next_activity_fk FOREIGN KEY (next_activity_id) REFERENCES activities(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_lead_fk FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_salesperson_fk FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_pdf_file_fk FOREIGN KEY (pdf_file_id) REFERENCES files(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE contract_lines ADD CONSTRAINT contract_lines_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE contract_lines ADD CONSTRAINT contract_lines_uom_fk FOREIGN KEY (uom_id) REFERENCES uoms(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE contract_lines ADD CONSTRAINT contract_lines_tax_fk FOREIGN KEY (tax_id) REFERENCES taxes(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_received_by_fk FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE receipts ADD CONSTRAINT receipts_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE receipts ADD CONSTRAINT receipts_pdf_file_fk FOREIGN KEY (pdf_file_id) REFERENCES files(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE guarantors ADD CONSTRAINT guarantors_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE guarantors ADD CONSTRAINT guarantors_id_photo_fk FOREIGN KEY (id_photo_file_id) REFERENCES files(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE guarantors ADD CONSTRAINT guarantors_signed_file_fk FOREIGN KEY (signed_file_id) REFERENCES files(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE client_scores ADD CONSTRAINT client_scores_partner_fk FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE client_scores ADD CONSTRAINT client_scores_accepted_by_fk FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL;

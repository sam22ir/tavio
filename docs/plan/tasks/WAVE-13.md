# Wave 13: Mourabaha commercial process

Source: [mourabaha-gap.md](../../research/mourabaha-gap.md) (gap report and Odoo 17 research) and [mourabaha-pdf-checklist.md](../../research/mourabaha-pdf-checklist.md) (the PDF requirements, numbered). Build generic features. The Mourabaha-specific setup is seed data (W13-SEED), not hard-coded behaviour.

## Order
| Step | Tasks | Parallel |
|---|---|---|
| 13.0 | W13-EVENTS | 1 |
| 13.1 | W13-CRM, W13-ACT, W13-CREDIT, W13-PO, W13-STOCK | 5 |
| 13.2 | W13-AUTO, W13-TEAMS, W13-COCKPIT | 3 |
| 13.3 | W13-SEED | 1 |

Each task branches from `wave/13`, works in `/home/saadi/tavio-wt/<ID>` on `task/<ID>`, and opens a PR into `wave/13`. After each step the PRs are reviewed and merged. Then `wave/13` gets one PR into `main`.

## Rules for every task
- Follow `docs/plan/CONVENTIONS.md` and `AGENTS.md`. Copy the patterns of the module you are editing (schema, service, actions, ui, manifest, events, tests).
- **node_modules is a symlink, so never run `pnpm install`.** Use `./node_modules/.bin/<bin>`.
- Edit only the files your task owns. If you need something outside them, stop and say so in your report.
- **Schema:** edit `schema.ts`, but never generate migrations. New tenant tables get `company_id`, a leading index and RLS. Write the RLS SQL (same style as `drizzle/0007_p4_p8_rls.sql`) to `docs/plan/tasks/rls/<ID>.sql`. The integrator turns it into a migration. Changes to an existing table must be backward compatible (nullable or defaulted columns; check constraints only widened).
- **i18n:** add keys in fr, ar and en, in your module's `messages/*/<module>.json` only.
- **UI:** keep it minimal and consistent with the module's existing screens. Use logical properties for RTL.
- **Tests:** unit tests for new logic. Add a two-tenant isolation test for each new table, but don't run int tests (the DB isn't migrated yet).
- **Verification:** `./node_modules/.bin/next typegen && ./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/eslint <your paths>`, `./node_modules/.bin/vitest run <your paths>`. Everything must pass.
- Commit with Conventional Commits and your own model's Co-Authored-By trailer. Don't push. Don't spawn sub-agents. Never print `~/.config/tavio/*`.

## W13-EVENTS Event catalog (13.0)
**Owns:** `src/core/events/catalog.ts`, `src/core/events/events.test.ts`
- Add these events, with typed payloads, to `EventCatalog` and `EVENT_NAMES`:
  - `crm.lead.created` {leadId, stageId, userId|null, teamId|null}
  - `crm.lead.stage_changed` {leadId, fromStageId, toStageId, userId|null}
  - `crm.lead.won` {leadId}
  - `crm.lead.lost` {leadId, lostReasonId}
  - `chatter.activity.done` {activityId, entity, recordId, activityTypeId|null, result|null}
  - `credit_sales.contract.state_changed` {contractId, partnerId, fromState, toState}

## W13-CRM Lead fields and events (13.1) — PDF items 8–14, 22
**Owns:** `src/modules/crm/**`, `messages/*/crm.json`
- **Leads:**
  - `stage_entered_at` (timestamptz, set on create and on every stage change; backfill = `created_at` in the RLS file as an UPDATE)
  - `attempt_count` (int, default 0, with an action "log attempt" that increments it)
  - `channel` (text: phone, whatsapp, showroom, web, referral, other)
- **Stages:** `requirements` (text, shown as a hint on the kanban column and the lead form).
- **Events:** emit the W13-EVENTS crm events from the lead service (create, stage change, won, lost).
- **UI:** show channel and attempt count on the lead form and list. Show days in stage on kanban cards.

## W13-ACT Activity types, results and plans (13.1) — items 11, 23–31, 37
**Owns:** `src/modules/chatter/**`, `messages/*/chatter.json`
- **Activity types** (Odoo `mail.activity.type`):
  - `delay_count` + `delay_unit` (days, weeks)
  - `category` (default, phonecall, upload_file, meeting)
  - `chaining_type` (suggest, trigger) + `next_type_id`
  - `default_user_id`
  - `require_result` (bool)
- **Complete activity:** takes a result and an optional note. If the type's `require_result` is set, the result is required. Completing posts a chatter message with the result and emits `chatter.activity.done`. If `chaining_type = trigger`, it creates the next activity (due date from that type's delay); if `suggest`, the UI pre-fills it.
- **Activity plans** (new tables `activity_plans` {name, entity, active} and `activity_plan_steps` {plan, sequence, activity_type, summary, offset_days, responsible: 'record_owner' | 'fixed', user_id|null}). Add a service:
  - `launchPlan(ctx, planId, entity, recordId, startDate, ownerId)` creates the activities and tags them with `plan_run_id` (new nullable column on activities, plus an `activity_plan_runs` table).
  - `cancelPlanRuns(ctx, entity, recordId, {exceptRunId?})` deletes the open activities of earlier runs.
- **UI:** a settings page to manage activity types and plans, and a "Launch plan" button in the chatter activity panel.

## W13-CREDIT Contract workflow, documents, handoff (13.1) — items 44–59, 65–70
**Owns:** `src/modules/credit_sales/**`, `messages/*/credit_sales.json`
- **States:** widen the contract state check with `submitted`, `under_review`, `approved`, `refused`, `reserved`. Allowed path: draft → submitted → under_review → approved | refused; approved → reserved → active. Draft → active stays allowed (existing flow). Every transition goes through one service function. It writes the audit log and emits `credit_sales.contract.state_changed`.
- **Required documents:**
  - New table `credit_document_requirements` {name, required, active}: the company template.
  - New table `credit_contract_documents` {contract, requirement, file_id|null, status: missing | received | rejected, note}. Rows are created from the template when a contract is submitted.
  - A contract can't go to under_review while a required document isn't `received`.
- **Handoff (BO):** contract columns `bo_owner_id`, `sent_to_bo_at`, `received_by_bo_at`, with actions "send to BO" and "acknowledge receipt".
- **Decision:** columns `decision_reason`, `next_action`, `decided_by`, `decided_at`. A reason is required for refused.
- **Bank / central risk:** columns `central_risk_checked_at`, `central_risk_result` (clear, flagged), `bank_name`, `bank_reference`, `bank_notified_at`.
- **UI:** a workflow bar with the allowed transitions on the contract page, plus document checklist, BO, decision and bank sections. Add a settings list for document requirements.

## W13-PO Purchase from approved contract (13.1) — items 60–61
**Owns:** `src/modules/purchases/**`, `messages/*/purchases.json`
- Subscribe to `credit_sales.contract.state_changed` where toState = `approved`. Follow how `src/modules/inventory/events.ts` subscribes and is registered. For each contract line with a product, find its supplier in the purchases/products data. If there's none, skip it and post a chatter note on the contract.
- Create one draft purchase order per supplier, with `source_entity` = credit_sales.contract and `source_id` (new nullable columns). Make it idempotent: no second PO for the same contract.
- **UI:** show the source contract link on the PO.

## W13-STOCK Reservation and delivery orders (13.1) — items 60–64
**Owns:** `src/modules/inventory/**`, `messages/*/inventory.json`
- New table `stock_reservations` {product, location, quantity, source_entity, source_id, state: active | released | consumed}. Reserved quantity reduces the available quantity shown in stock views. Add service functions to reserve, release and consume.
- New tables `deliveries` {number from sequence, partner, source_entity, source_id, state: draft | ready | done | cancelled, scheduled_date, delivered_at, signed_by_name, signature_file_id, proof_file_id, note} and `delivery_lines` {product, quantity}. Validating a delivery consumes the reservation and creates stock moves out, using the existing move service.
- **Event handlers:** `credit_sales.contract.state_changed` to approved → reserve the contract lines. To active → create a draft delivery from them. To refused → release the reservations. All of them idempotent.
- **UI:** deliveries list and form, with an upload for signature and proof.

## W13-AUTO Automation engine (13.2) — items 10, 25, 29–36
**Owns:** `src/modules/automation/**`, `messages/*/automation.json`, `src/app/api/cron/outbox/route.ts`
- **Triggers:** accept every name in `EVENT_NAMES` (drop the hard-coded list). Conditions may read the event payload, including `fromStageId`/`toStageId` and `fromState`/`toState`, so rules can match transitions.
- **Time-based trigger:** a rule kind `time` {entity: lead | activity | credit_contract, date_field, delay_days, conditions}. `runTimedRules(ctx)` runs from the outbox cron, once per company. A new table `automation_rule_runs` (rule, record_id, unique) means each record fires a rule only once.
- **Actions:**
  - `update_record`: a whitelisted set of fields per entity. It must refuse to set a lead lost or a contract refused, which keeps PDF item 36.
  - `launch_activity_plan`: calls the chatter plan service and, unless the rule says otherwise, first cancels earlier runs for the record.
  - `cancel_activity_plans`.
  - `multi`: an ordered list of actions.
- **UI:** the rule form supports the new trigger kind and actions.

## W13-TEAMS Sales teams and lead visibility (13.2) — items 41–43
**Owns:** `src/modules/crm/**`, `messages/*/crm.json`
- New tables `sales_teams` {name, leader_id} and `sales_team_members` {team, user}. Leads get `team_id`, which defaults to the owner's team.
- New permissions in the crm manifest: `crm.leads.view_team` and `crm.leads.view_all`. Without them a user sees only their own leads. With `view_team` they also see their team's leads, and team leaders always see their team's. Apply this in every lead list, kanban and count query.
- **UI:** a teams settings page and a team filter on leads.

## W13-COCKPIT KPIs, my activities, alerts (13.2) — items 35, 52–54, 71–75
**Owns:** `src/core/dashboard/**`, `src/app/[locale]/(app)/dashboard/**`, the My Activities component (find it under `src/modules/chatter/ui` or `src/core`; if it's in chatter, coordinate by touching only that one file), `src/app/api/cron/daily/route.ts`, `messages/*/dashboard.json`
- **KPIs:**
  - leads per stage
  - average days in the current stage (from `stage_entered_at`)
  - active leads with no open activity
  - overdue activities
  - won leads this month and conversion rate (won ÷ created), using stage `is_won` and never stage names
- **My Activities:** today, overdue and planned counts and filters. Show a deadline colour (overdue red, today amber, future green).
- **Daily cron:** for each company, create one activity for the lead's owner when an active lead has no open activity, and one for the team leader (or the owner) for each lead stuck more than 14 days in a stage. Use one summary activity per user per day, not one per lead.

## W13-SEED Mourabaha template (13.3) — items 8, 12, 23, 37, Annex A
**Owns:** `src/modules/crm/templates/**`, `src/modules/crm/ui/settings/**` (button only), `messages/*/crm.json`
- An idempotent `applyMourabahaTemplate(ctx)` that creates a "Mourabaha" pipeline with the 13 statuses from item 8. Put them in the order Nouveau Lead, Déjà contacté, Ne répond pas, Injoignable, Demande d'information, Qualifié, Intéressé, Orienté showroom, En attente de l'envoi du dossier, Dossier reçu, Transmis BO (is_won), Pas intéressé, Non qualifié (both folded). Fill each stage's `requirements` from items 9–21. It also creates:
  - lost reasons Pas intéressé and Non qualifié
  - activity types: call (phonecall, require_result), WhatsApp, document follow-up (upload_file)
  - activity plans NR, INJ, INFO, QUAL, INT, SHOW and DOS, with the day offsets from item 23
  - automation rules: stage change → cancel old plans + launch that stage's plan; a client reply (activity done with result "answered") → cancel the NR/INJ plans
  - the default document requirements (CIN, fiche de paie / attestation de travail, relevé bancaire, chèque, facture proforma), all required
- Add an "Apply Mourabaha template" button for admins on the CRM settings page.

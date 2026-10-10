# Mourabaha PDF vs Revora: gap report

Source: organized (8).pdf. Checklist in the appendix.

# Gap analysis A: Mourabaha / Odoo 17 checklist vs Revora

Scope: items 1-40 (sections Scope, Pipeline, Commercial path, Follow-up matrix, Odoo automation rules, Daily cockpit).
Revora equivalents: CRM stages and lead status (src/modules/crm), chatter activities (src/modules/chatter), automation rules (src/modules/automation), credit module (src/modules/credit_sales).

| item # | requirement | status | evidence/gap |
|---|---|---|---|
| 1 | Target flow Nouveau Lead -> Dossier reçu -> Transmission BO | PARTIAL | Only "Nouveau" exists as first stage (src/modules/crm/schema.ts:252). No Dossier reçu or BO transmission stage. Lead-to-contract conversion exists (src/modules/crm/service/leads.ts:497). |
| 2 | Odoo is commercial engine up to BO handoff; credit/bank on separate platform | PARTIAL | Credit contracts and installments are in-app (src/modules/credit_sales/schema.ts). No handoff event or boundary to an external credit platform. |
| 3 | Digital/WhatsApp default path; showroom optional | PARTIAL | WhatsApp is only a reminder link helper (src/modules/credit_sales/service/reminders.ts:64). No showroom entity or digital-first path. |
| 4 | Final commercial KPI is Dossier reçu | MISSING | Dashboard KPIs cover only overdue credit and openLeads (src/core/dashboard/kpis.ts:9-13). |
| 5 | Engines: Call Center, Commercial/Showroom, BO, Credit Analyst, Achats, Livraison, Banque | PARTIAL | Modules crm, credit_sales, purchases, inventory exist. No BO, Credit Analyst, Livraison or Banque roles or engines. |
| 6 | End-to-end chain through consolidation and bank deposit | MISSING | Chain stops at credit contract creation. No BO, reserve, guarantee, delivery or consolidation steps. |
| 7 | Each engine has defined entry and exit | MISSING | No engine or stage-transition definitions in code or docs/plan. |
| 8 | Canonical 13-status pipeline | PARTIAL | Only 4 default stages: Nouveau, Qualifié, Proposition, Gagné (src/modules/crm/schema.ts:248-253). Lead status is open/won/lost only (src/modules/crm/service/leads.ts:382, 431). |
| 9 | Each status has action, nature and rotation sequence | MISSING | Stages have only name, position, probability, isWon, fold (src/modules/crm/schema.ts:52-80). No action or rotation fields. |
| 10 | Status change triggers next activity | PLANNED-ONLY | moveLead only writes stage and status and audit (src/modules/crm/service/leads.ts:362-405). CRM events are not in TRIGGER_EVENTS (src/modules/automation/engine.ts:18-26). Event crm.lead.stage_changed is only planned (docs/plan/ROADMAP.md:226). |
| 11 | Required fields: responsible, status, next activity, result, exit reason, attempt counter, channel, history | PARTIAL | Present: salespersonId, nextActivityId, lostReasonId, audit history. Missing: attempt counter, interaction channel (source is origin only), interaction result field (activity doneNote is optional, src/modules/chatter/service/index.ts:113). |
| 12 | Exit reason mandatory for Pas intéressé and Non qualifié | PARTIAL | markLost requires lostReasonId for any loss (src/modules/crm/service/leads.ts:420). No separate Pas intéressé or Non qualifié statuses. |
| 13 | Dossier reçu and Transmis BO are distinct | MISSING | Neither status exists. |
| 14 | Digital path sequence (Premier appel, Qualification, WhatsApp, En attente du dossier, ...) | PARTIAL | Stages new, qualified, proposal, won exist (src/modules/crm/schema.ts:252-255). Intermediate steps are missing. |
| 15 | Showroom branch optional, offered on conditions | MISSING | No showroom entity or branch logic. Only a generic "visit" activity type (src/modules/chatter/entities.ts:12). |
| 16 | Client near showroom can stay digital | MISSING | No showroom model. |
| 17 | Digital and showroom converge at dossier receipt | MISSING | No convergence stage. |
| 18 | Client response suspends automatic follow-up | MISSING | No automatic follow-up sequences exist. |
| 19 | Answer to rotation moves lead to Qualification; "yes" goes to Requalification | MISSING | No rotation logic. |
| 20 | Demande d'information requires phone callback J+2/J+5/J+10 | MISSING | Only a generic "call" activity type (src/modules/chatter/entities.ts:8). Dates are manual. |
| 21 | Refusal needs motif and closure; reactivation only if motive reversible | PARTIAL | markLost and reopenLead exist (src/modules/crm/service/leads.ts:407, 457). No reversibility rule. |
| 22 | Dossier reçu requires documents, products, sufficient info | MISSING | No document checklist or product selection on leads. |
| 23 | Follow-up plans per status (NR, INJ, INFO, QUAL, INT, SHOW, DOS) | MISSING | Automation create_activity takes one dueInDays value (src/modules/automation/config.ts:14-20). No plan codes. docs/plan has no J+ cadence. |
| 24 | Stop rules (reply, status change, dossier received, closed lead) | MISSING | No sequence objects, so nothing to stop. |
| 25 | Standard follow-ups created by status rules, not manual | PARTIAL | Generic rule engine exists (src/modules/automation/engine.ts:83-108) with create_activity. Not wired to any CRM trigger. |
| 26 | Exit motives seeded (Pas intéressé, Non qualifié, NR attempts, Injoignable type) | PARTIAL | lost_reasons is free tenant-defined text (src/modules/crm/service/lost-reasons.ts). No seeded motive set. |
| 27 | Reactivation rules (Pas intéressé deferred J+30/J+60; NR after J+15) | MISSING | No reactivation scheduling. |
| 28 | Call result mandatory before closing an activity | MISSING | completeActivity takes optional feedback (src/modules/chatter/service/index.ts:113-118; src/modules/chatter/actions.ts:28). |
| 29 | Ne répond pas creates J+1 call, then NR sequence | MISSING | No status-triggered activity. |
| 30 | Demande d'information creates J+2 call and requires requalification | MISSING | Same as 20 and 29. |
| 31 | Intéressé creates WhatsApp/commercial follow-up and stops old sequence | MISSING | No WhatsApp activity type or stop logic. |
| 32 | Showroom accepted adds showroom follow-up | MISSING | No showroom model. |
| 33 | Attente dossier creates recovery sequence, stops when complete | MISSING | No recovery sequence. |
| 34 | Dossier reçu stops relances and prepares BO handoff | MISSING | No Dossier reçu state or BO handoff. |
| 35 | Alerts: active lead without activity, overdue activity, major status change with history | PARTIAL | Overdue highlight (src/modules/chatter/ui/chatter.tsx:45). Next-activity date in lead list (src/modules/crm/service/leads.ts:100). Stage history in audit (leads.ts:392). No "lead without next activity" alert. |
| 36 | Odoo never auto-sets Pas intéressé, Non qualifié or Rejet | DONE | Automation actions are only create_activity, post_note, webhook (src/modules/automation/config.ts:14-29). None can change lead status. |
| 37 | Automatic activity plan codes NR, INJ, INFO, QUAL, INT, SHOW, DOS | MISSING | Activity types are call, meeting, todo, payment_reminder, visit only (src/modules/chatter/entities.ts:8-12). |
| 38 | Daily work queue P1-P5 priorities | MISSING | Only my-activities lists open activities, overdue first (src/modules/chatter/ui/my-activities.tsx:13). No priority tiers. |
| 39 | Daily load targets per status | MISSING | No targets or capacity data. |
| 40 | Daily routine order and check that no active lead lacks next activity | PARTIAL | Overdue-first ordering exists (my-activities.tsx). Routine order and the lead-without-activity check are missing. |

# Gap B: Roles, BO handoff, Credit/Bank, Purchasing, Delivery, Consolidation

Scope: checklist items 41-70 (sections "Roles and governance" through "Consolidation and compliance").

| item # | requirement | status | evidence/gap |
|---|---|---|---|
| 41 | Telephone agent: call, qualify, log results, collect docs/product choice, mark dossier reçu, prepare BO handoff | PARTIAL | Staff role has crm.lead.* and contacts/credit payment perms (src/core/tenancy/default-roles.ts:19-28). No telephone-agent role, no doc collection or dossier-reçu step. |
| 42 | Team Leader checks: start/mid/end of day, weekly | PARTIAL | Manager role exists (default-roles.ts:14-18). Generic dashboard test exists (src/core/dashboard/kpis.int.test.ts). No team-leader role or check cadence. |
| 43 | Commercial manager KPIs (volume, conversion, dossier rate, loss motives) | PARTIAL | Manager perms credit_sales.*, crm.* (default-roles.ts:16). No KPI definitions for these metrics found. |
| 44 | Final KPI: controlled progression of leads to Dossier reçu | MISSING | Lead status is only open/won/lost (src/modules/crm/schema.ts:133, 170). Default pipeline is new/qualified/proposal/won (crm/schema.ts:248-257). No Dossier reçu stage. |
| 45 | Dossier reçu trigger conditions (docs, products, info, channel, owner) | MISSING | No dossier entity or trigger. Contract states only draft/active/completed/cancelled/defaulted (credit_sales/schema.ts:75-76). |
| 46 | Agent cannot validate dossier reçu while docs/products missing | MISSING | No gate exists (same as 45). |
| 47 | WhatsApp path: docs, product confirmation, Excel request, email dispatch, BO handoff | PARTIAL | wa.me link helper exists (src/modules/credit_sales/service/reminders.ts, WAVE-5.md:149 refs it). Only for reminders. No dossier flow, Excel request, or dispatch. |
| 48 | Showroom path: deposit dossier, archived docs, origin traceability | MISSING | No showroom or deposit concept in src. |
| 49 | Email dispatch to BO mailbox with DOSSIER / COMMERCIAL / NOM / DATE / TYPE subject | MISSING | Email adapter only serves auth/invitations/contact (src/core/adapters/email/index.ts; src/core/auth/server.ts). No dispatch template. |
| 50 | Standardised file naming and standard Excel purchase request | MISSING | No xlsx/csv generation in src (grep). Purchase orders exist but are not linked to a dossier (purchases/schema.ts:33, 71). |
| 51 | Dispatch traceability: send date, receipt, assigned agent, status, BO acknowledgement | MISSING | No dispatch table or fields. |
| 52 | BO process steps 1-10 (reception to final validation) | MISSING | No BO workflow, states or assignment. |
| 53 | BO controls: presence check, anomalies returned, owner per step, reconstructable docs | PARTIAL | Generic audit_log with entity/recordId (src/core/db/schema/infra.ts:32-40). OCR upload exists (src/modules/ai_features/ocr/service.ts:136). No per-step owner, anomaly return, or pre-credit validation. |
| 54 | Odoo/platform boundary: "Dossier saisi" hands off to credit platform | MISSING | No handoff state or integration event for dossier saisi/validé. Generic outbox exists (infra.ts:86). |
| 55 | Credit flow: Dossier saisi -> analyst -> file control -> central risk -> reserve | PARTIAL | Rule-based client score A-D/new (src/modules/credit_sales/service/scoring.ts:29-40) and client_scores history (credit_sales/schema.ts:322). No analyst role, file control, or central risk step. |
| 56 | Central risk outcomes: financeable / non-financeable / regularisation | MISSING | No central risk integration or outcome field. |
| 57 | OK -> bank notification; complement -> reserve | MISSING | No bank notification or complement flow. |
| 58 | Every reserve has motive and next action; bank rejection distinct | MISSING | No reserve entity. |
| 59 | Bank path: notification -> account opening -> guarantee -> guarantees available | MISSING | Bank appears only as payment method bankName (credit_sales/schema.ts:192). |
| 60 | Chosen products sent to Achats as soon as dossier saved | MISSING | Contract lines carry productId (credit_sales/schema.ts:119) and PO lines do too (purchases/schema.ts:82), but no link or event from contract to PO. |
| 61 | Product securing situations (reserve / purchase / stockout / urgent / transmit to Livraison) | PARTIAL | Stock moves (inventory/schema.ts:79), reorder rules (inventory/schema.ts:122), PO states draft/sent/confirmed/received/cancelled (purchases/schema.ts:60-61). No stock reservation (grep "reserv" empty) or securing states. |
| 62 | Delivery trigger: guarantees available + product secured | MISSING | No delivery entity or trigger. |
| 63 | Delivery flow: order -> checks -> scheduling -> delivery -> signature -> docs returned | MISSING | No delivery order module. WAVE-5.md:76 plans draft delivery moves on sales.order.confirmed only (PLANNED-ONLY for a different trigger). |
| 64 | Guarantees available does not mean delivery ready | MISSING | No state separation exists (see 62). |
| 65 | Digital vs showroom document checklists for delivery | PARTIAL | files table with kinds id_photo/contract_pdf/receipt_pdf/attachment and entity/recordId (src/core/db/schema/infra.ts:116-146). No per-channel checklist. |
| 66 | Post-delivery control chain to bank deposit | MISSING | Receipt and contract PDFs exist (credit_sales/schema.ts:66, 275). No return, verification, conformity or deposit steps. |
| 67 | Document circuit through main showroom and Algiers hub, batch consolidation | MISSING | No hub, batch or consolidation concept. |
| 68 | Every documentary anomaly has owner and corrective action | MISSING | No anomaly entity. |
| 69 | Delivery documents matched to the corresponding credit file | PARTIAL | files.entity/recordId can attach docs to a contract (infra.ts:126 area). No matching or reconciliation step. |
| 70 | Inter-pole sync table with entry, exit and proof per pole | PARTIAL | Generic outbox (infra.ts:86) and webhooks/outbox handler (src/modules/platform/outbox-handler.ts). No pole-level proof model or sync table. |

Counts: DONE 0, PARTIAL 10 (41, 42, 43, 47, 53, 55, 61, 65, 69, 70), MISSING 20, PLANNED-ONLY 0.

# Gap analysis C: KPIs, Deployment, Non-negotiable rules, Annexes, Guiding principle

Project: /home/saadi/tavio (Revora). Read-only review.

| item # | requirement | status | evidence/gap |
|---|---|---|---|
| 71 | Call Center KPIs (new leads, contact/qualified/interested rate, age per status, overdue, leads without next activity, conversion per agent) | PARTIAL | Only an open-leads count: src/core/dashboard/kpis.ts:22 (`openLeads`), shown at src/app/[locale]/(app)/dashboard/page.tsx:55. Lead reports are planned only: docs/plan/ROADMAP.md:218 ("Reports"). No rate, age or per-agent metrics. |
| 72 | Back-Office KPIs (dossiers received/entered, delays, incomplete dossiers, anomaly rate) | MISSING | No BO module or dossier entity in src/modules. |
| 73 | Credit KPIs (analysed, analysis delay, reserves, rejections, acceptance rate) | PARTIAL | Dashboard has due-today, overdue, collected-this-month, active contracts (src/core/dashboard/kpis.ts:9-13; dashboard page.tsx:47-54). No analysis delay, reserve, rejection or acceptance metrics. |
| 74 | Delivery KPIs (guarantees, orders, stockouts, guarantee->delivery delay) | MISSING | No delivery or guarantee entities found. |
| 75 | CRM alerts (overdue activity, lead without next activity, status vs last interaction, dossier waiting, sequence after reply, stuck leads) | PARTIAL | Overdue is derived for chatter activities (src/modules/chatter/schema.ts:86-87) but no CRM alert consumes it. Scheduled reminders cover credit installments only (src/app/api/cron/daily/route.ts -> src/modules/credit_sales/jobs/daily-reminders.ts). No lead alerts. |
| 76 | Phase 1 Diagnostic | N/A | Organizational. |
| 77 | Phase 2 Configuration (pipeline, fields, results, activity plans) | PARTIAL | DEFAULT_PIPELINE has 4 stages: new, qualified, proposal, won (src/modules/crm/schema.ts:248-257) vs the 13 required statuses. Activity types exist (chatter/schema.ts:60). No result or exit-reason fields, attempt counter or channel on leads. |
| 78 | Phase 3 Automation (result -> status -> next activity, stop rules) | PARTIAL | Generic engine with a create_activity action (src/modules/automation/config.ts:9-16). TRIGGER_EVENTS has no CRM or chatter events (src/modules/automation/engine.ts:12-19). No stop rules. |
| 79 | Phase 4 WhatsApp (templates, usage, stop on relances, checklist) | PARTIAL | wa.me links only for credit reminders (src/modules/credit_sales/service/reminders.ts, whatsappLink) and the contact page. No CRM templates, no sequence stop. |
| 80 | Phase 5 Pilot | N/A | Organizational. |
| 81 | Phase 6 Deployment (train team, generalise rules) | N/A | Organizational. |
| 82 | Phase 7 Optimisation (KPI measurement, cadence recalibration) | MISSING | No KPI reporting and no configurable cadences. |
| 83 | Priority order (mandatory result, mandatory next activity, rotations, dossier follow-ups, CRM anomalies, dashboards, BO formalisation, delays) | MISSING | Only the dashboard counter (item 71) exists. Items 84, 85, 78 and the BO handoff are not implemented. |
| 84 | No active Odoo lead without a next activity | MISSING | leads.nextActivityId is nullable with no check (src/modules/crm/schema.ts:154; check constraints at :170-185 do not cover it). |
| 85 | No completed activity without a result | MISSING | completeActivity takes an optional feedback (src/modules/chatter/service/index.ts:113); doneNote is nullable (chatter/schema.ts:108). |
| 86 | Pas intéressé and Non qualifié require a motive | PARTIAL | Lost requires a lostReason (src/modules/crm/service/leads.ts markLost; schema.ts:183). The two statuses and their motive lists do not exist. |
| 87 | Information requests handled by phone first | MISSING | No rule or status. |
| 88 | Showroom is an optional branch | MISSING | No showroom concept in CRM. |
| 89 | Dossier reçu = documents + products + sufficient info | MISSING | No Dossier reçu status or checklist. |
| 90 | Referring agent stays recorded after BO handoff | PARTIAL | Lead owner exists (salesperson index, crm/schema.ts:159-162). No BO handoff record. |
| 91 | Every BO dossier has an operational owner | MISSING | No BO dossier entity. |
| 92 | Every credit reserve has a motive and next action | MISSING | No reserve concept in credit_sales schema (not exhaustively verified). |
| 93 | Guarantee availability does not imply delivery readiness | MISSING | No guarantee or delivery model. |
| 94 | Digital and showroom use different document checklists | MISSING | No checklist entity. |
| 95 | Every anomaly has owner, status, next action | MISSING | No anomaly entity. |
| 96 | CRM is a steering tool (Team Leader knows who, why, action, delay) | PARTIAL | Kanban and leadsByStage exist (crm/service/leads.ts:195). No team-leader view, delay metric or activity-due list. |
| 97 | Annex A: result -> status -> next activity matrix | MISSING | Not implemented. Not in docs/plan (grep for mourabaha/dossier returned nothing). |
| 98 | Annex B: Dossier reçu checklist | MISSING | Not implemented. |
| 99 | Annex C: dispatch email template | MISSING | Not implemented. |
| 100 | Email dispatch to BO kept, with standardisation, assignment, SLA and traceability | PARTIAL | Generic email exists (team invite sends email: src/app/[locale]/(app)/settings/team/actions.ts:57, emailSent). No BO dispatch, subject format, attachments, or receipt tracking. |
| 101 | Every interaction -> result -> next action -> control | PARTIAL | Activities, completion and audit trail exist (chatter/service/index.ts:113-128). Result and next action are not enforced. |

Counts (31 items, 71-101): DONE 0, PARTIAL 11, PLANNED-ONLY 0 (ROADMAP.md:214 and :218 plan activity reminders and CRM reports, not built), MISSING 17, N/A 3.

## Top gaps
1. CRM status model is 4 generic stages (crm/schema.ts:248-257), not the 13 Mourabaha statuses. No Dossier reçu or Transmis BO.
2. No enforcement of next activity or call result (crm/schema.ts:154; chatter/service/index.ts:113-121).
3. Automation has no CRM triggers (automation/engine.ts:12-19) and no stop-on-reply or status-change rules. Cron only runs credit reminders (cron/daily -> daily-reminders.ts).
4. No BO, Credit-reserve, Guarantee or Delivery modules, so no handoff, owner, checklist or anomaly tracking (items 72, 74, 89-95).
5. No CRM alerts or team-leader reporting; the only KPI is openLeads (core/dashboard/kpis.ts:22). Planned reports are in docs/plan/ROADMAP.md:218.

## Appendix: PDF checklist
# Requirements checklist: Plan opérationnel cible Mourabaha / Odoo 17

## Scope and system boundaries
1. Target flow is Nouveau Lead -> Dossier reçu -> Transmission Back-Office [1]
2. Odoo 17 is the commercial engine up to formal BO handoff; credit/bank processing runs on the dedicated platform [1, 5]
3. Digital/WhatsApp is the default client path; showroom is optional [1]
4. Final commercial KPI is Dossier reçu [1]
5. Engines in scope: Call Center, Commercial/Showroom, Back-Office, Credit Analyst, Achats/Sourcing, Livraison, Banque [3]
6. Chain: Acquisition -> Call Center/Odoo -> Qualification/relances -> Intéressé -> Digital or showroom -> Dossier reçu -> BO transmission -> Dossier saisi -> Credit/Banque <-> Achats -> Garanties + produit sécurisé -> Livraison -> Documents signés -> Consolidation -> Dépôt banque [5]
7. Each engine has a defined entry and exit (e.g. Back-Office: Dossier reçu -> Dossier saisi) [5]

## Pipeline and statuses (Odoo CRM)
8. Canonical pipeline of 13 statuses: Nouveau Lead, Ne répond pas, Injoignable, Pas intéressé, Non qualifié, Demande d'information, Déjà contacté, Qualifié, Intéressé, Orienté showroom, Transmis BO, En attente de l'envoi du dossier, Dossier reçu [6]
9. Each status has a defined action, a nature (active, closed, optional branch, final) and a rotation sequence [6]
10. Statuses must reflect the prospect's real state; a status change triggers the matching next activity [3, 6]
11. Required fields: responsible, single current status, next activity (date, type, owner), interaction result, exit reason, attempt counter, channel, status history [6]
12. Exit reason is mandatory for Pas intéressé and Non qualifié [6, 11]
13. "Dossier reçu" (client complete) and "Transmis BO" (formal handoff) are distinct statuses [5]

## Commercial path and branching rules
14. Digital path: Nouveau Lead -> Premier appel -> Qualification -> Qualifié -> Intéressé -> WhatsApp/choix produit -> En attente du dossier -> Dossier reçu -> Transmission BO [8, 4]
15. Showroom branch is optional and offered only when proximity, demo, comparison or client preference justify it [9]
16. A client near a showroom can remain fully digital [9]
17. Digital and showroom paths converge at receipt of the dossier [9]
18. A response from the client immediately suspends automatic follow-up until re-planned [9, 3]
19. Answer to a rotation moves the lead directly to Qualification; a "yes" to "répond?" goes to Requalification [4]
20. Demande d'information requires a phone callback (J+2 / J+5 / J+10) [6, 10]
21. Refusal or incompatible profile requires motif plus closure; reactivation only if motive is reversible [9, 10]
22. Dossier reçu requires documents + chosen products + sufficient information before transmission [9]

## Follow-up (relance) matrix and activity plans
23. Follow-up plans per status: NR (J0/J+1/J+3/J+7/J+15), INJ (J0/J+1/J+3/J+7), INFO (J+2/J+5/J+10), QUAL (J+1 by result), INT (J0/J+1/J+3), SHOW (J+1 then by visit), DOS (J0/J+1/J+2/J+4/J+7) [5, 11]
24. Stop rules: client response ends the non-response sequence; status change cancels old sequence; dossier received stops recovery; closed lead does not re-enter rotation without reactivation motive [10]
25. Standard follow-ups must be created by status rules, not manual entry [10]
26. Exit motives: Pas intéressé (no need/price/financing/already bought/deferred), Non qualifié (profile/zone/product/conditions/other), Ne répond pas (number of attempts), Injoignable (type of impossibility) [10]
27. Reactivation examples: Pas intéressé deferred purchase -> J+30 / J+60; Ne répond pas -> rotation after J+15 [10]

## Odoo automation rules
28. Call result is mandatory before closing an activity [6, 3]
29. Ne répond pas creates J+1 call, then applies NR sequence [11]
30. Demande d'information creates call at J+2 and requires requalification [11]
31. Intéressé creates WhatsApp/commercial follow-up and stops previous sequence [11]
32. Showroom accepted adds showroom follow-up (optional branch) [11]
33. Attente dossier creates recovery sequence; stops once dossier is complete [11]
34. Dossier reçu stops relances and prepares BO handoff [11]
35. Alerts for: active lead without activity (target zero), overdue activity, major status change (history kept with old/new/date) [11]
36. Odoo must never automatically set Pas intéressé, Non qualifié or Rejet commercial from a missing response or incomplete activity [11]
37. Automatic activity plan codes: NR, INJ, INFO, QUAL, INT, SHOW, DOS [11]

## Daily work mode and cockpit
38. Daily work queue priorities P1-P5: hot prospects + dossiers in waiting + showroom; qualified/info requests; overdue no-answer/unreachable; 50 new leads; WhatsApp/dossiers [12]
39. Daily load starting points: interested 4-8, qualified 5-10, info requests 8-15, no answer/unreachable 15-30, new leads 50, awaiting dossier 5-15 (to be recalibrated) [12]
40. Daily routine order: overdue activities, hot prospects, due rotations, new leads, WhatsApp/dossiers, immediate Odoo update, check no active lead lacks a next activity [12]

## Roles and governance
41. Telephone agent: call new leads and rotations, qualify and log results, manage interested prospects, collect documents and product choice, mark dossier reçu only when both pillars are available, prepare BO handoff [13]
42. Team Leader checks: start of day, mid-day, end of day, weekly (conversion per step, loss motives, performance per agent, delays) [13]
43. Commercial manager tracks lead volume, capacity, conversion, qualification rate, interest rate, dossier rate, Interested -> Dossier reçu delay, digital vs showroom, loss motives [13]
44. Final commercial KPI: controlled progression of leads to Dossier reçu within a controlled delay [13]

## Back-Office handoff and dispatch
45. Dossier reçu trigger conditions: documents received, products chosen, sufficient info, traced channel, known owner [14]
46. Agent may never validate Dossier reçu while documents or products are missing [14]
47. WhatsApp path: client sends documents, agent confirms receipt, products/references/quantities confirmed, standard Excel purchase request prepared, dossier + request emailed to dispatch, BO handoff recorded [14]
48. Showroom path: client may deposit dossier at showroom; archived documents follow BO circuit; agent origin traceability kept [14]
49. Email dispatch to shared BO mailbox: subject format DOSSIER | COMMERCIAL | NOM CLIENT | DATE | TYPE [14, 23]
50. Dispatch attachments: standardized file naming, standard Excel purchase request [14, 24]
51. Dispatch traceability: send date, receipt date, assigned agent and status; BO receipt acknowledgement [14, 24]
52. BO process steps 1-10: reception/dispatch, global check, assignment, agent check, OCR/entry/scoring, responsible check, bank documents, client signature, recomposition, final validation [15]
53. BO controls: no entry without presence/legibility check; anomalies returned with expected action; dossier owner identifiable at each step; generated and signed documents reconstructable; responsible validation before Credit Analyst [15]
54. Odoo/platform boundary: "Dossier saisi / validé" hands off to credit platform, which becomes source of truth for Credit/Banque [15]

## Credit Analyst, central risk and bank
55. Credit flow: Dossier saisi -> Credit Analyst -> file control -> OK to central risk -> problem leads to internal reserve [16]
56. Central risk outcomes: financeable -> bank pre-notification; non-financeable -> bank rejection; regularisation needed -> reserve with complement request [16]
57. OK -> bank notification; complement required -> reserve and new action [16]
58. Every reserve has a motive and next action; bank rejection is distinct from temporary reserve [16]
59. Bank path: notification -> account opening -> guarantee generation -> guarantees available [16]

## Purchasing and product securing (parallel)
60. Chosen products sent to Achats/Sourcing as soon as dossier is saved [17]
61. Product situations: available/securable -> reserve; available but purchase needed -> launch purchase; out of stock -> alternative supplier or delay (blocking risk); guarantee available but product not secured -> urgent; guarantee + secured -> transmit to Livraison [17]

## Delivery and document collection
62. Delivery trigger: guarantees available + product secured [18]
63. Delivery flow: delivery order -> client/product/guarantee check -> scheduling -> delivery -> signature and collection -> documents returned [18]
64. Guarantees available does not mean delivery ready: product secured and logistics order required [18, 22]
65. Digital/WhatsApp delivery collects client docs + bank docs + signed guarantees; showroom collects mainly signed guarantees [18]
66. Post-delivery control: guarantees signed -> Credit Analyst return -> verification -> scan/platform update -> validation -> physical dossier -> conformity check -> bank deposit [18]

## Consolidation and compliance
67. Document circuit: delivery -> return -> main showroom (documentary hub) -> first check -> batch consolidation -> Algiers showroom (finalisation/bank deposit hub) -> final review -> bank deposit [19]
68. Every documentary anomaly has an owner and a corrective action [19]
69. Delivery documents must be matched to the corresponding credit file [19]
70. Inter-pole sync table: each pole has entry, exit and expected proof (CRM up to date, platform record, reservation/purchase proof, delivery order + proof, consolidated dossier) [19]

## KPIs, SLAs and alerts
71. Call Center KPIs: new leads, contact rate, qualified rate, interested rate, Dossier reçu rate, age per status, overdue activities, leads without next activity, Interested -> Dossier reçu delay, conversion per agent [20]
72. Back-Office KPIs: dossiers received / entered, Dossier reçu -> Dossier saisi delay, incomplete dossiers, anomaly rate, document generation time [20]
73. Credit KPIs: dossiers analysed, analysis delay, internal reserves, bank reserves, rejections, acceptance rate [20]
74. Delivery KPIs: guarantees available, orders launched, product stockouts, guarantee -> delivery delay, deliveries made, dossiers blocked by product [20]
75. CRM alerts: overdue activity, active lead without next activity, status inconsistent with last interaction, interested prospect without follow-up, dossier waiting without next action, sequence still active after client reply, old portfolio, lead stuck too long in one step [20]

## Deployment plan
76. Phase 1 Diagnostic: map statuses, fields, activities, histories, anomalies [21]
77. Phase 2 Configuration: pipeline, fields, results, activity plans [21]
78. Phase 3 Automation: Result -> Status -> Next Activity rules and stop rules [21]
79. Phase 4 WhatsApp: templates, usage, stop on relances, dossier checklist [21]
80. Phase 5 Pilot on a small representative group [21]
81. Phase 6 Deployment: train team, generalise rules [21]
82. Phase 7 Optimisation: measure KPIs and recalibrate cadences after 4-8 weeks of clean data [21]
83. Priority order: mandatory call result; mandatory next activity for active leads; automate rotations; automate dossier follow-ups; stop obsolete sequences on client reply or status change; CRM anomalies; team leader/manager dashboard; formalise Dossier reçu -> BO transmission; measure delays between poles; recalibrate after 4-8 weeks [21]

## Non-negotiable rules and quality controls
84. No active Odoo lead without a next activity [22]
85. No completed activity without a result [22]
86. Pas intéressé and Non qualifié require a motive [22]
87. Information requests are handled by phone first [22]
88. Showroom is an optional branch [22]
89. Dossier reçu = documents + chosen products + sufficient information [22]
90. Referring agent stays recorded after BO handoff [22]
91. Every BO dossier has an operational owner [22]
92. Every credit reserve has a motive and next action [22]
93. Guarantee availability does not imply delivery readiness [22]
94. Digital and showroom use different document checklists [22]
95. Every anomaly has an owner, a status and a next action [22]
96. CRM is a steering tool, not just a database; Team Leader must always know who to call, why, which action to obtain and where the delay is [22]

## Annexes
97. Annex A: interaction result -> status -> next activity -> rule matrix [23]
98. Annex B: Dossier reçu checklist (documents, products, references/quantities, info for BO, path identified, Excel request, referring agent kept, dispatch prepared); dossier stays "En attente" until all are valid [24]
99. Annex C: dispatch email template (subject, two attachments, channel, send date, owner, BO acknowledgement, assignment) [24]
100. Email dispatch is kept; improvement targets content standardisation, assignment, SLA and traceability [24]

## Guiding principle
101. Every interaction produces a result; every result produces a next action; every dossier produces a control [2]

---

## How Odoo 17 does it (research pass 2, Sonnet subagents)

Caveats: some rows come from the 17.0 source or from memory rather than fetched docs, and are marked in place. Verdict corrections are listed at the end of each part.

# Odoo 17 vs Revora (research A)

Base URLs: D=https://www.odoo.com/documentation/17.0/applications ; S=github odoo/odoo 17.0 addons/<mod>/models/<file>.py

| mechanism | Odoo 17 model/fields | behaviour | URL | Revora today | to build |
|---|---|---|---|---|---|
| Pipeline stage | crm.stage: name, sequence, is_won, fold, requirements (Text, tooltip), team_id (m2o crm.team, one team or global) | Kanban columns; stage list for a lead = global stages + its team's. Won stage -> write() sets probability 100, date_closed. Moving to a stage never creates activities by itself | S crm/models/crm_stage.py ; D/sales/crm/track_leads/prospect_management... | stages(pipelineId,name,position,probability,isWon,fold), several pipelines per company (src/modules/crm/schema.ts:52). moveLead writes stage+audit+system note (service/leads.ts:362) | add `requirements` text; pipeline = team analogue already exists; stage-change hook (event crm.lead.stage_changed) |
| Lost reason | crm.lost.reason (name, active); crm.lead.lost_reason_id; wizard crm.lead.lost | action_set_lost = action_archive (active=False, probability 0) + reason. Lost is NOT a stage. Restore clears the reason. Reason optional in core Odoo | S crm/models/crm_lead.py | lost_reasons + leads.lostReasonId, status lost, reason mandatory (leads.ts:420) | seed motive list; optional reversible flag is custom (not Odoo) |
| Lead vs opportunity | crm.lead.type 'lead'/'opportunity'; setting group_use_lead; convert_opportunity sets type + date_conversion; leads have no stage (_compute_stage_id) only for lead; kanban_state from activity_date_deadline (grey none/green/red overdue) | Same table | S crm_lead.py | leads.type lead/opportunity exists (schema.ts:113), all share stages | decide if leads get stages; add "no next activity" badge like Odoo's grey kanban_state |
| Activity type | mail.activity.type: name, summary, delay_count, delay_unit(days/weeks/months), delay_from(current_date after completion | previous_activity deadline), category(default/upload_file/phonecall), chaining_type(suggest|trigger), triggered_next_type_id, suggested_next_type_ids, previous_type_ids, default_user_id, default_note, mail_template_ids, keep_done, res_model, icon, decoration_type | Delay computes deadline for new activity. Trigger: on done, next activity auto-created. Suggest: next types offered in the popup | S mail/models/mail_activity_type.py ; D/productivity/discuss/overview/plan_activities.html | activity_types: name, entity, defaultDays, icon, active (chatter/schema.ts:60). Seed keys call/meeting/todo/payment_reminder/visit | add delayUnit, delayFrom, chainingType+nextTypeId(s), defaultUserId, defaultNote, category, keepDone; add WhatsApp etc. types |
| Mark done + feedback | mail.activity.action_feedback(feedback, attachment_ids) -> _action_done | Posts chatter message (mt_activities subtype, template message_activity_done) with feedback + type; moves attachments; unlinks activity (or archives if keep_done). Feedback is optional in core | S mail/models/mail_activity.py | completeActivity sets doneAt/doneBy/doneNote only, optional note, no chatter message (chatter/service/index.ts:113) | post a system/activity-done message; enforce mandatory result via per-type flag (custom, not Odoo) |
| Done & Schedule Next | action_done_schedule_next / action_feedback_schedule_next | Sets default_previous_activity_type_id + activity_previous_deadline in context; runs _action_done; if trigger-chained activities were created returns False, else opens Schedule dialog prefilled (deadline from previous deadline per delay_from) | S mail_activity.py | none | button + chaining engine in completeActivity |
| Activity Plans | mail.activity.plan: name, company_id, res_model(_id) "Applies to", active, template_ids, steps_count, has_user_on_demand. mail.activity.plan.template: plan_id, sequence, activity_type_id, summary, responsible_type(on_demand "Ask at launch" | other "Default user"), responsible_id, note; docs also show per-step Interval/Units and Trigger (before/after plan date) | Launched from chatter Activities popup: pick plan, Plan Date, Assigned To (for on_demand steps); all steps scheduled at once, deadlines = plan date +/- interval. Plan tied to one model; editing a plan updates its activities by default. Launched from chatter on any mail.thread record (docs example is opportunity). NOT launched automatically on stage change | D/sales/crm/optimize/utilize_activities.html ; S mail/models/mail_activity_plan*.py | none. automation create_activity = one activity, dueInDays (automation/config.ts:9-20), triggers list lacks CRM (engine.ts:12) | tables activity_plans + plan_steps (type, summary, offset, unit, before/after, responsible), launch action, plan-per-entity; auto-launch on stage change is custom |
| Chatter / Discuss | mail.thread messages, followers, subtypes, mail.activity; Discuss app = channels + inbox | Activity done/system messages land in chatter log | D/productivity/discuss | chatter module: messages, followers, activities | (no Discuss app needed) |
| Cockpit / lists | Activity view (type 'activity') on crm.lead: grid records x activity types with counts; systray "My Activities" grouped by model with Today/Overdue/Planned counts; filters "My Activities", "Late Activities", "Today Activities", "Future Activities"; kanban red/green/grey deadline | No priority tiers; ordering by deadline | D/sales/crm/optimize/utilize_activities.html | MyActivities server component, overdue first, no entity grouping or counts (chatter/ui/my-activities.tsx) | activity matrix view, counts per Today/Overdue/Planned, filters on lead list, "no next activity" filter |

## Gap-report verdicts the research shows are wrong or need nuance
- 10 / 25 / 29: Odoo core does NOT trigger activities on stage change either; plans are launched manually, so "PLANNED-ONLY / missing" is fair but the PDF assumption that Odoo does it natively is false (needs automated action or custom code in Odoo too).
- 12: Odoo core lost reason is optional; Revora already stricter than Odoo (item 12 PARTIAL is fine, but Pas interesse/Non qualifie are lost-reason values in Odoo, not statuses).
- 8 / 14: Odoo has no "status" beyond stage + won/lost(archived) so 13 statuses = 13 stages (or stages plus lost reasons); Revora's open/won/lost mirrors Odoo.
- 28: mandatory feedback is not Odoo core (optional) -> custom in both; MISSING stays but not a parity gap.
- 31 "stops old sequence": Odoo has no stop-sequence concept; plan activities are independent, "stop" = cancel/unlink remaining activities (custom).
- 37: Odoo 17 plan codes NR/INJ... are just plan names; activity types != plans. Revora gap is the Activity Plan entity, not types.
- 36 DONE: fine, but note Odoo automated actions CAN write state, so the rule is a design choice in Revora.
- Caveat: fetched 17.0 plan_template source showed no delay field, while 17.0 docs show Interval/Units/Trigger per step; unverified which exact 17.0 revision. Treat per-step delay as supported.

# Odoo 17 mechanisms vs Revora (research B)
Sources fetched: odoo.com/documentation/17.0/applications/studio/automated_actions.html and odoo/odoo base_automation.py (version not confirmed in the fetched copy; 17-era). Reporting rows marked (memory) were not re-fetched.
Revora facts: engine.ts TRIGGER_EVENTS = 7 business events (sales/invoicing/purchases/pos/inventory/credit payment), no CRM/chatter events; actions = create_activity (one dueInDays), post_note, webhook (outbox); conditions.ts payload match only; no cron-based rules; cron = /api/cron/daily (credit reminders) + /api/cron/outbox; dashboard kpis.ts = dueToday, overdue, collected, activeContracts, openLeads.

| mechanism | Odoo 17 model/fields | behaviour | URL | Revora today | to build |
|---|---|---|---|---|---|
| Automation rule | base.automation: model_id, trigger, action_server_ids, filter_pre_domain, filter_domain, trigger_field_ids, active | patches create/write/unlink on the model; runs actions in same transaction as the write | /documentation/17.0/applications/studio/automated_actions.html | automationRules table + runAutomations after emit | model-level hooks (record create/update), not just business events |
| Trigger: stage set to | trigger=on_stage_set (+ trigger_field_ids stage_id, filter_domain auto = stage_id = X) | fires when stage becomes X (field value changed) | same | none; moveLead (crm/service/leads.ts) emits no event | emit crm.lead.stage_changed {from,to}; add to TRIGGER_EVENTS |
| Trigger: user set / tag added / state set / priority set | on_user_set, on_tag_set, on_state_set, on_priority_set; domain auto-built; tag: pre_domain excludes tag | sugar over on_create_or_write with generated domains | same (docs group as "Values Updated") | none | optional; "status set to" is the one Mourabaha needs |
| Trigger: on save / create / update / delete / archive | on_create_or_write (on_create, on_write deprecated), on_unlink, on_archive, on_unarchive; trigger_field_ids: runs only if watched field changed | one rule for create+write; empty trigger fields = runs every save | same | none | generic record.created/updated events with changed-field diff |
| Trigger: on UI change | on_change, onchange_field_ids | form-view only, only Execute Code, manual edits only | same | n/a | skip |
| Trigger: time-based | on_time (trg_date_id, trg_date_range, trg_date_range_type minutes/hours/days/months, negative=before, trg_date_calendar_id working days), on_time_created, on_time_updated, last_run | ir.cron base_automation.ir_cron_data_base_automation_check scans records whose date+delay passed since last_run; interval = min delay/10, clamped 1 min..4 h (docs: "every 4 hours") | same | none | scheduled scan job over a date field + delay (e.g. nextActivityDue, stage entered + N days) with a last_run watermark |
| Trigger: webhook | on_webhook; secret URL, Rotate Secret, Log Calls, payload in ctx, Target Record code | inbound HTTP triggers rule | same | only outbound webhook action | optional inbound endpoint |
| Trigger: email received/sent | on_message_received, on_message_sent (mail.thread models only) | fires on message post | same | chatter has messages but no event | emit chatter.message.posted; "stop sequence on client reply" needs it |
| Before-update domain | filter_pre_domain (dev mode) checked on records BEFORE write (not on create) via _filter_pre; filter_domain ("Apply on") checked AFTER | together detect transitions, e.g. pre "email unset" + apply "email set" = newly set | same | conditions.ts checks the new payload only | carry previous values in event payload; support pre + post conditions |
| Action: create activity | ir.actions.server state=next_activity: activity_type_id, activity_summary, activity_note, activity_date_deadline_range(+_type), activity_user_type specific/generic (activity_user_id / activity_user_field_name) | schedules mail.activity; not allowed on on_unlink | same | create_activity (idempotent via ensureActivity); fixed type, due days only | assignee choice (owner/dynamic field), working-day offsets, plan = list of steps |
| Action: update record | state=object_write, fields_lines (evaluation_type value/reference/equation), update_m2m_operation add/remove/set/clear | writes fields; can retrigger other rules (not UI change) | same | none | update_record action (status, owner); needed for stage/status moves, must exclude forbidden statuses |
| Action: send email/SMS/WhatsApp | state=mail_post (template_id, mail_post_method email/comment/note), state=sms (sms_template_id, sms_method sms/comment/note); WhatsApp = enterprise whatsapp module, wa.template | template send or chatter message/note | same | team invite email only; no template action | send_email via template; WhatsApp needs provider |
| Action: add/remove followers | state=followers / remove_followers, partner_ids, partner_field_id | subscribes partners | same | none | low priority |
| Action: create record | state=object_create (crud_model_id, link_field_id, fields_lines) | creates linked record | same | none | optional |
| Action: execute code | state=code, python `code` with env, record, records, log, UserError, Command | arbitrary Python; raising UserError/ValidationError aborts the write | same | none (deliberately) | do NOT copy; use declarative guards |
| Action: webhook | state=webhook, webhook_url, webhook_field_ids | POST selected fields | same | webhook action (https only, via outbox) | ok |
| Action: multi | state=multi, child_ids (sequence ordered) | run existing actions in order | same | one action per rule | allow ordered action list per rule |
| Server action | ir.actions.server (model_id, state, binding_model_id, group_ids); run via button/cron/rule | reusable; "Action" menu binding | /documentation/17.0/developer/reference/backend/actions.html (memory) | none | n/a |
| Block / validate stage change | NOT a base_automation feature to rely on: python @api.constrains / write() override raising ValidationError; UI: field required via view attrs/states; Studio "required" is per field, optional conditional-required domain. Execute Code + UserError on on_stage_set works but is after the write in same txn (rolls back) | custom module code; no built-in "required fields per stage" in CRM | developer/reference/backend/orm.html (memory); studio docs above | schema CHECK constraints (crm/schema.ts:170-185); lost needs lostReason in markLost | stage-gate table (stage -> required fields/checklist) enforced in moveLead + service-level guard; same for complete-activity-needs-result |
| Scheduled actions | ir.cron: ir_actions_server_id, interval_number/type, nextcall, numbercall (removed in 17: recurring only), priority, active, lastcall | server-side loop on schedule; used by base_automation, digest, mail queue | /documentation/17.0/developer/reference/backend/orm.html#ir-cron (memory) | /api/cron/daily -> daily-reminders.ts (credit only), /api/cron/outbox | add CRM job in same daily route: leads without next activity, overdue activities |
| Overdue activity alerts | mail.activity: date_deadline, state computed overdue/today/planned, user_id; Activities systray + activity view; mail digest "Activities" (memory); base_automation on_time on date_deadline can email/notify | chip colours in UI; daily digest email only if digest configured | /documentation/17.0/applications/productivity/discuss/... (memory) | chatter.tsx:45 overdue highlight; no alert/digest | daily job + in-app list "my overdue activities" + manager rollup |
| Lead without next activity | no built-in alert; typical: server action/cron with domain activity_ids = False & active, or filter "Activities: no activity" in CRM list (activity_state = False) | search filter + cron | (memory) | leads.nextActivityId nullable, no check | scheduled domain scan + dashboard count (target 0) |
| CRM pipeline analysis | crm.lead report (read_group on crm.lead, pivot/graph/list/cohort) via CRM > Reporting > Pipeline; measures expected_revenue, count; groupby stage, user, source, lost_reason, create/close dates; day_open/day_close | ad-hoc grouping | /documentation/17.0/applications/sales/crm/optimize/... (memory) | leadsByStage (leads.ts:195); no reporting UI | pivot/group-by report on leads (stage, owner, lost reason, age) |
| Activity analysis | mail.activity.report (view of mail.activity + done activities): count by type, user, state | pivot/graph | (memory) | none | report over chatter activities by type/user/state/age |
| Spreadsheet dashboards | spreadsheet_dashboard (Enterprise: documents spreadsheet); stored JSON with pivots/lists/charts and global filters | per-app dashboards, live data | /documentation/17.0/applications/productivity/spreadsheet.html (memory) | core/dashboard (kpis.ts, due-list.ts) | extend KPI set; no spreadsheet engine needed |
| KPI digest | digest.digest: periodicity daily/weekly/monthly/quarterly, kpi_* boolean toggles, user_ids, template; cron sends comparison vs previous period | email of KPIs; extend by adding kpi_ fields | /documentation/17.0/applications/general/digest_emails.html | none (reminders email only credit) | digest job: per-manager KPI email from dashboardKpis |

## Gap-report verdicts the research shows are wrong or need correcting
- #36 "Odoo never auto-sets Pas interesse / Non qualifie / Rejet = DONE": true only because Revora has no update-record action and no CRM trigger. Odoo's update_record/Execute Code CAN set status. Reword to "not applicable yet"; becomes a design constraint when an update_record action is added (whitelist excluded statuses).
- #10 / #25 / #78 are fair but understate cause: engine has no record-change triggers at all (no create/update/stage/time), not only missing CRM events. Time-based (cron scan with delay) is a separate missing piece, needed for NR/INFO J+N sequences and "dossier waiting" recovery.
- #85 "No completed activity without result" and #84 are not Odoo built-ins either (Odoo activity feedback is optional; the PDF's rule needs custom constraint). Gap stands but is a custom build, not a parity gap.
- #86 PARTIAL: Odoo's lost reason (crm.lost.reason) is mandatory on Mark Lost, so Revora's lostReason matches Odoo; the "two statuses" need separate stages/status, not new mechanism.
- #75 / #35: Odoo has no native "lead without next activity" or "stuck lead" alerts either; they are filters + cron/digest. Gap is smaller conceptually (domain scan + daily job).
- #73-74/#71 KPIs: Odoo 17 only gives count/age grouping and digest KPIs; delay KPIs (dossier reçu delay, analysis delay) need stage-entry timestamps (Odoo: date_last_stage_update, day_open). Revora has no stage-entered-at column; check.
- Timer detail: docs say time-based rules run "every 4 hours"; source computes interval = min delay/10 clamped 1 min..4 h, so granularity is better than the docs claim.

# Odoo 17 coverage vs Revora (sections 41-70). Source: odoo/odoo 17.0 raw source (docs site fetch was flaky; URLs are the expected 17.0 doc pages, not all re-verified)
| mechanism | Odoo 17 model/fields | behaviour | URL | Revora today | to build |
|---|---|---|---|---|---|
| Groups/roles | res.groups; sales_team.group_sale_salesman ("Own Documents Only"), group_sale_salesman_all_leads, group_sale_manager (implied chain); purchase.group_purchase_user/manager; stock.group_stock_user/manager | Groups imply each other; ir.model.access CRUD per model per group | /documentation/17.0/applications/general/users/access_rights.html | roles w/ wildcard perms (src/core/tenancy/default-roles.ts; can() in src/core/perms/index.ts); 4 roles only | add roles telephone_agent, team_leader, back_office, credit_analyst, purchasing, delivery as seeded permission sets |
| Record rules | ir.rule: domain_force, groups, perm_*; sale: "Personal Orders" ['|',('user_id','=',user.id),('user_id','=',False)] for own-docs group; "All Orders" [(1,'=',1)]; multi-company rule | Row filter ANDed across global rules, ORed across group rules | .../access_rights.html#record-rules | perms are action-level only; no row scoping found (only createdBy on crm) | row-scope (owner/team) filter in list/get services |
| Sales teams + leader | crm.team (name, user_id=team leader, member_ids, company_id); crm.lead/sale.order team_id, user_id; _get_default_team_id picks team where user is leader or member | Leader sees team via rules; team dashboards (sale_models_crm_team.py sums by team_id) | /documentation/17.0/applications/sales/crm/optimize/team_management.html (verify) | no team entity; Manager role stands in | team + member table, leader flag, team_id on lead/contract, team KPI |
| Opportunity -> quotation | sale_crm: crm.lead.order_ids (One2many sale.order.opportunity_id), action_sale_quotations_new; state draft/sent/sale/cancel only | Button on won/open lead creates SO with partner, team, user, opportunity_id | /documentation/17.0/applications/sales/crm/acquire_leads/... ; sales/send_quotations | crm lead -> credit contract link not found; sales.order.confirmed event exists (src/modules/sales/service/orders.ts:325) | lead->contract/quotation action carrying owner/team |
| SO approval | NONE in Community 17: SALE_ORDER_STATE has no to_approve (sale_order.py:22). Enterprise: Approvals app (approval.category, approval.request, approver rules, can attach to sale.order via Studio/automation); optional quote 'require_signature'/prepayment | Gate is Enterprise/Studio, not core | /documentation/17.0/applications/productivity/approvals.html | none (grep approv: only hr leave) | own approval entity (request, approvers, state) gating contract activation |
| PO double validation | res.company.po_double_validation ('one_step'/'two_step'), po_double_validation_amount (default 5000); purchase.order state draft/sent/to approve/purchase/done/cancel; _approval_allowed() | button_confirm -> 'to approve' if amount >= threshold and user not purchase manager; button_approve | /documentation/17.0/applications/inventory_and_mrp/purchase/manage_deals/... (settings: Purchase > Orders > Purchase Order Approval) | PO states draft/sent/confirmed/received/cancelled (purchases/schema.ts:60), no approval | add to_approve state + threshold setting |
| Document requests | Enterprise Documents: documents.request wizard (name, owner, partner, activity_user, folder, tags) -> empty documents.document w/ requestee, upload via share link; documents workflow rules; Checklist = none native (use activity types/tags or mail.activity.plan, or a custom one2many) | Requestee gets email/activity; file uploaded fills the placeholder | /documentation/17.0/applications/productivity/documents.html | files table (kind, entity, recordId; src/core/db/schema/infra.ts:116, src/core/files/service.ts); no request/checklist | doc_requirement + doc_request entity per dossier, required-by-channel set, gate on 'dossier recu' |
| Community attachments | ir.attachment (res_model,res_id,res_field,datas) + chatter | Plain upload, no requirement tracking | /documentation/17.0/developer/reference/backend/orm.html | same | as above |
| MTO / Buy route | stock.route, stock.rule(action='buy' via purchase_stock, procure_method make_to_stock/make_to_order/mts_else_mto); product.template.route_ids; procurement.group; sale_stock._action_confirm launches stock rules; _run_buy finds/creates draft PO per vendor (_make_po_get_domain) and merges lines | Confirming SO with MTO+Buy routes creates draft PO (origin=SO) + picking waiting on receipt; sale_purchase only for service products | /documentation/17.0/applications/inventory_and_mrp/inventory/product_replenishment/mto.html | inventory handles sales.order.confirmed -> draft delivery moves (src/modules/inventory/events.ts:11); reorder rules; no SO->PO | on contract/dossier event create draft PO (reuse purchases service/orders.ts) with source ref |
| Reservation | stock.move state confirmed/partially_available/assigned; _action_assign reserves, stock.move.line reserved qty; picking state draft/waiting/confirmed/assigned/done | Validate-ready ('Ready') = fully reserved; reservation_method per picking type | .../inventory/shipping/operation/... | no reservation (grep empty) | reserved_qty on stock levels + securing state (reserved/to buy/stockout/secured) |
| Delivery order + signature | stock.picking (picking_type_id outgoing, state, scheduled_date, carrier, signature Image, is_signed; setting group_stock_sign_delivery "Digital Signature") | Sign widget on picking form; stored as attachment; printed on delivery slip. No photo/geo proof natively | /documentation/17.0/applications/inventory_and_mrp/inventory/shipping/operation/delivery_signature.html (verify) | none | delivery order entity w/ signature file, doc-return step |
| Islamic/installment | No Community/Enterprise module. Standard: sale.order + payment term (account.payment.term lines) for installments; Enterprise account_loans for the lender side. Murabaha: OCA has none known (search of GitHub found nothing); usual approach is custom module (cost+markup contract, installment schedule, guarantees) or OCA contract/ sale_financing-like | N/A | N/A | credit_sales already has contract, installments, guarantors, scoring (schema.ts:32-322) | Revora is ahead of Odoo here; keep as the Credit platform |

## Gap-report verdicts the research shows are wrong or need nuance
- Items 41-43 "PARTIAL": roles exist in spirit but Odoo has no telephone-agent/team-leader role either; it uses crm.team (leader user_id) + salesman groups. Revora's missing piece is team + row scope, not a role per se.
- Item 60/61 "MISSING": Odoo core ALSO does not do dossier-triggered purchase; SO->PO is MTO/Buy rule-based on SO confirm. Revora already has the event hook; needs a handler. Reservation also needs building (Odoo's is native).
- Items 54-59 (central risk/bank/reserve) "MISSING": correct; Odoo has no equivalent either (custom).
- Items 46/65 doc gates: Odoo Community has no checklist/gate; Documents requests are Enterprise only, so "build custom" is the correct parity target.
- Item 63: Odoo signature is a single image field on stock.picking (opt-in group), not a full delivery proof; Revora's file table can match it cheaply.
- No SO approval in Community 17 (sale.order has no to_approve), so do not call it a missing Odoo-standard feature; PO threshold approval is the only built-in.

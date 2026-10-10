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

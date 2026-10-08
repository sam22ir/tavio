# Algeria business software requirements (research)

Research date: 2026-10-08. Most sources found were secondary (consulting, accounting and blog sites). No official DGI, JORA or ANPDP text was retrieved directly. Every legal or tax claim below needs accountant/lawyer verification. "Unknown" means no source was found.

## 1. SCF chart of accounts
- Framework: Law 07-11 (25 Nov 2007), Decree 08-156 (26 May 2008), Arrêté of 26 Jul 2008 (accounts nomenclature, rules, statements). Published JO n° 19, 25 Mar 2009 (per secondary source). In force 1 Jan 2010. Needs accountant verification.
- Class 1 is "Comptes de capitaux", with account 101 for issued capital (secondary mémoire source). Needs accountant verification.
- Full list of classes 1-9 and sub-accounts: unknown. A mémoire showing classes 10-49 reflects the old PCN 1975 structure, not the SCF. Do not use it as the SCF nomenclature.

## 2. TVA (VAT)
- Normal rate: 19%. Needs accountant verification.
- Reduced rate: 9%. Finance Law 2026 (Loi n° 25-17, 14 Dec 2025) extended it to more sectors, including old residential property rehabilitation, some health and training services, and intercity bus transport (Deloitte, TSA). Exact scope: unknown, needs lawyer verification.
- Tourism services at 9% until 31 Dec 2027 (secondary: vatcalc / Kintsugi). Needs verification.
- Older rates of 17% and 7% appear in an old source. Treat as obsolete. Needs verification.

## 3. G50 monthly declaration
- Real regime: monthly G50, due by the 20th of the following month (secondary: upgrowth.dz, zoomalgerie, 2026 guides). Needs accountant verification.
- Simplified real regime: quarterly. IFU taxpayers do not file G50 (secondary). Needs verification.
- Filing via Jibayatic (online). Said to be mandatory from 1 Jan 2026 for real-regime taxpayers (secondary). Needs verification.
- Late penalty: 10% plus 3% per month, capped at 25% (secondary, unverified). Needs verification.
- Zero declarations are still required (secondary). Needs verification.

## 4. Timbre fiscal (stamp duty)
- Receipts, Finance Law 2025 tiers (secondary: Algérie-Eco / TSA / afrik.com): up to 300 DA exempt; 300 to 30,000 DA = 1 DA; 30,000 to 100,000 DA = 1.5 DA; above 100,000 DA = 2 DA. Applied to the whole amount, not per bracket. Needs accountant verification.
- Previous rule: 1 DA per 100 DA, capped at 10,000 DA (secondary). Superseded, needs verification.
- Cash ban, LF 2025 Art. 207 (secondary): no cash for real estate, car/equipment dealers, yachts, and mandatory insurance policies. Needs lawyer verification.
- Older general cash threshold: 50,000 DA (Décret exécutif 05-442, effective 1 Sep 2006). Current status: unknown.
- LF 2018 deductibility limit for cash-paid invoices above 300,000 DA: current status unknown.

## 5. Company identifiers
- NIF (tax ID, DGI), NIS (statistical ID, ONS), RC (trade register, CNRC) are distinct (secondary article, 2026). Needs verification.
- NIS on official correspondence per Decree 94-01 (secondary). Needs verification.
- "AI" (article d'imposition): no source confirms it as an invoice mention. Unknown.

## 6. Mandatory invoice mentions
- Secondary guide lists: supplier identity, NIF, invoice number and date, description, unit price and total, VAT amount and rate, total payable. Official basis: unknown. Needs accountant verification.

## 7. DZD rounding and formatting
- No official rounding rule found. Unknown.
- Centimes are effectively out of circulation. Prices are commonly rounded to multiples of 5 DA (Wikipedia, general). Unknown whether invoices must follow this.
- Engineering suggestion (not a legal claim): compute in integer centimes internally, make the rounding rule explicit and configurable, and confirm it with an accountant.

## 8. Arabic RTL and French
- No source found on mandatory language rules for invoices or accounts. Unknown. Practical note: business documents are commonly bilingual in practice (not verified).

## 9. Payment methods
- SATIM operates CIB and Edahabia. Since early 2020, CIB and Edahabia cards are accepted at any merchant TPE (algerie-eco, 2020). Needs verification.
- Old SATIM stats (end 2021): 39,000 TPE, 154 online shops. Dated; newer data unknown.
- Online payment: via bank or Algérie Poste virtual TPE contract. Third-party gateways (WordPress plugins, MYTPE) are not confirmed as SATIM-certified.
- CCP and bank transfer technical rules: unknown.

## 10. Law 18-07 (personal data) and ANPDP
- Transfers abroad require prior ANPDP authorization, with exceptions (consent, contract, legal obligation, judicial procedure, vital interests, public interest). Source: GIDE (law firm). Needs lawyer verification.
- Transfers that threaten national security or vital state interests are prohibited; the term is not defined (GIDE). Needs lawyer verification.
- Law 25-11 (24 Jul 2025) amended 18-07, strengthening ANPDP powers (investigations, suspension, administrative fines). Needs lawyer verification.
- Penalties up to 5 years' imprisonment and a DA 500,000 fine (secondary). Needs lawyer verification.
- Adequacy country list: none published, per secondary source. Needs verification.

## 11. E-invoicing
- Planned B2B/B2G mandate slipped beyond 2026. As of early 2026 no binding legal framework. Large taxpayers expected 2027 at earliest (secondary: sharedserviceslink, vatcalc). Needs verification.
- Planned model: centralized real-time clearance (CTC) by the DGI. A voluntary scheme for public-contract suppliers has run since 2023 (secondary).
- LF 2026 requires certified billing software (secondary). Record retention: 6 years vs 10 years, conflicting. Unknown.

## 12. Installment and credit sales
- Consumer protection: Law 09-03 (25 Feb 2009), in force 8 Mar 2009 (WIPO Lex). Needs lawyer verification.
- No specific rule found for installment sales, effective annual rate, required contract content, withdrawal period, or early repayment. Unknown.

## 13. Odoo l10n_dz
- No official Odoo l10n_dz localization was confirmed in search results. Unknown.
- Third-party Algeria modules exist: Nimizis "Algeria - Base" (v16.0, AGPL-3, 58 wilayas per Law 19-12); Elosys eloapps_l10n_dz_regions (v11-17, 15,956 localities); TaghrasThink "Administrative Division" (v17-19, 69 wilayas). Licensing and accuracy need checking before use.
- Verify on apps.odoo.com and Odoo docs for each target version.

## Sources
(Accessed 2026-10-08. Source publication dates were not available in search results unless stated.)
- Université de Béjaïa, SCF course material: https://elearning.univ-bejaia.dz/mod/resource/view.php?id=303339
- Université de Mila, JIAMCS article: https://jiamcs.centre-univ-mila.dz/index.php/fber/article/view/1705/1273
- Deloitte, LF 2026 main measures: https://blog.avocats.deloitte.fr/algerie-les-principales-mesures-de-la-loi-de-finances-pour-2026/
- TSA Algérie, taxes and salaries from 1 Jan 2026: https://www.tsa-algerie.com/taxes-salaires-ce-qui-change-au-1er-janvier-2026-en-algerie/
- Kintsugi, Algeria VAT guide 2026 (secondary): https://trykintsugi.com/sales-tax-guides/africa/algeria
- VATcalc, Algeria tourism VAT (Jan 2025): https://www.vatcalc.com/algeria/algeria-cuts-tourism-vat-jan-2025/
- Algérie-Eco, cash payment ban from 2025: https://algerie-eco.com/2024/12/31/fini-les-paiements-en-especes-pour-ces-transactions-a-partir-de-2025/
- Algérie360, timbre fiscal 2025: https://www.algerie360.com/timbre-fiscal-gratuit-en-2025-qui-est-concerne-et-comment-en-beneficier/
- Afrik.com, cash limit 50,000 DA: https://www.afrik.com/algerie-le-paiement-en-especes-interdit-au-dela-de-50-000-dinars
- CMS, LF 2018 overview: https://cms.law/fr/fra/a-la-une/algerie-loi-de-finances-pour-2018-apercu-sur-les-principales-dispositions
- Upgrowth, G50 guide: https://www.upgrowth.dz/g50-declaration-algerie
- ZoomAlgérie, G50 and Jibayatic: https://zoomalgerie.com/g50-algerie/
- ZoomAlgérie, NIF guide 2026: https://zoomalgerie.com/numero-fiscal-algerien-nif-comment-obtenir/
- DemarchesDZ, NIS guide 2026: https://www.demarchesdz.com/obtenir-nis/
- GIDE, personal data protection in Algeria: https://www.gide.com/en/news-insights/protection-of-personal-data-focus-on-algerian-regulations/
- AlgeriaTech News, Law 25-11 and cross-border flows: https://algeriatech.news/?p=26670
- APS, personal data protection commentary: https://fr.apanews.net/society/algerie-protection-des-donnees-personnelles-un-encadrement-plus-symbolique-que-reel/
- VATcalc, Algeria e-invoicing mandate slips: https://www.vatcalc.com/algeria/algeria-e-invoicing-mandate-slips/
- Shared Services Link, e-invoicing delay: https://sharedserviceslink.com/news/algeria-s-e-invoicing-mandate-slips-beyond-2026-as-regulatory-framework-lags
- SATIM / CIB and Edahabia, Algérie-Eco (2020): https://algerie-eco.com/?p=76087
- MYTPE (third-party provider, marketing claims): https://mytpe.app/about
- WIPO Lex, Law 09-03: https://www.wipo.org/wipolex/en/legislation/details/20559
- Odoo Apps, Nimizis Algeria Base: https://apps.odoo.com/apps/modules/16.0/nimizis_dz_base
- Odoo Apps, Elosys eloapps_l10n_dz_regions: https://apps.odoo.com/apps/modules/12.0/eloapps_l10n_dz_regions
- Wikipedia, Algerian dinar: https://en.wikipedia.org/wiki/Algerian_dinar

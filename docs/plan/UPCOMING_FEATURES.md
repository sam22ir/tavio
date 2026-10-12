# Upcoming features: what comparable systems have that we don't

Sources: two rounds of web research on 2026-10-12.
- Round 1: global ERP suites, Algeria/MENA, modern AI-native tools.
- Round 2 (Parallel search connector): official-source verification of the compliance items, the vendors round 1 could not open, and a deeper pass on credit sales.
- Round 3 (Perplexity website, free tier): payroll rates, the Algerian SME software market, payment gateways. **Stopped early at Perplexity's free-search limit** (about 3 answered questions per agent). Answers are model-generated with citations; the cited official PDFs were listed but **not opened**, so treat round-3 figures as MEDIUM confidence until checked.
- Round 4 (Exa tools only): remaining legal facts read from official texts where possible, integration provider docs and prices, the Algerian market and funding, and a competitor teardown from vendors' own pages. Figures marked `[S]` came from search extracts, not opened pages.

This is a candidate list to choose from, not a committed roadmap; the committed plan stays in [ROADMAP.md](./ROADMAP.md).

**How to read the tags**
- Effort: S (days), M (1-3 weeks), L (a month or more). Guesses.
- Value: for an Algerian SME, especially a retailer selling on credit. H / M / L. Guesses.
- **CONFIRMED** = seen in an official text or on an official page. **CORRECTED** = round 1 was wrong. **[VERIFY]** = still unconfirmed; do not code against it before an accountant or the official text confirms it.

---

## 1. Algerian compliance (highest priority)

| # | Item | Status and exact rule | What we build | Effort | Value |
|---|---|---|---|---|---|
| 1.1 | **69 wilayas, 1,541 communes** | **CONFIRMED** (official): Law 26-06 of 4 Apr 2026 (JO n° 25); wilayas 59-69 named by decree (JO n° 40) and listed with codes in the JO n° 58 annex (12 Aug 2026). The 11 new wilayas: Aflou, Barika, El Kantara, Bir El Ater, El Aricha, Ksar Chellala, Aïn Oussara, Messaad, Ksar El Boukhari, Bou Saâda, El Abiodh Sidi Cheikh. Mother wilayas keep their powers until the new executives are installed (transfer by 31 Dec 2026). | **Our list in `src/core/tenancy/wilayas.ts` has 58 entries and no codes 59-69.** Add the 11 wilayas (fr/ar/en), update the commune data, and decide how existing companies and contacts that sit in a mother wilaya are re-assigned. | S-M | H |
| 1.2 | **Software publisher compliance commitment, from 1 Jan 2027** | **CONFIRMED** (official, Finance Act 2026 / law 25-17). Not a government certification: the publisher must commit that the software guarantees inalterability, security, retention and archiving, **or** hold a certificate from an accredited body. Publisher must give codes and documentation on request during an accounting audit (arts. 51 bis CTCA, 20 ter and 51 sexies CPF; dates in the final article before art. 110). | We are the publisher. Document and prove: audit trail, immutability of posted documents (already true), archiving, 10-year retention, export of documentation. Prepare the commitment letter. | M | H |
| 1.3 | **G50 online filing** | **CORRECTED.** Art. 111 LF 2026: taxpayers under the *réel* regime and the *simplifié BNC* regime must file returns electronically; electronic payment allowed. Jibayatic online payment launched 25 Jul 2026; G50 payment guide published 3 Aug 2026; G50 / G50 ter / G12 bis deadlines were extended in 2026. Monthly IRG-on-salaries payment: 1st to 20th of the following month. | Produce the G50 figures as a reviewable draft for manual entry. **Do not claim Jibayatic compatibility.** The third-party file spec was not found **[VERIFY]**. | M | H |
| 1.4 | **Payroll** (fiche de paie) | Confirmed: SNMG 24,000 DA/month from 1 Jan 2026; CNAS employee 9%. **CNAS employer 25% + 0.5% social-works fund** (decree 15-236, 2015): MEDIUM, no official text found in round 4, still **[VERIFY]**. **CASNOS** (non-salaried): 15% (7.5% insurance + 7.5% pension) of an annual base between 1x and 20x the annual SNMG (288,000 to 5,760,000 DA, so 43,200 to 864,000 DA a year), decree 26-257 of 15 Jul 2026 (JO n° 53), applies from 23 Jul 2026 (old minimum 32,400 DA); auto-entrepreneurs may pay a flat 24,000 DA; its interaction with the flat-regime base (25% or 35% of turnover in older notes) is unclear. **IRG monthly scale** (art. 104 CIDTA, several secondary sources, official text not read): 0% up to 20,000 DA; 23% from 20,001; 27% from 40,001; 30% from 80,001; 33% from 160,001; 35% above 320,000 DA. The **40% abatement applies to the tax and is bounded between 1,000 and 1,500 DA a month** (1,000 is the abatement minimum, not an IRG floor). **Salaries up to 30,000 DA taxable per month are exempt**, with a smoothing formula from 30,001 to 35,000 DA (formula not checked). Taxable base = gross minus employee CNAS 9%. **[VERIFY]** whether the 33% band is new in LF 2026 (one source) or unchanged since LF 2022 (another). | Payroll with **versioned rate tables, not hard-coded constants**; an accountant signs off the scale, the exemption smoothing and the CASNOS base before release. We have HR but no payroll; Odoo has none for Algeria. | L | H |
| 1.5 | **DAS / DAC** (CNAS annual declarations) | **CORRECTED:** due within 30 days after year end (about 30 January, not 31). Filed on teledeclaration.cnas.dz; CNAS provides an extraction tool for employers. File spec **[VERIFY]**. | Export of the data DAS needs, once payroll exists. | M | H |
| 1.6 | **Stamp duty (droit de timbre) on cash-paid invoices** | **CONFIRMED** (Code du timbre art. 100-I as rewritten by LF 2025 art. 46, in force 1 Jan 2025, no ceiling): over 300 DA up to 30,000 DA: 1 DA per 100 DA or fraction; 30,000 to 100,000: 1.5 per 100; above 100,000: 2 per 100; **minimum 5 DA**. Electronic-payment receipts exempt (art. 258 quinquies); 300 DA or less exempt. **Round 4 corrected the earlier conflict:** no text read shows a 45 DA minimum (the pre-2025 rule was 5 DA with a 10,000 DA cap). Whether LF 2026 changed it is **[VERIFY]**: the full LF 2026 PDF would not load, and the communiqué excerpts show no change. | Check what our tax pack already does; make tiers and the minimum **configurable**. | S | H |
| 1.7 | **Legal books** | **CONFIRMED** (Law 07-11, Commercial Code arts. 9-12): livre-journal, grand livre, livre d'inventaire; the journal and inventory book must be numbered and signed by the court president; 10-year retention; computer-kept accounts allowed (art. 24). | Exports in the official layout, a print step for the signed books, retention policy. | M | H |
| 1.8 | **Customer consent for SMS / WhatsApp / email** | **CONFIRMED:** law 18-05 art. 32 forbids direct prospecting by electronic message without prior consent (art. 18: consent before collecting data); law 18-07 requires express consent, withdrawable at any time. Treat 18-05 as the stricter rule. Law 25-11 (Jul 2025) amended 18-07. DPO duty under decree 25-350 **[VERIFY]**. | Per-customer opt-in with proof (when, how), opt-out in every message. Does not apply to purely transactional messages about an existing contract (confirm with a lawyer). | S | H |
| 1.9 | **Monthly IRG-on-salaries reminder** | From the DGI calendar (réel regime): pay between the 1st and the 20th. | Reminder and a due-date view. | S | M |
| 1.10 | **Multi-currency** (DZD / EUR / USD) | Bank of Algeria publishes daily reference rates. | Document currency + rate per day, revaluation of open items. | M | M |
| 1.11 | **E-invoicing readiness** | **CORRECTED:** no mandate in force. The planned model (centralised clearance, 5-corner) stalled; 2027 or later is more likely; no binding text. Invoice form still rests on decrees 05-468 and 16-66. | A structured-invoice field set **behind a flag** only. Do not build clearance. | M later | M |
| 1.12 | **Online-shop legal requirements (law 18-05)** | **CONFIRMED** (official text, read in part): e-commerce needs registration in the commercial or artisan register mentioning e-commerce, and a website **hosted in Algeria on a `.com.dz` domain** (art. 8); the domain is deposited with the CNRC (art. 9); **electronic payment only through platforms run by banks approved by the Bank of Algeria and by Algérie Poste** (art. 27); secure connection with electronic certification (art. 28); platforms controlled by the Bank of Algeria (art. 29). No separate CNRC "authorization" was found; the requirements sit in the law. Blog claims (30-day delivery, 14-day return, SATIM-only) are not in the official text read. | **Flag for a lawyer:** art. 27 may conflict with third-party gateways (Chargily, SlickPay), and art. 8 conflicts with hosting the shop abroad. Decide how the website module is positioned before promising online card payments. | S (decision) | H |
| 1.13 | **Monthly transaction report to the CNRC (decree 19-89)** | **CONFIRMED** (official excerpt): e-commerce sellers transmit monthly transaction data to the CNRC before the 20th of the following month: object, amount incl. tax, date, payment mode, invoice number. | Monthly export for shop operators. | S-M | M |
| 1.14 | **Personal-data transfers abroad (law 18-07, 25-11)** | **No general rule forces storage in Algeria** was found. Transfer to a foreign state needs the ANPDP's authorization and adequate protection (art. 44), with exceptions such as explicit consent or contract performance (art. 45); prior declaration must name foreign transfers (arts. 13-14). Law 25-11 (Jul 2025) amends the scope. DPO duty and decree 25-350 not read **[VERIFY]**. | Decide hosting and sub-processors (we run on foreign cloud services) with a lawyer; keep a processing register. | M | H |
| 1.15 | **E-signature validity (law 15-04, new law 26-02)** | **CONFIRMED** generally valid: a qualified signature needs a qualified certificate, a secure device and sole control (15-04 art. 7). New trust-services law 26-02 (17 Feb 2026, JO n° 14): an e-signature cannot be denied effect for being electronic (art. 16), and contracts concluded electronically keep their validity and evidentiary force (arts. 55-56). **[VERIFY]** whether 26-02 repeals 15-04. The AECE (run by ARPCE) issues qualified certificates (2-year validity, hardware token); no Algerian e-signature SaaS was found. | Basic e-signature (OTP, audit trail) is defensible; qualified signatures need an AECE certificate. Confirm with a lawyer. | S-M | H |

**Dropped after verification:** the cash-payment limit. No binding threshold exists; a 500,000 DA cap was discussed in the press and is not in force.

**TAP: CONFIRMED abolished** (round 4, official DGI circular 09 read): LF 2024 art. 14 repealed CIDTA arts. 217-231 and art. 24 repealed arts. 357-364, effective 1 Jan 2024. Our tax pack still ships TAP inactive by default; remove it or mark it obsolete.

**IFU: CORRECTED.** The threshold is **8,000,000 DA** (CIDTA art. 282 ter, LF 2024 art. 17), not 15 million; auto-entrepreneurs up to 5,000,000 DA. Rates: 5% for production and sale of goods, 12% for other activities, 0.5% for auto-entrepreneurs; minimum tax 30,000 DA (10,000 for auto-entrepreneurs). LF 2026 keeps the regime.

## 2. Credit-sales strengths (extend our lead)

No suite we found advertises installment contracts with guarantors and a risk score. These deepen the one area where we are ahead.

**From round 1**

| # | Feature | What it does | Effort | Value |
|---|---|---|---|---|
| 2.1 | **Cheque and traite register** | Post-dated, domiciled and bounced cheques with a lifecycle (registered, deposited, bounced, cleared), maturity view, bounce alerts, auto journal entries. Bounced cheques must be declared to the Centrale des Impayés within 4 working days (Bank of Algeria). | S-M | H |
| 2.2 | **Payment auto-matching with explanations** | Match bank lines and payments to installments and invoices, show why, queue the rest. | M | H |
| 2.3 | **AI collections assistant (suggestion mode)** | Rank overdue accounts daily, draft French or Arabic reminders for one-click approval, capture promise-to-pay and disputes as structured notes. Builds on our AI draft button. | M | H |
| 2.4 | **"Who to call today" brief** | Per customer: late amounts, last contact, promised dates, risk change. | S-M | H |
| 2.5 | **Cash-flow forecast** | Inflows from installment schedules and cheque maturities, runway date, "top 5 debtors pay 15 days late" scenarios. | M | H |
| 2.6 | **E-signature** on contracts and guarantor forms | Templates, signing order, SMS OTP, audit trail. | S-M | H |
| 2.7 | **Multi-level approvals** | Sequential approvers, approval limits. | M | H |
| 2.8 | **Field collector app** | Offline visit list, GPS, on-site payment and receipt. | L | H |
| 2.9 | **Reminder timing prediction** | Best day/time to chase per customer. | M | M |
| 2.10 | **Bank-leasing style sale (Ijar)** | Rent-to-own schedule with residual value. | M | M |

**New in round 2**

| # | Feature | What it does | Source of the idea | Effort | Value |
|---|---|---|---|---|---|
| 2.11 | **Payment allocation waterfall** | Each payment is split in an explicit configured order across fees, penalties, interest and principal. | Apache Fineract | S | H |
| 2.12 | **Fee vs penalty flag** | Penalties post to their own account and are reported separately. | Fineract | S | H |
| 2.13 | **Late-payment penalty engine** | Charges triggered by overdue or by installment date, flat or percent. | Fineract | M | H |
| 2.14 | **Reschedule / refinance** | Keep the outstanding balance, change the schedule, carry balances forward. | Mambu | M | M |
| 2.15 | **Promise-to-pay auto-pause** | An active promise pauses dunning; a tolerance amount and days define when it breaks. A broken promise creates a callback task for the collector. | BillingPlatform, Oracle Collections | S | H |
| 2.16 | **Dunning ladder by days past due** (about 7 / 30 / 60 / 90) | Reminder, then a person at 30, owner at 60, restructure or escalate at 90; the channel changes per step. | Collections guides | S | H |
| 2.17 | **Block new credit while overdue** | A customer with an overdue installment cannot open a new installment plan until cleared. | Tabby | S | H |
| 2.18 | **Eligibility gates before a plan** | Age, national ID captured, credit history, minimum down payment. | Tabby | S | H |
| 2.19 | **Per-installment payment links** | One link per installment, sent by SMS or WhatsApp; auto-mark paid on webhook. | Chargily Pay, SlickPay | S-M | H |
| 2.20 | **Serial / IMEI lifecycle and warranty** | Serial at sale, warranty end per SKU, defective unit returned to the supplier (RMA). | Easy Sell, appliance POS vendors | M | H |
| 2.21 | **Layaway and rent-to-own** | Deposit first, due dates, cancel with a configurable restocking fee. | CellSmart, AIM | S-M | H |
| 2.22 | **Delivery proof** | Signature, photo, GPS, customer ID captured before release. | Delivery apps | M | H |
| 2.23 | **Trade-in as part payment** | Used item valued, accepted as part payment, becomes stock in one step. | Easy Sell | M | M |
| 2.24 | **Manufacturer warranty chargeback** | Track authorization numbers for supplier credits on repaired goods. | STORIS | M | M |
| 2.25 | **Recurring invoicing parity** | Auto-invoicing, renewals, self-cancel with reason. We have a subscriptions module; check the gap. | Odoo, Holded, Alegra | S-M | H |
| 2.26 | **CCP direct debit** (v1 built, see the PR for CCP direct debit) | Monthly payment file (bordereau) for Algérie Poste, statement import, handling of **rejected debits**, CCP key check. The headline feature of Vyvex and of MekaStore's credit edition: many customers pay through CCP. | M | H | Vyvex, MekaStore [opened pages] |
| 2.27 | **Customer credit ceiling** | A per-customer limit that blocks a new credit sale above it, with alerts (distinct from 2.17, which blocks while overdue). | S | H | DropDz, Protid, DZBuild POS, Cirtasoft |
| 2.28 | **Bank-financed vs in-house installments** | Record the two separately: a bank-financed sale (the buyer's bank pays the seller) is a different flow from the shop's own schedule. | M | H | Round-4 market report; Algerian bank offers (BDL Mourabaha, CPA) |
| 2.29 | **Cash-on-delivery returns and collections against accounts** | COD is about 95% of e-commerce with 15-30% return rates; track collection and returns per customer account. | S-M | M | Round-4 market report |
| 2.30 | **Consumer-credit paperwork helper** | Help the seller assemble the file for the Ministry scheme: invoice in the buyer's name, local-production attestation, bank package. | M | M | commerce.gov.dz arrêté of 31 Dec 2015 |
| 2.31 | **Blacklist and rejected-payment flags** | A customer blacklist and flags for rejected CCP debits and bounced cheques. | S | M | Vyvex |

**KPIs and reports to add to the credit module**
1. PAR30 / PAR90: outstanding balance of contracts with an installment more than 30 / 90 days late, divided by total outstanding.
2. Vintage curve: delinquency % by months-on-book, one curve per origination month.
3. Roll rate: share of balance moving from one aging bucket to the next in a month.
4. Cure rate: share of a delinquent bucket back to current within N days.
5. Collection efficiency: cash collected in the period divided by installments that fell due in the period.
6. Promise-to-pay kept rate.
7. Collector productivity: promises, collections and calls per collector per day.
8. Dunning response rate by channel and by days-past-due bucket.
9. Early-settlement and reschedule rate by product.
10. Write-off and post-write-off recovery rate.

(Items 2-5 and 7-10 are standard industry definitions; the sources did not publish formulas.)

**Rules to respect when designing these**
- **Early-settlement discounts on a murabaha-style sale must be discretionary** (AAOIFI-based guidance): a manual action, never an automatic rule or a contractual right.
- **Consumer credit is a bank product (decree 15-114 of 12 May 2015, read):** for households buying goods over 3 months and up to 60 months; goods must be produced or assembled in Algeria; Algerian residents only; a written offer is required; sale takes effect once the seller is told the credit was granted (8 working days); the buyer has an 8-working-day withdrawal right; the seller may take no payment beyond the cash portion until the credit contract is final; repayment capped at 30% of regular net income; early repayment allowed. **No text found lets a non-bank lend.** **Flag for a lawyer:** position our installment module as recording the seller's own deferred-payment sales and bank-financed ones, and avoid presenting shops as granting regulated consumer credit.
- The Bank of Algeria reinstated household consumer credit in 2026 (secondary sources; BA notes n° 3 of 29 Jul and n° 4 of 10 Aug 2026 urge banks to expand it digitally for local goods). Ceilings and conditions are still to come in a BA instruction **[VERIFY]**.
- **Ministry of Commerce consumer-credit scheme (round 3, government pages cited, MEDIUM):** eligible goods are locally made appliances, phones and tablets, domestic wooden furniture and some ceramic and sanitary products. The buyer needs an invoice in their own name plus an attestation of local production, and the retailer works with a bank. **Idea:** help the seller assemble that file (invoice in the buyer's name, local-production attestation, bank package). Bank and Islamic financing offers exist beside it (for example TaksitDZ Mourabaha, Condor's financing).
- **Centrale des Risques: CORRECTED.** Access is limited to declaring banks and financial institutions (BA règlement 2012-01 arts. 3, 9, 14; instruction 04-2019 art. 12); data may be used only for granting and managing credit, never for prospecting. **Do not offer a bureau lookup for retailers.** The 4-working-day bounced-cheque declaration rule is still **[VERIFY]**.

## 3. Commerce, logistics and stock

| # | Feature | What it does | Effort | Value |
|---|---|---|---|---|
| 3.1 | **Courier integrations with cash on delivery** | Push shipments with COD amount and stop-desk flag, sync rates, poll tracking. Yalidine, ZR Express, EcoTrack family, Maystro, Noest. A stronger wedge than card payments alone. | M | H |
| 3.2 | **Online card payments in the shop** | **Chargily Pay** (round 3, MEDIUM): REST API, hosted checkout, payment links, signed webhooks (HMAC-SHA256 of the raw body; `checkout.paid / failed / canceled`); CIB and Edahabia; Visa/Mastercard announced; plans Starter 0% (free up to 300 transactions or 300,000 DA), Comfort 1.5%, Supreme 3%, Elite 4.5% (higher plans = faster payout); refund 2%; the fee can be paid by merchant, customer or split; merchant needs an account and profile verification. **SlickPay:** REST API with SDKs (Laravel, Flutter), payment links, QR, transfers; fee 1.4% to 2.0% by payout schedule; needs a commercial register, a business bank account, and SATIM/GIE authorization via cibweb.dz. **Direct SATIM/CIB:** no public API; CIBWEB application, then an acquiring-bank contract, then SATIM integration tests and GIE authorization; a software vendor certifies one reusable payment module (GIE fee 10,000 DA) but every merchant still needs its own file and bank contract; bank-specific costs (one bank lists 50,000 DA enrollment). A CNRC e-commerce authorization is reportedly needed first **[VERIFY]**. Fee tables come from Perplexity summaries: check the official pricing pages. | M | H |
| 3.3 | **WhatsApp sharing of invoices, receipts and reminders** | One-tap send from the record. Algeria-specific WhatsApp Business pricing is unverified and two sources conflict on when service messages become paid. | S | H |
| 3.4 | **Payment link on the invoice** | Pay from the invoice by card or transfer; auto-mark paid. | M | H |
| 3.5 | **Online quote acceptance** | Customer accepts a quote from a link or email, converts to an order. | S-M | H |
| 3.6 | **Customer ledger ("khata" view)** | One running credit/debit balance per customer, with auto-reminders. Pattern from Khatabook and Vyapar. | S-M | H |
| 3.7 | **Automated dunning letters by age** | Scheduled reminder letters at set intervals. | S | H |
| 3.8 | **Lot / serial / expiry tracking** | Per-batch IDs, expiry dates, traceability. | M | H |
| 3.9 | **Barcode scanning and offline mobile app** | Scan-driven receiving, picking and counting. | M | H |
| 3.10 | **Offline POS with per-record sync status** | Checkout works offline; each record shows pending, synced or failed. | L | M-H |
| 3.11 | **Fixed assets with depreciation** | Asset register, schedules, disposal. | M | M |
| 3.12 | **Payables capture from an email inbox** | Read supplier invoices from a shared mailbox, OCR, draft the purchase invoice for approval. Extends our OCR scan. | M | H |
| 3.13 | **Price lists per customer, product variants** | Client-specific prices, size/colour variants. | S | M |
| 3.14 | **Expense claims with receipt OCR** | Submit by email, scan or mobile, approval roles. | S-M | M |
| 3.15 | **Free accountant seat and export to accounting tools** | Accountants drive SME adoption. | S | M |
| 3.16 | **Multi-warehouse transfers, 3PL** | Warehouse-to-warehouse flows. | L | L-M |

## 3b. Provider facts for integrations (round 4, read before building)

- **Couriers:** no courier publishes a clean developer portal in what could be opened. **dzship** (a free hosted wrapper by DZBuild, 99 couriers behind one API: create order, track, rates, desks; courier credentials sent per request; 200 orders/hour and 60 tracking calls/minute per IP) is the quickest route but your courier credentials transit a third party. Direct: **Yalidine** (token headers, parcels and rates endpoints, origin wilaya required, COD sent as subtotal; the same API serves Yalitec, Guepex, Easy & Speed, Economiqua, We Can), **ZR Express** (two platforms: legacy Procolis with token + key, and a new one with X-Tenant + X-Api-Key), **Maystro** (token, prices per commune, strict same-day duplicate policy), **NOEST** (Bearer + user_guid, weight required, bulk endpoint of 100), **EcoTrack family** (one Bearer API for 82 carriers: create, fees, label PDF, delete, validate; no webhooks). Fees are not published; use each rates endpoint. Official courier docs were not opened (third-party repos and a competitor's docs only).
- **SMS:** aggregators with routes to Mobilis, Djezzy and Ooredoo list about 2.5 to 3.5 DZD per SMS (eSMS Africa: 3.5 / 3 / 2.5 by tier; BulkGate, SMSPM in euros); REST and SMPP, delivery webhooks, Unicode (70 characters per part). Sender IDs must be pre-approved (3 to 5 business days claimed). No direct operator portal or official ARPT/ANRT rule was found.
- **WhatsApp Business Platform:** Algeria (+213) is in Meta's "Rest of Africa" band. Tracker figures: marketing USD 0.0225, utility 0.0040, authentication 0.0040, service 0.0040. **Unsettled:** whether service replies become billable from 1 Oct 2026 after 1,000 free replies a month (two trackers say yes, Meta's older page says service conversations are free). Official Business Solution Providers usable in Algeria: not identified.
- **Card payments:** see 3.2 for Chargily and SlickPay. **Raïs** (rais.app) and **SofizPay** (docs.sofizpay.com) also offer CIB/Edahabia APIs (fees not seen). **Direct SATIM:** register.do, acknowledgeTransaction.do, refund.do (POST only), no webhooks, orders auto-cancel if not confirmed (about 20 minutes); one agency blog says about 50 DA + 1.2% per transaction and 8 to 12 weeks to set up, an integration quote of 15,000 DA excl. VAT (LOW confidence).
- **QR and wallets:** **Baridi Pay** (BaridiMob QR, launched 14 Jun 2025): customer scans a merchant QR, confirms with an SMS code, CCP-to-CCP instantly; merchant needs a commercial CCP, RC and tax card; **no merchant API or web checkout found**. DZMobPay (interbank QR, 2025) exists. Djezzy Payment Services was authorised as a PSP in Sep 2026 (live status unknown).
- **Bank reconciliation:** **no bank publishes a statement API or export spec** (BNA, CPA, BEA, BADR, CNEP, BDL, AGB, SG Algeria). CPA offers WEB EDI for transfer files; the RIB transfer file format (VIRM header, fixed width, 20-digit RIB) is documented in an old note; the SATIM Web Merchant console exports to Excel; CCP/BaridiMob show statements in-app only. So statement import means CSV/Excel upload or manual entry, not an API.
- **DGI:** Jibayatic is a browser portal (enrolment at the desk plus an access code); **no web service or file import for software vendors was found**, and the one XML-import claim is unsupported. The B2B e-invoice schema is pilot-stage.
- **Hosting in Algeria:** Algérie Télécom web hosting from 13,400 DZD a year (100 GB); IBOX Business 1 TB for 10 users at 66,000 DZD a year; Djezzy Cloud (ARPCE-accredited since 2021, IaaS, pay in DZD); Aventure Cloudz (2,500 / 9,000 / 20,000 DZD a month). No latency or uptime data found.
- **Invoice OCR (Arabic + French):** Azure Document Intelligence about USD 10 per 1,000 pages (invoice model, 27 languages, free tier of 500 pages a month claimed); an independent small benchmark reported 93% field accuracy vs 78% for Textract (Textract is English only). Mistral OCR is claimed at USD 4 per 1,000 pages (vendor/blog claims). No Algerian OCR provider found.
- **E-signature certificates:** AECE (run by ARPCE) issues THI9A-ID, THI9A-SIGN and THI9A-ENTREPRISE, 2-year validity on FIPS 140-2 hardware, ordered on ra.aece.dz; prices not found.

## 4. Product and UX patterns to copy

- **Autonomy dial** per AI feature (suggest / approve / auto) with a visible "why" on each automated action.
- **Shared saved views** with a "Current user" filter token.
- **Bulk-action bar** on lists with shift-range selection.
- **Record version history** with side-by-side compare, plus an audit log filterable by user and action (credit disputes).
- **One-click quick entry** from any screen.
- **Phone-first, non-accountant UX:** add customer, items, prices, send to WhatsApp on one screen (iMakeBill, Vyapar). Paid / partial / unpaid with due-date alerts per bill.
- **Reminder tone presets** (friendly / firm / urgent) on WhatsApp reminders (MsgBill).
- **Chat or voice data entry** in local languages (Wazobia, InvoiceCore; vendor claims).
- **Conditional field rules** without code; **multiple capture channels** for one record.
- A real **notification center** behind the bell (currently a placeholder link).

## 5. Deferred (weak fit for our customers)

Manufacturing and MRP, quality checks, preventive maintenance, fleet, field service dispatch, shift planning, recruitment, appraisals, live website chat, rental, internal wiki, no-code studio, 3PL/EDI, government e-invoice auto-filing (Holded-style) until a mandate exists.

## 6. Where we already lead

- Algerian tax pack (G50, TVA, timbre, TAP inactive by default). Narrower edge against Odoo, where partners sell Algerian accounting modules (Elosys about US$444, Digitaliac about US$1,141, as listed). Odoo's official docs list an "Algeria - Accounting" localization; Algerian payroll is not in the official list (a third-party app, NEDIS, lists IRG brackets at about US$1,144).
- Credit and installment sales with guarantors and a risk score.
- Full Arabic right-to-left layout alongside French and English.
- AI assistant and natural-language search.
- Documents posted to the ledger are immutable (useful for 1.2).
- **Round 4 view of the Algerian installment niche (unverified against our code):** no Algerian page opened offers guarantors and a risk score together (Vyvex has a score but no guarantor; Marselia has guarantees but no score); none shows an AI assistant; most show no public API; several cap contracts by plan (Vyvex's cheapest plan allows 20 contracts a month); installments are mostly kept separate from accounting.

## 7. Competitors and prices

**Algeria and MENA**
- **Round 3, local vendors (vendor pages, MEDIUM):** Tayssir ERP (desktop, quote-based), IntelliX Silwane (cloud and desktop, 70+ modules claimed, includes payroll), Cirtasoft Gestium (GestiumGo 25,000 DZD excl. tax; GestiumCOMPTA Starter 150,000 DZD, SCF and G50), Protid PRO-ERP and PRO-PAIE (on-premise, CNAS/IRG/DAS payroll), Buyini (cloud, no price), plus Odoo, Sage and SAP through local partners (DZD figures come from market guides, LOW).
- **Closest rivals to our credit module:** Vyvex (installment contracts, schedules, cash/CCP/direct-debit payments, arrears, IMEI/serial, risk scoring; plans from 7,000 DZD per month, vendor claim) and Marselia (Arabic installment management system, quote-based). Also POS products with a debt module (SkaiPOS, ZedPOS, DZBuild). Most retailers still use a paper "kridi" register or Excel.
- Almawarid (all-in-one local suite, quote-based, limited free plan), Ratib (cloud payroll, reported 15,000 / 40,000 / 99,000 DA per year by headcount, unverified), PC Paie (Windows payroll), Sage partners in Algiers (BSC, SIG, GS ICT, OMES), Odoo localisations by Elosys and Digitaliac.
- Qoyod, Wafeq and Daftra (accounting, roughly 99 to 199 SAR per month), Foodics and Rewaa (POS).

**List prices seen on official pages (Round 2; currency and basis as shown)**

| Product | Plan | Price | Basis |
|---|---|---|---|
| Odoo | One App Free | US$0 | one app, unlimited users |
| Odoo | Standard | US$31.10/user/mo yearly (US$38.90 monthly) | per internal user |
| Odoo | Custom (adds Studio, multi-company, API) | US$61.00/user/mo yearly (US$76.20 monthly) | per internal user |
| Dynamics 365 Business Central | Essentials / Premium / Team Members | US$80 / 110 / 8 per user per month | yearly |
| ERPNext | software | free (AGPL-3.0); Frappe Cloud hosting from US$5/mo | no per-user fee |
| Katana | Free / Core | US$0 (30 SKUs) / from US$299 per month | per company |
| Fishbowl | Essentials | GBP 150/mo, 2 users | yearly |
| Alegra (Panama) | four plans | US$8.55 / 13.90 / 24.60 / 37.44 per month | per company |
| Vyapar (India) | Silver / Gold | INR 4,399 / 4,799 per year | per company |
| Zoho ERP (India) | Standard / Premium | INR 999 / 2,499 per user per month, min 5 users | yearly |
| Sage Business Cloud (South Africa) | Start / Standard | from ZAR 240 / 435 per month incl. VAT | per company |
| QuickBooks Online Advanced | | US$275 list on one page, US$340 on another; promos vary | per company, 25 users |

Not verified from official pages: NetSuite, SAP Business One (third party quotes US$110-219/user/month), Siigo, Zoho One, Acumatica (not public), Pennylane, Holded (entry from about US$15/month).
A starter price of roughly 3,000 to 6,000 DZD per month was suggested in round 1; test it with 5 to 10 SME interviews first.

**What Algerian SMEs reportedly dislike in current software** (all from vendor blogs, LOW confidence, no independent survey found): weak local invoice compliance; accounting disconnected from sales and stock; POS not tied to customer credit and supplier debt; payroll without CNAS/IRG/DAS automation; poor Arabic/French UI; support paid for in foreign currency; WhatsApp plus Excel plus paper fragmentation.

**Algerian installment and retail products, from vendors' own pages (round 4; [O] = page opened)**

| Product | What it is | Notable features | Price (DZD, excl. tax) |
|---|---|---|---|
| Vyvex [O] | Installment SaaS for appliance, phone and furniture shops | CCP direct debit, bordereau and statement import, rejects, blacklist, client score, IMEI/serial stock, multi-showroom, role logins | 7,000/month (20 contracts/month), 10,000/month (unlimited, with score), Riada on quote |
| MekaStore [O] | Offline desktop suite (POS, stock, purchases, accounting, HR) | "Vente à Crédit" edition: CCP direct debit, printed contracts, monthly CCP file, customer capacity simulation, overdue follow-up | Free (50 customers, 3 contracts); Starter 25,000, Ultra 70,000, Cloud 150,000 (lifetime); installment module +50,000 [S] |
| DropDz Distribution [O] | Van-sales credit control | Credit ceiling that blocks new credit sales, promise-to-pay tracing, aged balance, offline Android seller app | 5,000 per truck per month |
| DG Software Plus (Tlemcen) [O] | DG-STOCK and DG-SALE | Customer and supplier credits, multi-warehouse, marketplace; installment sales, G50 and payroll only in the Professional edition | LITE 7,500/yr; STANDARD 10,500/yr; PROFESSIONAL 45,100/yr or 135,000 lifetime |
| Cirtasoft Gestium [S] | GestiumGo, PRO, ERP, COMPTA | Quotes, invoices, POS, cheques, CRM reminders, per-client price grids, credit ceilings | GestiumGo 25,000; COMPTA Starter 150,000 |
| Almawarid [O] | Cloud and Android, hosted in Algeria | DGI invoicing with QR, WhatsApp send, CNAS/IRG payroll, CRM add-on; free Windows cash register | Standard on request; accountants 1,500 per client file per month |
| Dolisoft PRO [S] | Windows licence | Invoices, stock, G50, état 104, Zakat, TVA, timbre | 12,000 lifetime per workstation |
| SkaiPOS [S, classified ad] | POS and stock | Installment module (manual, bank, Algérie Poste) | 35,000 one-time; 50,000 with installments |
| DZBuild [S] | E-commerce builder plus free GPL Windows POS | Dozens of couriers, COD, WhatsApp sender; POS has credit ceilings, serial/IMEI, G50 helpers | Pro 1,000/month, Enterprise 5,500/month; POS free |
| Marselia [O], EloERP [O] | **Foreign** (Egyptian, Pakistani) | Arabic installment system; EloERP has guarantors with documents, maker-checker approvals, cheque alerts | Quote only (use as feature benchmarks) |

Also seen: Tayssir ERP, IntelliX Silwane, Protid (reminder scenarios, promise-to-pay, credit ceilings, risk scoring), Buyini, Systematic ERP (cheque and traite printing); prices not published.

**Price ladder (DZD):** free (DZBuild POS, Almawarid cash register, MekaStore Free); 7,500 to 10,500 a year (DG-STOCK); 12,000 lifetime (Dolisoft); 25,000 lifetime (GestiumGo, MekaStore Starter); 35,000 to 50,000 lifetime (SkaiPOS); 60,000 a year (DropDz, one truck); 70,000 to 150,000 lifetime (MekaStore Ultra to Cloud); **84,000 to 120,000 a year (Vyvex)**; 45,100 a year to 135,000 lifetime (DG-STOCK Professional). Small local SaaS elsewhere clusters at 3,000 to 10,000 a month (CRM Algérie 9,900; SeryX 9,900 to 14,900; AgencyHub 3,000 to 8,000; Facturili 2,900 to 11,900).

**Market facts (round 4, mostly secondary, search extracts):**
- About 1.36 million SMEs in 2022, 97.5% with under 10 staff; services over 50%. CNRC: 2,227,814 registered operators at end-2022, retail the largest activity for individuals (977,574, about 46%). Share using management software: not found.
- E-commerce: market size estimates differ ($1.5B in 2024; $1.7 to 1.9B in 2025); about 95% of orders cash on delivery; return rates 15 to 30%; average order 2,500 to 6,000 DZD.
- Payments: about 23% debit-card ownership and 8% active online payment (secondary); foreign-currency subscriptions are hard to pay; local support is the most repeated complaint (anecdotal).
- Funding: ANGEM, ANSEJ and ANADE fund equipment and start-up costs, **not software**; the Startup label (decree 25-311) gives tax relief for 4 years. No programme found that pays for software: do not promise public funding.
- Consumer credit products (bank): BDL Mourabaha 100,000 to 1,000,000 DA over 3 to 36 months; CPA up to 90% of the price, capped at 700,000 DA, 6 to 36 months. Default rates are not published.
- Invoices: decree 05-468 sets the mandatory fields (NIF/NIS/RC/AI, prices excl. tax, VAT rate, total in figures and words). **No rule requiring Arabic on invoices, nor banning dual language, was found** (Law 91-05 not checked).
- Channels: direct sales with demos and WhatsApp support; accounting firms as multi-client resellers; Odoo partners; free trials of 9 to 14 days; desktop with offline mode as a selling point. Banks, telecom bundles and trade fairs: not found.

**Odoo Community vs Enterprise (matters to us)**
- Community (free) includes CRM, Sales, POS, Website, eCommerce, Purchase, Inventory, basic Invoicing and Expenses. Full accounting, payroll, barcode, Studio, mobile apps and unlimited support are Enterprise. Sign, Subscriptions, Approvals and Documents show in the Enterprise column; their Community status in v18/19 is **[VERIFY]**. Odoo's POS offline mode in v18/19 is also unverified.
- Odoo.sh requires Enterprise.

## 8. Open questions for an accountant, a lawyer or the authority

Settled in round 4 (see sections 1 to 3): TAP abolished, IFU threshold 8,000,000 DA, stamp-duty minimum 5 DA, CASNOS rate and base, e-signature validity, consumer credit goes through banks, Centrale des Risques is for banks only, Jibayatic has no vendor interface.

Still open:
1. **Lawyer:** does law 18-05 art. 27 (payment only on platforms of approved banks and Algérie Poste) allow Chargily and SlickPay? Does art. 8 (shop hosted in Algeria, `.com.dz`) apply to our website module?
2. **Lawyer:** how to position the installment module given decree 15-114 (consumer credit is a bank product).
3. **Lawyer:** hosting and sub-processors for personal data (ANPDP authorization for transfers abroad), DPO duty and decree 25-350; whether law 26-02 repeals law 15-04.
4. CNAS employer rate (25% + 0.5%) from an official text; the DAS/DAC file specification.
5. Whether the IRG 33% band is new in LF 2026; the smoothing formula for 30,001 to 35,000 DA; how decree 26-257 interacts with the flat-regime base.
6. Whether LF 2026 changed the stamp-duty rules (the full text did not load).
7. 2026 consumer-credit ceilings and conditions (Bank of Algeria instruction still to come); the 4-working-day bounced-cheque rule.
8. Official courier API docs, sandboxes and fees; operator-direct SMS offers and sender-ID rules; WhatsApp service-message billing and approved providers in Algeria.
9. Bank statement export formats (all eight banks), CCP and BaridiMob reconciliation, a Baridi Pay merchant API.
10. Market: share of SMEs using management software, retail-credit default rates, accountants' role in choosing software, sales-cycle length, Law 91-05 and invoice language, Hijri dates.

## 9. Key sources

Official: Loi de finances 2026 (mf.gov.dz), DGI portal and calendar (mfdgi.gov.dz), CNAS (cnas.dz, teledeclaration.cnas.dz), Journal Officiel (joradp.dz: JO 2024 n° 84 for LF 2025 stamp duty, JO 2026 n° 58 for the wilaya annex, JO 2007 n° 74 for Law 07-11), Radio Algérie / APS (wilayas, SNMG), law 18-05 text (mpt.gov.dz), Bank of Algeria cheque instruction.
Round 4 added official reads of: DGI circular 09 (LF 2024: TAP), decree 15-114 and the 31 Dec 2015 arrêté (consumer credit), law 18-05 on commerce.gov.dz, law 26-02 on mpt.gov.dz, Algérie Télécom's hosting pages, and the vendors' own pricing pages (Vyvex, MekaStore, DropDz, DG Software).
Everything else is vendor pages, aggregators or press; where a claim rests only on those it is tagged **[VERIFY]** above.

## Limits of this research
- NetSuite, SAP Business One, Acumatica and Sage product pages could not be opened; their rows are thin.
- Vendor claims (time saved, accuracy) are self-reported.
- Several rates and file formats remain unconfirmed (section 8).
- Round 4 (Exa): the full Finance Act 2026 PDF would not load past its opening pages; most Algerian figures come from secondary summaries or search extracts; courier docs were read through third-party repos.
- Round 3 (Perplexity free tier): each agent got 3 questions or fewer before the limit, citations were listed but mostly not opened, and one citation resolved to an unrelated page.

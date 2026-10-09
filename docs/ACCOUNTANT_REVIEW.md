# Checklist de vérification comptable et juridique (Tavio)

English: checklist for an Algerian chartered accountant (expert-comptable) and a lawyer to verify every tax and legal value in the Tavio app. Each item states what the app does today, where it is defined, the source used, and the question to answer.

Ce document décrit uniquement le comportement actuel de l'application. Il n'énonce aucune règle juridique nouvelle. Les sources sont celles de `docs/research/05-algeria-requirements.md`, qui indique elle-même qu'aucun texte officiel n'a été consulté directement.

Chemins relatifs à la racine du dépôt. Numéros de ligne au commit de rédaction.

---

## 1. TVA

### T1. TVA normale 19 %
- **Valeur actuelle :** taux 19,0000 %, validité à partir du 2020-01-01, valeur par défaut vente et achat.
- **Fichier :** `src/modules/l10n_dz/data.ts`, lignes 18-31 (taux l. 24, date de début l. 26).
- **Source :** commentaire « CIDTA, normal VAT rate. Verify » (l. 28). Aucune source officielle trouvée (`docs/research/05-algeria-requirements.md`, §2).
- **Question :** Le taux normal est-il bien 19 % à la date de référence ? Quelle est la date réelle de début de validité ? La date 2020-01-01 est-elle une valeur d'essai ?
- [ ] Validé / [ ] À corriger : ____

### T2. TVA réduite 9 %
- **Valeur actuelle :** taux 9,0000 %, validité à partir du 2026-01-01, périmètre `both` (vente et achat), pas de valeur par défaut.
- **Fichier :** `src/modules/l10n_dz/data.ts`, lignes 32-44 (taux l. 37, date l. 39, référence l. 41).
- **Source :** « Reduced rate, Finance Law 2026 (Loi n° 25-17). Scope needs lawyer verification ». Source secondaire : Deloitte, TSA (`docs/research/05-algeria-requirements.md`, §2).
- **Question :** Quels biens et services relèvent du taux de 9 % ? Le périmètre `both` (vente et achat) est-il correct pour chaque opération ? Le taux de 9 % s'applique-t-il à des activités autres que celles listées par la loi ?
- [ ] Validé / [ ] À corriger : ____

### T3. Taux 0 % et exonération absents
- **Valeur actuelle :** aucun taux 0 % ni code d'exonération n'est seedé. Seul le commentaire du schéma évoque « TVA0, EXO ».
- **Fichier :** `src/modules/l10n_dz/schema.ts`, ligne 49 (commentaire) ; `src/modules/l10n_dz/data.ts`, lignes 18-45 (absents).
- **Source :** aucune.
- **Question :** Faut-il un taux 0 % et un ou plusieurs codes d'exonération par défaut ? Si oui, avec quelles mentions légales sur la facture ?
- [ ] Validé / [ ] À corriger : ____

---

## 2. Timbre fiscal

### S1. Barème du timbre sur paiement en espèces
- **Valeur actuelle :** 0 DA jusqu'à 300 DA exclus ; 1 DA de 300 à 30 000 DA ; 1,5 DA de 30 000 à 100 000 DA ; 2 DA au-delà de 100 000 DA.
- **Fichier :** `src/modules/l10n_dz/data.ts`, lignes 58-67.
- **Source :** « Finance Law 2025. Verify ». Source secondaire : Algérie-Eco, TSA, afrik.com, Algérie360 (`docs/research/05-algeria-requirements.md`, §4). Ancienne règle (1 DA par 100 DA, plafonnée à 10 000 DA) signalée comme remplacée.
- **Question :** Ce barème est-il exact pour l'année en cours ? Confirmer que le montant est un forfait par tranche et non un taux.
- [ ] Validé / [ ] À corriger : ____

### S2. Bornes des tranches : incohérence entre commentaire et code

- **Valeur actuelle :** le commentaire de `data.ts` indique désormais que `maxAmountDa` est une borne **exclue** : une tranche couvre `[minAmountDa, maxAmountDa[`, et la borne haute d'une tranche est la borne basse de la suivante. Le code (`stampDutyCents`) applique cet intervalle. Résultat : 300 DA tombe dans la tranche 1 DA, 30 000 DA dans la tranche 1,5 DA, 100 000 DA dans la tranche 2 DA. Les tests aux bornes sont dans `src/modules/invoicing/__tests__/math.test.ts`.
- **Fichier :** `src/modules/l10n_dz/data.ts`, lignes 50-52 (commentaire corrigé) ; `src/modules/invoicing/service/math.ts`, lignes 64-74 (code inchangé).
- **Source :** aucune source sur la borne exacte. Le choix retenu suit la structure des données (chaque minimum égale le maximum précédent).
- **Question :** Confirmer que la borne haute est exclue dans le texte légal (30 000 DA dans la tranche 1,5 DA ; 300 DA dans la tranche 1 DA ; 100 000 DA dans la tranche 2 DA). Si la règle légale est inclusive, le code et les tests doivent changer ensemble.
- [ ] Validé / [ ] À corriger : ____

### S3. Base de calcul et assiette du timbre
- **Valeur actuelle :** le timbre est calculé sur le **montant du paiement en espèces** (et non sur le total de la facture), en DA entiers (centimes tronqués), une seule fois (`stamp === 0` requis). Il ne s'applique qu'aux factures de vente (`out_invoice`) payées en espèces. Il ajoute le timbre au total de la facture au moment du paiement.
- **Fichier :** `src/modules/invoicing/service/invoices.ts`, lignes 137-153 (`registerPayment`, `applyStamp` l. 150-152) ; `src/modules/invoicing/service/math.ts`, lignes 67-74 (`stampDutyCents`).
- **Source :** « Applied to the whole amount, not per bracket » (`data.ts`, l. 49). Source secondaire (`docs/research/05-algeria-requirements.md`, §4).
- **Question :** Sur quel montant le timbre est-il dû : le paiement, la facture, ou le total TTC ? Que se passe-t-il si la facture est réglée en plusieurs paiements espèces ? Le timbre doit-il être payé une seule fois par facture ?
- [ ] Validé / [ ] À corriger : ____

### S4. Cas d'application et non-application
- **Valeur actuelle :** pas de timbre sur avoirs, achats, factures payées par banque, ventes POS (`posLines` ne prend pas de montant de timbre), ni ventes à crédit. Aucun contrôle de plafond d'espèces n'a été trouvé dans les modules lus (`src/modules`, recherche de « 50000 », « plafond », « espèces »).
- **Fichier :** `src/modules/invoicing/service/invoices.ts`, ligne 150 (condition) ; `src/modules/accounting/service/posting.ts`, lignes 116-123 (`PosPaidForPosting`, sans timbre).
- **Source :** cash ban LF 2025 Art. 207 et ancien seuil de 50 000 DA (`docs/research/05-algeria-requirements.md`, §4, statut inconnu).
- **Question :** Le timbre s'applique-t-il aux ventes POS en espèces ? Quelles opérations sont exclues ? Le plafond de paiement en espèces doit-il être contrôlé par l'application, et à quel montant ?
- [ ] Validé / [ ] À corriger : ____

### S5. Écriture comptable du timbre (445) : constat

- **Valeur actuelle :** au paiement en espèces d'une facture de vente (`out_invoice`), le timbre calculé sur ce paiement est comptabilisé dans le journal CA : Dr 53 pour le montant total encaissé, Cr 411 pour le montant encaissé moins le timbre, Cr 445 pour le timbre. Exemple : 1 001 DA encaissés, 1 DA de timbre : Dr 53 1 001 DA ; Cr 411 1 000 DA ; Cr 445 1 DA. Le compte 411 est alors soldé. Les paiements par banque ne portent pas de timbre. Le champ `stampCents` de l'événement `invoicing.payment.registered` porte ce montant.
- **Fichier :** `src/modules/accounting/events.ts` (handler `invoicing.payment.registered`) ; `src/modules/accounting/service/posting.ts` (`paymentLines`) ; `src/core/events/catalog.ts` (champ `stampCents`) ; test d'intégration `src/modules/__tests__/flows.int.test.ts`.
- **Source :** aucune.
- **Question :** Ce traitement (445 crédité au paiement, 411 soldé du montant hors timbre) est-il conforme ? Le timbre encaissé doit-il être reversé sur une déclaration particulière ?
- [ ] Validé / [ ] À corriger : ____

---

## 3. Arrondis

### A1. Montant HT d'une ligne
- **Valeur actuelle :** `montant HT = roundHalfUp(quantité en millièmes × prix unitaire en centimes, 1000)`, soit un arrondi au centime, demi vers l'extérieur de zéro.
- **Fichier :** `src/modules/invoicing/service/math.ts`, lignes 23-30 (`computeLine`) ; `src/core/money/index.ts`, lignes 54-62 (`roundHalfUp`).
- **Source :** aucune règle officielle trouvée (`docs/research/05-algeria-requirements.md`, §7 : « Unknown »).
- **Question :** Quelle est la règle légale d'arrondi sur une ligne de facture (au centime, à 5 DA, par ligne ou sur le total) ? Le demi-arrondi « vers l'extérieur » est-il conforme ?
- [ ] Validé / [ ] À corriger : ____

### A2. TVA par ligne
- **Valeur actuelle :** `TVA ligne = applyRate(montant HT ligne, taux)`, arrondie au centime par ligne. Les totaux de TVA sont ensuite sommés par taux (`computeTotals`).
- **Fichier :** `src/modules/invoicing/service/math.ts`, lignes 29 et 40-56 ; `src/core/money/index.ts`, lignes 73-76 (`applyRate`).
- **Source :** « Tax is round_half_up(base_cents * rate / 100) per line » (`docs/plan/DATA_MODEL.md`, l. 903). Règle marquée « needs accountant verification ».
- **Question :** La TVA doit-elle être calculée par ligne ou sur le total HT par taux ? Une différence d'un centime est-elle acceptable entre les deux méthodes ?
- [ ] Validé / [ ] À corriger : ____

### A3. Quantité
- **Valeur actuelle :** quantité décimale avec au plus 3 décimales, strictement positive.
- **Fichier :** `src/modules/invoicing/service/math.ts`, lignes 12-21 (`QTY_RE`, `parseQtyMilli`).
- **Source :** aucune.
- **Question :** Les quantités décimales sont-elles admises sur facture, et avec combien de décimales ?
- [ ] Validé / [ ] À corriger : ____

### A4. Arrondi de la majoration des ventes à crédit
- **Valeur actuelle :** `majoration = applyRate(prix comptant − acompte, taux)`, arrondie au centime (même règle que A2).
- **Fichier :** `src/modules/credit_sales/service/contracts.ts`, lignes 158-159.
- **Source :** aucune.
- **Question :** La majoration doit-elle être arrondie au centime, ou à un montant entier de DA ?
- [ ] Validé / [ ] À corriger : ____

### A5. Découpage des échéances
- **Valeur actuelle :** chaque échéance vaut `trunc(montant financé / n)` ; la dernière échéance prend le reste.
- **Fichier :** `src/core/money/index.ts`, lignes 78-86 (`splitEven`) ; `src/modules/credit_sales/service/schedule.ts`, lignes 1-3 et 60.
- **Source :** commentaire de `schedule.ts` (« Rule from src/lib/sales/schedule.ts »), règle interne.
- **Question :** Le reste doit-il être placé sur la dernière échéance ou réparti ? L'arrondi à la baisse est-il acceptable pour des échéances de vente à tempérament ?
- [ ] Validé / [ ] À corriger : ____

### A6. Troncature du timbre
- **Valeur actuelle :** le montant en DA est obtenu par division entière des centimes (centimes ignorés), puis le timbre est converti en centimes par `Math.round(dutyDa × 100)`.
- **Fichier :** `src/modules/invoicing/service/math.ts`, lignes 67-74.
- **Source :** aucune.
- **Question :** Les centimes du montant encaissé doivent-ils être ignorés pour le calcul du timbre ?
- [ ] Validé / [ ] À corriger : ____

---

## 4. Plan comptable SCF

Le plan comptable seedé est limité à 9 comptes et 5 journaux. Chaque compte porte le marqueur « ⚠ needs accountant verification ». Source : `docs/research/05-algeria-requirements.md`, §1. Le plan complet de la nomenclature SCF n'a pas été trouvé.

### C1. Compte 411 Clients
- **Valeur actuelle :** `411`, « Clients », classe 4, type actif, rapprochable. Débité à la vente TTC, crédité à l'encaissement client.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 23.
- **Source :** SCF (`docs/research/05-algeria-requirements.md`, §1), non confirmée par texte officiel.
- **Question :** Faut-il des sous-comptes par client ? Le type d'actif et le caractère rapprochable sont-ils corrects ?
- [ ] Validé / [ ] À corriger : ____

### C2. Compte 401 Fournisseurs
- **Valeur actuelle :** `401`, « Fournisseurs », classe 4, type passif, rapprochable.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 24.
- **Source :** SCF, non confirmée par texte officiel.
- **Question :** Faut-il des sous-comptes par fournisseur ? Le type passif est-il correct ?
- [ ] Validé / [ ] À corriger : ____

### C3. Compte 4457 TVA collectée
- **Valeur actuelle :** `4457`, « TVA collectée », type passif, non rapprochable. Crédité à la vente.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 25.
- **Source :** aucune source officielle trouvée.
- **Question :** Faut-il des sous-comptes par taux (19 %, 9 %) ?
- [ ] Validé / [ ] À corriger : ____

### C4. Compte 4456 TVA déductible
- **Valeur actuelle :** `4456`, « TVA déductible », type actif, non rapprochable. Débité à l'achat.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 26.
- **Source :** aucune source officielle trouvée.
- **Question :** Faut-il des sous-comptes par taux ? La TVA sur immobilisations et le prorata sont-ils pris en compte ? (Non gérés actuellement.)
- [ ] Validé / [ ] À corriger : ____

### C5. Compte 700 Ventes de marchandises
- **Valeur actuelle :** `700`, « Ventes de marchandises », classe 7, type produit. Crédité à la vente HT et au POS.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 27.
- **Source :** SCF, non confirmée.
- **Question :** Les prestations de services doivent-elles aller sur un autre compte (par exemple 706) ? Un seul compte de vente suffit-il ?
- [ ] Validé / [ ] À corriger : ____

### C6. Compte 600 Achats de marchandises
- **Valeur actuelle :** `600`, « Achats de marchandises », classe 6, type charge. Débité à l'achat HT.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 28.
- **Source :** SCF, non confirmée.
- **Question :** Les achats de services ou de matières doivent-ils aller sur d'autres comptes ?
- [ ] Validé / [ ] À corriger : ____

### C7. Compte 512 Banque
- **Valeur actuelle :** `512`, « Banque », classe 5, type actif, rapprochable. Reçoit tous les modes de paiement sauf espèces.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 29 ; `src/modules/accounting/service/posting.ts`, lignes 96-98.
- **Source :** aucune.
- **Question :** Les chèques, virements, CCP, CIB et Edahabia doivent-ils aller tous sur 512, ou sur des sous-comptes distincts (chèques à encaisser, cartes à recevoir) ?
- [ ] Validé / [ ] À corriger : ____

### C8. Compte 53 Caisse
- **Valeur actuelle :** `53`, « Caisse », classe 5, type actif, rapprochable. Reçoit les paiements de méthode `cash`.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 30 ; `src/modules/accounting/service/posting.ts`, lignes 96-98.
- **Source :** aucune.
- **Question :** Le compte de caisse 53 est-il correct selon le SCF ? Faut-il une caisse par point de vente ?
- [ ] Validé / [ ] À corriger : ____

### C9. Compte 445 Taxes (droit de timbre)
- **Valeur actuelle :** `445`, « Taxes (droit de timbre) », classe 4, type passif, non rapprochable. Utilisé pour le timbre dans les écritures de vente et d'achat.
- **Fichier :** `src/modules/accounting/service/chart.ts`, ligne 31 ; `src/modules/accounting/service/posting.ts`, lignes 75 et 81.
- **Source :** aucune source officielle trouvée.
- **Question :** Le compte 445 est-il le bon pour le timbre fiscal collecté (et non pour une autre taxe) ? Son type passif est-il correct ? Voir aussi S5.
- [ ] Validé / [ ] À corriger : ____

### J1. Journaux VT, AC, CA, BQ, OD
- **Valeur actuelle :** VT (Ventes), AC (Achats), CA (Caisse), BQ (Banque), OD (Opérations diverses). Le journal OD n'est utilisé par aucune écriture automatique, seulement en saisie manuelle.
- **Fichier :** `src/modules/accounting/service/chart.ts`, lignes 34-40 ; `src/modules/accounting/events.ts`, lignes 26, 52, 70.
- **Source :** aucune.
- **Question :** Les codes et libellés de journaux sont-ils acceptés ? Faut-il un journal distinct pour le POS ou pour les ventes à crédit ?
- [ ] Validé / [ ] À corriger : ____

---

## 5. Écritures automatiques

### E1. Vente (facture validée)
- **Valeur actuelle :** journal VT. Débit 411 pour le total TTC ; crédit 700 pour le HT ; crédit 4457 pour la TVA ; crédit 445 pour le timbre (en pratique 0 à la validation, voir S5).
- **Fichier :** `src/modules/accounting/events.ts`, lignes 22-41 ; `src/modules/accounting/service/posting.ts`, lignes 68-76.
- **Source :** commentaire de `posting.ts`, ligne 63. Aucune source externe.
- **Question :** Cette écriture de vente est-elle conforme à la pratique du plan SCF ? La TVA doit-elle être comptabilisée à la facturation ou à l'encaissement (régime de TVA sur encaissement) ?
- [ ] Validé / [ ] À corriger : ____

### E2. Achat (facture fournisseur validée)
- **Valeur actuelle :** journal AC. Crédit 401 pour le total TTC ; débit 600 pour le HT ; débit 4456 pour la TVA ; débit 445 pour le timbre (valeur 0 en pratique).
- **Fichier :** `src/modules/accounting/events.ts`, lignes 22-41 ; `src/modules/accounting/service/posting.ts`, lignes 77-82.
- **Source :** commentaire de `posting.ts`, ligne 64.
- **Question :** Une facture d'achat peut-elle porter du timbre ? La TVA sur achats est-elle déductible dans tous les cas ?
- [ ] Validé / [ ] À corriger : ____

### E3. Encaissement client et règlement fournisseur
- **Valeur actuelle :** journal CA si espèces, sinon BQ. Encaissement client : débit 53 ou 512, crédit 411. Règlement fournisseur : débit 401, crédit 53 ou 512. Montant = montant du paiement.
- **Fichier :** `src/modules/accounting/events.ts`, lignes 43-65 ; `src/modules/accounting/service/posting.ts`, lignes 100-114 et 96-98.
- **Source :** aucune.
- **Question :** Le choix du journal et du compte de trésorerie est-il correct pour chaque mode de paiement ? Un paiement partiel doit-il être lettré ?
- [ ] Validé / [ ] À corriger : ____

### E4. Vente au comptoir (POS)
- **Valeur actuelle :** journal CA si espèces, sinon BQ. Débit 53 ou 512 pour le total TTC ; crédit 700 pour le HT ; crédit 4457 pour la TVA. Pas de 411, pas de 445.
- **Fichier :** `src/modules/accounting/events.ts`, lignes 67-86 ; `src/modules/accounting/service/posting.ts`, lignes 116-132.
- **Source :** aucune.
- **Question :** Le POS encaisse-t-il le timbre ? La vente au comptoir doit-elle passer par 411 puis encaissement, ou directement en trésorerie comme ici ?
- [ ] Validé / [ ] À corriger : ____

### E5. Avoirs (factures de remboursement)
- **Valeur actuelle :** toutes les lignes sont inversées (débit et crédit échangés) pour les types `out_refund` et `in_refund`. Les paiements de remboursement sont aussi inversés.
- **Fichier :** `src/modules/accounting/service/posting.ts`, lignes 33-36 (`invertLines`), 83-84, 107-109.
- **Source :** aucune.
- **Question :** La comptabilisation des avoirs par inversion est-elle conforme ? Un avoir doit-il reprendre le timbre de la facture d'origine ?
- [ ] Validé / [ ] À corriger : ____

### E6. Ventes à crédit (vente à tempérament)

- **Valeur actuelle :** à l'activation du contrat (journal VT) : Dr 411 pour le montant financé plus l'acompte ; Cr 700 pour le prix comptant ; Cr 708 pour la majoration. Le compte 708 « Produits annexes (majoration vente à crédit) » a été ajouté au plan seedé avec le marqueur ⚠. Pas de 4457, car le code n'applique pas de TVA à la vente à crédit. À chaque encaissement client (`credit_sales.payment.recorded`) : Dr 53 si espèces, sinon Dr 512 ; Cr 411. Les deux types d'écritures sont idempotents par source (`credit_sales.contract` et `credit_sales.payment`).
- **Fichier :** `src/modules/accounting/events.ts` (handlers `credit_sales.contract.activated` et `credit_sales.payment.recorded`) ; `src/modules/accounting/service/posting.ts` (`creditContractLines`, `creditPaymentLines`) ; `src/modules/accounting/service/chart.ts` (compte 708) ; `src/core/events/catalog.ts`.
- **Source :** aucune. Choix de conception à valider.
- **Question :** Le compte 708 est-il le bon pour la majoration, ou faut-il un compte de produit financier ? La vente doit-elle être constatée à l'activation (choix actuel) ou à la livraison ? Le 4457 est-il dû sur la majoration ?
- [ ] Validé / [ ] À corriger : ____

---

## 6. Déclaration G50

### G1. Calcul du brouillon
- **Valeur actuelle :** pour un mois civil, TVA collectée = crédit − débit du 4457 ; TVA déductible = débit − crédit du 4456 ; net à payer = collectée − déductible. Le net peut être négatif. Aucun report de crédit de TVA n'est géré.
- **Fichier :** `src/modules/accounting/service/reports.ts`, lignes 125-137 (`g50Draft`) ; `src/modules/accounting/service/posting.ts`, lignes 134-142 (`g50Summary`, avec `needsAccountantReview: true`).
- **Source :** aucune source officielle. Règle interne.
- **Question :** Le calcul ci-dessus correspond-il à la déclaration G50 ? Comment traiter un crédit de TVA reporté d'un mois sur l'autre ?
- [ ] Validé / [ ] À corriger : ____

### G2. Période et échéance
- **Valeur actuelle :** la période est le mois civil (du 1er au dernier jour). Aucune date d'échéance n'est calculée.
- **Fichier :** `src/modules/accounting/service/reports.ts`, lignes 126-130.
- **Source :** « Real regime: monthly G50, due by the 20th of the following month » (source secondaire : Upgrowth, ZoomAlgérie). « Simplified real regime: quarterly » (même type de source). Non vérifié.
- **Question :** Quel est le régime de TVA applicable (réel mensuel, réel simplifié trimestriel) ? Quelle est la date d'échéance du G50 ? Le G50 doit-il être produit à zéro quand il n'y a pas d'opération ?
- [ ] Validé / [ ] À corriger : ____

### G3. Rubriques du formulaire G50
- **Valeur actuelle :** le brouillon ne donne que deux montants (collectée, déductible) et le net. Il ne correspond à aucune rubrique numérotée du formulaire G50. Les régularisations, la TVA sur immobilisations et le prorata ne sont pas gérés.
- **Fichier :** `src/modules/accounting/service/posting.ts`, lignes 134-142.
- **Source :** aucune.
- **Question :** Quelles lignes du G50 doivent être pré-remplies ? Quelles opérations hors vente et achat courants doivent être prises en compte ?
- [ ] Validé / [ ] À corriger : ____

---

## 7. Mentions obligatoires sur facture et reçu

### M1. Facture imprimable
- **Valeur actuelle :** en-tête (titre, numéro, date) ; vendeur et acheteur (nom, adresse, NIF, NIS, RC, AI, si renseignés) ; lignes (description, quantité, prix unitaire, montant HT, taux de TVA) ; total HT ; TVA par taux ; timbre si supérieur à 0 ; total TTC. Le HTML comporte un marqueur « ⚠ needs accountant verification ».
- **Fichier :** `src/modules/invoicing/service/print.ts`, lignes 37-39 (commentaire), 43-53 (identifiants), 63 (marqueur), 88 (total) ; `src/modules/invoicing/__tests__/print.test.ts`, ligne 34.
- **Source :** « Secondary guide lists: supplier identity, NIF, invoice number and date, description, unit price and total, VAT amount and rate, total payable. Official basis: unknown » (`docs/research/05-algeria-requirements.md`, §6).
- **Question :** Quelles mentions sont obligatoires sur une facture algérienne ? Faut-il ajouter les conditions de paiement, la date de livraison, l'unité de mesure, la mention de l'acheteur sans NIF, ou la mention du régime de TVA ? Le NIS, le RC et l'AI doivent-ils être obligatoires ou facultatifs ?
- [ ] Validé / [ ] À corriger : ____

### M2. Libellé « total en lettres » sans conversion

- **Valeur actuelle :** la facture imprime une ligne « Total en lettres » (libellé `totalInWords`, fr : « Total en lettres », ar : « المجموع بالحروف », en : « Total in words ») suivie du montant en lettres, puis le montant en chiffres dans la colonne de droite. Le montant en lettres est produit par `amountInWords` (`src/core/money/words.ts`) : dinars algériens et centimes, en français (règles d'accord : « et un », « quatre-vingts », « cent/cents », « mille » invariable, « de » après un million), en arabe (arabe standard, jusqu'aux milliards) ou en anglais.
- **Fichier :** `src/modules/invoicing/service/print.ts` (ligne du total) ; `src/core/money/words.ts` ; tests `src/core/money/words.test.ts`.
- **Source :** aucune source officielle consultée sur la mention obligatoire.
- **Question :** La mention du montant en lettres est-elle obligatoire sur facture, et dans quelle langue ? Les formulations (« dinars algériens et zéro centime ») et les règles arabes sont-elles acceptées par l'expert-comptable ?
- [ ] Validé / [ ] À corriger : ____

### M3. Reçu de paiement
- **Valeur actuelle :** le reçu comporte un marqueur « ⚠ needs accountant/lawyer verification » (commentaire HTML), le téléphone du client, et d'après le plan, la raison sociale, le NIF et le RC de l'entreprise. Format A5.
- **Fichier :** `src/modules/credit_sales/print/receipt-html.ts`, lignes 38, 51, 66 ; `src/modules/credit_sales/print/views.tsx`, lignes 17, 43, 59 ; plan : `docs/plan/tasks/WAVE-4.md`, ligne 144.
- **Source :** aucune source officielle.
- **Question :** Un reçu de vente à crédit doit-il porter des mentions légales précises (NIF, RC, numéro de reçu, mode de paiement) ? Le reçu a-t-il valeur de quittance ?
- [ ] Validé / [ ] À corriger : ____

### M4. Contrat de vente à crédit
- **Valeur actuelle :** le contrat comporte un marqueur « ⚠ needs accountant/lawyer verification » (lignes 78 et 121 de `contract-html.ts`), les parties, leurs identifiants, les lignes, l'échéancier, la majoration, l'acompte, un bloc « Conditions » avec placeholder, et des cadres de signature.
- **Fichier :** `src/modules/credit_sales/print/contract-html.ts`, lignes 78, 91, 105-107, 120-122 ; `src/modules/credit_sales/print/views.tsx`, lignes 59, 101-103, 128-130.
- **Source :** aucune source. `docs/research/05-algeria-requirements.md`, §12 : « No specific rule found for installment sales ».
- **Question :** Quelles clauses sont obligatoires dans un contrat de vente à tempérament ? Faut-il un taux annuel effectif global (TAEG) ou une mention de coût total du crédit ? Quelles sont les clauses de rétractation et de remboursement anticipé ?
- [ ] Validé / [ ] À corriger : ____

---

## 8. Numérotation des factures

### N1. Préfixes et longueur des numéros
- **Valeur actuelle :** facture de vente `FAC-{AAAA}-` ; avoir de vente `AV-{AAAA}-` ; facture d'achat `FF-{AAAA}-` ; avoir d'achat `AVF-{AAAA}-`. Compteur sur 5 chiffres (par exemple `FAC-2026-00001`). Numérotation attribuée à la validation (pas au brouillon).
- **Fichier :** `src/modules/invoicing/service/invoices.ts`, lignes 15-18 et 46-47.
- **Source :** `docs/plan/tasks/WAVE-5.md` (préfixes définis par le plan). Aucune source officielle.
- **Question :** Les préfixes et la longueur sont-ils conformes aux exigences de numérotation légale ? La numérotation doit-elle être continue sans trous (oui dans le code) ?
- [ ] Validé / [ ] À corriger : ____

### N2. Continuité du compteur d'une année sur l'autre
- **Valeur actuelle :** le compteur est associé au code de séquence (par exemple `invoicing.out_invoice`) et non à l'année. L'année n'apparaît que dans le préfixe. Le compteur ne semble donc pas remis à zéro le 1er janvier.
- **Fichier :** `src/core/sequences/index.ts`, lignes 7-37 (en particulier l. 24-37).
- **Source :** aucune.
- **Question :** La numérotation doit-elle repartir à 00001 chaque année ? Si oui, la clé de séquence doit inclure l'année.
- [ ] Validé / [ ] À corriger : ____

### N3. Numérotation des écritures comptables
- **Valeur actuelle :** une séquence par journal, de la forme `accounting.entry.<code journal>` avec préfixe et longueur définis à la création de l'écriture. Le commentaire du schéma indique « VT/2026/00001 ».
- **Fichier :** `src/modules/accounting/service/entries.ts`, ligne 76 ; `src/modules/accounting/schema.ts`, ligne 82 (commentaire).
- **Source :** aucune.
- **Question :** Le format de numéro d'écriture (préfixe, année, longueur) est-il conforme aux pratiques comptables ? Les numéros doivent-ils être continus par journal ?
- [ ] Validé / [ ] À corriger : ____

### N4. Numérotation des contrats de vente à crédit
- **Valeur actuelle :** préfixe `CR-{AAAA}-`, longueur 5.
- **Fichier :** `src/modules/credit_sales/service/contracts.ts`, ligne 321.
- **Source :** `docs/plan/tasks/WAVE-4.md`, ligne 83 (prévu).
- **Question :** Le préfixe et la longueur sont-ils acceptables ? Un contrat doit-il avoir une numérotation légale distincte de celle des factures ?
- [ ] Validé / [ ] À corriger : ____

---

## 9. Vente à tempérament et crédit

### V1. Calcul de la majoration
- **Valeur actuelle :** majoration = taux saisi appliqué au (prix comptant − acompte) ; total = prix comptant + majoration ; montant financé = total − acompte. Le taux est un nombre libre avec au plus 4 décimales, sans plafond ni contrôle.
- **Fichier :** `src/modules/credit_sales/service/contracts.ts`, lignes 50, 122, 146-169.
- **Source :** aucune. `docs/research/05-algeria-requirements.md`, §12 : statut inconnu.
- **Question :** Existe-t-il un plafond légal de majoration ou de taux d'intérêt pour la vente à tempérament ? Faut-il afficher un taux annuel effectif ?
- [ ] Validé / [ ] À corriger : ____

### V2. Échéancier
- **Valeur actuelle :** échéances mensuelles (même jour, jour ramené en fin de mois si besoin) ou hebdomadaires (7 jours). Montants : voir A5.
- **Fichier :** `src/modules/credit_sales/service/schedule.ts`, lignes 1-3, 39-64.
- **Source :** commentaire du fichier (règle interne).
- **Question :** Les modalités d'échéance (délai minimal, fréquence) sont-elles encadrées ? Le premier échéance peut-elle être fixée librement ?
- [ ] Validé / [ ] À corriger : ____

### V3. Clauses du contrat : placeholder
- **Valeur actuelle :** le bloc « Conditions » affiche « [Clauses du contrat à compléter] » (français), « [بنود العقد لتعبئتها] » (arabe), « [Contract terms to be completed] » (anglais). Aucune clause juridique n'est rédigée dans l'application.
- **Fichier :** `src/modules/credit_sales/print/shared.ts`, lignes 54, 96, 138 ; `src/modules/credit_sales/print/contract-html.ts`, ligne 122 ; `src/modules/credit_sales/print/views.tsx`, ligne 130.
- **Source :** aucune.
- **Question :** Fournir les clauses types (objet, prix, paiement, retard, résolution, clause de propriété, juridiction). Qui rédige le texte définitif ?
- [ ] Validé / [ ] À corriger : ____

### V4. Pénalités de retard et défaut de paiement
- **Valeur actuelle :** le montant en retard (`lateCents`) est calculé, mais aucun taux de pénalité ni clause de déchéance n'a été trouvé dans les fichiers lus.
- **Fichier :** `src/modules/credit_sales/service/contracts.ts`, ligne 44 (champ `lateCents`).
- **Source :** aucune.
- **Question :** Quelles pénalités de retard sont permises ? Y a-t-il un plafond ? La reprise du bien est-elle encadrée ?
- [ ] Validé / [ ] À corriger : ____

### V5. Droit de rétractation et remboursement anticipé
- **Valeur actuelle :** aucune règle de rétractation ni de remboursement anticipé n'a été trouvée dans les fichiers lus.
- **Fichier :** `src/modules/credit_sales/print/contract-html.ts` ; `src/modules/credit_sales/service/payments.ts` (aucune règle de ce type identifiée).
- **Source :** aucune. `docs/research/05-algeria-requirements.md`, §12 : statut inconnu.
- **Question :** Un délai de rétractation est-il obligatoire pour la vente à crédit au consommateur ? Le client peut-il rembourser par anticipation sans frais ?
- [ ] Validé / [ ] À corriger : ____

### V6. Protection du consommateur
- **Valeur actuelle :** non traitée dans le code.
- **Fichier :** aucun (sujet juridique).
- **Source :** Loi 09-03 du 25 février 2009 (WIPO Lex), signalée « needs lawyer verification » (`docs/research/05-algeria-requirements.md`, §12).
- **Question :** Quelles obligations de la loi 09-03 s'appliquent à la vente à crédit et doivent figurer dans le contrat ?
- [ ] Validé / [ ] À corriger : ____

---

## 10. Loi 18-07 (données personnelles) et ANPDP

### P1. Numéro d'identité nationale
- **Valeur actuelle :** le numéro de carte d'identité ou de passeport du client (`nationalId`) est déclaré chiffré au niveau applicatif (AES-GCM, selon le commentaire) et doublé d'un hachage HMAC pour l'unicité. Il est exclu du formulaire client et de l'API REST publique. Il n'apparaît pas dans les impressions.
- **Fichier :** `src/modules/contacts/schema.ts`, lignes 57-60 ; `src/app/[locale]/(app)/contacts/_lib/form-entity.ts`, ligne 7 ; `src/modules/platform/service/rest.ts`, ligne 64.
- **Source :** commentaire du schéma (chiffrement non vérifié dans ce constat).
- **Question :** Le chiffrement est-il bien implémenté et la clé bien gérée ? Le numéro d'identité est-il nécessaire pour un client (minimisation) ? Base légale ?
- [ ] Validé / [ ] À corriger : ____

### P2. Données de contact client
- **Valeur actuelle :** téléphone (format E.164), téléphone secondaire, adresse, e-mail et noms sont stockés sur la fiche client. Le téléphone apparaît sur les reçus et contrats.
- **Fichier :** `src/modules/contacts/schema.ts`, lignes 61-64 ; `src/modules/credit_sales/print/receipt-html.ts`, ligne 51 ; `src/modules/credit_sales/print/contract-html.ts`, ligne 91.
- **Source :** aucune.
- **Question :** Quelle base légale et quelle information du client sont requises ? Quelle durée de conservation ? Le droit d'accès et de rectification est-il prévu ?
- [ ] Validé / [ ] À corriger : ____

### P3. Numéro d'identification national des employés (NIN)
- **Valeur actuelle :** le champ `nin` est stocké en texte clair, sans chiffrement signalé dans le schéma. Le commentaire indique « Personal data: never log it ». Il est saisi dans le formulaire employé.
- **Fichier :** `src/modules/hr/schema.ts`, lignes 56-59 ; `src/modules/hr/ui/employee-form.tsx`, ligne 64.
- **Source :** aucune.
- **Question :** Le NIN doit-il être chiffré comme le numéro client (P1) ? Est-il nécessaire à la gestion RH ? Quelle base légale ?
- [ ] Validé / [ ] À corriger : ____

### P4. Photo de pièce d'identité
- **Valeur actuelle :** les fichiers de type « id_photo » sont stockés dans le bucket privé `tavio-id-photos` avec un indicateur `encrypted` (chiffrement au repos, selon le commentaire).
- **Fichier :** `src/core/db/schema/infra.ts`, lignes 133-134 (indicateur) et 139 (contrainte du bucket).
- **Source :** aucune.
- **Question :** La photo d'identité est-elle facultative ? Une durée de conservation est-elle fixée pour elle ? Le consentement doit-il être recueilli avant la prise de photo ?
- [ ] Validé / [ ] À corriger : ____

### P5. Transferts de données hors d'Algérie
- **Valeur actuelle :** la base de données est hébergée sur Supabase (région Paris) et les traitements sur Cloudflare. Les données quittent donc le territoire.
- **Fichier :** `docs/plan/ARCHITECTURE.md`, lignes 35-38 (risque 2) ; `docs/plan/ROADMAP.md`, ligne 288.
- **Source :** GIDE et AlgeriaTech News (`docs/research/05-algeria-requirements.md`, §10). Exigence d'autorisation préalable de l'ANPDP, avec exceptions. Non vérifié.
- **Question :** Un transfert vers Supabase (Paris) et Cloudflare nécessite-t-il une autorisation de l'ANPDP ? Quelle exception (consentement, contrat, obligation légale) peut être invoquée ? Faut-il héberger en Algérie ?
- [ ] Validé / [ ] À corriger : ____

### P6. Texte de consentement
- **Valeur actuelle :** aucun texte de consentement n'a été trouvé dans l'application, sauf une mention dans `src/modules/credit_sales/schema.ts`.
- **Fichier :** `src/modules/credit_sales/schema.ts` (mention relevée lors de la recherche).
- **Source :** `docs/plan/ROADMAP.md`, ligne 287 (prévu : base légale, texte de consentement, minimisation, conservation, droits).
- **Question :** Rédiger le texte de consentement et les informations à donner au client (finalité, destinataires, durée, droits).
- [ ] Validé / [ ] À corriger : ____

### P7. Loi 25-11 et pouvoirs de l'ANPDP
- **Valeur actuelle :** non traité dans le code.
- **Fichier :** aucun (sujet juridique).
- **Source :** loi 25-11 du 24 juillet 2025 modifiant la loi 18-07, avec des sanctions pouvant aller jusqu'à 5 ans d'emprisonnement et 500 000 DA d'amende (source secondaire, `docs/research/05-algeria-requirements.md`, §10).
- **Question :** Quelles obligations concrètes la loi 25-11 impose-t-elle à un éditeur de logiciel qui héberge des données clients ? Le rôle de l'éditeur (sous-traitant ou responsable de traitement) est-il clair ?
- [ ] Validé / [ ] À corriger : ____

---

## 11. Conservation des documents

### R1. Durée de conservation
- **Valeur actuelle :** non décidée. Les documents sont mentionnés comme devant être conservés 6 ans ou 10 ans selon les sources. Le journal d'audit rejette toute modification ou suppression.
- **Fichier :** `docs/plan/DATA_MODEL.md`, ligne 188 ; `docs/plan/ARCHITECTURE.md`, ligne 55 ; `docs/plan/ROADMAP.md`, ligne 283.
- **Source :** « Record retention: 6 years vs 10 years, conflicting. Unknown » (`docs/research/05-algeria-requirements.md`, §11).
- **Question :** Quelle est la durée légale de conservation des factures, des écritures comptables et des contrats (6 ans ou 10 ans) ? S'applique-t-elle à chaque type de document ?
- [ ] Validé / [ ] À corriger : ____

### R2. Purge à l'issue de la durée de conservation
- **Valeur actuelle :** aucune tâche de purge n'est implémentée. Le commentaire de la table des fichiers indique « Hard delete only by retention job », mais aucun job de ce type n'a été trouvé dans `src`.
- **Fichier :** `src/core/db/schema/infra.ts`, ligne 135 (commentaire).
- **Source :** aucune.
- **Question :** Faut-il une purge automatique ? Quelle est la procédure en fin de durée ? Une archive légale distincte est-elle nécessaire ?
- [ ] Validé / [ ] À corriger : ____

### R3. Sauvegardes et restauration
- **Valeur actuelle :** la restauration ponctuelle (PITR) couvre 7 à 14 jours selon le plan Supabase. Des exports `pg_dump` quotidiens vers un stockage R2 dans un autre compte sont prévus.
- **Fichier :** `docs/plan/ARCHITECTURE.md`, ligne 55.
- **Source :** aucune. À confirmer avec le tarif et le plan Supabase.
- **Question :** Les sauvegardes doivent-elles être conservées au même niveau que la durée légale de conservation (R1) ? Faut-il une sauvegarde hors du territoire (voir P5) ?
- [ ] Validé / [ ] À corriger : ____

---

## 12. Prix SaaS

### X1. Plan Pro
- **Valeur actuelle :** 290 000 centimes, soit 2 900 DA par utilisateur et par mois, jusqu'à 5 utilisateurs. Valeur marquée « placeholder ».
- **Fichier :** `src/modules/subscriptions/plans.ts`, lignes 6, 29-35 (prix l. 32).
- **Source :** aucune. Valeur provisoire.
- **Question :** Ce prix est-il confirmé par le propriétaire de l'entreprise ? Est-il TTC ou HT ?
- [ ] Validé / [ ] À corriger : ____

### X2. Plan Business
- **Valeur actuelle :** 590 000 centimes, soit 5 900 DA par utilisateur et par mois, jusqu'à 25 utilisateurs. Valeur marquée « placeholder ».
- **Fichier :** `src/modules/subscriptions/plans.ts`, lignes 36-42 (prix l. 39).
- **Source :** aucune. Valeur provisoire.
- **Question :** Ce prix est-il confirmé ? Est-il TTC ou HT ?
- [ ] Validé / [ ] À corriger : ____

### X3. Plan Free et plafonds d'utilisateurs
- **Valeur actuelle :** Free à 0 DA, 1 utilisateur, modules `core`, `contacts`, `credit_sales`.
- **Fichier :** `src/modules/subscriptions/plans.ts`, lignes 22-28.
- **Source :** aucune.
- **Question :** Le plan gratuit est-il conforme à l'offre commerciale ? Les plafonds de 5 et 25 utilisateurs sont-ils les bons ?
- [ ] Validé / [ ] À corriger : ____

### X4. TVA sur les abonnements
- **Valeur actuelle :** le montant mensuel est le prix par utilisateur × nombre de sièges, sans aucune TVA ni mention de taxe.
- **Fichier :** `src/modules/subscriptions/plans.ts`, lignes 50-53 (`monthlyTotalCents`).
- **Source :** aucune.
- **Question :** Les abonnements logiciels facturés par Tavio sont-ils soumis à la TVA (19 %) ? Si oui, faut-il afficher les prix HT et TTC, et émettre une facture de TVA pour l'abonnement ?
- [ ] Validé / [ ] À corriger : ____

---

_Fin de la checklist. Les sources sont celles de `docs/research/05-algeria-requirements.md`. Ce document ne constitue pas un avis juridique ou fiscal._

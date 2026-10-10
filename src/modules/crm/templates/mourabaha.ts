// Mourabaha commercial process: pure seed data (PDF items 8, 12, 23, 37, Annex A).
// No database access here. The idempotent applier turns this into service calls.

export const MOURABAHA_PIPELINE_NAME = 'Mourabaha';

export interface MourabahaStageTemplate {
  name: string;
  probability: number;
  isWon: boolean;
  fold: boolean;
  requirements: string;
}

// Order is the kanban order (item 8). Pas intéressé and Non qualifié are folded, and Transmis BO is the won stage.
export const MOURABAHA_STAGES: readonly MourabahaStageTemplate[] = [
  { name: 'Nouveau Lead', probability: 10, isWon: false, fold: false, requirements: 'Premier contact à faire. Renseigner le canal.' },
  { name: 'Déjà contacté', probability: 10, isWon: false, fold: false, requirements: 'Contact déjà tenté. Noter le résultat et la prochaine action.' },
  { name: 'Ne répond pas', probability: 5, isWon: false, fold: false, requirements: 'Compter les tentatives. Séquence NR. Ne pas clore sans motif.' },
  { name: 'Injoignable', probability: 5, isWon: false, fold: false, requirements: 'Noter le type d\'impossibilité (numéro coupé, hors zone, etc.).' },
  { name: 'Demande d\'information', probability: 20, isWon: false, fold: false, requirements: 'Rappel téléphonique requis (J+2, J+5, J+10). Requalifier ensuite.' },
  { name: 'Qualifié', probability: 30, isWon: false, fold: false, requirements: 'Profil, zone, produit et conditions vérifiés. Prochaine action planifiée.' },
  { name: 'Intéressé', probability: 50, isWon: false, fold: false, requirements: 'Suivi WhatsApp et choix produit. Arrêter la séquence précédente.' },
  { name: 'Orienté showroom', probability: 50, isWon: false, fold: false, requirements: 'Branche facultative: visite du showroom planifiée et suivie.' },
  { name: 'En attente de l\'envoi du dossier', probability: 60, isWon: false, fold: false, requirements: 'Relance du dossier. S\'arrête dès que le dossier est complet.' },
  { name: 'Dossier reçu', probability: 80, isWon: false, fold: false, requirements: 'Documents, produits choisis et informations suffisantes. Préparer la transmission BO.' },
  { name: 'Transmis BO', probability: 100, isWon: true, fold: false, requirements: 'Transmission formelle au back-office effectuée.' },
  { name: 'Pas intéressé', probability: 0, isWon: false, fold: true, requirements: 'Motif de sortie obligatoire (pas de besoin, prix, financement, déjà acheté, reporté).' },
  { name: 'Non qualifié', probability: 0, isWon: false, fold: true, requirements: 'Motif de sortie obligatoire (profil, zone, produit, conditions, autre).' },
];

export const MOURABAHA_LOST_REASONS: readonly string[] = ['Pas intéressé', 'Non qualifié'];

export interface MourabahaActivityTypeTemplate {
  key: string;
  name: string;
  category: 'default' | 'phonecall' | 'upload_file' | 'meeting';
  delayCount: number;
  requireResult: boolean;
}

export const MOURABAHA_ACTIVITY_TYPES: readonly MourabahaActivityTypeTemplate[] = [
  { key: 'call', name: 'Appel', category: 'phonecall', delayCount: 0, requireResult: true },
  { key: 'whatsapp', name: 'WhatsApp', category: 'default', delayCount: 0, requireResult: false },
  { key: 'document_follow_up', name: 'Relance dossier', category: 'upload_file', delayCount: 0, requireResult: false },
];

export interface MourabahaPlanStepTemplate {
  summary: string;
  activityTypeKey: string;
  offsetDays: number;
}

export interface MourabahaPlanTemplate {
  code: 'NR' | 'INJ' | 'INFO' | 'QUAL' | 'INT' | 'SHOW' | 'DOS';
  name: string;
  steps: readonly MourabahaPlanStepTemplate[];
}

// Offsets in days from item 23. Each step is J+offset from the plan start.
export const MOURABAHA_PLANS: readonly MourabahaPlanTemplate[] = [
  { code: 'NR', name: 'NR - Ne répond pas', steps: [0, 1, 3, 7, 15].map((d) => ({ summary: 'Relance téléphonique', activityTypeKey: 'call', offsetDays: d })) },
  { code: 'INJ', name: 'INJ - Injoignable', steps: [0, 1, 3, 7].map((d) => ({ summary: 'Nouvelle tentative', activityTypeKey: 'call', offsetDays: d })) },
  { code: 'INFO', name: 'INFO - Demande d\'information', steps: [2, 5, 10].map((d) => ({ summary: 'Rappel demande d\'information', activityTypeKey: 'call', offsetDays: d })) },
  { code: 'QUAL', name: 'QUAL - Qualification', steps: [{ summary: 'Suivi qualification', activityTypeKey: 'call', offsetDays: 1 }] },
  { code: 'INT', name: 'INT - Intéressé', steps: [0, 1, 3].map((d) => ({ summary: 'Suivi WhatsApp et commercial', activityTypeKey: 'whatsapp', offsetDays: d })) },
  { code: 'SHOW', name: 'SHOW - Showroom', steps: [{ summary: 'Suivi visite showroom', activityTypeKey: 'call', offsetDays: 1 }] },
  { code: 'DOS', name: 'DOS - Dossier en attente', steps: [0, 1, 2, 4, 7].map((d) => ({ summary: 'Relance dossier', activityTypeKey: 'document_follow_up', offsetDays: d })) },
];

export const MOURABAHA_DOCUMENT_REQUIREMENTS: readonly string[] = [
  'CIN',
  'Fiche de paie ou attestation de travail',
  'Relevé bancaire',
  'Chèque',
  'Facture proforma',
];

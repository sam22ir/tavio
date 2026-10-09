// Pure helpers: message personalisation and campaign state rules. No DB access.

export interface MessageVars {
  name: string;
  shop: string;
}

/** Replaces {name} and {shop} placeholders. Unknown placeholders are left as written. */
export function personalize(template: string, vars: MessageVars): string {
  return template.replaceAll('{name}', vars.name).replaceAll('{shop}', vars.shop);
}

export type CampaignState = 'draft' | 'ready' | 'sent';

/** Campaigns can be edited until every recipient has been handled (state sent). */
export function isEditable(state: string): boolean {
  return state === 'draft' || state === 'ready';
}

/** Recipients can be (re)built only before anyone has been marked sent or failed. */
export function canBuildRecipients(state: string, statuses: readonly string[]): boolean {
  return isEditable(state) && statuses.every((s) => s === 'pending');
}

/** A campaign is sent when it has recipients and none is still pending. */
export function nextCampaignState(statuses: readonly string[]): CampaignState {
  if (statuses.length === 0) return 'draft';
  return statuses.every((s) => s !== 'pending') ? 'sent' : 'ready';
}

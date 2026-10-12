import { DEFAULT_PIPELINE } from './schema';

type Locale = 'fr' | 'ar' | 'en';

/**
 * Stage names are stored in the language the company was created in. The default stages exist in all three languages,
 * so a stored default name is shown in the viewer's language; custom stage names are returned unchanged.
 */
export function stageLabel(name: string, locale: Locale): string {
  for (const stage of DEFAULT_PIPELINE.stages) {
    if ((Object.values(stage.names) as string[]).includes(name)) return stage.names[locale];
  }
  return name;
}

import { describe, expect, it } from 'vitest';
import arTools from '../../../../../messages/ar/ai_tools.json';
import enTools from '../../../../../messages/en/ai_tools.json';
import frTools from '../../../../../messages/fr/ai_tools.json';
import arShell from '../../../../../messages/ar/shell.json';
import enShell from '../../../../../messages/en/shell.json';
import frShell from '../../../../../messages/fr/shell.json';

/** Sorted list of every leaf key path, so two locales can be compared for parity. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k))
    .sort();
}

describe('ai_tools message parity', () => {
  it('fr, ar and en have the same keys', () => {
    expect(keyPaths(frTools)).toEqual(keyPaths(enTools));
    expect(keyPaths(arTools)).toEqual(keyPaths(enTools));
  });

  it('every action label is a non-empty string in all locales', () => {
    for (const messages of [enTools, frTools, arTools]) {
      for (const path of keyPaths(messages.actions)) {
        const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages.actions);
        expect(typeof value === 'string' && value.length > 0, path).toBe(true);
      }
    }
  });
});

describe('assistant starter prompt parity', () => {
  it('the collections starter exists in all locales', () => {
    for (const shell of [enShell, frShell, arShell]) {
      expect(shell.dashboard.assistant.prompts.collections.length).toBeGreaterThan(0);
    }
    expect(keyPaths(frShell.dashboard.assistant)).toEqual(keyPaths(enShell.dashboard.assistant));
    expect(keyPaths(arShell.dashboard.assistant)).toEqual(keyPaths(enShell.dashboard.assistant));
  });
});

import { describe, expect, it } from 'vitest';
import { pipelineNameInput, stageInput } from '../service/pipeline';

const PIPELINE_ID = '0b9c5a5e-6f3a-4c57-9d2e-7a1f2b3c4d5e';

const base = {
  pipelineId: PIPELINE_ID,
  name: 'Nouveau Lead',
  position: 0,
  probability: 10,
  isWon: false,
  fold: false,
};

describe('pipeline name input', () => {
  it('trims and accepts a normal name', () => {
    expect(pipelineNameInput.parse('  Mourabaha  ')).toBe('Mourabaha');
  });

  it('rejects an empty or overlong name', () => {
    expect(pipelineNameInput.safeParse('   ').success).toBe(false);
    expect(pipelineNameInput.safeParse('x'.repeat(121)).success).toBe(false);
  });
});

describe('stage input', () => {
  it('accepts a stage with requirements', () => {
    expect(stageInput.safeParse({ ...base, requirements: 'Premier contact.' }).success).toBe(true);
  });

  it('accepts a missing or null requirements hint', () => {
    expect(stageInput.safeParse({ ...base, requirements: null }).success).toBe(true);
    expect(stageInput.safeParse(base).success).toBe(true);
  });

  it('keeps probability within 0 to 100 and position non-negative', () => {
    expect(stageInput.safeParse({ ...base, probability: 101 }).success).toBe(false);
    expect(stageInput.safeParse({ ...base, probability: -1 }).success).toBe(false);
    expect(stageInput.safeParse({ ...base, position: -1 }).success).toBe(false);
  });

  it('requires a uuid pipeline id and a non-empty name', () => {
    expect(stageInput.safeParse({ ...base, pipelineId: 'nope' }).success).toBe(false);
    expect(stageInput.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });

  it('rejects requirements longer than 1000 characters', () => {
    expect(stageInput.safeParse({ ...base, requirements: 'x'.repeat(1001) }).success).toBe(false);
  });
});

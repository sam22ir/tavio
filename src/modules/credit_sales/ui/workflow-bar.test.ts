import { describe, expect, it } from 'vitest';
import { workflowButtons } from './workflow-bar';

describe('workflowButtons', () => {
  it('offers the next one-click step for each state', () => {
    expect(workflowButtons('draft')).toEqual(['submit']);
    expect(workflowButtons('submitted')).toEqual(['review']);
    expect(workflowButtons('approved')).toEqual(['reserve']);
    expect(workflowButtons('reserved')).toEqual([]);
  });

  it('offers no one-click step while a decision is pending, or once terminal', () => {
    expect(workflowButtons('under_review')).toEqual([]);
    expect(workflowButtons('refused')).toEqual([]);
    expect(workflowButtons('active')).toEqual([]);
  });
});

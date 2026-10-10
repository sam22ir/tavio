import { describe, expect, it } from 'vitest';
import { archiveRefusal, visibleCompanyRows } from './service';

const demo = { isDemo: true, archivedAt: null };
const real = { isDemo: false, archivedAt: null };

describe('archiveRefusal', () => {
  it('allows the owner to archive an active demo company', () => {
    expect(archiveRefusal(demo, 'owner')).toBeNull();
  });

  it('refuses a real company, even for its owner', () => {
    expect(archiveRefusal(real, 'owner')).toBe('FORBIDDEN');
  });

  it('refuses a demo company for members who are not owners', () => {
    expect(archiveRefusal(demo, 'admin')).toBe('FORBIDDEN');
    expect(archiveRefusal(demo, 'manager')).toBe('FORBIDDEN');
    expect(archiveRefusal(demo, null)).toBe('FORBIDDEN');
  });

  it('treats an unknown or already archived company as not found', () => {
    expect(archiveRefusal(undefined, 'owner')).toBe('NOT_FOUND');
    expect(archiveRefusal({ isDemo: true, archivedAt: new Date() }, 'owner')).toBe('NOT_FOUND');
  });
});

describe('visibleCompanyRows', () => {
  it('drops archived companies and keeps the rest in order', () => {
    const rows = [
      { id: 'real', archivedAt: null },
      { id: 'old-demo', archivedAt: new Date('2026-01-01') },
      { id: 'demo', archivedAt: null },
    ];
    expect(visibleCompanyRows(rows).map((r) => r.id)).toEqual(['real', 'demo']);
  });
});

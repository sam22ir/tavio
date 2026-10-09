import { describe, expect, it } from 'vitest';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  isInviteExpired,
  normalizeInviteEmail,
} from '../invitations';
import { canManageTeam, isMemberRoleKey } from '../members';

describe('invitation tokens', () => {
  it('hashes with SHA-256 hex, deterministically', () => {
    expect(hashInviteToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
    expect(hashInviteToken('abc')).not.toBe(hashInviteToken('abd'));
  });

  it('generates unique url-safe tokens of at least 256 bits', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('invitation expiry', () => {
  const now = new Date('2026-10-09T10:00:00Z');

  it('expires seven days after creation', () => {
    expect(inviteExpiry(now).toISOString()).toBe('2026-10-16T10:00:00.000Z');
  });

  it('is expired at or after the expiry instant, not before', () => {
    const expiresAt = inviteExpiry(now);
    expect(isInviteExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isInviteExpired(expiresAt, expiresAt)).toBe(true);
    expect(isInviteExpired(expiresAt, new Date(expiresAt.getTime() + 1))).toBe(true);
  });
});

describe('invitation helpers', () => {
  it('lowercases and trims emails', () => {
    expect(normalizeInviteEmail('  Amine@Example.DZ ')).toBe('amine@example.dz');
  });
});

describe('team roles', () => {
  it('lets only owners and admins manage the team', () => {
    expect(canManageTeam('owner')).toBe(true);
    expect(canManageTeam('admin')).toBe(true);
    expect(canManageTeam('manager')).toBe(false);
    expect(canManageTeam('staff')).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });

  it('recognises the four seeded role keys only', () => {
    expect(isMemberRoleKey('staff')).toBe(true);
    expect(isMemberRoleKey('superuser')).toBe(false);
  });
});

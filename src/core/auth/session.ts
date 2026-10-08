import { headers } from 'next/headers';
import { getAuth } from '@/core/auth/server';
import { err, type Result } from '@/core/result';

export type SessionUser = { userId: string; email: string };

export async function getSession(): Promise<SessionUser | null> {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email };
}

export async function requireUser(): Promise<Result<SessionUser>> {
  const user = await getSession();
  if (!user) return err('UNAUTHENTICATED', 'no active session');
  return { ok: true, value: user };
}

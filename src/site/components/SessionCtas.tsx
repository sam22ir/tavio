'use client';

import { useSignedIn } from './useSignedIn';
import { CtaLink } from './CtaLink';
import { MobileMenu, type MobileMenuProps } from './MobileMenu';

export interface SessionCtasProps {
  loginHref: string;
  loginLabel: string;
  auditHref: string;
  auditLabel: string;
  appHref: string;
  appLabel: string;
}

/** Desktop header CTAs: "Log in" + audit by default, "Open app" once a session is found. */
export function SessionCtas({ loginHref, loginLabel, auditHref, auditLabel, appHref, appLabel }: SessionCtasProps) {
  const signedIn = useSignedIn();
  if (signedIn) return <CtaLink href={appHref} label={appLabel} />;
  return (
    <>
      <CtaLink href={loginHref} label={loginLabel} variant="light" arrow={false} />
      <CtaLink href={auditHref} label={auditLabel} />
    </>
  );
}

/** Mobile menu whose primary CTA follows the same client-side session check. */
export function SessionMobileMenu({ appHref, ...props }: Omit<MobileMenuProps, 'appHref'> & { appHref: string }) {
  const signedIn = useSignedIn();
  return <MobileMenu {...props} appHref={signedIn ? appHref : undefined} />;
}

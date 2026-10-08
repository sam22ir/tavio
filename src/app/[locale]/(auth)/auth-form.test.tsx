import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from './auth-form';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/login',
}));
vi.mock('@/core/auth/client', () => ({
  authClient: {
    signIn: { email: vi.fn().mockResolvedValue({ error: null }) },
    signUp: { email: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

describe('AuthForm', () => {
  it('renders the signup fields including name', () => {
    render(<AuthForm mode="signup" />);
    expect(screen.getByLabelText('fields.name')).toBeTruthy();
    expect(screen.getByLabelText('fields.email')).toBeTruthy();
    expect(screen.getByLabelText('fields.password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'signup.submit' })).toBeTruthy();
  });
});

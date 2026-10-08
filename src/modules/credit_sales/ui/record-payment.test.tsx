import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';

const action = vi.fn<(input: unknown) => Promise<unknown>>(async () => ({ ok: false as const, error: { code: "VALIDATION", message: "bad" } }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../actions/payments', () => ({ recordPaymentAction: (input: unknown) => action(input) }));

import { RecordPaymentButton } from './record-payment';

describe('RecordPaymentButton', () => {
  afterEach(cleanup);
  it('prefills the amount from the next due installment', async () => {
    render(<RecordPaymentButton contractId="c1" remainingCents="200000" nextDueCents="150050" />);
    fireEvent.click(screen.getByRole('button', { name: 'payment.record' }));
    const amount = await screen.findByLabelText('payment.amount');
    expect((amount as HTMLInputElement).value).toBe('1500.50');
  });

  it('submits the chosen method and reference to the action', async () => {
    render(<RecordPaymentButton contractId="c1" remainingCents="200000" />);
    fireEvent.click(screen.getByRole('button', { name: 'payment.record' }));
    fireEvent.change(await screen.findByLabelText('payment.amount'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('payment.reference'), { target: { value: 'REF1' } });
    fireEvent.submit(screen.getByLabelText('payment.reference').closest('form') as HTMLFormElement);
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: 'c1', amount: '1000', reference: 'REF1', isDownPayment: false }),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { isOpenDeliveryState } from '../service/deliveries';

describe('isOpenDeliveryState', () => {
  it('treats draft and ready deliveries as open', () => {
    expect(isOpenDeliveryState('draft')).toBe(true);
    expect(isOpenDeliveryState('ready')).toBe(true);
  });

  it('treats done and cancelled deliveries as closed', () => {
    expect(isOpenDeliveryState('done')).toBe(false);
    expect(isOpenDeliveryState('cancelled')).toBe(false);
  });
});

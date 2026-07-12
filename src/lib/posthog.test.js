import { describe, expect, it } from 'vitest';
import { PH_EVENTS, getPostHogHost, getPostHogKey, isPostHogEnabled } from './posthog';

describe('posthog helpers', () => {
  it('expone nombres de eventos estables', () => {
    expect(PH_EVENTS.CHECKOUT_STARTED).toBe('checkout_started');
    expect(PH_EVENTS.QUICK_WIN_COMPLETED).toBe('quick_win_completed');
    expect(PH_EVENTS.AEO_COMPLETED).toBe('aeo_completed');
  });

  it('sin key no está habilitado', () => {
    expect(getPostHogKey()).toBe('');
    expect(isPostHogEnabled()).toBe(false);
    expect(getPostHogHost()).toContain('posthog.com');
  });
});

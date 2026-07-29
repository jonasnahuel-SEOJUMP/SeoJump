import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('./supabase', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { checkAndConsumeAiCredit, resolveEffectivePlan } from './aiCredits';

function chainSelect(result: { data: unknown; error?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, maybeSingle });
  return {
    select: vi.fn().mockReturnValue({ eq: eq1, maybeSingle }),
  };
}

describe('resolveEffectivePlan', () => {
  it('baja a free si la suscripción venció', () => {
    expect(
      resolveEffectivePlan({
        subscription_status: 'pro',
        subscription_expires_at: '2020-01-01T00:00:00.000Z',
      })
    ).toBe('free');
  });

  it('mantiene pro si no venció', () => {
    expect(
      resolveEffectivePlan({
        subscription_status: 'pro',
        subscription_expires_at: '2099-01-01T00:00:00.000Z',
      })
    ).toBe('pro');
  });
});

describe('checkAndConsumeAiCredit (RPC atómico)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return chainSelect({
          data: {
            id: '1',
            email: 'user@test.com',
            business_name: null,
            website_url: null,
            subscription_status: 'free',
            subscription_expires_at: null,
            created_at: '',
            updated_at: '',
          },
        });
      }
      return chainSelect({ data: null });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('consume 1 crédito vía RPC y devuelve el nuevo conteo', async () => {
    rpcMock.mockResolvedValue({
      data: { allowed: true, usedToday: 1, usedMonth: 1 },
      error: null,
    });

    const r = await checkAndConsumeAiCredit('user@test.com', 'buscador_oro');
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.status.usedToday).toBe(1);
      expect(r.status.limitDay).toBe(2);
    }
    expect(rpcMock).toHaveBeenCalledWith('consume_ai_credit', {
      p_email: 'user@test.com',
      p_limit_day: 2,
      p_limit_month: 20,
    });
  });

  it('bloquea cupo diario sin incrementar dos veces', async () => {
    rpcMock.mockResolvedValue({
      data: { allowed: false, code: 'AI_CREDIT_DAILY', usedToday: 2, usedMonth: 2 },
      error: null,
    });

    const r = await checkAndConsumeAiCredit('user@test.com', 'quick_wins');
    expect(r.allowed).toBe(false);
    expect(r.allowed === false && r.code).toBe('AI_CREDIT_DAILY');
    expect(r.allowed === false && r.status.usedToday).toBe(2);
  });

  it('bloquea cupo mensual PRO', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return chainSelect({
          data: {
            id: '1',
            email: 'pro@test.com',
            business_name: null,
            website_url: null,
            subscription_status: 'pro',
            subscription_expires_at: null,
            created_at: '',
            updated_at: '',
          },
        });
      }
      return chainSelect({ data: null });
    });

    rpcMock.mockResolvedValue({
      data: { allowed: false, code: 'AI_CREDIT_MONTHLY', usedToday: 5, usedMonth: 250 },
      error: null,
    });

    const r = await checkAndConsumeAiCredit('pro@test.com', 'aeo');
    expect(r.allowed).toBe(false);
    expect(r.allowed === false && r.code).toBe('AI_CREDIT_MONTHLY');
    expect(rpcMock).toHaveBeenCalledWith('consume_ai_credit', {
      p_email: 'pro@test.com',
      p_limit_day: 12,
      p_limit_month: 250,
    });
  });

  it('fail-closed si el RPC falla', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'fn missing' } });
    const r = await checkAndConsumeAiCredit('user@test.com', 'human_score');
    expect(r.allowed).toBe(false);
  });

  it('admins no consumen ni llaman RPC', async () => {
    const r = await checkAndConsumeAiCredit('admin@test.com', 'quick_wins', { isAdmin: true });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.status.isUnlimited).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

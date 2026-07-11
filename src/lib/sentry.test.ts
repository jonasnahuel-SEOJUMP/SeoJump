import { describe, expect, it } from 'vitest';
import { captureAppError, isSentryEnabled } from './sentry';

describe('sentry helper', () => {
  it('no falla si no hay DSN configurado', () => {
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureAppError(new Error('test'), { action: 'demo' })).not.toThrow();
  });
});

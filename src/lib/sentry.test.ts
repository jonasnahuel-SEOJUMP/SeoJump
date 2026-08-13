import { describe, expect, it } from 'vitest';
import { captureAppError, getSentryDsn, isSentryEnabled } from './sentry';

describe('sentry helper', () => {
  it('no falla si no hay DSN configurado', () => {
    expect(getSentryDsn()).toBe('');
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureAppError(new Error('test'), { action: 'demo' })).not.toThrow();
  });

  it('ignora DSN que no son URL http(s)', () => {
    const prev = process.env['SENTRY_DSN'];
    process.env['SENTRY_DSN'] = '[SENSITIVE]';
    expect(getSentryDsn()).toBe('');
    expect(isSentryEnabled()).toBe(false);
    process.env['SENTRY_DSN'] = prev;
  });
});

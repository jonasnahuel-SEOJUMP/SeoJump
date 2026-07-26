import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail } from './adminEmails';

describe('isAdminEmail', () => {
  const prevAdmin = process.env.ADMIN_EMAILS;
  const prevAllowed = process.env.ALLOWED_EMAILS;

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ALLOWED_EMAILS;
  });

  afterEach(() => {
    if (prevAdmin === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prevAdmin;
    if (prevAllowed === undefined) delete process.env.ALLOWED_EMAILS;
    else process.env.ALLOWED_EMAILS = prevAllowed;
  });

  it('fail-closed: sin lista nadie es admin', () => {
    expect(isAdminEmail('cualquiera@gmail.com')).toBe(false);
  });

  it('reconoce emails de ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'Admin@Example.com, otro@test.com';
    expect(isAdminEmail('admin@example.com')).toBe(true);
    expect(isAdminEmail('otro@test.com')).toBe(true);
    expect(isAdminEmail('no@test.com')).toBe(false);
  });

  it('usa ALLOWED_EMAILS como fallback', () => {
    process.env.ALLOWED_EMAILS = 'beta@test.com';
    expect(isAdminEmail('beta@test.com')).toBe(true);
    expect(isAdminEmail('otro@test.com')).toBe(false);
  });
});

/**
 * True si el email está en ADMIN_EMAILS (o ALLOWED_EMAILS como fallback).
 * Si ninguna lista está configurada → nadie es admin (fail-closed).
 * En desarrollo local, configurá ADMIN_EMAILS=tu@email.com.
 */
export function isAdminEmail(userEmail: string): boolean {
  const raw = process.env.ADMIN_EMAILS || process.env.ALLOWED_EMAILS || '';
  if (!raw.trim()) return false;
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(userEmail.trim().toLowerCase());
}

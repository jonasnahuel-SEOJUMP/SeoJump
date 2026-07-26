import crypto from 'crypto';

function getSecretsKey(): Buffer {
  const raw =
    process.env.WP_CONNECTOR_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    '';
  if (!raw) {
    throw new Error('Falta AUTH_SECRET (o WP_CONNECTOR_SECRET) para cifrar el token del conector.');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/** Genera un token opaco para pegar en el plugin de WordPress. */
export function generateWpToken(): string {
  return `sj_${crypto.randomBytes(24).toString('base64url')}`;
}

export function hintWpToken(token: string): string {
  if (token.length < 10) return '••••';
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

/** Cifra el token (AES-256-GCM). Formato: v1.<iv>.<tag>.<cipher> en base64url. */
export function encryptWpToken(plain: string): string {
  const key = getSecretsKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
}

export function decryptWpToken(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Token cifrado inválido');
  }
  const key = getSecretsKey();
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const data = Buffer.from(parts[3], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function normalizeSiteUrl(raw: string): string | null {
  const input = (raw || '').trim();
  if (!input) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    url.search = '';
    // Solo origen (sin path) para la conexión del sitio
    return `${url.protocol}//${url.host}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * Module augmentation para next-auth.
 * Extiende las interfaces Session y JWT con los campos personalizados
 * que usamos en src/auth.ts.
 *
 * accessToken solo se adjunta en auth() server-side (no en /api/auth/session).
 */
import { DefaultSession, DefaultJWT } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    /** Token de acceso OAuth de Google — solo disponible vía auth() en el servidor */
    accessToken?: string
    /** Alcances (scopes) autorizados — solo server-side */
    scope?: string
    /** True si hay un access token usable para Search Console (seguro para el cliente) */
    hasGscAccess?: boolean
    /** Error de refresco de token, si corresponde */
    error?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    scope?: string
    error?: string
  }
}

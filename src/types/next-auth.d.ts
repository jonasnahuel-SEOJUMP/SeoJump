/**
 * Module augmentation para next-auth.
 * Extiende las interfaces Session y JWT con los campos personalizados
 * que usamos en src/auth.ts (accessToken y error).
 */
import { DefaultSession, DefaultJWT } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    /** Token de acceso OAuth de Google */
    accessToken?: string
    /** Alcances (scopes) autorizados en la sesión */
    scope?: string
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

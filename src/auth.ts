import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid profile email https://www.googleapis.com/auth/webmasters",
          // Acumula los permisos ya concedidos en cada token en vez de resetearlos.
          // Evita que se "pierda" el scope de Search Console entre logins
          // (causa del clásico "tengo que entrar dos veces").
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // ── Beta Whitelist ──────────────────────────────────────────────────────
      // ALLOWED_EMAILS is a comma-separated list set in Vercel env vars.
      // Example: "jonasnahuel@gmail.com,tester@example.com"
      // To add a new tester: update the var in Vercel dashboard → no redeploy needed.
      const raw = process.env.ALLOWED_EMAILS ?? '';
      const allowed = raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      // If no whitelist is configured, allow everyone (open mode)
      if (allowed.length === 0) return true;

      const email = (user.email ?? '').toLowerCase();
      if (allowed.includes(email)) return true;

      // Unauthorized → redirect to friendly beta page
      console.warn(`[Auth] Blocked sign-in attempt from: ${email}`);
      return '/acceso-restringido';
    },

    async jwt({ token, account }) {
      // First login or dynamic elevation of scopes: store/update access token, scope, refresh token and expiry
      if (account) {
        token.accessToken = account.access_token
        token.scope = account.scope
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token
        }
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000  // Convert to ms
          : Date.now() + 3600 * 1000   // Default 1 hour
        return token
      }

      // Token still valid → return as is
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // Token expired → attempt to refresh
      console.log('[Auth] Access token expired, refreshing...')
      return await refreshAccessToken(token)
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined
      session.scope = token.scope as string | undefined
      session.error = token.error as string | undefined
      return session
    },
  },
})

/**
 * Refreshes the Google access token using the stored refresh token.
 */
async function refreshAccessToken(token: any) {
  try {
    const url = 'https://oauth2.googleapis.com/token'
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })

    const refreshed = await response.json()

    if (!response.ok) {
      console.error('[Auth] Failed to refresh token:', refreshed)
      throw refreshed
    }

    console.log('[Auth] Token refreshed successfully ✅')

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Keep the old refresh token if a new one wasn't returned
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    }
  } catch (error) {
    console.error('[Auth] Error refreshing access token:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

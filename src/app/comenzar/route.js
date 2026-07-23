import { redirect } from "next/navigation";
import { auth, signIn } from "../../auth";

/**
 * Entrada única al Espía / al dashboard.
 *
 * Es un Route Handler (GET), así el CTA de la landing puede ser un <a href>
 * normal: funciona SIEMPRE, sin depender de que hidrate el JS del cliente.
 *
 *  - ?spy=1  → destino Espía de la Competencia.
 *  - (sin)   → destino dashboard.
 *
 * El servidor decide: con sesión redirige directo; sin sesión inicia el OAuth
 * de Google con retorno al destino.
 */
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dest = searchParams.get("spy") ? "/detective-de-enlaces?view=spy" : "/";

  const session = await auth();
  if (session?.user) {
    redirect(dest);
  }

  // signIn (server) arma el authorize URL de Google, setea cookies PKCE/state
  // y lanza un redirect 3xx. Válido en Route Handler.
  await signIn("google", { redirectTo: dest });
}

import { redirect } from "next/navigation";
import { auth, signIn } from "../../auth";
import { spyDestFromParams } from "../../lib/spyEntry";

/**
 * Entrada única al Espía / al dashboard.
 *
 * Es un Route Handler (GET), así el CTA de la landing puede ser un <a href>
 * o un <form method="GET">: funciona SIEMPRE, sin depender de que hidrate el JS.
 *
 *  - ?spy=1         → destino Espía de la Competencia.
 *  - ?spy=1&url=…   → mismo destino, con la URL del rival prellenada.
 *  - (sin)          → destino dashboard.
 *
 * El servidor decide: con sesión redirige directo; sin sesión inicia el OAuth
 * de Google con retorno al destino.
 */
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dest = searchParams.get("spy") ? spyDestFromParams(searchParams) : "/";

  const session = await auth();
  if (session?.user) {
    redirect(dest);
  }

  // signIn (server) arma el authorize URL de Google, setea cookies PKCE/state
  // y lanza un redirect 3xx. Válido en Route Handler.
  await signIn("google", { redirectTo: dest });
}

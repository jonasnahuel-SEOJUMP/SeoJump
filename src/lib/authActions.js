"use server";

import { redirect } from "next/navigation";
import { auth, signIn } from "../auth";

const SPY_DESTINATION = "/detective-de-enlaces?view=spy";

/**
 * Entrada única y confiable al Espía de la Competencia.
 *
 * Se ejecuta en el SERVIDOR (form action), así no depende de que el JS de la
 * landing hidrate. Decide server-side:
 *  - Con sesión → va directo al Espía.
 *  - Sin sesión → inicia OAuth de Google con retorno al Espía.
 */
export async function startSpyAction() {
  const session = await auth();
  if (session?.user) {
    redirect(SPY_DESTINATION);
  }
  await signIn("google", { redirectTo: SPY_DESTINATION });
}

/**
 * Entrada al dashboard (registro/login genérico). Mismo patrón server-side.
 */
export async function startAppAction() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }
  await signIn("google", { redirectTo: "/" });
}

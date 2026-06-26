import { auth } from "../auth";
import HomeApp from "./HomeApp";
import LandingShell from "../components/LandingShell";

export const metadata = {
  title: "SEO Jump — Mejorá tu web cada día con misiones SEO y AEO",
  description:
    "Conectá tu sitio, detectá oportunidades en Google y completá misiones diarias para posicionar tu negocio — sin tecnicismos. Incluye AEO para ChatGPT y Gemini.",
  openGraph: {
    title: "SEO Jump — Misiones SEO y AEO para tu negocio",
    description:
      "Mejorá tu web cada día con misiones guiadas, Quick Wins con IA y espionaje de competencia.",
    type: "website",
    locale: "es_AR",
  },
};

/**
 * Home pública (SSR) para visitantes y Googlebot.
 * Usuarios logueados van al dashboard (HomeApp) sin pasar por el loader global.
 */
export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return <LandingShell />;
  }

  return <HomeApp />;
}

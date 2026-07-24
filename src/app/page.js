import { auth } from "../auth";
import HomeApp from "./HomeApp";
import LandingShell from "../components/LandingShell";

export const metadata = {
  title: "Espiá a tu competencia gratis en Google — y superala | SEO Jump",
  description:
    "Espiá a tu competencia gratis: pegá la URL de un rival y la IA te muestra qué hace mejor en Google. Después SEO Jump te da misiones diarias para superarla — con AEO para ChatGPT y Gemini.",
  openGraph: {
    title: "Espiá a tu competencia gratis — SEO Jump",
    description:
      "Espiá a tu competencia en Google gratis, sin Semrush. Descubrí sus brechas y superala con misiones diarias, Quick Wins con IA y AEO.",
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

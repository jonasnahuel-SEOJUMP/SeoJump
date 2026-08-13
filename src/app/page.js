import { auth } from "../auth";
import HomeApp from "./HomeApp";
import LandingShell from "../components/LandingShell";

export const metadata = {
  title: "Espiá a tu competencia gratis — pegá su URL | SEO Jump",
  description:
    "Pegá la URL de un rival y descubrí qué hace mejor en Google. Sin Semrush. Después, misiones diarias para superarlo — y AEO para ChatGPT y Gemini.",
  openGraph: {
    title: "Espiá a tu competencia gratis — SEO Jump",
    description:
      "Pegá la URL de tu rival. Te decimos qué te gana y qué cambiar hoy. Luego, una misión por día.",
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

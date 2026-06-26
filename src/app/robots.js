import { getSiteUrl } from "../lib/siteUrl";

/** Rutas de la app autenticada — no indexar (crawl budget + privacidad). */
const DISALLOW = [
  "/api/",
  "/optimizacion",
  "/perfil",
  "/buscador-de-oro",
  "/contenido",
  "/detective-de-enlaces",
  "/pago/",
  "/acceso-restringido",
];

export default function robots() {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl.replace(/^https?:\/\//, ""),
  };
}

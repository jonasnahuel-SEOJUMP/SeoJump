# Arquitectura de SEO Jump

Mapa de decisiones y reglas duras del proyecto. **Leé este archivo antes de hacer cambios grandes.**
Si una regla de acá cambia, actualizá este archivo en el mismo commit.

> Nota para agentes de IA: este es Next.js 16. Algunas APIs y convenciones difieren de versiones
> anteriores. Ante la duda, leé la guía en `node_modules/next/dist/docs/` antes de escribir código.

---

## 1. Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Auth | NextAuth v5 (Google OAuth, scope `webmasters` para Search Console) |
| Base de datos | Supabase (perfiles, suscripciones, créditos IA, snapshots de competencia, misiones) |
| IA | Google Gemini (análisis de contenido, Quick Wins, AEO, Espía) |
| Pagos ARS | **Mercado Pago** (suscripciones `/preapproval`) |
| Pagos internacionales | Stripe |
| Hosting | Vercel (deploy automático al pushear a `main`) |

---

## 2. Organización del código (`src/lib/`)

`actions.ts` es el archivo de **server actions** (`"use server"`). Regla clave de Next.js:
**en un archivo `"use server"` TODO export debe ser una función async** (server action). Por eso los
helpers puros NO viven ahí: están en módulos sin `"use server"` y se importan de vuelta.

| Archivo | Responsabilidad | `"use server"` |
|---------|-----------------|----------------|
| `actions.ts` | Server actions (lo que llaman los componentes cliente) | Sí |
| `scraping.ts` | Primitivas de fetch/parseo de HTML: `fetchPage`, `scrapeMetadata`, `scrapeHeadingSections`, `buildCompetitorSnapshot`, extracción de title/links/headings | No |
| `linkAudit.ts` | Clasificación de URLs (home/hub/contenido), filtros de recomendaciones de enlaces, `crawlSiteLinks` | No |
| `urlHome.ts` | Fuente de verdad única: `isRootHomeUrl(url)` (path `/` sin segmentos). La usan `isHomePage`, `resolvePageType`, `scrapeMetadata` y el Espía. Home **nunca** se infiere solo por HTML/IA. | No |
| `google.js` | Integración con Search Console (datos y diagnóstico de conexión) | No |
| `supabase.ts` | Acceso a Supabase y tipos de datos | No |
| `aiCredits.ts` | Lógica de créditos IA (consumo, límites, caché de Gemini) | No |
| `planLimits.ts` | Límites por plan (free/pro/agencia) | No |
| `mercadopago.ts` | Integración Mercado Pago suscripciones PRO (ARS) | No |
| `stripe.ts` | Integración Stripe suscripciones PRO (USD internacional) | No |

**Regla:** si vas a agregar un helper puro (sin sesión/créditos), ponelo en el módulo de dominio
que corresponda, NO en `actions.ts`. Si `actions.ts` vuelve a crecer mezclando dominios, partilo.

---

## 3. Planes y créditos IA

- Plan **free**: 2 consultas IA por día. Ve **2 oportunidades a la vez** en misiones, Quick Wins y AEO.
- Plan **PRO** / **Agencia**: más consultas IA y todas las oportunidades desbloqueadas.
- **Cada análisis con Gemini cuenta 1 consulta** (Quick Wins, AEO, Espía, Buscador de Oro, Detective).
- **Verificar/completar misiones en la web NO consume créditos IA.** Esto debe quedar claro en toda la UI.

---

## 4. Espía de la Competencia

- Compara on-page (título, H1, headings) de una página rival contra una propia, vía Gemini.
- **No comparar manzanas con naranjas:** si el rival es una página de producto específica, NO se debe
  comparar contra la home del usuario penalizándolo por "genérico".
- Prioridad para elegir la página propia a comparar:
  1. La que el usuario pega a mano (campo "Tu página equivalente").
  2. Auto-detección vía Search Console: la página propia que ya rankea para ese tema (`findOwnPageForKeyword`).
  3. La home, solo como último recurso (y ahí se marca `pageTypeMismatch` para avisar al usuario).
- **Nunca sugerir la marca del competidor** en título/H1/copy del usuario. La marca rival se deriva del
  hostname del rival (`brandLabelFromUrl` / `collectCompetitorBrandTokens` en `spySnapshot.ts`). Si el
  título scrapado del usuario ya trae esa marca (contaminación o marketplace), se trata como error y se
  pide quitarla. Defensa en dos capas: reglas en el prompt a Gemini + post-proceso
  (`sanitizeSpyGapsCompetitorBrand`) que limpia suggestion/problem/verdict.

---

- **Home = regla fija por URL** (`isRootHomeUrl` en `urlHome.ts`). Si la URL es la raíz del dominio, el tipo es `home` aunque el HTML diga `blog`/`post`.
- **Protección de marca en HOME (H1 y `<title>`):** en portada no se sugiere reemplazar el nombre de marca por keywords genéricas. El prompt compartido vive en `homeBrandPrompt.ts` (`homeBrandProtectionInstructions`) y se inyecta en Espía, misiones H1/título y Quick Wins. Hay tests que fallan si alguien saca esa instrucción del prompt.
- **UI:** antes de confirmar un cambio de H1/título, `MissionWarning` avisa el riesgo de ranking temporal.

## 5. Detective de Enlaces / Traspaso de Fuerza

- **Origen de enlaces contextuales (Traspaso de Fuerza y Texto de Anclaje):**
  - PROHIBIDO sugerir como origen: la **Home**, `/tienda`, `/productos`, `/categoria`, `/catalogo`,
    `/shop`, `/coleccion` ni cualquier página catálogo/hub. Meter anclas de texto flotantes ahí rompe
    el diseño del ecommerce.
  - PRIORIZAR como origen: páginas de **contenido** (`/blog`, `/guias`, `/articulos`, etc.) donde un
    enlace de texto fluye natural en el cuerpo.
  - El destino (`toPage`) SÍ puede ser una categoría/producto que necesita visibilidad.
  - Si no hay páginas de contenido en el crawl, devolver lista vacía en vez de una mala sugerencia.
- La clasificación vive en `linkAudit.ts` (`isCatalogHubPage`, `isContentPage`, `isValidLinkSourcePage`).
  Se filtra **dos veces**: antes del prompt a Gemini y en el post-procesado de la respuesta.

---

## 6. Pagos

- **Mercado Pago** es la pasarela para Argentina (suscripciones mensuales PRO).
- Estado actual: integración en `src/lib/mercadopago.ts` + rutas `/api/mercadopago/*`.
- **Stripe** para pagos internacionales (USD). Se reemplazará por Lemon Squeezy cuando aprueben la cuenta.
- Las suscripciones actualizan `subscription_status` en Supabase vía webhook.
- El panel admin permite activar PRO/Agencia manualmente como backup si falla el webhook.
- Variables de entorno viven en `.env.local` (local) y en Vercel (producción). Vercel NO lee `.env.local`.

---

## 7. Flujo de deploy

1. Commit en `main`.
2. Push a `origin/main` → Vercel buildea y deploya automáticamente.
3. Variables de entorno se cargan aparte en el dashboard de Vercel.

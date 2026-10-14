# Análisis: módulo SEO Local (Perfil de Empresa / GBP) para SEO Jump

**Fecha:** 2026-10-13  
**Alcance:** solo investigación (sin cambios de producto, sin commits).  
**Fuentes de código:** repo `/workspace` en el estado de `main` post-hotfix #63.

---

## Resumen ejecutivo

**Recomendación: sí al wedge local, no al clon de Localo.** SEO Jump hoy es un producto de **web + GSC + misiones verificadas**; no hay nada de GBP/Maps/Places en código. El diferencial real frente a Localo en LatAm no es “otro panel de perfil”, sino **web ↔ perfil ↔ reseñas → misiones simples**, a precio pyme (~USD 27 / ARS 39k PRO). Construir geo-grid + agente + posts + white-label ahora diluye el foco y choca con: (1) aprobación lenta de GBP API, (2) cero cron/colas en Vercel, (3) un fundador solo que todavía cierra deuda del circuito web.

**Próximos 3 pasos**
1. **Enviar ya** la solicitud de Basic API Access de GBP (proceso paralelo; no bloquea MVP).
2. **Validar con 5–10 negocios locales** un MVP sin API propia: checklist de perfil + link/QR de reseña WhatsApp + 3 misiones semanales verificadas a mano / con Places público.
3. **No abrir** geo-grid ni “visibilidad en ChatGPT” hasta que ese wedge cobre o retenga; si avanza, DataForSEO standard + caché semanal.

**Confianza en la recomendación:** alta en el diagnóstico del código; media-alta en la economía (precios de terceros pueden moverse); media en timing de aprobación Google.

---

## Desvíos entre el contexto del prompt y el código

| Afirmación del contexto | Realidad en el repo |
|-------------------------|---------------------|
| UI en **español neutro sin voseo** | El producto usa **voseo rioplatense** (`cmsGuide.js`, `humanScore.ts`, prompts Gemini “Español rioplatense”, tests de labels con voseo). |
| **Rachas** como feature | Solo copy de marketing en `LandingPage.js` (“XP y racha”). **No hay** motor, tabla ni storage de rachas. |
| Pagos: MP + Lemon; Stripe legacy | Código: MP + Lemon + Stripe. `architecture.md` aún dice Stripe para intl y “se reemplaza por Lemon”. En `/precios` el gating geo usa MP (AR) / Lemon (resto); Stripe existe pero no es el camino principal de UI. |
| “Modo automático” pendiente | Existe **«Aplicar automáticamente»** por misión vía plugin WP (`wpActions.ts` → `seo_title`/`meta`). No hay job que aplique cambios solo en background. |
| Plugin WP “puede estar en otro repo” | Está **en este repo**: `wordpress-plugin/seo-jump-connector/`. |
| Todo centrado en la web / nada de GBP | **Correcto.** Solo blog `seo-local-negocios.md` + hint de prompt “ciudad en título”. |

Para ejemplos de UI en este informe uso **español neutro** como pidió el prompt de análisis; al implementar habrá que decidir voseo vs neutro (hoy el código es voseo).

---

## Mapa del código relevante (Fase 0)

### Arquitectura general

| Área | Rutas |
|------|--------|
| App Router | `src/app/` — `/`, `/optimizacion`, `/buscador-de-oro`, `/contenido`, `/detective-de-enlaces`, `/espia-competencia`, `/mapa-comprension`, `/precios`, `/perfil`, `/pago/*`, `/blog`, `/comenzar` |
| Server actions | `src/lib/actions.ts` (`"use server"`, archivo grande), `src/lib/wpActions.ts` |
| Dominio puro | `scraping.ts`, `linkAudit.ts`, `humanScore.ts`, `spySnapshot.ts`, `cmsGuide.js`, `missionSafety.js`, `gemini.ts`, `aiInvoke.ts`, `aiCredits.ts`, `planLimits.ts` |
| Auth | `src/auth.ts` — NextAuth Google |
| GSC client | `src/lib/google.js` |
| DB | `src/lib/supabase.ts` + `supabase/migrations/001`–`008` |
| WP plugin | `wordpress-plugin/seo-jump-connector/` |
| Docs / reglas | `architecture.md`, `docs/*` |
| Cron | `vercel.json` = `{}` — **sin cron** |

### API routes (`src/app/api/**`)

Auth, user-state (JSON en disco), geo, comprehension pública, health, pagos (MP / Lemon / Stripe), debug (gemini, gsc, sc, pipeline, supabase, mp, sentry), suggestions.

### Cómo se llama a Gemini

1. Feature → `invokeGeminiWithCredits` (`aiInvoke.ts`)  
2. Créditos/caché → `aiCredits.ts` (`ai_usage_daily`, `ai_usage_monthly`, `ai_response_cache`)  
3. HTTP → `callGeminiREST` (`gemini.ts`) — modelo **`gemini-2.5-flash`**, timeouts ~10–25s.

### OAuth Google / Search Console

| Pieza | Detalle |
|-------|---------|
| Scopes | `openid profile email` + `https://www.googleapis.com/auth/webmasters` (`src/auth.ts`) |
| Tokens | En **JWT de NextAuth** (`accessToken`, `refreshToken`, `accessTokenExpires`) — **no** en Supabase |
| Refresh | `refreshAccessToken()` → `oauth2.googleapis.com/token` |
| Uso | GSC sites + searchAnalytics (+ sitemap). **Sin** Indexing API ni `business.manage` |

### Motor de misiones / XP / “rachas”

| Paso | Dónde |
|------|--------|
| Generación | `getRealMissions` (GSC → on-page); fallback `buildStarterMissions` (scrape) |
| Tipos | `H1` (= Título SEO), `META`, `ALT`, `AEO`, `QUICK_WIN`, `AEO_OPP` |
| Verify en vivo | `verifyMission` / `verifyQuickWin` / `verifyAeoMission` / `verifySpyGap` / `verifyHumanMission` → fetch HTML + extract |
| Progreso | localStorage (XP/completadas) + `/api/user-state` (**antes** archivo efímero en Vercel; migrar a `user_game_state`) + Supabase `user_missions` |
| Rachas | **No implementadas** |

### Espía y Human Score (reutilizable)

- Espía: `spyCompetitor`, `spySnapshot.ts`, tabla `competitors`, UI en Detective/`espia-competencia`. Patrón scrape → snapshot → Gemini gaps → verify.  
- Human Score: `humanScore.ts` + `extractHumanSignals` — score 0–100 determinístico + misiones; verify sin OAuth nuevo.

### Esquema Supabase relevante

`profiles` (plan), `user_missions`, `ai_usage_*`, `ai_response_cache`, `competitors`, `wp_connections`, `agency_sites` (**schema sin uso en app**), `rate_limit_buckets`. RLS: policies `service_role_only_*`; la app usa service role server-side.

### Jobs / límites de tiempo

Sin cron, sin colas. Timeouts típicos: layout 60s, suggestions/pagos 30s, Gemini 25s, Quick Wins ~55s. Un geo-grid 7×7 **no cabe** en un request sincrónico sin orquestación externa o jobs por lotes.

### Gating de planes (`planLimits.ts`)

| Plan | Precio (código) | IA día/mes | Sitios | URLs Espía |
|------|-----------------|------------|--------|------------|
| free | 0 | 2 / 20 | 1 | 3 |
| pro | ARS 39.000 / USD 27 | 12 / 250 | 1 | 15 |
| agency | ARS 150.000 / ~USD 105 | 40 / 800 | 8 | 50 |

Free ve 2 oportunidades; resto paywall. Verify/complete **no** consume créditos IA.

### Estado “modo automático”

Botón por misión + plugin WP (`seojump/v1/apply`) solo `seo_title` | `meta`. No autopilot.

### GBP / local en código

**Ausente** como integración. Presente solo como contenido/blog y un hint de prompt de ciudad en título.

---

## Tabla de encaje (Fase 1)

| # | Pieza | Reutilizar | Construir de cero | Fuente de datos | Esfuerzo | ¿Depende GBP API? |
|---|-------|------------|-------------------|-----------------|----------|-------------------|
| 1 | Diagnóstico perfil 0–100 | Motor misiones + UI de score (Human Score pattern); Gemini credits | Modelo de score local, UI, persistencia | MVP: Places (público) + input manual; V2: GBP API | **M** | No para MVP; Sí para datos privados ricos |
| 2 | Espía local (vs top 3 mapa) | Patrón Espía (`competitors`, snapshot, compare) | Resolución de place_id, SERP Maps, UI mapa | DataForSEO Maps SERP + Reviews; Places como fallback | **L** | No |
| 3 | Circuito de reseñas (QR/WhatsApp/alertas/borradores) | Gemini voz de marca; misiones | Generador link/QR, templates WA, tracking “días sin reseña” | Link público de reseñas (place_id); alertas sin API o con GBP | **S–M** | No (pedidos); Sí (alertas en tiempo real) |
| 4 | Modo mala reseña | Misiones + Gemini | Clasificador de políticas, guía report, simulación promedio | GBP API (reseñas propias) o pegado manual | **M** | Parcial (manual = no) |
| 5 | Temas repetidos → misión | Human Score / clustering simple + Gemini | Pipeline NLP sobre texto de reseñas | Reviews API (propia o DataForSEO) | **M** | Parcial |
| 6 | Ranking geo-grid | Casi nada (no hay jobs) | Grid engine, storage, UI heatmap, billing de créditos | DataForSEO Maps SERP | **L** | No |
| 7 | Cruce web ↔ perfil | Scraping web + WP apply (schema/contacto); misiones | NAP extract, diff, misiones LocalBusiness | Web scrape + Places/GBP | **M** | No para MVP |
| 8 | Visibilidad local en IA | Mapa AEO / prompts Gemini | Protocolo de queries, scoring “¿me nombran?” | Gemini/ChatGPT probes (caro/inestable) o vendors | **L** | No |
| 9 | Métricas Performance (llamadas, directions, clicks) | Plan gating + dashboard simple | Sync + charts + misiones “bajaron las llamadas” | **Solo GBP Performance API** | **M** | **Sí** |

**Esfuerzo:** S ≤ ~1 PR vertical usable; M = varias PRs + schema; L = infra (jobs/créditos) + UX densa.  
**Confianza esfuerzo:** media (fundador + IA; sin equipo).

---

## Modelo de costos (Fase 2)

### Supuestos explícitos (PRO razonable)

- 1 perfil / 1 ubicación  
- 3 keywords × grilla **7×7** × **1 vez/semana** → \(3 × 49 × 4\) = **588** SERPs Maps/mes  
- Reseñas de **3 competidores**, refresh **mensual**, ~50 reseñas c/u → 150 reseñas ≈ 15 bloques de 10  
- 1 “consulta IA local”/día → 30/mes (Gemini flash, ~1k–2k tokens)  
- Gemini adicional: borradores de respuesta / posts (~20/mes)  
- **Sin** Places Enterprise masivo; **sin** live SERP  

### Costo de datos estimado / usuario PRO / mes

| Ítem | Cálculo | USD/mes |
|------|---------|---------|
| Geo-grid DataForSEO Standard | 588 × US$0,0006 | **~0,35** |
| Geo-grid Priority (si se usa) | 588 × 0,0012 | ~0,71 |
| Geo-grid Live (evitar) | 588 × 0,002 | ~1,18 |
| Reviews competidores | 15 × US$0,00075 | **~0,01** |
| Gemini (50 calls flash, orden de magnitud) | depende pricing Google; típico bajo | **~0,05–0,50** |
| GBP API (propia) | cuota, no $/call comercial típico | **~0** |
| Places Details (si se abusa) | Enterprise+/Atmosphere | **riesgo alto** |

**Total datos “PRO con grilla semanal” acotado:** ≈ **US$0,5–2/usuario/mes** si se disciplina caché + standard queue.  
**Confianza:** media (precios DataForSEO citados en el brief; Gemini variable).

### Contra precio objetivo

| Referencia | Precio | Margen de datos |
|------------|--------|-----------------|
| SEO Jump PRO (código) | **USD 27** / **ARS 39.000** | Holgado si el costo de datos &lt; US$2 |
| Localo Single | **US$49**/mes | Ellos absorben más superficie (posts, multi-canal) |
| Local Falcon Starter | US$24,99 por créditos | Solo grilla/IA mentions; no es suite pyme |

**Funciones que disparan costo:** geo-grid live, refresh diario de grilla, Places Atmosphere por cada reseña, probes diarios a ChatGPT vía scraping frágil, agencia × N ubicaciones sin markup.

**Acotaciones:** caché 7 días por celda; cola **standard**; grilla 5×5 en Free/trial; PRO 7×7 semanal; Agency paga por ubicación; no live salvo “actualizar ahora” (crédito extra).

---

## Roadmap (Fase 3)

### MVP — sin GBP API (2–6 semanas de foco, no calendario)

**Entregás**
- Onboarding: “¿Tenés Perfil de Empresa?” + pegar URL de Maps / place  
- Checklist de completitud (categorías, horarios, fotos, descripción) con score 0–100 **orientativo** (Places + lo que el usuario confirma)  
- Circuito de reseñas: link + QR + mensaje WhatsApp **igual para todos** (sin gating)  
- 5–8 misiones locales semanales / por evento, verify: foto subida (manual confirm), texto de descripción pegado, link de reseña enviado (honor system + checklist)  
- Cruce NAP básico: teléfono/dirección scrapados de la web vs lo declarado  

**Tablas nuevas (propuesta)**

```text
local_profiles (
  id uuid pk,
  profile_id uuid → profiles,
  place_id text,
  maps_url text,
  business_name text,
  primary_category text,
  nap_json jsonb,          -- phone, address, hours
  completeness_score int,
  last_public_sync_at timestamptz,
  created_at, updated_at
)

local_missions (
  id uuid pk,
  profile_id uuid,
  local_profile_id uuid,
  mission_key text,        -- review_ask, add_photo, fix_hours, ...
  status text,             -- pending|done|dismissed
  payload jsonb,
  xp_awarded int,
  completed_at timestamptz
)

review_ask_assets (
  id uuid pk,
  local_profile_id uuid,
  review_url text,
  wa_template text,
  qr_path text,
  last_sent_at timestamptz
)
```

**Jobs:** ninguno crítico (todo on-demand).  
**Planes:** feature en PRO; Free = 1 auditoría + QR; no grilla.

### V2 — con GBP API

**Entregás:** OAuth `business.manage` (segundo scope o flujo dedicado), sync reseñas propias, responder desde la app, posts, Performance (llamadas/directions/clicks), alertas “llegó reseña / mala reseña”, borradores con voz.

**Tablas:** `gbp_tokens` (o columnas en `local_profiles` si se acepta guardar refresh aparte del JWT GSC — **recomendado tabla aparte**), `gbp_reviews`, `gbp_posts`, `gbp_metrics_daily`, `review_reply_drafts`.

**Jobs:** sync reseñas cada 6–24h → **hace falta** Vercel Cron + ruta autenticada, o Supabase scheduled + edge, o cola externa. Hoy no existe.

**Planes:** PRO = 1 ubicación; Agency = N ubicaciones (activar `agency_sites` o `local_profiles` multi-row).

### V3 — opcional / solo si el wedge paga

Geo-grid, espía local top-3, temas de reseñas → FAQ web (Human Score), probes de IA local, marca blanca agencia.

**No en V3 temprano:** constructor de web, citas, cross-post FB/IG, MCP marketplace.

---

## Gamificación local (Fase 4)

### ¿Misión diaria sin relleno?

**No.** Acciones locales de alto valor son **semanales o por evento** (llegó reseña, bajó el promedio, 14 días sin reseña). Forzar 1/día inventa tareas (“publicá un post”) que compiten con Localo y cansan.

**Cadencia propuesta**

| Tipo | Cadencia | Ejemplos |
|------|----------|----------|
| Core | **Semanal** | Completar categoría secundaria, 3 fotos, post, pedir reseñas a N clientes |
| Evento | **Push** | Mala reseña, inconsistencia NAP, caída de llamadas |
| Micro | **Opcional diaria** | Solo si hay cola real (responder reseña pendiente) |

### 10 misiones locales + verificación

Ejemplos en **español neutro** (ver nota de voseo arriba):

1. **Completar horario de atención** — Verify: Places/GBP hours no vacíos / usuario confirma captura.  
2. **Elegir categoría primaria correcta** — Verify: category ∈ allowlist del rubro declarado.  
3. **Subir 3 fotos del local o del trabajo** — Verify: manual “ya lo hice” + opcional conteo GBP media.  
4. **Pedir reseña por WhatsApp a un cliente de hoy** — Verify: honor + timestamp `last_sent_at` (no exigir captura de PII del cliente).  
5. **Responder reseñas pendientes (&gt;48h)** — Verify: GBP API `reply` presente.  
6. **Alinear teléfono web ↔ perfil** — Verify: scrape tel web == NAP perfil.  
7. **Crear página de servicio que el perfil ofrece y la web no** — Verify: URL nueva indexable con keyword del servicio.  
8. **Recuperar promedio tras mala reseña** — Verify: N nuevas 5★ o reply publicado + misión educativa.  
9. **Publicar 1 actualización en el perfil esta semana** — Verify: GBP posts timestamp.  
10. **Corregir dirección/área de servicio** — Verify: geocode match o confirmación guiada.

---

## Riesgos y mitigaciones (Fase 5)

| Riesgo | Mitigación |
|--------|------------|
| GBP API 0 QPM / rechazo / semanas | MVP sin API; solicitar acceso ya; no vender “responder reseñas” hasta aprobación |
| ToS Places (caché/almacenamiento) | Guardar lo mínimo; refrescar; no redistribuir tiles; preferir GBP del dueño + DataForSEO contractual |
| DataForSEO / terceros | Contrato + no presentar datos como “oficiales de Google”; TOS review legal ligero |
| Google hace nativo AI replies / Ask Maps | No competir en “responder por responder”; competir en **misiones + web + LatAm price + WA** |
| Timeouts Vercel en grillas | Jobs async, standard queue, 5×5 default, nunca 49 lives en un lambda |
| PII reseñadores / clientes WA | No guardar guiones de clientes; templates sin CRM; minimizar texto de reseñas almacenado |
| Review gating (política abr 2026) | UI sin filtro “solo felices”; copy legal; un solo flujo de pedido |
| Fundador solo + IA | Capar scope; 1 métrica de éxito (reseñas/mes o retención); no abrir Agency white-label primero |

---

## Opinión crítica (Fase 6)

### ¿Conviene?

**Sí, como segunda columna del producto para pymes locales**, no como pivot que abandone GSC/web. El brief de mercado es sólido: reseñas + Maps + IA local importan, y LatAm no tiene un Localo dominante en español rioplatense/LatAm con precio pyme + Mercado Pago.

**No conviene** intentar paridad con Localo/Paige/BrightLocal en un solo trimestre. El código actual **no tiene** la infra (cron, multi-location real, tokens GBP, rachas) para sostener esa promesa.

### ¿Qué NO construiría?

- Constructor de webs / citas / MCP  
- Cross-post a redes  
- Geo-grid como feature de marketing el día 1  
- “ChatGPT te recomienda” como claim principal (frágil, caro, poco verificable)  
- Tablets/kioscos de reseñas o cualquier gating  
- Marca blanca agencia antes de product-market fit en dueños  

### Porción más chica que valida pago

**“Link + QR + WhatsApp de reseña + alerta de X días sin reseña + 3 misiones semanales de perfil”** vendido a 10 detailing/clínicas/restaurantes que ya usan SEO Jump o a un vertical chico. Éxito = usan el QR ≥4 semanas o pagan el add-on/PRO por eso.

### Cómo ganar a Localo en LatAm (más allá del idioma)

1. **Precio + MP** (ARS, factura local).  
2. **Web + perfil en el mismo circuito de misiones** (LocalBusiness, FAQs desde reseñas, Human Score).  
3. **WhatsApp-first** (no SMS US).  
4. **Gamificación verificada** (ya es el ADN; Localo es “Smart Tasks” de panel).  
5. Rubros LatAm con copy y políticas locales (no traducir UI polaca).

---

## Preguntas abiertas para Nahuel

1. ¿El ICP primario sigue siendo **ecommerce/web** (detailing con tienda) o querés pivotar peso a **servicios locales con Maps**?  
2. ¿Mantienen **voseo** (código actual) o pasan a neutro (brief de este análisis)?  
3. ¿Ya tienen (o pueden crear) proyecto Google Cloud **separado** para GBP y están listos a llenar el form de Basic Access?  
4. ¿Presupuesto mensual aceptable de DataForSEO en stage (ej. US$20–50)?  
5. ¿Local es **add-on de PRO**, feature dentro de PRO, o plan “Local” aparte?  
6. ¿Hay vertical de lanzamiento (detailing, odontólogos, talleres) para el QR/WA?  
7. ¿Prioridad vs PRs restantes del incidente web (PR5+)? ¿Local espera a estabilizar misiones web?  
8. ¿Quién pide la reseña hoy en 55 Detail Shop / clientes piloto — y aceptarían un flujo sin filtrar “clientes felices”?

---

## Fuentes de la investigación (del brief; para verificar)

- Localo pricing: https://localo.com/pricing  
- Local Falcon créditos: https://www.localfalcon.com/knowledge-base/kb81-how-much-does-local-falcon-cost-a-complete-guide-to-local-falcons-pricing  
- BrightLocal precios: https://help.brightlocal.com/hc/en-us/articles/12623266931730  
- BrightLocal Review Survey 2026: https://www.brightlocal.com/research/local-consumer-review-survey/  
- DataForSEO grid Maps: https://dataforseo.com/help-center/build-grid-rank-tracker-maps  
- DataForSEO Maps SERP price: https://dataforseo.com/pricing/google-serp/google-maps-serp-api  
- DataForSEO Reviews price: https://dataforseo.com/pricing/business-data/google-reviews-api  
- Places pricing (secundaria): https://www.woosmap.com/blog/google-places-api-pricing  
- GBP API access/quota 0: https://unified.to/blog/how_to_set_up_google_business_profile_api_access_and_get_oauth_2_credentials  
- Review policy Apr 2026: https://launchcodex.com/blog/seo-geo-ai/google-business-profile-review-policy-update/  
- Paige: https://www.getapp.co.uk/software/2083351/paige-1  
- Podium/Birdeye/NiceJob: https://wisernotify.com/blog/podium-alternatives/

**Nota:** este informe no re-verificó en vivo cada URL de precios de terceros; los números de mercado se tomaron del brief del fundador (oct 2026). Los hallazgos de **código** sí se basan en el repo.

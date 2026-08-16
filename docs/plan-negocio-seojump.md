# SEO Jump — Estudio de negocio, costos y plan de límites

**Fecha:** 6 de junio de 2026  
**Proyecto:** SEO Jump (https://seo-jump.ai)  
**Versión:** 1.0

---

## 1. Resumen ejecutivo

SEO Jump es una plataforma gamificada de SEO y AEO (Answer Engine Optimization) para PyMEs y agencias en LATAM. La propuesta: **resultados accionables, no reportes técnicos**.

**Conclusiones principales:**

- La idea de negocio es **viable y rentable** con el modelo freemium propuesto.
- Los costos de infraestructura (Vercel, Gemini, Supabase) son **bajos** si hay límites por usuario y facturación activa en Google.
- El plan gratuito de Gemini **no escala** a miles de usuarios sin optimización; el error 429 es de **cuota**, no de clave inválida.
- Las claves `AQ.` de Google **funcionan** con la app; el formato nuevo es normal en AI Studio.
- Un fundador no programador **puede sostener 50–100 usuarios** con ayuda de IA; para cientos hace falta procesos y posiblemente ayuda puntual.
- Supabase ya tiene `subscription_status: 'free' | 'pro' | 'agency'` — listo para implementar cobro y límites.

---

## 2. Visión del producto

### Propuesta de valor

- Conectar Search Console + sitio web del usuario.
- Detectar oportunidades de tráfico y ventas (Quick Wins).
- Generar misiones concretas de optimización (H1, meta, AEO).
- Gamificar el progreso (XP, niveles, fases).
- Traducir AEO a lenguaje de negocio: "que Google y las IAs te recomienden".

### Público objetivo

| Segmento | Necesidad |
|----------|-----------|
| PyMEs / negocios locales | Más clientes sin aprender SEO |
| E-commerce chico | Optimizar fichas y categorías |
| Agencias | Análisis rápido de clientes con Search Console |

### Diferenciador

Competidores (Semrush, Ahrefs) son potentes pero intimidantes. SEO Jump apunta a **simplicidad + acción + gamificación**.

---

## 3. Modelo de negocio propuesto

### Estructura freemium

1. **Gratis:** 2 consultas IA por día → el usuario prueba valor real.
2. **Pago:** desbloquea más consultas IA y límites ampliados.
3. **Agencia:** plan separado, más sitios, pool compartido de consultas.

### Precios definidos

| Plan | Precio | Público |
|------|--------|---------|
| FREE | $0 | Prueba / conversión |
| PRO | $35.000 ARS/mes (~USD 25) | Dueño de negocio / PyME |
| AGENCIA | $150.000 ARS/mes (~USD 105) | Agencias con varios clientes |

### Cobro

- **Mercado Pago Suscripciones** (ARS, mercado natural).
- Webhook de pago → actualizar `subscription_status` en Supabase.
- Sin pago → volver a `free` automáticamente.
- Agencias: activación manual al inicio o plan MP separado.

---

## 4. Sistema de "Consultas IA"

Unificar todo lo que llama a Gemini en **1 unidad = 1 consulta IA**.

### Cuenta como 1 consulta

| Acción | Función técnica |
|--------|-----------------|
| Cargar Quick Wins | `getQuickWins` |
| "Buscar otras" (Quick Wins) | `getQuickWins` |
| Cargar oportunidades AEO | `getAeoOpportunities` |
| Reintentar AEO | `getAeoOpportunities` |
| Buscador de Oro | `getAIPredictiveSuggestions` |
| Detective de enlaces (si hay problemas + IA) | `auditSiteLinks` |

### NO cuenta (casi gratis)

| Acción | Función técnica |
|--------|-----------------|
| Misiones de optimización | `getRealMissions` (solo GSC) |
| Verificar misión / Quick Win / AEO | `verify*` (fetch HTTP) |
| XP, fases, progreso | Supabase / localStorage |

---

## 5. Tabla de límites por plan (números finales)

### Plan FREE

| Concepto | Límite |
|----------|--------|
| Precio | $0 |
| Consultas IA / día | **2** |
| Consultas IA / mes | **20** |
| Sitios conectados | **1** |
| Misiones + verificación | Ilimitadas |
| Fases (gamificación) | Todas desbloqueables |

### Plan PRO

| Concepto | Límite |
|----------|--------|
| Precio | **$35.000 ARS/mes** |
| Consultas IA / día | **12** |
| Consultas IA / mes | **250** |
| Sitios conectados | **1** |
| Misiones + verificación | Ilimitadas |

### Plan AGENCIA

| Concepto | Límite |
|----------|--------|
| Precio | **$150.000 ARS/mes** |
| Consultas IA / día | **40** (compartidas) |
| Consultas IA / mes | **800** |
| Sitios conectados | **8** |
| Usuarios / seats | 1 login (v1) |

### Comparación rápida

| | FREE | PRO | AGENCIA |
|---|:---:|:---:|:---:|
| Precio/mes | $0 | $35.000 | $150.000 |
| IA / día | 2 | 12 | 40 |
| IA / mes | 20 | 250 | 800 |
| Sitios | 1 | 1 | 8 |
| Costo Gemini est./mes | ~$0.02 | ~$0.25 | ~$1.50 |

### Mensajes cuando se agota el cupo

- **Free:** "Usaste tus 2 consultas gratis de hoy. Volvé mañana o pasate a PRO."
- **PRO:** "Llegaste al límite de hoy (12). Mañana se renuevan."
- **Agencia:** "Usaste las 40 consultas de hoy. Mañana se renuevan."
- **Mes agotado:** "Límite mensual alcanzado. Se renueva el día 1."

**Regla:** misiones y verificación siguen funcionando sin consultas IA.

---

## 6. Economía y unit economics

### Costos de infraestructura (estimados)

| Servicio | Costo mensual (escala moderada) |
|----------|--------------------------------|
| Gemini Flash (pago, con límites) | USD 5–150 según usuarios activos |
| Vercel Pro | ~USD 20 |
| Supabase | USD 0–25 |
| Dominio + email | USD 5–15 |
| **Total** | **USD 30–200/mes** con 50–100 usuarios activos |

### Ingresos vs costos

| Escenario | Ingreso/mes | Costo infra | Margen bruto |
|-----------|-------------|-------------|--------------|
| 10 PRO | ~USD 250 | USD 15–40 | ~85% |
| 50 PRO | ~USD 1.250 | USD 50–120 | ~90% |
| 100 PRO | ~USD 2.500 | USD 150–300 | ~88% |
| 30 PRO + 3 agencias | ~USD 1.065 | USD 80–150 | ~88% |

**Conclusión:** Con USD 25/usuario/mes y límites programados, el costo Gemini por cliente pagador es ~USD 1–5. **El negocio cierra con margen alto.**

### Aclaración sobre "casi gratis hasta miles"

- **Verdad:** Gemini Flash pago es barato por consulta; Vercel/Supabase escalan con costo moderado.
- **Matiz:** El plan **gratuito** de Gemini tiene límites por proyecto/clave (RPM/RPD), no por usuario.
- **Problema actual de la app:** Hasta 6 llamadas Gemini por intento (3 modelos × 2 reintentos), sin caché, sin límite global en Quick Wins/AEO.
- **Resultado:** Con 1 usuario probando mucho ya aparece error 429. No es que la app sea cara; es que **quema cuota rápido**.

---

## 7. Situación técnica: Gemini y Google Cloud

### Claves API

| Formato | Origen | Estado con SEO Jump |
|---------|--------|---------------------|
| `AIzaSy...` | Cloud Console (clásica) | Funciona con `?key=` |
| `AQ....` | AI Studio (nueva) | Funciona con header `x-goog-api-key` |

Google está migrando cuentas nuevas a claves `AQ.` — es normal.

### Proyectos identificados

| Proyecto | ID | Estado facturación |
|----------|-----|-------------------|
| Proyecto principal (usar este) | `gen-lang-client-0918139206` | Prepago Nivel 1 |
| Proyecto nuevo | `gen-lang-client-0588022136` | Nivel gratuito |
| My First Project | — | Solo OAuth SEOJUMPWEB (login), no Gemini |

### Errores observados

| Error | Causa real |
|-------|------------|
| 401 | Clave inválida o método de auth incorrecto |
| 429 | Cuota agotada (free tier o saldo prepago $0) |
| "El análisis tardó demasiado" | Timeout 20s mientras Gemini reintenta con 429 |

### Acciones técnicas pendientes

1. Misma clave `AQ.` en Vercel (`GEMINI_API_KEY`) + redeploy.
2. Cargar USD 25 en cuenta Prepago si 429 persiste tras esperar.
3. Publicar cambios locales sin commitear (Quick Wins, AEO, perfil, privacidad).
4. Verificar migración Supabase `002_add_aeo_opp_mission_type.sql`.
5. Completar verificación Google OAuth para usuarios externos.

---

## 8. ¿Puede un solo fundador sostener la app?

### Por etapa

| Etapa | Usuarios | ¿Solo + IA? |
|-------|----------|-------------|
| Beta | 3–10 | Sí |
| Validación | 20–50 | Sí, con fricción |
| Negocio chico | 50–100 | Al límite |
| Escala | 200–500+ | Necesita procesos y/o ayuda |

### Lo que SÍ puede hacer solo con ayuda IA

- Deploys en Vercel, renovar claves, fixes puntuales, FAQs, mejoras de UX.

### Lo que no escala solo

- Soporte humano ("no veo mis datos en GSC").
- Monitoreo proactivo (alertas si Gemini falla 50 veces/hora).
- Verificación OAuth de Google para muchos usuarios.
- Una agencia con 50 sitios en plan individual.

---

## 9. Optimizaciones técnicas recomendadas

| # | Cambio | Impacto |
|---|--------|---------|
| 1 | 1 modelo (`gemini-2.5-flash`), 1 reintento | −70% llamadas en error |
| 2 | Caché 24h por usuario+sitio+módulo | No repetir análisis |
| 3 | Límites en servidor (Supabase), no localStorage | Anti-abuso |
| 4 | `checkAndConsumeAiCredit()` centralizado | Un solo punto de control |
| 5 | Contador UI: "Consultas IA: 1/2 hoy" | Transparencia |

### Features por costo

| Feature | Costo | ¿Mantener? |
|---------|-------|------------|
| Quick Wins + AEO | Alto (Gemini) | Sí — core |
| Buscador de Oro | Alto | Sí — con límite |
| Cadena 3 modelos | Muy alto en fallos | Reducir |
| Misiones GSC | Bajo | Sí |
| Verificación web | Casi gratis | Sí |

---

## 10. Implementación técnica (checklist)

### Migración Supabase 003 (propuesta)

```
profiles:
  subscription_status: 'free' | 'pro' | 'agency'  (ya existe)
  subscription_expires_at: timestamp

ai_usage_daily:
  email, date, count

ai_usage_monthly:
  email, year_month, count

sites (agencia):
  email, site_url, created_at
```

### Orden de desarrollo

1. Migración 003 — tablas de uso
2. `lib/planLimits.ts` — constantes de planes
3. `checkAndConsumeAiCredit()` en servidor
4. Enchufar en: getQuickWins, getAeoOpportunities, getAIPredictiveSuggestions, auditSiteLinks
5. UI contador + modal upgrade
6. Optimizar Gemini (1 modelo + caché)
7. Página /precios
8. Mercado Pago (fase 2; activación manual PRO al inicio)

### Reglas de negocio

- No trial de 7 días full: los 2/día son el trial permanente.
- Más de 1 sitio → forzar plan Agencia.
- Revisar precio ARS cada trimestre (inflación).
- Emails admin sin límites (`checkIsAdmin`).

---

## 11. Validación de mercado (próximos 30 días)

### Objetivo

Saber si alguien que no es usted usa la app cada semana.

### Pasos

1. Resolver mínimo técnico (clave Vercel, créditos Gemini si hace falta).
2. Publicar fixes locales pendientes.
3. Conseguir 3–5 testers de negocios reales (LATAM).
4. Documentar caso 55detailshop (vinilo líquido, pintura de retoque).
5. Medir: ¿vuelven la semana siguiente?

### Criterio de decisión

- **2 de 3 testers vuelven** → seguir e implementar cobro y límites.
- **Nadie vuelve** → replantear mensaje/problema, no abandonar por costos técnicos.

---

## 12. Decisiones tomadas / pendientes

### Decidido

- [x] Modelo: 2 gratis → pago → límites por plan
- [x] Precio PRO: $35.000 ARS/mes
- [x] Precio Agencia: $150.000 ARS/mes
- [x] Unidad de consumo: "Consulta IA"
- [x] Misiones sin IA: ilimitadas en todos los planes

### Pendiente

- [ ] Implementar límites en código
- [ ] Mercado Pago
- [ ] Cargar créditos Gemini (USD 25) si 429 persiste
- [ ] Publicar cambios locales a producción
- [ ] Migración Supabase 002 (AEO_OPP)
- [ ] Verificación Google OAuth
- [ ] Página de precios

---

## 13. Glosario

| Término | Significado |
|---------|-------------|
| **SEO** | Search Engine Optimization — aparecer en Google |
| **AEO** | Answer Engine Optimization — ser citado por IAs (ChatGPT, Gemini, etc.) |
| **Quick Wins** | Oportunidades de venta en posiciones 8–15 de Google |
| **GSC** | Google Search Console |
| **429** | Error HTTP: demasiadas solicitudes / cuota agotada |
| **Prepago** | Modelo de facturación Google: cargás créditos por adelantado |
| **Consulta IA** | Una llamada a Gemini que consume cupo del usuario |

---

*Documento generado a partir del estudio estratégico de SEO Jump, junio 2026.*

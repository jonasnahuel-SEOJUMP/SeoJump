# Mobbex — SEO Jump (suscripción PRO Argentina)

Guía para cobro mensual de **$39.000 ARS (IVA incluido)** con Mobbex.

---

## Qué necesitás antes de integrar

1. **Cuenta Mobbex** con CUIT activo y CBU/CVU ([mobbex.com](https://www.mobbex.com))
2. **Alta de comercio** — actividad coherente con software/SaaS (puede pedir revisión de la web)
3. Desde **[Consola Mobbex](https://mobbex.com/console)** → credenciales:
   - **API Key** (`MOBBEX_API_KEY`)
   - **Access Token** de la entidad (`MOBBEX_ACCESS_TOKEN`)

Opcional:

- `MOBBEX_SUBSCRIPTION_ID` — ID del plan recurrente si lo creás manualmente en la consola
- `MOBBEX_TEST=true` — marcar suscripciones como test en sandbox

---

## Variables en Vercel (producción)

| Variable | Descripción |
|----------|-------------|
| `MOBBEX_API_KEY` | API Key de la consola |
| `MOBBEX_ACCESS_TOKEN` | Access Token de la entidad |
| `MOBBEX_SUBSCRIPTION_ID` | (Opcional) Plan PRO ya creado en Mobbex |
| `NEXTAUTH_URL` | `https://seo-jump.ai` |

Local (`.env.local`):

```
MOBBEX_API_KEY=tu_api_key
MOBBEX_ACCESS_TOKEN=tu_access_token
NEXTAUTH_URL=http://localhost:3000
```

> En local, los callbacks de suscripción usan `https://seo-jump.ai` porque Mobbex no acepta `localhost` (igual que MP).

---

## Webhook

Mobbex envía eventos al URL configurado al **crear el plan de suscripción**:

`https://seo-jump.ai/api/mobbex/webhook`

La app lo setea automáticamente al crear el plan PRO. Verificá en consola Mobbex que el dominio esté permitido.

---

## Flujo en el código

```
Usuario → POST /api/mobbex/subscribe
       → crear/buscar plan PRO en Mobbex
       → crear suscriptor (reference: seojump|pro|email@google)
       → checkoutUrl → redirect Mobbex
       → pago OK → webhook /api/mobbex/webhook
       → updateSubscriptionPlan(email, 'pro') en Supabase
       → redirect /pago/exito + sync backup POST /api/mobbex/sync
```

Archivos:

- `src/lib/mobbex.ts`
- `src/app/api/mobbex/subscribe/route.ts`
- `src/app/api/mobbex/webhook/route.ts`
- `src/app/api/mobbex/sync/route.ts`
- `src/components/SubscribeProButton.js`

---

## Probar

1. Credenciales en `.env.local`
2. `npm run dev`
3. `/precios` → **Quiero PRO — Mobbex**
4. Completar pago en checkout Mobbex
5. Verificar PRO en **Perfil**

La guía operativa está en `docs/mobbex-setup.md`. El esquema técnico completo en `docs/mobbex-api-schema.md`.

Plan Essential Mobbex: ~1,9% débito / 2,6% crédito + IVA ([mobbex.com/planes](https://www.mobbex.com/planes)). Confirmar con tu ejecutivo.

---

*Última actualización: Junio 2026*

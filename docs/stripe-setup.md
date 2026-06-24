# Stripe Setup — SEO Jump

Guía paso a paso para configurar Stripe en SEO Jump (pagos internacionales en USD).

## Resumen de arquitectura

```
Usuario fuera de AR → /precios → botón Stripe → /api/stripe/subscribe
                                                → Stripe Checkout (hosted)
                                                → Stripe webhook → /api/stripe/webhook
                                                → updateSubscriptionPlan(email, 'pro')
```

---

## 1. Crear cuenta Stripe

1. Ir a https://stripe.com → "Start now"
2. Completar el registro con el email de SEO Jump (`cobros@seo-jump.ai` o similar)
3. Completar el perfil de negocio (nombre, tipo, país)
4. Activar cuenta real (requiere datos bancarios para recibir pagos)

> **Importante:** Stripe no acepta cuentas de personas físicas en Argentina directamente.
> Opciones:
> - Empresa constituida en **Uruguay, Chile o USA** → usar esa entidad
> - Usar **Stripe Atlas** (~$500 USD, crea empresa en Delaware, USA)
> - Partner intermediario: **dLocal, Prometeo, PayRetailers** (para cobrar sin entidad extranjera)
>
> Para empezar, podés usar **modo test** sin restricciones.

---

## 2. Crear el producto y precio en Stripe

1. Dashboard → **Catalog → Products** → "Add product"
2. Nombre: `SEO Jump PRO`
3. Pricing:
   - Type: **Recurring**
   - Amount: `27.00 USD`
   - Billing period: **Monthly**
4. Guardar → copiar el **Price ID** (empieza con `price_...`)

---

## 3. Variables de entorno

### En `.env.local` (desarrollo)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### En Vercel (producción)

Ir a Vercel → tu proyecto → **Settings → Environment Variables** y agregar:

| Variable | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (Stripe Dashboard → Developers → API keys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (ver paso 4) |
| `STRIPE_PRO_PRICE_ID` | `price_...` (el que copiaste en paso 2) |
| `NEXT_PUBLIC_APP_URL` | `https://seo-jump.ai` |

---

## 4. Configurar webhook en Stripe

1. Dashboard → **Developers → Webhooks** → "Add endpoint"
2. URL: `https://seo-jump.ai/api/stripe/webhook`
3. Seleccionar eventos:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `invoice.payment_failed`
4. Guardar → copiar **Signing secret** (`whsec_...`) → pegarlo en `STRIPE_WEBHOOK_SECRET`

### Para testing local (Stripe CLI)

```bash
# Instalar Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Esto imprime un `whsec_...` temporal para usar en desarrollo.

---

## 5. Verificar integración (modo test)

1. Agregar variables de **test** en `.env.local`
2. `npm run dev`
3. Ir a `/precios` desde un navegador fuera de Argentina (o cambiar manualmente al toggle USD)
4. Click "Get PRO — Stripe" → te redirige al Stripe Checkout
5. Usar tarjeta de test: `4242 4242 4242 4242` / cualquier fecha / cualquier CVC
6. Verificar que el webhook activa el plan en Supabase (`profiles.subscription_status = 'pro'`)

---

## 6. Precios configurados

| Plan | ARS (Mobbex) | USD (Stripe) |
|---|---|---|
| Gratis | $0 | $0 |
| PRO | $39.000/mes | $27/mes |
| Agencia | $150.000/mes | $105/mes |

---

## 7. Flujo completo

### Checkout exitoso
`Stripe → POST /api/stripe/webhook → event: checkout.session.completed`
→ `updateSubscriptionPlan(email, 'pro', expiresAt)` en Supabase
→ usuario ve plan PRO activado en SEO Jump

### Cancelación
`Stripe → POST /api/stripe/webhook → event: customer.subscription.deleted`
→ `updateSubscriptionPlan(email, 'free', null)` en Supabase

### Renovación mensual
`Stripe → POST /api/stripe/webhook → event: customer.subscription.updated (status=active)`
→ `updateSubscriptionPlan(email, 'pro', newExpiresAt)` en Supabase

---

## 8. Archivos clave

| Archivo | Descripción |
|---|---|
| `src/lib/stripe.ts` | Cliente Stripe + helpers (checkout, webhook verify, email extract) |
| `src/app/api/stripe/subscribe/route.ts` | Crea Stripe Checkout Session |
| `src/app/api/stripe/webhook/route.ts` | Maneja eventos Stripe → actualiza Supabase |
| `src/app/api/geo/route.ts` | Detecta país del usuario (header Vercel) |
| `src/components/StripeCheckoutButton.js` | Botón cliente para iniciar checkout |
| `src/app/precios/page.js` | Página de precios con detección de país AR/Internacional |

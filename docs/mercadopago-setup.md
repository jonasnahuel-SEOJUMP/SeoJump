# Mercado Pago — SEO Jump (suscripción PRO)

Guía paso a paso para conectar cobro mensual de **$39.000 ARS (IVA incluido)** con Mercado Pago.

---

## ¿Es lo mismo que 55 Detail Shop?

**No es el mismo producto de integración**, aunque uses el **mismo CUIT**:

| 55 Detail Shop (ecommerce) | SEO Jump (SaaS) |
|----------------------------|-----------------|
| Checkout Pro / preferencia de pago única | **Suscripciones** (`/preapproval`) |
| El cliente paga una compra | El cliente se **suscribe** y se cobra **cada mes** |
| Plugin o botón en la web | API + webhook en Next.js |

En Mercado Pago Developers conviene crear una **aplicación nueva** para SEO Jump (misma cuenta de vendedor, otra integración). Así separás credenciales, webhooks y actividad de software vs. retail.

---

## Paso 1 — Crear aplicación en Mercado Pago Developers

1. Entrá a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app)
2. **Crear aplicación**
3. Nombre: `SEO Jump`
4. Modelo de integración: **Suscripciones** (o Pagos online si no aparece Suscripciones)
5. Guardá el **Access Token de producción** (empieza con `APP_USR-`)

> Usá credenciales de **producción** solo cuando pruebes con plata real. Para pruebas, MP ofrece usuarios de test en la doc.

---

## Paso 2 — Variables en Vercel (proyecto `seojump`)

En [Vercel → seojump → Settings → Environment Variables](https://vercel.com):

| Variable | Valor | Entorno |
|----------|--------|---------|
| `MP_ACCESS_TOKEN` | `APP_USR-...` (producción) | Production |
| `MP_WEBHOOK_SECRET` | Secret de Webhooks en MP Developers | Production |
| `ADMIN_EMAILS` | `jonasnahuel@gmail.com` | Production |

Opcional para pruebas locales en `.env.local`:

```
MP_ACCESS_TOKEN=APP_USR-...
MP_WEBHOOK_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

**Redeploy** después de agregar las variables.

---

## Paso 3 — Webhooks en Mercado Pago

En tu app **SEO Jump** en Developers:

1. Menú **Webhooks → Configurar notificaciones**
2. **URL producción:**  
   `https://seo-jump.ai/api/mercadopago/webhook?source_news=webhooks`
3. Eventos a activar:
   - **Planes y suscripciones** → `subscription_preapproval`
   - **Planes y suscripciones** → `subscription_authorized_payment`
   - **Pagos** → `payment` (opcional, backup)
4. Guardar y copiar el **Secret signature** → pegarlo en `MP_WEBHOOK_SECRET` en Vercel

La app también envía `notification_url` al crear cada suscripción (doble vía).

---

## Paso 4 — Probar el flujo

1. Entrá a `https://seo-jump.ai/precios` (logueado)
2. Clic en **Quiero PRO — Mercado Pago**
3. Completá el pago en el checkout de MP
4. Volvés a `/pago/exito` → la app sincroniza y activa PRO en Supabase
5. Verificá en **Perfil** que diga plan PRO

Si PRO no aparece al instante, el webhook o `/api/mercadopago/sync` lo activa en segundos.

---

## Paso 5 — Facturación (contadora)

- Precio mostrado: **$39.000 final con IVA incluido**
- Actividad separada de 55 Detail Shop (mismo CUIT, otra rubrica/actividad)
- Facturá cada cobro mensual según indique tu contadora (RI + IIBB)

Mercado Pago te da reportes de cobros; exportalos para la contabilidad.

---

## Cómo funciona en el código

```
Usuario → POST /api/mercadopago/subscribe
       → MP API POST /preapproval (status: pending)
       → init_point → checkout MP
       → pago OK
       → webhook subscription_preapproval (authorized)
       → updateSubscriptionPlan(email, 'pro') en Supabase
       → redirect /pago/exito + sync backup
```

Archivos principales:

- `src/lib/mercadopago.ts` — API MP
- `src/app/api/mercadopago/subscribe/route.ts` — inicia checkout
- `src/app/api/mercadopago/webhook/route.ts` — activa / baja plan
- `src/app/api/mercadopago/sync/route.ts` — backup post-pago
- `src/components/SubscribeProButton.js` — botón en UI

---

## Plan Agencia

Sigue siendo **manual** (mail o panel admin) hasta integrar un segundo plan en MP.

---

## Troubleshooting

| Problema | Qué revisar |
|----------|-------------|
| "MP_ACCESS_TOKEN no configurado" | Variable en Vercel proyecto **seojump** + redeploy |
| Botón no redirige | Consola del navegador + logs Vercel en `/api/mercadopago/subscribe` |
| Pagó pero sigue Free | Webhook en MP, `MP_WEBHOOK_SECRET`, logs en `/api/mercadopago/webhook` |
| Error 401 webhook | Secret incorrecto o desactualizado |

---

*Última actualización: Junio 2026*

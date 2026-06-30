# Mejoras pendientes — SEO Jump

Lista de ideas y mejoras para implementar. Consultar este archivo cuando preguntes *"¿qué nos quedó pendiente?"*.

---

## Espía de la Competencia — marketing y visibilidad

### Hecho ✅
- Feature en `/detective-de-enlaces` (pestaña Espía, Fase 4)
- Landing: barra superior, card de beneficio, misión gamificada (`10fb3d2`)
- `/precios`: feature listada + nota de créditos IA
- Post Semrush actualizado con Espía, tabla corregida, FAQ nueva (`Jun 2026`)
- Banner en home para usuarios con Fase 4 (o admin) → link directo `?view=spy`
- Deep link `?view=spy` en Detective abre pestaña Espía

### Pendiente 📋
| Prioridad | Tarea | Notas |
|-----------|-------|-------|
| Alta | **Post blog dedicado** | ✅ `como-espiar-competencia-google-sin-semrush.md` (18 Jun 2026) |
| Media | **Landing `/espia-competencia`** | ✅ Hero Espía en home + ruta `/espia-competencia` para ads (Jun 2026) |
| Media | **Renombrar botón Fase 4** | Ej. *"Detective + Espía"* en nav del home |
| Baja | **Copy para Google Ads / redes** | *"Pegá la web de tu rival. Te decimos qué hace mejor — sin Semrush."* |
| Producto | **Desbloqueo temprano del Espía** | Evaluar si el Espía debería estar antes de completar Fase 3 (decisión de producto) |
| UX | **Banner dismissible** | localStorage para no mostrar siempre el banner del home |

---

## Pagos e internacional

### Pendiente 📋
| Tarea | Estado |
|-------|--------|
| **Mercado Pago AR** — `MP_ACCESS_TOKEN` renovado en Vercel + webhook | Usuario confirmó billing.allow en cuenta cobros@ |
| **Plan B MP** | Token cuenta vieja 55 Detail Shop |
| **Lemon Squeezy + Payoneer** (Fase 1 internacional, MoR) | Pausado unos días |
| **Stripe + LLC** | Cuando escale facturación internacional |

---

## Detective de Enlaces (Fase 4)

### Crawl progresivo por sesión
**Idea:** hoy el Detective analiza siempre las mismas 5 páginas desde cero. La mejora consiste en que cada sesión avance a páginas que todavía no vio, de modo que con el tiempo cubra todo el sitio.

**Cómo funcionaría:**
1. Primera sesión → analiza homepage + primeras 4 páginas
2. Segunda sesión → salta las ya analizadas, avanza a las siguientes 5
3. Así hasta cubrir todo el sitio de a poco
4. El usuario puede forzar un re-análisis de una URL ya vista si la corrigió

**Dónde guardar el estado:** Supabase (por usuario + siteUrl) o localStorage como fallback.

**Prioridad:** Media — implementar después de la verificación de Google.

---

*Última actualización: 18 Jun 2026*

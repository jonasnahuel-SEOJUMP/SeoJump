# Mejoras pendientes — SEO Jump

Lista de ideas y mejoras para implementar una vez que la app esté verificada y con usuarios reales.

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

*Última actualización: Junio 2026*

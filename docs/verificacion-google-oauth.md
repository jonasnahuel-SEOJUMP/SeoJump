# Verificación de Google OAuth — Guía simple

Esta guía te ayuda a pedirle a Google que apruebe SEO Jump para que cualquier persona pueda entrar con su cuenta de Google (sin la pantalla amarilla de “app no verificada”).

**Tiempo del trámite:** suele tardar 2 a 6 semanas. Podés empezar hoy.

---

## Paso 1 — Revisar la pantalla de consentimiento

Entrá a: [Google Cloud Console](https://console.cloud.google.com/) → **APIs y servicios** → **Pantalla de consentimiento de OAuth**

Completá estos campos:

| Campo | Qué poner |
|-------|-----------|
| Nombre de la app | `SEO Jump` |
| Correo de asistencia | `nahuel@seo-jump.ai` |
| Logo | El búho de SEO Jump (mismo que en la web) |
| Dominio de la app | `seo-jump.ai` |
| Página de inicio | `https://seo-jump.ai` |
| Política de privacidad | `https://seo-jump.ai/privacidad` |
| Condiciones del servicio | `https://seo-jump.ai/terminos` |

**Dominios autorizados** (en el cliente OAuth y en la pantalla de consentimiento):

- `seo-jump.ai`
- `seojump.ai` (si lo usás)
- `vercel.app` (para previews, opcional)

---

## Paso 2 — Grabar el video demo

Google casi siempre pide un video. No tiene que ser perfecto: 3 a 5 minutos, grabado con el celular o con Loom/OBS.

**Subilo a YouTube como “No listado”** y pegá el link en el formulario.

### Guion (leé en voz alta mientras grabás)

1. **Inicio (10 seg)**  
   *“Hola, soy Nahuel. Esta es SEO Jump, una app que ayuda a dueños de negocios a mejorar su visibilidad en Google usando datos reales de Search Console.”*  
   Mostrá: `https://seo-jump.ai`

2. **Login (30 seg)**  
   *“El usuario entra con su cuenta de Google.”*  
   Clic en **Empezar** → **Iniciar sesión con Google** → mostrá la **pantalla de consentimiento de Google** (donde pide acceso a Search Console).

3. **Para qué pedimos el permiso (40 seg)**  
   *“Pedimos acceso a Search Console solo para leer las métricas del sitio del usuario: clics, impresiones, palabras clave y URLs. Con eso generamos misiones diarias de SEO.”*  
   Mostrá el panel con misiones y números (clics, impresiones, posición).

4. **Inteligencia artificial (20 seg)**  
   *“Las sugerencias de títulos y textos las genera Google Gemini. Solo enviamos datos del sitio del usuario para darle una recomendación concreta. No vendemos datos ni los usamos para publicidad.”*  
   Mostrá una misión con el badge **“Generada con IA”**.

5. **Indexación — acción opcional del usuario (30 seg)**  
   *“En una función específica, si el usuario lo pide, enviamos su sitemap a Google para pedir indexación. El usuario siempre inicia esa acción; nosotros no modificamos su sitio ni su propiedad en Search Console.”*  
   Mostrá **Detective de enlaces** o la parte de **Solicitar indexación** (si tenés una web de prueba conectada).

6. **Privacidad y borrado (30 seg)**  
   *“El usuario puede ver nuestra política de privacidad en seo-jump.ai/privacidad.”*  
   Abrí `/privacidad` en otra pestaña.  
   *“Puede revocar el acceso en myaccount.google.com/permissions, o borrar su cuenta desde Perfil en la app.”*  
   Mostrá **Perfil** → botón de eliminar cuenta (no hace falta borrarla de verdad).

7. **Cierre (10 seg)**  
   *“Eso es todo. SEO Jump usa los datos de Google únicamente para las funciones que el usuario ve en pantalla. Gracias.”*

---

## Paso 3 — Textos para copiar y pegar en el formulario

### ¿Para qué usa tu app los datos de Google?

```
SEO Jump es una herramienta de optimización SEO para dueños de negocios.

Usamos el scope de Google Search Console (webmasters) para:

1. LEER (solo lectura): clics, impresiones, consultas de búsqueda, posiciones y URLs del sitio que el usuario conecta. Con eso mostramos métricas y generamos misiones de optimización personalizadas.

2. ESCRIBIR (solo cuando el usuario lo pide): enviar el sitemap del sitio para solicitar indexación en Google. Esta acción la inicia el usuario desde la función "Detective de enlaces"; no modificamos la propiedad del dominio ni el contenido del sitio en Search Console.

Los datos se usan únicamente para las funciones visibles en la app. No vendemos, alquilamos ni compartimos datos de Google con terceros para publicidad. Cumplimos la Política de Datos de Usuario de los Servicios API de Google (Limited Use).

Política de privacidad: https://seo-jump.ai/privacidad
```

### ¿Por qué necesitás el scope `webmasters` y no solo lectura?

```
Necesitamos el scope webmasters porque además de leer métricas de Search Console, ofrecemos una función opcional donde el usuario puede solicitar la indexación de su sitio enviando su sitemap. Esa acción la dispara el usuario manualmente; no ocurre en segundo plano.

El resto del uso es de lectura: analizar rendimiento orgánico y generar recomendaciones SEO en el panel del usuario.
```

### ¿Cómo puede el usuario revocar el acceso?

```
1. En Google: https://myaccount.google.com/permissions — quitar permiso a SEO Jump.
2. En la app: Perfil → "Eliminar mi cuenta y borrar mis datos".
3. Por email: nahuel@seo-jump.ai desde el mismo correo con el que se registró.
```

---

## Paso 4 — Enviar la solicitud

1. En Google Cloud → **Pantalla de consentimiento** → **Publicar app** o **Enviar para verificación**.
2. Marcá el scope: `https://www.googleapis.com/auth/webmasters`
3. Pegá el link del video de YouTube.
4. Pegá los textos de arriba donde te los pidan.
5. Enviá y esperá el mail de Google (pueden pedir aclaraciones; respondé con calma y en español o inglés).

---

## Paso 5 — Después de que aprueben

1. En Vercel, **sacá o ampliá** `ALLOWED_EMAILS` — si solo está tu mail, nadie más podrá entrar aunque Google apruebe.
2. Pasá la app de **Testing** a **Production** en la pantalla de consentimiento.
3. Probá el login con una cuenta de Google que **no** esté en la whitelist, para confirmar que funciona.

---

## Checklist rápido

- [ ] Pantalla de consentimiento completa (nombre, logo, URLs, email)
- [ ] Video demo subido a YouTube (no listado)
- [ ] Formulario enviado con textos de arriba
- [ ] `nahuel@seo-jump.ai` funciona (Google puede escribirte ahí)
- [ ] Después de aprobar: quitar whitelist y pasar a Production

---

*Última actualización: Junio 2026*

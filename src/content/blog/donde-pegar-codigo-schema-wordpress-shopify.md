---
title: "Dónde pegar el código Schema: WordPress (bloques, clásico, Elementor), Shopify y errores típicos"
description: "Guía práctica para dueños de negocio: dónde pegar el código que genera SEO Jump según tu editor. Gutenberg vs Editor clásico vs maquetadores (Flatsome, Elementor) vs Shopify. Errores que rompen la home."
date: "2026-07-19"
dateModified: "2026-07-19"
readTime: "9 min"
author: "Equipo SEO Jump"
---

# Dónde pegar el código Schema (sin volverte loco)

Si SEO Jump te dio un código para pegar y te trabaste buscando las pestañas **Visual** y **Código**, no estás solo. Es el error más común cuando alguien prueba el [Mapa de comprensión](/mapa-comprension) en la página de inicio.

Este artículo responde una sola pregunta, bien a fondo:

> **¿Dónde pego este código en MI web?**

Si todavía no entendés *para qué* sirve el Schema (datos estructurados), leé primero: [Schema no hace magia: lo que Google y las IA necesitan es entender tu página](/blog/schema-no-hace-magia-mapa-comprension-ia).

---

## Qué estás pegando (en una frase)

Es un bloque técnico invisible. **No cambia cómo se ve tu página.** Solo le explica a Google y a las IA, en su idioma, de qué trata *esa* URL.

La regla de oro:

**El código de una página se pega solo en esa página.** No en el header global de todo el sitio. No en otra URL. No en `theme.liquid` “porque es más fácil”.

---

## Por qué la home no se edita igual que un producto

En WordPress es muy habitual esto:

- Un **producto** de WooCommerce se edita con el **Editor clásico** (pestañas Visual / Texto o Código).
- La **página de inicio** se armó con el **Editor de bloques (Gutenberg)** o con un **maquetador** (Elementor, Divi, Flatsome / UX Builder, shortcodes tipo `[ux_banner]`).

Si SEO Jump te muestra instrucciones del editor clásico y usted está en la home, **no vas a encontrar esas pestañas**. No es que “falló el código”: estás mirando el editor equivocado.

En el Mapa de comprensión ahora hay **pestañas** para elegir el editor correcto antes de copiar.

---

## Opción A — WordPress: Editor de bloques (Gutenberg)

**Cómo reconocerlo:** al editar la página ves un botón **+** para agregar bloques. No hay pestañas Visual/Código arriba del texto.

**Pasos:**

1. Abrí **la misma página** que analizaste (incluida la home) → **Editar**.
2. Bajá hasta el **final del contenido**.
3. Tocá **+** (Añadir bloque).
4. Buscá **HTML personalizado** (o escribí `/html`).
5. Pegá el código de SEO Jump **tal cual**.
6. **Actualizar** / **Publicar**. Si tenés caché, borrala.
7. Volvé a SEO Jump y tocá **Ya lo pegué**.

---

## Opción B — WordPress: Editor clásico

**Cómo reconocerlo:** arriba del contenido aparecen **Visual** y **Texto** (o **Código**).

**Pasos:**

1. Abrí la misma página o producto → **Editar**.
2. Usá el editor del **contenido principal** (en productos, no la “descripción corta”).
3. Cambiá a **Texto** / **Código**.
4. Al final, pegá el código completo.
5. **Actualizar**, borrá caché, y verificá en SEO Jump.

Si no ves Visual/Código, **no fuerces esta opción**: cambiá a Bloques o Maquetador.

---

## Opción C — Elementor, Divi, Flatsome / UX Builder u otro maquetador

**Cómo reconocerlo:**

- Botón “**Editar con Elementor**”, Divi, UX Builder, etc.
- O en el contenido aparecen shortcodes tipo `[ux_banner]`, `[ux_slider]`, etc. (muy común en temas Flatsome).

**Pasos (idea general):**

1. Abrí esa página con el constructor visual.
2. Agregá un elemento **HTML** / **Código** / código personalizado (no un texto normal).
3. Pegá el código de SEO Jump.
4. Publicá solo en **esa** página o plantilla asignada a esa URL.

**Cuidado:** si editás una **plantilla global** usada por muchos productos, el mismo Schema se va a repetir con datos incorrectos. Pegá solo donde corresponde esa URL.

---

## Opción D — Shopify

1. **Tienda online → Temas → Personalizar**.
2. Abrí el tipo de página analizada (producto, página, artículo).
3. Si la plantilla se comparte, creá una **plantilla nueva** y asignala solo a esa página.
4. **Agregar sección → Liquid personalizado** y pegá el código.

**No** pegues un Schema de un producto en `theme.liquid`: puede aparecer en todo el sitio.

---

## Errores típicos (y cómo evitarlos)

| Error | Qué pasa |
| --- | --- |
| Buscar Visual/Código en una home con Gutenberg | Te trabás; usá bloques o maquetador |
| Pegar en la descripción corta del producto | El código no queda donde Google lo espera |
| Pegar en el header/footer global | Se mezcla con otras páginas |
| Pegar en `theme.liquid` (Shopify) | Se publica en todo el sitio |
| No borrar la caché | SEO Jump no ve el cambio al verificar |
| Usar el código de la home en un producto (o al revés) | Datos incorrectos para esa URL |

---

## Cómo lo hace SEO Jump (sin jerga)

1. Analizás una URL en el **Mapa de comprensión**.
2. Ves qué entiende (y qué no) una IA de esa página.
3. Si hace falta, te damos el código listo.
4. Elegís la **pestaña de tu editor** y seguís los pasos.
5. Tocás **Ya lo pegué** y comprobamos que el código esté publicado.

No necesitás saber qué es `@context` ni `FAQPage`. Solo pegar en el lugar correcto.

---

## Probá ahora

Pegá tu URL y descubrí qué entienden Google y las IA de tu página — gratis:

→ [Mapa de comprensión](/mapa-comprension)

¿Arrancás de cero? Empezá desde la [app SEO Jump](/) y seguí las misiones del Búho paso a paso.

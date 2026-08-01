---
title: "Cómo conectar WordPress a SEO Jump (plugin + Aplicar en mi web)"
description: "Guía paso a paso: descargar el ZIP del plugin, subirlo en WordPress, pegar el token y usar «Aplicar en mi web» para título SEO y meta. Qué se copia, qué se sube y qué hacer si perdiste el token."
date: "2026-08-01"
dateModified: "2026-08-01"
readTime: "6 min"
author: "SeoJump"
---

**Resumen:** SEO Jump puede escribir por vos el **título SEO** y la **meta descripción** en tu WordPress (vía Yoast o Rank Math). Para eso instalás un plugin chiquito y pegás un token. El plugin se **sube como archivo ZIP**; el token es lo único que se **copia y pega**.

## Qué hace (y qué no hace)

Con la conexión activa, en las misiones de título y meta aparece el botón **«Aplicar en mi web»**. Un clic guarda el texto sugerido en Yoast SEO o Rank Math.

| Sí hace | No hace |
|---------|---------|
| Título SEO (el de Google) | Cambiar el nombre del producto/página |
| Meta descripción | Tocar precios, stock o el diseño |
| Solo en la URL de la misión | Crear usuarios ni tocar otros plugins |

Necesitás **Yoast SEO** o **Rank Math** instalado (casi todas las tiendas ya lo tienen).

## Importante: no se “pega” el plugin

En WordPress **no hay un campo para pegar el plugin**. Hay dos cosas distintas:

1. **El plugin** = archivo `seo-jump-connector.zip` → lo **descargás** y lo **subís** en Plugins → Subir plugin.
2. **El token** = código que empieza con `sj_` → lo **copiás** en SEO Jump y lo **pegás** en Ajustes → SEO Jump.

Si intentás “pegar el plugin” y WordPress te pide un archivo: es correcto. Tenés que elegir el `.zip` de Descargas.

## Paso a paso

### 1. En SEO Jump → Perfil

1. Tocá tu foto (arriba a la derecha) → **Perfil**.
2. Buscá el bloque **Conectar WordPress**.
3. Escribí la URL de tu tienda (ej. `https://tutienda.com`).
4. Tocá **Generar token**.
5. **Copiá el token ahora** (se muestra completo una sola vez en esa pantalla).
6. Descargá el link **seo-jump-connector.zip**.

¿Cerraste sin copiar el token? No pasa nada: tocá **Regenerar token** y usá el nuevo.

### 2. En WordPress → instalar el plugin

1. Entrá a **wp-admin**.
2. Menú **Plugins → Añadir nuevo**.
3. Arriba: **Subir plugin**.
4. **Elegir archivo** → seleccioná `seo-jump-connector.zip` de tu carpeta Descargas.
5. **Instalar ahora** → **Activar**.

### 3. En WordPress → pegar el token

1. Menú **Ajustes → SEO Jump**.
2. Pegá el token (`sj_…`) en el campo.
3. **Guardar token**.
4. Revisá que diga que detectó Yoast o Rank Math.

### 4. Volvé a SEO Jump → verificar

1. Perfil → **Verificar conexión**.
2. Tiene que aparecer **WordPress conectado** en verde.

### 5. Usar «Aplicar en mi web»

1. Abrí una misión de **título** o **meta** (con sugerencia lista).
2. Tocá **Aplicar en mi web** (si no estás conectado, te manda a Perfil).
3. Vaciá la caché del sitio si usás WP Rocket / LiteSpeed / similar.
4. En SEO Jump tocá **Verificar** la misión para confirmar que Google (y el Búho) ya leen el cambio.

Podés aplicar **muchas veces** en distintas páginas. No es de un solo uso.

## El token “una sola vez”: qué significa

- **Una sola vez** = esa pantalla te muestra el código completo; si recargás, ya no lo vuelve a mostrar entero (por seguridad).
- **No** significa que perdiste el conector si no lo pegaste.
- Solución: **Regenerar token** → pegar el nuevo en WordPress → Verificar de nuevo.
- El botón **Aplicar en mi web** se puede usar todas las veces que quieras una vez conectado.

## Problemas frecuentes

**«WordPress me pide subir un archivo»**  
Es normal. Subí el `.zip`. No pegues el plugin en ningún lado.

**«No encuentro Ajustes → SEO Jump»**  
El plugin no está activado. Plugins → SEO Jump Connector → Activar.

**«Falta Yoast o Rank Math»**  
Instalá uno de los dos. Sin eso el plugin no puede guardar título/meta automático (igual podés copiar la sugerencia a mano).

**«Verificar conexión falla»**  
Revisá que el token esté guardado, que el sitio sea la misma URL, y que la web sea pública (no solo localhost).

**«Apliqué pero Verificar la misión falla»**  
Vacía caché del hosting/CDN y esperá unos segundos. El plugin ya guardó; la verificación lee la página pública.

## ¿Es seguro?

El plugin solo permite cambiar título SEO y meta con tu token. No crea administradores ni modifica el diseño. Si sospechás que alguien vio el token, regeneralo y desconectá desde Perfil.

---

¿Listo para conectar? Andá a [Perfil → Conectar WordPress](/perfil#wp-connect) o arrancá por las [misiones](/).

También te puede servir: [la misión del H1](/blog/mision-del-h1) y [dónde pegar Schema en WordPress](/blog/donde-pegar-codigo-schema-wordpress-shopify).

---
title: "Cómo conectar SEO Jump a WordPress sin enredarte con el token y el plugin"
description: "El error más común: confundir el ZIP del plugin con el token. Qué se sube, qué se pega, qué significa «una sola vez» y cómo usar Aplicar en mi web todas las veces que haga falta."
date: "2026-08-01"
dateModified: "2026-08-04"
readTime: "5 min"
author: "SeoJump"
---

Una de las dudas más frecuentes al vincular SEO Jump con tu sitio de WordPress es entender **qué se sube**, **qué se pega** y qué significa eso de que el token se ve **"una sola vez"**. Vamos a aclararlo paso a paso para que lo dejes andando en dos minutos.

## El error más común: ¿El token se pega en WordPress?

**No.** El token (ese código largo que empieza con `sj_…`) **no se pega en el instalador de plugins**.

- **El plugin (`seo-jump-connector.zip`) se sube:** es un archivo que descargás desde tu Perfil de SEO Jump y se instala en WordPress como cualquier otro plugin (`Plugins → Añadir nuevo → Subir plugin`).
- **El token (`sj_…`) se pega después:** una vez que el plugin de SEO Jump ya está instalado y activo, vas a **Ajustes → SEO Jump** y es **ahí adentro** donde pegás el token para autorizar la conexión.

Si WordPress te pide “elegir un archivo”, es correcto: está pidiendo el **ZIP**, no el código.

## ¿Qué significa que el token se muestra “una sola vez”?

Cuando hacés clic en **Generar token**, SEO Jump te muestra el código completo en pantalla por única vez. Si recargás la página, cerrás la pestaña o volvés otro día, por seguridad ya no se vuelve a mostrar entero (en la base queda cifrado y en tu perfil solo vas a ver algo abreviado como `sj_ab12…x9`).

- **¿Qué pasa si cerraste la pantalla sin copiarlo?** No pasa absolutamente nada malo. Tocá **Regenerar token**, se crea uno nuevo, lo copiás y lo pegás en WordPress. El token anterior se desactiva.
- **¿Se puede ver el panel del conector después?** Sí. Podés entrar cuantas veces quieras a **Perfil** (avatar → `/perfil` → Conectar WordPress) para chequear el estado o gestionar la conexión.

## ¿Por qué en Perfil aparece la home y no un producto?

**Es correcto.** En Perfil conectás **el WordPress entero** con la URL de inicio (`https://tutienda.com`). No tenés que poner la URL de un shampoo o un producto.

Cuando más adelante, en una misión, tocás **«Aplicar en mi web»**, SEO Jump manda la URL de **esa misión** (el producto o página concreta) al plugin. La home del Perfil solo sirve para saber a qué sitio hablarle.

## Resumen rápido del proceso

1. **En SEO Jump (Perfil):** generá el token (copialo) y descargá `seo-jump-connector.zip`.
2. **En tu WordPress:** andá a *Plugins → Añadir nuevo → Subir plugin*, seleccioná el ZIP, instalalo y tocá **Activar**.
3. **En los ajustes de WordPress:** *Ajustes → SEO Jump*, pegá tu token y guardá.
4. **De vuelta en SEO Jump:** tocá **Verificar conexión**.

Requisito: tené **Yoast SEO** o **Rank Math** en la tienda (casi todas ya lo tienen). El conector escribe título SEO y meta ahí; no cambia el nombre del producto ni el diseño.

## Una vez conectado: ¿qué pasa con «Aplicar en mi web»?

Cuando el indicador de conexión está en verde, **«Aplicar en mi web»** (el botón de las misiones de título o meta) **no es de un solo uso**. Lo vas a poder usar todas las veces que haga falta cada vez que resuelvas una misión de optimización.

Sirve para **páginas, productos y categorías** de WooCommerce (por ejemplo `/estetica-vehicular/shampoos` o `/categoria-producto/…`). Si ves “No encontramos esa URL”, actualizá el plugin a la **v1.2+** (Perfil → descargar ZIP de nuevo → Plugins → Subir / reemplazar).

Después de aplicar, si usás caché (WP Rocket, LiteSpeed, etc.), vaciala y tocá **Verificar** en la misión para confirmar que el cambio ya se ve en la web pública.

## Problemas frecuentes

**«Me pide subir un archivo y yo solo tengo el token»**  
Descargá el ZIP desde Perfil y subilo. El token va después, en Ajustes → SEO Jump.

**«No encuentro Ajustes → SEO Jump»**  
El plugin no está activado. Plugins → SEO Jump Connector → Activar.

**«Verificar conexión falla»**  
Revisá que el token esté guardado, que la URL sea la de tu tienda y que el sitio sea público.

**«Apliqué pero la misión no verifica»**  
Vacía la caché del sitio. El plugin ya guardó; la verificación lee la página pública.

---

¿Listo? Andá a [Perfil → Conectar WordPress](/perfil#wp-connect) o seguí con las [misiones](/).

También te puede servir: [la misión del H1](/blog/mision-del-h1) y [dónde pegar Schema en WordPress](/blog/donde-pegar-codigo-schema-wordpress-shopify).

# Publicidad en BlackNews — especificación de banners

Guía de referencia para cargar creatividades y entender cómo se renderizan
los anuncios de la web. Fuente de verdad en código: `src/types/ads.ts`
(`AD_PLACEMENTS_INFO`) y `src/components/AdBanner.tsx`.
El flujo end-to-end de envío y aprobación está en
[`flujo-publicidad.md`](./flujo-publicidad.md).

## Principios

1. **No molestan**: sin pop-ups, sin sticky, sin video autoplay, sin saltos
   de layout. Los suscriptores nunca ven anuncios.
2. **Visibles**: siempre dentro del flujo de lectura, con etiqueta
   «PUBLICIDAD» y nombre del anunciante en micro-tipo.
3. **Siempre llenan el hueco**: todos los slots usan `object-cover`; si la
   creatividad no tiene la proporción nominal se **recorta por el centro**
   y nunca quedan bandas (en proporción exacta cover y contain son
   idénticos). Decisión de diseño: el anunciante nunca ve su anuncio a
   media caja.
4. **CLS = 0**: el contenedor tiene tamaño antes de que la imagen cargue:
   relación de aspecto (= la del tamaño nominal) + tope de ancho.

## Dimensionado: proporción nominal + tope de ancho

Todos los slots se dibujan con **relación de aspecto = la del tamaño
nominal** (`ratio` en `AD_PLACEMENTS_INFO`, p. ej. `970 / 250`) y un
**tope de ancho** (`containerClass` = `max-w-[…]`, igual al ancho nominal).
Por qué:

- La creatividad nominal **llena el hueco al 100%** y la **vista previa
  del asistente replica el slot exacto**: usa el mismo `ratio` y el mismo
  tope, así que proporción y tamaño coinciden por construcción con el
  sitio.
- El hueco **nunca supera el tamaño de exportación**: no se escala la
  creatividad hacia arriba y un vertical como `ARTICLE_SIDEBAR` no se
  dispara a ~700 px de alto en la columna del artículo.
- En pantallas estrechas baja el ancho y la altura sigue la proporción:
  el mismo aspecto en todos los viewports.

Tamaños de exportación secundarios (728×90 en el billboard, etc.) se
muestren igual a sangre: al no tener la proporción nominal se **recortan
por el centro** hasta llenar el hueco. El asistente avisa «se recortará
al centro» cuando la creatividad no tiene la proporción nominal.

## Inventario de slots

| Slot (ubicación) | Orient. | Proporción del hueco | Ancho máx. | Ajuste | Tamaños de exportación |
|---|---|---|---|---|---|
| `TOP_BILLBOARD` — portada, bajo el teletipo | horizontal | `970 / 250` | 970 px | cover | **970×250**, 728×90, 320×100 |
| `IN_FEED_LEADERBOARD` — entre Edición Visual y cuadernos | horizontal | `1200 / 180` | 1200 px | cover | **1200×180**, 970×120, 728×90 |
| `ARTICLE_SIDEBAR` — dentro del cuerpo del artículo, tras las claves del informe | vertical | `300 / 250` | 300 px | cover | **300×250** (recomendado); 300×600 recorta los laterales |
| `IN_ARTICLE_PARAGRAPHS` — dentro del cuerpo del artículo, **cada 8 párrafos** (`IN_ARTICLE_AD_EVERY`) | horizontal | `728 / 90` | 728 px | cover | **728×90**, 800×120 |
| `ARTICLE_FOOTER` — cierre del artículo | horizontal | `728 / 90` | 728 px | cover | **728×90**, 800×120 |
| `GRID_CARD` — card patrocinada en la parrilla «Edición Visual», tras las 2 primeras tarjetas | card | `4 / 5` | 390 px (columna) | cover | 800×1000 |

- **Ancho**: hasta el tope por slot (`containerClass`), dentro de la
  columna del sitio (portada `max-w-7xl`, artículo `max-w-4xl`); por
  debajo del tope el ancho es el de la columna y la altura sigue `ratio`.
- El tamaño en **negrita** es el nominal recomendado de cada slot; el
  tope de ancho es su ancho nominal (la card usa el de su columna).

## Carrusel (varios anuncios en el mismo slot)

- Rotan **todas las campañas activas** del mismo slot, en orden de la lista.
- Cambio cada **6 s** con transición de opacidad (fade 500 ms).
- **Pausa** al pasar el cursor, al enfocar, y con la pestaña oculta.
- **Puntos** (dots) siempre visibles; **flechas** ← → aparecen al hover
  (solo ≥640 px). Navegación por teclado con `Tab` + `Enter`/`Espacio`.
- Con `prefers-reduced-motion: reduce`: **sin autoplay** ni fade; solo
  manual con dots/flechas.
- Si hay **1 sola** campaña: no hay controles, queda estática.
- Si **no hay campañas activas**: sin gestor de consulta no se pinta nada
  (cero huecos muertos); con «Anúnciate aquí» disponible se muestra una
  invitación punteada discreta ocupando el mismo hueco: mismo tope de
  ancho que la creatividad; la card 4:5 mantiene la proporción y los
  huecos horizontales su alto natural (una caja de 250 px vacíos en la
  portada molestaría más que el anuncio).

### Impresiones y clics

- **Impresión**: +1 por campaña **una sola vez por carga de página** del
  slot (no cuenta cada rotación). Evita reescribir el almacén cada 6 s.
- **Clic**: +1 en cada clic sobre la creatividad (abre en pestaña nueva con
  `rel="sponsored"`).
- Datos en `localStorage["blacknews_ads"]`, visibles en el panel de
  AdsManager (impr./clics).

## Reglas para las creatividades

| Regla | Detalle |
|---|---|
| Formato | JPG, PNG o **WebP** (preferido) |
| Peso | ≤ 300 KB horizontales · ≤ 150 KB cards |
| Fondo | **Negro o transparente** en slots `contain` (el letterbox es invisible); cover puede ir a sangre |
| Texto propio | Dentro de un margen seguro de 24 px; la etiqueta «PUBLICIDAD» va arriba-izquierda y el anunciante abajo-izquierda (no colocar texto en esas zonas) |
| Resolución | Exportar @2× del tamaño nominal p.ej. 1940×500 para 970×250 |
| Prohibido | Iframes, scripts, trackers, sonido, video |

## Cómo cargar una campaña

1. **Panel de redacción → AdsManager**: crear/editar campaña (título,
   anunciante, URL, imagen, placement, fechas, estado `ACTIVE`).
2. **"Anúnciate aquí"** (página de carga en el panel, `AdSubmissionPage`):
   ubicación con maqueta del sitio en dos pestañas —«Portada» (el orden
   real de la página principal) y «Publicación» (el despacho abierto)—
   con la pestaña que sigue a la ubicación elegida, y proporción,
   creatividad con vista previa real,
   plan con vistas estimadas y pago; la solicitud queda `PENDIENTE_PAGO`
   hasta la confirmación y la aprobación en AdsManager.
3. Mientras una campaña tenga otro estado (`PAUSED`, `PENDIENTE_PAGO`,
   `RECHAZADA`…) o esté fuera de fechas, **no aparece** en la web.

## Alta de un slot nuevo

1. Agregar la entrada en `AdPlacement` y `AD_PLACEMENTS_INFO`
   (`src/types/ads.ts`) con `ratio` (proporción de la creatividad nominal
   y del hueco), `containerClass` (tope de ancho `max-w-[…]` = ancho
   nominal), `exportSizes` y `estimatedDailyViews` (vistas/día
   estimadas que usa la página de carga).
2. Agregar su contenedor en `SLOT_WRAPPER` (`src/components/AdBanner.tsx`).
3. Renderizar `<AdBanner placement="..." campaigns={adsList} … />` donde
   corresponda.
4. Documentarlo en la tabla de arriba.

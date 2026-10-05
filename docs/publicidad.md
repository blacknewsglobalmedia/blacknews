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
3. **Nunca se recortan**: los slots horizontales usan `object-contain`; la
   creatividad se escala entera y el sobrante queda en negro (invisible
   sobre el fondo AMOLED).
4. **CLS = 0**: el contenedor tiene tamaño fijo (altura o aspect ratio)
   antes de que la imagen cargue.

## Decisiones: tamaño fijo vs aspect ratio

| Tipo de slot | Decisión | Motivo |
|---|---|---|
| Horizontales (billboard, leaderboard, footer) | **Altura fija por breakpoint + ancho fluido** | Un banner de 728×90 y uno de 970×250 comparten ancho pero no altura; la altura fija evita que la página "bailen" al rotar el carrusel. El ancho libre + `contain` admite cualquier tamaño nominal. |
| Verticales / cards | **Aspect ratio** (`4/5` para GRID_CARD) | Se integran en la grilla junto a las noticias, que ya usan 4:5. |

Breakpoints Tailwind: `sm` = 640 px, `md` = 768 px.

## Inventario de slots

| Slot (ubicación) | Orient. | Dimensionado | Alturas contenedor | Ajuste | Tamaños de exportación |
|---|---|---|---|---|---|
| `TOP_BILLBOARD` — portada, bajo el teletipo | horizontal | altura fija | 90 px · 120 px (≥640) · 160 px (≥768) | contain | **970×250**, 728×90, 320×100 |
| `IN_FEED_LEADERBOARD` — entre Edición Visual y cuadernos | horizontal | altura fija | 72 px · 96 px (≥640) · 120 px (≥768) | contain | **1200×180**, 970×120, 728×90 |
| `ARTICLE_SIDEBAR` — dentro del cuerpo del artículo | vertical | altura fija | 200 px · 250 px (≥640) | contain | **300×250** (recomendado); 300×600 se muestra completo y centrado |
| `ARTICLE_FOOTER` — cierre del artículo | horizontal | altura fija | 56 px · 72 px (≥640) · 90 px (≥768) | contain | **728×90**, 800×120 |
| `GRID_CARD` — card patrocinada en la cuadrícula | card | aspect `4/5` | — | cover | 800×1000 |

- **Ancho**: fluido. Horizontales van dentro de `max-w-7xl` (portada) o del
  ancho de columna del artículo.
- El tamaño en **negrita** es el nominal recomendado de cada slot.

## Carrusel (varios anuncios en el mismo slot)

- Rotan **todas las campañas activas** del mismo slot, en orden de la lista.
- Cambio cada **6 s** con transición de opacidad (fade 500 ms).
- **Pausa** al pasar el cursor, al enfocar, y con la pestaña oculta.
- **Puntos** (dots) siempre visibles; **flechas** ← → aparecen al hover
  (solo ≥640 px). Navegación por teclado con `Tab` + `Enter`/`Espacio`.
- Con `prefers-reduced-motion: reduce`: **sin autoplay** ni fade; solo
  manual con dots/flechas.
- Si hay **1 sola** campaña: no hay controles, queda estática.
- Si **no hay campañas activas**: no se pinta nada (cero huecos muertos).

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
2. **"Anúnciate aquí"** (modal de auto-servicio): el anunciante envía la
   solicitud y queda pendiente de aprobación en AdsManager.
3. Mientras una campaña tenga otro estado (`PAUSED`, `PENDIENTE_PAGO`,
   `RECHAZADA`…) o esté fuera de fechas, **no aparece** en la web.

## Alta de un slot nuevo

1. Agregar la entrada en `AdPlacement` y `AD_PLACEMENTS_INFO`
   (`src/types/ads.ts`) con `sizing`, `containerClass`/`aspect`, `fit` y
   `exportSizes`.
2. Agregar su contenedor en `SLOT_WRAPPER` (`src/components/AdBanner.tsx`).
3. Renderizar `<AdBanner placement="..." campaigns={adsList} … />` donde
   corresponda.
4. Documentarlo en la tabla de arriba.

# Flujo de publicidad — trazado completo

Trazado end-to-end de lo que hace **cada persona** para enviar y publicar una
publicidad en BlackNews. Referencias de tamaños y creatividades:
[`publicidad.md`](./publicidad.md). Este documento describe el flujo YA
implementado (ver "Lo que falta" al final para lo pendiente).

## Máquina de estados

```
PENDIENTE_PAGO ──(pago verificado)──▶ PENDIENTE_APROBACION ──(admin aprueba)──▶ ACTIVE
      │                                      │                          │
      │                                (admin rechaza)            (admin pausa)
      ▼                                      ▼                          ▼
 RECHAZADA ◀────────────────────────── RECHAZADA                    PAUSED ⇄ ACTIVE
```

- **Todo envío nace `PENDIENTE_PAGO`** — ni transferencia ni MP ni PayPal
  están verificados al enviar.
- **PayPal**: la captura del cobro (verificada por el Worker) pasa la
  campaña a `PENDIENTE_APROBACION` automáticamente.
- **Transferencia / Mercado Pago**: mueve el estado el admin desde
  AdsManager tras ver el comprobante.
- Las campañas con `endDate` vencido **no se muestran** aunque su estado
  diga `ACTIVE` (los filtros de `AdBanner` las excluyen).

---

## Persona 1 — El anunciante

| # | Paso | Dónde vive |
|---|------|-----------|
| 1 | **Descubre** el espacio: botón *Anúnciate aquí* en el pie, o el recuadro *ESPACIO PATROCINADO DISPONIBLE* en la portada (solo aparece cuando no hay campañas activas). Los suscriptores no ven anuncios ni recuadros. | `Footer.tsx`, `AdBanner.tsx` (placeholder + `onOpenInquiry`) |
| 2 | **Inicia sesión con Google** (obligatorio — sin login, «Anúnciate aquí» muestra el aviso de sesión en vez de abrir la página). | `App.tsx` `openAdSubmission` → `GoogleAuthModal` |
| 3 | **Elige ubicación y plan** en la página de carga del panel (sección 1): 5 placements con su proporción, tamaños de exportación y vistas diarias estimadas; 5 planes (7d/15d/30d/CPM 10k/CPM 50k) con vistas estimadas por ubicación (sección 3). | `AdSubmissionPage.tsx` · `types/ads.ts` (`AD_PLACEMENTS_INFO`, `AD_PRICING_PLANS`, `estimateCampaignViews`) |
| 4 | **Carga la creatividad** (sección 2): sube el archivo (va a Cloudinary y se usa el ORIGINAL a máxima calidad) o pega una URL; ve dimensiones reales, aviso de proporción y **vista previa en el contenedor real del slot**. | `AdSubmissionPage.tsx` · `worker/images.ts` (`originalUrl`) |
| 5 | **Elige el pago** (sección 4): | `AdSubmissionPage.tsx` |
| | **PayPal** (principal): se cobra en **USD** con el precio del servidor. Botón *CONTINUAR A PAYPAL*. | `utils/paypalAds.ts` → `POST /api/paypal/ad-order` |
| | **Mercado Pago**: tarjetas/Abitab/Redpagos. | manual (comprobante) |
| | **Transferencia BROU/Itaú**: muestra los datos y pide nº de comprobante. | manual |
| 6 | **Envía** → la campaña se registra **siempre** como `PENDIENTE_PAGO` (sobrevive aunque el pago no se complete). | `App.tsx` `handleSaveCampaign` → Firestore `ads` + `localStorage["blacknews_ads"]` |
| 7a | **PayPal**: redirige a PayPal (`approveUrl`). Al aprobar, PayPal vuelve a `/?ad_campaign=<id>&token=<orderId>` → el Worker **captura y verifica** importe/plan/campaña → la campaña pasa a `PENDIENTE_APROBACION` y se avisa con toast. Si el anunciante abandona, queda `PENDIENTE_PAGO`. Si PayPal no está configurado (sin claves), se registra igual y la confirmación explica que se le contactará. | `worker/paypal.ts` `handleAdCapture` · `App.tsx` efecto de retorno |
| 7b | **Transferencia / MP**: la confirmación es manual; la vista de confirmación muestra la solicitud registrada. | — |
| 8 | **Ve la confirmación** con el resumen de su solicitud y el estado. | `AdSubmissionPage.tsx` (vista de confirmación) |

---

## Persona 2 — El administrador (panel de redacción → AdsManager)

| # | Paso | Detalle |
|---|------|---------|
| 1 | Entra a **AdsManager** (solo roles admin/redacción). La pestaña de pendientes cuenta `PENDIENTE_PAGO` + `PENDIENTE_APROBACION`. | `AdsManager.tsx` |
| 2 | **Abre la solicitud** y verifica el pago: PayPal (figura el comprobante `PayPal order …`), comprobante de transferencia o MP. | ficha de campaña |
| 3 | **Aprueba y publica** (→ `ACTIVE`, sale en portada y artículos) o **Rechaza** con motivo (→ `RECHAZADA`, visible para el anunciante en la ficha). | botones *APROBAR Y PUBLICAR* / *RECHAZAR* |
| 4 | **Gestiona** campañas activas: pausar/reactivar, editar fechas, ver métricas (impresiones/clics), filtrar por estado/ubicación, rate card. | editor + filtros |
| 5 | Cuando se agota el plazo (`endDate`), la campaña deja de renderizarse sola. | filtros en `AdBanner` |

---

## Persona 3 — El lector (cómo se ve)

- Los anuncios van en **carrusel** por ubicación: fade cada 6 s, pausa al
  hover, dots + flechas, sin autoplay con `prefers-reduced-motion`.
- Mientras la creatividad baja se ve un **cargador** discreto (skeleton
  «Cargando…» sobre el negro del slot, sin salto de layout).
- Etiqueta **PUBLICIDAD** + nombre del anunciante en micro-tipo; borde
  sutil; **nunca recortados** (contain sobre negro AMOLED).
- Clic → pestaña nueva con `rel="sponsored"` (cuenta +1 clic).
- **Los suscriptores no ven ningún anuncio.**

---

## Sistema — quién hace qué (archivos)

| Componente | Responsabilidad |
|---|---|
| `src/components/AdSubmissionPage.tsx` | Página de carga del anunciante en el panel (ubicación → creatividad con vista previa real → plan con alcance estimado → datos y pago); estado inicial `PENDIENTE_PAGO`, redirección PayPal. Sustituye al antiguo `CreateAdModal`. |
| `src/App.tsx` | Estado `adsList`; **Firestore `ads` como fuente de verdad** (pull al arrancar + `setDoc`/`deleteDoc` en cada guardado/borrado); efecto de retorno `?token=&ad_campaign=`; abre la página de carga desde los placeholders. |
| `src/components/AdsManager.tsx` | Panel de aprobación/pago/métricas. |
| `src/components/AdBanner.tsx` | Render de banners: carrusel, tamaños, cargador/skeleton de imagen, impresiones (1/campaña/página), clics. |
| `src/types/ads.ts` | Catálogo: placements + tamaños, planes y precios, estados, `AdPaymentMethod` (`PAYPAL`, `MERCADO_PAGO`, `BANK_TRANSFER`, `STRIPE`). |
| `worker/paypal.ts` | `POST /api/paypal/ad-order` (crea orden con **precio server-side** `AD_PLANS`) y `POST /api/paypal/ad-capture` (captura, verifica importe/plan/campaña, KV `adorder:<id>`, idempotente). |
| `src/utils/paypalAds.ts` | Cliente de esas dos rutas. |
| Firestore `ads` | Solicitud visible en **todos** los navegadores (el admin no comparte localStorage con el anunciante). |
| `localStorage["blacknews_ads"]` | Caché local offline (mismo patrón que reports). |

### Nota sobre métricas

Impresiones y clics se acumulan **por dispositivo** en `localStorage` (1
impresión por campaña por carga de página). Un contador global compartido
requiere un endpoint con concurrencia (Worker) — ver checklist.

---

## Lo que falta para producción

- [ ] **Claves de PayPal** en Cloudflare (`PAYPAL_CLIENT_ID` /
      `PAYPAL_SECRET`) — las mismas que suscripciones; `PAYPAL_MODE:
      "sandbox"` para probar y `"live"` para cobrar de verdad. Sin claves,
      el botón PayPal informa que se contactará al anunciante (degraded).
- [ ] **Publicar las reglas Firestore de `ads`** — `firestore.rules` en el
      repo ya incluye el bloque `match /ads/{campaignId}` (lectura pública,
      creación con sesión de Google verificada, edición dueño + transición
      PayPal, borrado solo dueño). Falta el deploy:
      `npx firebase-tools deploy --only firestore:rules`.
      *Verificado por sonda*: hoy `ads` está fuera de las reglas → lectura
      y escritura denegadas (la app degrada en silencio a copia local: los
      visitantes no verían campañas enviadas y el admin no las recibiría).
- [ ] **Contadores globales** de impresiones/clics (hoy: por dispositivo).
- [ ] Verificación manual de pagos MP/transferencia en panel (ya operativa
      con los botones de estado; es una tarea humana, no de código).

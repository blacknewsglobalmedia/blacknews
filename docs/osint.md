# Módulo OSINT — Centro de Investigación (BlackNews)

Inteligencia de fuentes abiertas dentro de `/dashboard`: búsqueda
multi-fuente desde el backend, detección de duplicados, cuotas honestas,
vista previa e importación a las herramientas editoriales. Sólo para
administradores y con verificación **también en el Worker**.

---

## 1. Arquitectura

```
Navegador (OsintCenter.tsx)          Worker Cloudflare (worker/osint/)
┌──────────────────────────┐        ┌──────────────────────────────────────┐
│ Pestaña OSINT (solo ADMIN)│  Bearer│ auth.ts  → Google ID token / token   │
│ Buscador · Resultados     │───────▶│             secreto (fail-closed)    │
│ Preview · Guardados       │ /api/  │ routes.ts → status/search/sources    │
│ Fuentes (admin)           │ osint/*│ search.ts → orquestación + cuotas    │
└──────────────────────────┘        │ connectors.ts → GDELT, RSS, OpenAlex, │
        ▲                           │              Wikidata, Tavily         │
        │ importación (borrador)     │ ssrf.ts   → guard de salida           │
        ▼                           │ store.ts  → KV «osint:» (PAYPAL_KV)   │
 SocialPostGenerator · Builder      └──────────────────────────────────────┘
```

- **El navegador nunca ve claves ni llama a APIs de terceros**: todas las
  peticiones salen del Worker con el `user-agent` del propio Worker.
- **Contrato de tipos compartido**: `src/types/osint.ts` lo importan tanto
  el Worker como la UI (una sola fuente de verdad).
- **Persistencia**: binding KV existente `PAYPAL_KV` con prefijo `osint:`
  (`osint:sources`, `osint:runtime:<id>`, `osint:lastsearch`). Los
  hallazgos guardados viven en `localStorage` (`blacknews_osint_saved`),
  igual que borradores de anuncios/pódcast.

## 2. Endpoints (todos exigen administración)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/osint/status` | Fuentes + runtime (cuotas, errores, cortacircuitos), última búsqueda, avisos |
| POST | `/api/osint/search` | Búsqueda multi-fuente con resultados parciales |
| GET | `/api/osint/sources` | Configuración + consumo por fuente |
| PUT | `/api/osint/sources` | Activar/desactivar o ajustar límite interno diario |
| POST | `/api/osint/sources` | Añadir feed RSS personalizado (dominio en allowlist) |
| DELETE | `/api/osint/sources?id=` | Eliminar una fuente personalizada (las built-in no) |
| POST | `/api/osint/sources/test` | Probar conexión + vista previa de 5 titulares |
| POST | `/api/osint/translate` | Traducción automática de un hallazgo al español (IA gratuita) |

### Autenticación (doble vía, ninguna expone secretos)

1. **Google ID token (ruta principal)** — el frontend envía
   `Authorization: Bearer <idToken>` de Firebase Auth
   (`auth.currentUser.getIdToken()`). El Worker verifica la firma RS256
   contra `https://www.googleapis.com/identity/v1/certs` (caché 1 h),
   `exp`, `iss` (securetoken.google.com / accounts.google.com),
   `email_verified` y que el email esté en `OSINT_ADMIN_EMAILS`.
2. **Token administrativo** — cabecera `x-bn-admin-token` igual al secreto
   `OSINT_ADMIN_TOKEN` (CI, scripts, asistente local). Si el secreto no
   existe, la vía no existe.

**Fail-closed**: sin `OSINT_ADMIN_EMAILS` ni `OSINT_ADMIN_TOKEN`, el
módulo responde 403 con instrucciones. Los mensajes de error no filtran
configuración.

> Modo asistente/CI en el navegador: si existe
> `sessionStorage.BN_OSINT_TOKEN`, el cliente la usa como `x-bn-admin-token`.
> Sólo aporta un token que su poseedor ya tiene; no escala privilegios.

## 3. Conectores

| Fuente | Clave | Ofrece | Límites / notas (verbatim en la UI) | Cuota por defecto |
|---|---|---|---|---|
| **GDELT DOC 2.0** | no | `artlist` global con fecha, idioma, país, socialimage | recomienda ~1 consulta/15 s; `maxrecords` ≤ 250; no publica cuota diaria | `official` (nota) |
| **RSS/Atom built-in** | no | BBC World/Mundo, DW, France 24 EN, ONU News: título, enlace, fecha, fragmento, autor, imagen | feeds públicos sin cuota documentada | `internal` |
| **OpenAlex** | no | publicaciones académicas + abstract reconstruido + autores | «polite pool» ~100.000 req/día declaradas; sin saldo en cabeceras | `official` |
| **Wikidata SPARQL** | no | entidades estructuradas + enlace Wikipedia | pide User-Agent; límites de tasa no documentados con exactitud | `unknown` |
| **Tavily** | `TAVILY_API_KEY` (secreto ya existente del proyecto) | búsqueda web de noticias con fecha de publicación | plan gratuito con límite diario no publicado | `unknown` |

Todo conector: timeout 12 s, mensajes legibles sin secretos, y
`Promise.allSettled`-style por fuente: **un fallo jamás bloquea a las
demás** (`OsintSourceResult` informa `ok/error/skipped` por fuente).

### Cuotas: cuatro categorías (nunca se mezclan)

- `official` → límite documentado por el proveedor (se muestra su texto).
- `headers` → saldo leído de cabeceras HTTP (`x-ratelimit-*`); única fuente
  de «saldo restante».
- `internal` → sólo contadores propios de BlackNews (hoy/total).
- `unknown` → límite no verificable.

Sin cabeceras, la UI dice explícitamente **«saldo restante desconocido»**.
Además hay **límite interno diario configurable** por fuente (el contador
se reinicia a medianoche UTC) y un **cortacircuito de 15 min** tras un 429
(persistido en KV; la fuente se omite con el motivo y la hora).

## 4. Duplicados, puntuación y datos

- **Duplicados** = misma URL canónica (sin `utm_*`, `fbclid`, `gclid`,
  `www`, fragmento) **o** titulares largos (≥40 caracteres) idénticos
  normalizados con similitud ≥0.9 y fechas a ≤6 h. **Nada se borra**: los
  duplicados se agrupan en *acontecimientos* (`cluster`) conservando todos
  los enlaces y fuentes originales. Los titulares cortos no agrupan por
  palabras clave (evita mezclar sucesos distintos).
- **Puntuación editorial** (0–100) con factores explicados: recencia,
  número de fuentes independientes, coincidencia con la búsqueda, fragmento,
  documentación estructurada, autoría. **No es prueba de veracidad** (la UI
  lo indica en la vista previa).
- Los datos son **originales de la fuente**: titular, enlace, fecha de
  publicación, fragmento tal cual. Si no hay más (sólo titular y enlace),
  la vista previa lo advierte; nunca se genera un texto ajeno.

## 5. Importaciones (siempre borradores editables)

- **Generador de posts** (`SocialPostGenerator`): precompleta `title`,
  `description`, `selectedCountries`, `photoCaption` («Fuente: …») e
  `mediaSrc` si la fuente trae imagen; muestra una franja de procedencia
  con el enlace original. Categoría sólo si está en el catálogo vivo.
- **Redactor** (`RedactionStudio` → builder): precompleta `title`,
  `subtitle` (≤180 car.), `imageCaption` (fuente·autor) y
  `articleCountries` (ISO sólo si la fuente lo informa) y salta al
  constructor.
- **Ninguna importación publica nada**: el disparo de publicación sigue
  siendo manual. Estado del hallazgo guardado pasa a «Importado al
  generador»/«Importado al redactor».

### Traducción automática al importar

- Si el hallazgo **no está declarado en español** (`language !== 'es'`), el
  importador llama a `POST /api/osint/translate`, que reutiliza
  `callFreeModel` de `worker/ai.ts` (Workers AI → Groq → Gemini). No hay
  configuración nueva: usa exactamente la misma IA gratuita que la
  redacción asistida.
- **Etiqueta y original**: lo traducido lleva siempre la marca «traducción
  automática» (aviso emerald en la UI, chip ámbar en la franja del
  generador con «Ver texto original de la fuente») y el texto original se
  conserva en la vista previa, en los guardados (nota automática sólo si
  el editor no escribió notas propias) y en `originalTitle`/
  `originalSnippet` del payload.
- **Nunca bloquea**: si no hay proveedor de IA o la respuesta es
  ilegible, el servidor responde `ok:false` (200) con el motivo y la
  importación continúa con el **texto original** de la fuente. Un aviso
  ámbar lo explica.
- El botón muestra «Traduciendo…» con spinner y queda deshabilitado
  mientras la petición está en vuelo. Los límites internos y las cuotas
  por fuente no se ven afectados: la traducción usa la IA del proyecto,
  no cuota OSINT.

## 6. Configuración

```bash
# Obligatorio (al menos uno de los dos):
npx wrangler secret put OSINT_ADMIN_TOKEN      # vía token (CI/scripts)
# allowlist de administradores (vídeo Google) — wrangler.jsonc → vars:
#   "OSINT_ADMIN_EMAILS": "tu-email@gmail.com"

# Opcional — feeds RSS personalizados (vacío = deshabilitados):
#   "OSINT_RSS_ALLOWLIST": "mi-medio.org,un.org"
```

Local: valores en `.dev.vars` (gitignored), p. ej.

```
OSINT_ADMIN_EMAILS=admin@blacknews.com
OSINT_ADMIN_TOKEN=bn-osint-dev-token
OSINT_RSS_ALLOWLIST=bbc.co.uk,dw.com,france24.com,un.org
```

## 7. Pruebas

```bash
npx tsx test/osint-logic.test.ts   # 23 pruebas: dedupe, scoring, SSRF, RSS/Atom, traducción
npm run lint                       # tsc (incluye worker/ y test/)
```

Prueba manual del backend:

```bash
curl -H "x-bn-admin-token: <token>" http://127.0.0.1:8787/api/osint/status
curl -X POST -H "content-type: application/json" -H "x-bn-admin-token: <token>" \
  -d '{"query":"Ukraine","period":"24h"}' http://127.0.0.1:8787/api/osint/search
```

## 8. Limitaciones conocidas

- **SSRF**: en Workers no hay hook previo de resolución DNS; el guard
  bloquea esquemas no-http(s), credenciales, localhost/`.local`/`.internal`
  e IP privadas/metadata, y exige allowlist de dominio para feeds
  personalizados (reducción explícita del riesgo, no supresión total).
- **Feed ONU**: `news.un.org/feed/` puede devolver 0 elementos desde
  algunos bordes de Fastly; el resto de feeds built-in no se ven afectados
  (resultados parciales por feed).
- **Filtro por categoría en la búsqueda**: las categorías se usan hoy para
  describir la cobertura de cada fuente; el filtrado textual está por
  tokens de la consulta.
- Los contadores diarios se reinician a medianoche UTC; los mensuales son
  sólo informativos.

# signal-ui

Componentes React minimalistas (negro, Lexend, ASCII, LED). Sin dependencias.
Funcionan en Next.js (App Router) y Vite. Los archivos ya traen `'use client'`.

## Instalación

Copia la carpeta `signal-ui/` a `components/` (Next) o `src/` (Vite).

**Fuente Lexend**
- Next: `import { Lexend } from 'next/font/google'` y asigna su `variable` a `--sg-font`.
- Vite: agrega en `index.html`
  `<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@200;300;400&display=swap" rel="stylesheet">`

**Raíz de la app**: envuelve con la clase `sg-root` (por ejemplo en `<body className="sg-root">`).

## Uso

```tsx
import { GlitchText, DecodeText, Tuner, Tabs, Transmission, Pager, Redacted,
         Stat, Skeleton, Disclosure, StaticOverlay, Scanlines, useSignalSound } from '@/components/signal-ui';

<h1><GlitchText>SEÑAL</GlitchText></h1>
<DecodeText text="Transmisión recibida" />
<Redacted>[dato reservado]</Redacted>
<Tuner label="Frecuencia" value={f} onChange={setF} />
<Stat label="Verificación" value="82%" level={8} />
<StaticOverlay opacity={0.04} /> <Scanlines />   {/* una sola vez, en el layout */}
```

## Sonido (opcional, apagado por defecto)

```tsx
const { enabled, enable, disable, beep, burst, geiger } = useSignalSound();
<button className="sg-btn" onClick={enabled ? disable : enable}>Sonido {enabled ? 'on' : 'off'}</button>
<button onClick={() => { burst(); beep(660); }}>Abrir alerta</button>
```
Los navegadores exigen un gesto del usuario para iniciar audio: por eso `enable()` va en un clic.

## Accesibilidad incluida
Foco visible, objetivos táctiles de 44px, roles de tabs y dialog nativo, `prefers-reduced-motion`
apaga glitch, parpadeo, decodificación y estática animada.

## Personalizar
Todo vive en variables `--sg-*` de `signal.css`. Para un LED ámbar: `--sg-led:#ffb000`.

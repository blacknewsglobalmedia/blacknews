import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  Copy,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  RotateCcw,
  Eye,
  Layers,
  Sliders,
  FileText,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Maximize2,
  Trash2,
  Palette,
  Film,
  Smartphone,
  Globe,
  MapPin,
  Plus,
  X,
  Type,
  Zap,
  Scissors,
  Gauge,
  FileCode,
  FolderUp,
  FileDown,
  User,
  AlertTriangle,
} from "lucide-react";
import { Report } from "../types/news";
import type { OsintPostImport } from "../types/osint";
import { CATEGORIES } from "../data/newsData";
import fixWebmDuration from "fix-webm-duration";
import {
  addCustomCountry,
  countryKey,
  findCountryByName,
  searchCountries,
  useCountryCatalog,
  type CountryItem,
} from "../data/countries";
import { CountryFlag, loadFlagImage, isRegionalFlagEmoji } from "./CountryFlag";
// signal-ui: negra, Lexend, ASCII, LED — componentes sin dependencias.
import { GlitchText, Led, Transmission, Scanlines } from "./signal-ui";
// Cierre de marca (opcional, apagado por defecto): se añade al final de los
// vídeos exportados y de la vista previa. Vite lo sirve como asset estático.
import outroVideoSrc from "../assets/videos/Blacknews.mp4";
// Aviso de contenido sensible (opcional): se añade tras un frame opcional antes del clip.
// Al activarse, el preview de redes toma como miniatura el primer frame (portada con titular).
// Vite lo sirve como asset estático.
import warningVideoSrc from "../assets/videos/Blacknews-Advertencia.mp4";
// Cama musical del podcast: se mezcla por debajo de la voz a volumen muy bajo.
// Sólo entra al bundle el MP3 (2,2 MB); el WAV maestro vive fuera de git.
import podcastSoundtrack from "../assets/audio/BlackNews_Soundtrack.mp3";

// Las banderas viven en CountryFlag.tsx (compartido con la barra de relojes):
// se reexportan aquí por compatibilidad con los importers existentes.
export { CountryFlag, loadFlagImage };

interface SocialPostGeneratorProps {
  reports?: Report[];
  categories?: string[];
  /** Hallazgo OSINT a precompletar (borrador editable; nunca publica solo). */
  importPayload?: OsintPostImport | null;
  /** Avisa al panel tras aplicar la importación para limpiar el puente. */
  onImportConsumed?: () => void;
}

// Categorías canónicas del sitio: fuente única en data/newsData.ts.
// El selector y los chips usan exactamente la misma lista que la portada.
export const EXPANDED_CATEGORIES: string[] = CATEGORIES.filter(
  (c) => c !== "TODAS",
);

/** Segmento de la cinta del ticker: `code` dibuja la bandera como imagen
 *  (flagcdn) y `emoji` es el respaldo de glifo sólo si no es un emoji de
 *  bandera (en Windows los de bandera salen como letras). */
interface TickerSeg {
  text: string;
  code?: string;
  emoji?: string;
}
type TickerItem = string | TickerSeg[];

/** Imagen por defecto del generador; también es el respaldo del borrador
 *  cuando la URL guardada de un vídeo local ya no existe. */
const DEFAULT_MEDIA_SRC =
  "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80";

/** Márgenes de texto seguros para TikTok en 9:16 (1080×1920): la UI de la app
 *  tapa ~160 px superiores (pestañas "Para ti"/"Siguiendo" y búsqueda) y ~140 px
 *  derechos (raíl de acciones). La izquierda conserva los 84 de siempre. En
 *  4:5 nada cambia: un post de feed no lleva superposiciones. */
const PAD_TOP_9X16 = 160;
const PAD_RIGHT_9X16 = 140;

/** Ancho de la columna de texto en 4:5: 1080 menos 84 de margen por lado. En
 *  9:16 se estrecha a la columna segura (84 izquierda + 140 derecha) —
 *  renderToCanvas calcula lo mismo con `W - padX - padRight`. */
const TEXT_COLUMN_WIDTH = 1080 - 84 * 2;

/** Máximo de líneas de la bajada: la vista previa siempre limitó a 5 líneas
 *  (line-clamp) y el export ahora respeta ese mismo tope. */
const MAX_DESC_LINES = 5;

/** Suelo de la zona de texto en 9:16: la foto arranca como pronto al 30 % del
 *  alto (576 px de 1920) para que el formato vertical le dé más espacio. En
 *  4:5 se mantiene el suelo clásico de 520 px sobre 1350 (38,5 %). */
const MEDIA_FLOOR_RATIO_9X16 = 0.3;

/** Reparte `text` en líneas que caben en `maxWidth` según la métrica del ctx. */
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const paragraphs = text.split("\n");
  const allLines: string[] = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.length === 0) {
      allLines.push("");
      return;
    }
    const words = paragraph.split(" ");
    let currentLine = "";

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine !== "") {
        allLines.push(currentLine);
        currentLine = words[n];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      allLines.push(currentLine);
    }
  });

  return allLines;
};

let measureCtx: CanvasRenderingContext2D | null = null;

/** Envuelve texto con la MISMA métrica del export (peso y tamaño reales del
 *  lienzo, ancho de columna 912 px, sin tracking): la vista previa pinta estas
 *  líneas tal cual, así que los cortes coinciden al 100 % con el archivo
 *  exportado. */
const wrapLikeExport = (
  font: string,
  text: string,
  maxWidth: number,
): string[] => {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return text.split("\n");
  measureCtx.font = font;
  measureCtx.letterSpacing = "0px";
  return wrapText(measureCtx, text, maxWidth);
};

/** Tope de líneas de la bajada (diseño de 5) con "…" de corte. Se aplica igual
 *  en la vista previa y en el archivo exportado para que coincidan carácter a
 *  carácter. */
const capDescLines = (lines: string[]): string[] => {
  if (lines.length <= MAX_DESC_LINES) return lines;
  const capped = lines.slice(0, MAX_DESC_LINES);
  capped[MAX_DESC_LINES - 1] += "…";
  return capped;
};

/** Tope genérico de líneas con "…" de corte (chyron del formato TV 16:9):
 *  el titular se corta a 3 líneas y la bajada del chyron a 2, igual en el
 *  lienzo exportado que en la vista previa. */
const capLines = (lines: string[], max: number): string[] => {
  if (lines.length <= max) return lines;
  const capped = lines.slice(0, max);
  capped[max - 1] += "…";
  return capped;
};

/** Duración de respaldo del cierre (Blacknews.mp4) mientras no carguen los
 *  metadatos del <video>: sólo la muestra la UI y cierra plazos del export. */
const OUTRO_DUR_FALLBACK = 11.3;

/** Margen que la ruta clásica concede al sello para despegar de su propio
 *  final antes de dar la fase de cierre por muerta. El <video> del cierre
 *  puede quedar aparcado en su último fotograma (tras haber sonado en la vista
 *  previa) y, si el archivo se cierra en ese primer compás, el MP4 sale con la
 *  longitud exacta del clip pero SIN el sello. */
const OUTRO_START_GRACE_MS = 2000;
/** Altura por defecto del panel de contexto del asistente flotante. */
const AI_COMPOSER_H_DEFAULT = 170;

/** Número de barras de la onda del post-podcast. Es el mismo valor en la vista
 *  previa y en el archivo: la onda se calcula una vez al cargar el audio y se
 *  pinta siempre con los mismos picos, así el frame exportado es idéntico al
 *  que se ve en pantalla. */
const PODCAST_BARS = 88;

/** Picos (RMS normalizado 0..1) de un archivo de audio, repartidos en
 *  `buckets` muestras. Se calcula con el decoder del navegador sobre el
 *  archivo completo, no con AnalyserNode en vivo: así la onda es
 *  determinista y se puede pintar fuera de la reproducción (pausa, export). */
const computeAudioPeaks = async (
  blob: Blob,
  buckets = PODCAST_BARS,
): Promise<number[]> => {
  const raw = await blob.arrayBuffer();
  const probe = new OfflineAudioContext(1, 1, 44100);
  const decoded = await probe.decodeAudioData(raw);
  const ch = decoded.getChannelData(0);
  const size = Math.max(1, Math.floor(ch.length / buckets));
  const peaks: number[] = [];
  let max = 0;
  for (let i = 0; i < buckets; i++) {
    const start = i * size;
    const end = Math.min(ch.length, start + size);
    let sum = 0;
    let n = 0;
    // Un paso de 4 muestras basta para el RMS visual y va 4× más rápido.
    for (let j = start; j < end; j += 4) {
      sum += ch[j] * ch[j];
      n++;
    }
    const rms = n > 0 ? Math.sqrt(sum / n) : 0;
    peaks.push(rms);
    if (rms > max) max = rms;
  }
  return peaks.map((v) => (max > 0 ? Math.min(1, v / max) : 0));
};

/** Reloj del post-podcast: m:ss (sin décimas: es un indicador, no un editor). */
const fmtPodcastClock = (t: number): string => {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Cómo se muestrean las banderas (países) en la tarjeta del podcast.
 *  «auto» elige variante según cuántos países haya; el resto son estilos
 *  fijos para probar en cada caso desde el panel. */
type PodcastFlagStyle =
  | "auto"
  | "flags-names"
  | "flags-codes"
  | "flags-only"
  | "names"
  | "ocultar";

/** Lo que acaba pintando la tarjeta una vez resuelto el estilo «auto». */
type PodcastFlagMode = Exclude<PodcastFlagStyle, "auto">;

/** Umbral del muestreo automático: 1-3 bandera+nombre · 4-6 bandera+código
 *  (más compacto) · 7 o más solo bandera (que es cuando los nombres alargan
 *  demasiado la línea y la estructura se ve rara). */
const autoFlagMode = (count: number): PodcastFlagMode => {
  if (count <= 0) return "ocultar";
  if (count <= 3) return "flags-names";
  if (count <= 6) return "flags-codes";
  return "flags-only";
};

const PODCAST_FLAG_STYLES: Array<{ value: PodcastFlagStyle; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "flags-names", label: "Bandera + Nombre" },
  { value: "flags-codes", label: "Bandera + Código" },
  { value: "flags-only", label: "Solo banderas" },
  { value: "names", label: "Solo nombres" },
  { value: "ocultar", label: "Ocultar" },
];

const PODCAST_FLAG_MODE_LABEL: Record<PodcastFlagMode, string> = {
  "flags-names": "bandera + nombre",
  "flags-codes": "bandera + código ISO",
  "flags-only": "solo banderas",
  names: "solo nombres",
  ocultar: "sin países",
};

/** Dónde se pintan los países en la tarjeta. «top-right», «under-title» y
 *  «bottom» son formas extra del podcast: en el modo noticia se pintan en la
 *  barra superior (y el panel no las ofrece). */
type CountryPlacement =
  | "line"
  | "badge"
  | "top-right"
  | "under-title"
  | "bottom"
  | "none";

const PODCAST_ONLY_PLACEMENTS: CountryPlacement[] = [
  "top-right",
  "under-title",
  "bottom",
];

const COUNTRY_PLACEMENTS: Array<{
  value: CountryPlacement;
  label: string;
  hint: string;
  podcastOnly?: boolean;
}> = [
  {
    value: "line",
    label: "En Línea",
    hint: "Mostrar en la barra superior junto a la categoría",
  },
  {
    value: "badge",
    label: "Insignia",
    hint: "Mostrar como fila de países bajo la categoría",
  },
  {
    value: "top-right",
    label: "Arriba dcha.",
    hint: "Países a la derecha, en la fila de la categoría",
    podcastOnly: true,
  },
  {
    value: "under-title",
    label: "Bajo titular",
    hint: "Países entre el titular y la bajada",
    podcastOnly: true,
  },
  {
    value: "bottom",
    label: "Pie",
    hint: "Países abajo, a la derecha en la línea de la marca",
    podcastOnly: true,
  },
  {
    value: "none",
    label: "Ocultar",
    hint: "Ocultar mención de países",
  },
];

/** Encuadre «cover» de un medio sobre el lienzo (recorta por el centro, con
 *  rotación ISO 14496). Lo comparten el fondo del post-podcast y el 16:9. */
const drawCoverFrame = (
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  elW: number,
  elH: number,
  rot: number,
  W: number,
  H: number,
) => {
  const dispW = rot % 180 === 90 ? elH : elW;
  const dispH = rot % 180 === 90 ? elW : elH;
  const targetRatio = W / H;
  const sourceRatio = dispW / dispH;
  let sx = 0;
  let sy = 0;
  let sw = dispW;
  let sh = dispH;
  if (sourceRatio > targetRatio) {
    sw = dispH * targetRatio;
    sx = (dispW - sw) / 2;
  } else {
    sh = dispW / targetRatio;
    sy = (dispH - sh) / 2;
  }
  if (!rot) {
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
    return;
  }
  let csx = sx;
  let csy = sy;
  let csw = sw;
  let csh = sh;
  if (rot === 90) {
    csx = sy;
    csy = dispW - sx - sw;
    csw = sh;
    csh = sw;
  } else if (rot === 180) {
    csx = dispW - sx - sw;
    csy = dispH - sy - sh;
  } else if (rot === 270) {
    csx = dispH - sy - sh;
    csy = sx;
    csw = sh;
    csh = sw;
  }
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(src, csx, csy, csw, csh, -dispW / 2, -dispH / 2, dispW, dispH);
  ctx.restore();
};

/** Pinta un fotograma del cierre de marca a sangre del lienzo SIN overlays
 *  (sin chyron, sin ticker, sin velos): es un sello de cierre, no una toma del
 *  reportaje. Encuadre «contain» sobre negro para no recortar el sello en los
 *  formatos verticales; con el negro AMOLED las bandas pasan desapercibidas y
 *  en 16:9 (1920×1000 en 1920×1080) apenas se notan 40 px. Los tamaños van en
 *  enteros para no dejar costuras de medio píxel contra el negro. */
const paintOutroFrame = (
  targetCanvas: HTMLCanvasElement,
  W: number,
  H: number,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  rot = 0,
): void => {
  if (targetCanvas.width !== W) targetCanvas.width = W;
  if (targetCanvas.height !== H) targetCanvas.height = H;
  const ctx = targetCanvas.getContext("2d");
  if (!ctx || !sw || !sh) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  const spin = ((rot % 360) + 360) % 360;
  const dispW = spin % 180 === 90 ? sh : sw;
  const dispH = spin % 180 === 90 ? sw : sh;
  const scale = Math.min(W / dispW, H / dispH);
  const dw = Math.round(dispW * scale);
  const dh = Math.round(dispH * scale);
  if (!spin) {
    ctx.drawImage(
      source,
      Math.round((W - dw) / 2),
      Math.round((H - dh) / 2),
      dw,
      dh,
    );
    return;
  }
  // Con giro (tkhd de móvil): se rota alrededor del centro con la caja previa
  // al giro, para que tras girar ocupe exactamente dw×dh.
  const bw = spin % 180 === 90 ? dh : dw;
  const bh = spin % 180 === 90 ? dw : dh;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((spin * Math.PI) / 180);
  ctx.drawImage(source, -bw / 2, -bh / 2, bw, bh);
  ctx.restore();
};

/** Muestras y metadata de un MP4 H.264 listas para WebCodecs. */
interface DemuxedAvcClip {
  samples: Array<{
    cts: number;
    duration: number;
    is_sync: boolean;
    data: Uint8Array;
  }>;
  /** timescale de la pista de vídeo (p. ej. 90000). */
  ts: number;
  /** duración declarada de la pista en segundos (0 si es fragmentado). */
  srcDur: number;
  /** avcC empaquetado (ISO 14496-15) para VideoDecoder.configure. */
  description: Uint8Array;
  /** giro de tkhd en grados (0/90/180/270). */
  rot: number;
  codec: string;
}

/** Demux MP4 → muestras en orden de decodificación + descripción avcC.
 *  Devuelve null si el archivo no es AVC decodificable (la ruta rápida lo
 *  salta a la clásica); lanza si mp4box encuentra un error real del archivo. */
const demuxAvcClip = async (
  raw: ArrayBuffer,
): Promise<DemuxedAvcClip | null> => {
  const { createFile } = await import("mp4box");
  const mp4 = createFile(true);
  const samples: DemuxedAvcClip["samples"] = [];
  let readyInfo: any = null;
  let demuxError: string | null = null;
  mp4.onError = (e) => {
    demuxError = String(e);
  };
  mp4.onReady = (ready) => {
    readyInfo = ready;
    const vt = (ready as any).tracks?.find((t: any) => t.type === "video");
    if (vt) {
      // Extrae todas las muestras de golpe (se dispara dentro de appendBuffer)
      mp4.setExtractionOptions(vt.id, null, { nbSamples: 1000000 });
      mp4.start();
    }
  };
  mp4.onSamples = (_id, _user, batch) => {
    for (const s of batch as any[]) samples.push(s);
  };
  const buf = raw as ArrayBuffer & { fileStart: number };
  buf.fileStart = 0;
  mp4.appendBuffer(buf);
  if (typeof (mp4 as any).flush === "function") (mp4 as any).flush();
  if (demuxError) throw new Error(demuxError);

  const vTrack = readyInfo?.tracks?.find((t: any) => t.type === "video");
  if (!vTrack || samples.length < 2 || !/^avc1/.test(String(vTrack.codec)))
    return null;

  // avcC → descripción binaria que necesita VideoDecoder (ISO 14496-15)
  const stsd = (mp4.getTrackById(vTrack.id) as any)?.mdia?.minf?.stbl?.stsd;
  const avcCBox = stsd?.entries?.[0]?.avcC;
  // mp4box v2 envuelve cada NALU en { length, data } donde data son los bytes
  const toNalBytes = (nal: unknown): Uint8Array => {
    const anyNal = nal as any;
    const src =
      anyNal instanceof Uint8Array || Array.isArray(anyNal)
        ? anyNal
        : anyNal?.data;
    if (src instanceof Uint8Array) return src;
    if (Array.isArray(src)) return Uint8Array.from(src);
    if (src && typeof src === "object")
      return Uint8Array.from(Object.values(src));
    return new Uint8Array(0);
  };
  const spsList = ((avcCBox?.SPS ?? []) as unknown[])
    .map(toNalBytes)
    .filter((b) => b.length > 0);
  const ppsList = ((avcCBox?.PPS ?? []) as unknown[])
    .map(toNalBytes)
    .filter((b) => b.length > 0);
  if (spsList.length === 0) return null;
  const descSize =
    7 +
    spsList.reduce((n, s) => n + 2 + s.length, 0) +
    ppsList.reduce((n, p) => n + 2 + p.length, 0);
  const description = new Uint8Array(descSize);
  let dOff = 0;
  description[dOff++] = 1; // configurationVersion
  description[dOff++] = avcCBox.AVCProfileIndication ?? 0x4d;
  description[dOff++] = avcCBox.profile_compatibility ?? 0x00;
  description[dOff++] = avcCBox.AVCLevelIndication ?? 0x1f;
  description[dOff++] = 0xff; // reservado + lengthSizeMinusOne = 3
  description[dOff++] = 0xe0 | spsList.length;
  for (const nal of spsList) {
    description[dOff++] = (nal.length >> 8) & 0xff;
    description[dOff++] = nal.length & 0xff;
    description.set(nal, dOff);
    dOff += nal.length;
  }
  description[dOff++] = ppsList.length;
  for (const nal of ppsList) {
    description[dOff++] = (nal.length >> 8) & 0xff;
    description[dOff++] = nal.length & 0xff;
    description.set(nal, dOff);
    dOff += nal.length;
  }

  // Rotación declarada en tkhd: los móviles guardan el vídeo "acostado" y el
  // <video> la aplica solo; los fotogramas decodificados llegan en crudo.
  const norm = (v: number) => (v > 0x7fffffff ? v - 0x100000000 : v);
  const m: ArrayLike<number> | undefined = (mp4.getTrackById(vTrack.id) as any)
    ?.tkhd?.matrix;
  let rot = 0;
  if (m && m.length >= 5) {
    const a = norm(Number(m[0]));
    const b = norm(Number(m[1]));
    const c = norm(Number(m[3]));
    const d = norm(Number(m[4]));
    // ISO 14496: x' = a·x + c·y ; y' = b·x + d·y (píxeles que ve el <video>).
    // b=−1,c=+1 ⇒ la derecha del origen queda arriba = giro antihorario ⇒
    // ctx.rotate(270°); b=+1 es el sentido contrario ⇒ ctx.rotate(90°).
    if (a === 0 && b === -65536 && c === 65536 && d === 0) rot = 270;
    else if (a === -65536 && b === 0 && c === 0 && d === -65536) rot = 180;
    else if (a === 0 && b === 65536 && c === -65536 && d === 0) rot = 90;
  }

  const ts = Number(vTrack.timescale) || 90000;
  return {
    samples,
    ts,
    srcDur: Number(vTrack.duration) / ts,
    description,
    rot,
    codec: String(vTrack.codec),
  };
};

// ── Intro animada del formato TV (16:9) ─────────────────────────────────────
// Curvas compartidas por el lienzo y la vista previa: el titular del chyron
// entra escalonado durante los primeros segundos, se mantiene y sale al final
// de la intro para dejar paso al vídeo en color.
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
/** Entrada de la línea i del titular (0,15 s de arranque, 12 ms de atraso). */
const tvIntroLineIn = (t: number, i: number) =>
  easeOutCubic((t - 0.15 - i * 0.12) / 0.5);
/** Entrada de la fila de etiqueta (sección + países). */
const tvIntroTagIn = (t: number) => easeOutCubic((t - 0.05) / 0.4);
/** Entrada de la caja del chyron (crece desde la izquierda). */
const tvIntroBoxIn = (t: number) => easeOutCubic(t / 0.35);
/** Salida del chyron completo en el último tramo de la intro (0 → 1). */
const tvIntroExit = (t: number, dur: number) =>
  clamp01((t - (dur - 0.7)) / 0.6);

// ── Transición «texto → vídeo» del formato 4:5 ───────────────────────────────
// Pasados textFadeOutDur s de contenido, el bloque de texto (categoría,
// insignia, titular y bajada) se desvanece en este margen de tiempo para que
// el vídeo de fondo ocupe la tarjeta entera. El sello BlackNews de abajo a la
// izquierda nunca se toca: se pinta siempre, al final de todo.
const TEXT_FADE_MOVE = 0.6;

// ── Tema de fondo («Tema») dentro del archivo exportado ──────────────────────
// Mismos fundidos que la vista previa: sube en 900 ms cuando el texto empieza
// a irse (o desde el arranque si «texto → vídeo» está apagado) y baja en 1 s
// al entrar el cierre de marca — o al terminar el clip si no hay cierre.
const BG_THEME_IN_S = 0.9;
const BG_THEME_OUT_S = 1.0;

/** Automatización de volumen del tema sobre un `GainNode`.
 *
 *  En `t0` queda en 0, sube hasta `peak` con fundido de `BG_THEME_IN_S`
 *  segundos a partir de `inAt` y vuelve a 0 exactamente en `outAt` con una
 *  bajada de `BG_THEME_OUT_S`. Todos los tiempos van en el reloj de la pista
 *  (0 en el lienzo offline, `ctx.currentTime` en tiempo real) y en segundos.
 *
 *  Si la ventana (`outAt - inAt`) no da para los dos fundidos, sube y baja
 *  por la mitad de lo que haya; si no llega a haber ventana, no suena. */
const automateThemeGain = (
  gain: GainNode,
  t0: number,
  inAt: number,
  outAt: number,
  peak: number,
) => {
  const g = gain.gain;
  g.setValueAtTime(0, t0);
  if (outAt <= inAt) return;
  const win = outAt - inAt;
  if (win < BG_THEME_IN_S + BG_THEME_OUT_S) {
    g.linearRampToValueAtTime(peak, inAt + win / 2);
    g.linearRampToValueAtTime(0, outAt);
    return;
  }
  g.setValueAtTime(0, inAt);
  g.linearRampToValueAtTime(peak, inAt + BG_THEME_IN_S);
  g.setValueAtTime(peak, outAt - BG_THEME_OUT_S);
  g.linearRampToValueAtTime(0, outAt);
};

/** Ancho nominal de la tarjeta de vista previa por formato (px de pantalla).
 *  Es la base de `previewScale` y la que usa el render exportado para pasar
 *  la reposición del vídeo de px de vista previa a px de lienzo (1080). */
const previewCardWidthFor = (format: "4:5" | "9:16" | "16:9") =>
  format === "16:9" ? 480 : format === "9:16" ? 340 : 420;

/** ¿Se ve la tarjeta del tweet en este segundo de contenido?
 *
 *  `contentT` y `clipDur` van en las MISMAS unidades (segundos de contenido
 *  ya normalizados a la velocidad de reproducción). Sin reloj —imagen o PNG—
 *  o con el modo «todo el vídeo», se ve siempre. */
const tweetShownAt = (
  mode: "always" | "start" | "end",
  secs: number,
  contentT: number | undefined,
  clipDur: number,
): boolean => {
  if (mode === "always") return true;
  if (typeof contentT !== "number" || !(clipDur > 0)) return true;
  if (mode === "start") return contentT < secs;
  return contentT >= Math.max(0, clipDur - secs);
};

/** Transform de «Escala»/«Reposición» del bloque de media, con origen en el
 *  centro del rectángulo —igual que el CSS `scale() translate()` del
 *  preview—. Los offsets viajan en px de vista previa y se convierten a px de
 *  lienzo con el ancho nominal del formato. Con Escala = 1 no transforma. */
const applyMediaZoom = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  format: "4:5" | "9:16" | "16:9",
  zoom: number,
  offX: number,
  offY: number,
) => {
  if (zoom === 1 && offX === 0 && offY === 0) return;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const toCanvas = w / previewCardWidthFor(format);
  c.translate(cx, cy);
  c.scale(zoom, zoom);
  c.translate(offX * toCanvas, offY * toCanvas);
  c.translate(-cx, -cy);
};

// ── Tarjeta «tweet embebido» dibujada en el lienzo exportado ─────────────────
// Réplica del HTML de la vista previa: todas las medidas van en px de tarjeta
// de vista previa y se multiplican por `k` (ancho del lienzo / ancho nominal
// de tarjeta), así 4:5 y 9:16 salen con las mismas proporciones que en
// pantalla. Iconos: las mismas rutas SVG (viewBox 24×24) del preview.
const TWEET_ICON_REPLY =
  "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z";
const TWEET_ICON_RETWEET =
  "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z";
const TWEET_ICON_LIKE =
  "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z";
const TWEET_ICON_X =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

/** Añade al path actual un rectángulo de esquinas redondeadas. */
const pathRoundRect = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
};

/** Trunca `text` con «…» para que quepa en `maxW` con la fuente ya fijada. */
const fitTextEllipsis = (
  c: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string => {
  if (!(maxW > 0) || c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
};

/** Dibuja la tarjeta «tweet embebido» sobre el lienzo: degradado de apoyo,
 *  caja redondeada, avatar, nombre con check, cuerpo (máx. 5 líneas) y pie
 *  con fecha + métricas. `bottom` es la Y de la base de la tarjeta. */
const drawTweetCard = (
  ctx: CanvasRenderingContext2D,
  d: {
    W: number;
    /** Alto del lienzo: el degradado de apoyo baja hasta el borde. */
    H: number;
    k: number;
    bottom: number;
    name: string;
    handle: string;
    body: string;
    date: string;
    showEs: boolean;
    avatar: HTMLImageElement | null;
    letter: string;
  },
) => {
  const { W, H, k } = d;
  const inset = 12 * k; // px-3 del contenedor con degradado
  const padX = 12 * k; // px-3 de la tarjeta
  const padY = 10 * k; // py-2.5
  const radius = 16 * k; // rounded-2xl
  const gap = 10 * k; // gap-2.5
  const avatarSize = 36 * k; // w-9 h-9
  const xLogoSize = 14 * k; // w-3.5

  const cardX = inset;
  const cardW = W - inset * 2;
  const innerX = cardX + padX;
  const innerW = cardW - padX * 2;
  const colX = innerX + avatarSize + gap;
  const colW = innerW - avatarSize - gap - xLogoSize - gap;
  if (colW <= 24 * k) return; // tarjeta demasiado estrecha: nada que pintar

  const nameFs = 11.5 * k;
  const handleFs = 10.5 * k;
  const bodyFs = 11.5 * k;
  const bodyLh = bodyFs * 1.35; // leading-[1.35]
  const footFs = 9.5 * k;
  const iconSize = 12 * k;
  const nameRowH = 14 * k;
  const footH = 13 * k;

  // Cuerpo: envuelto y recortado a 5 líneas con «…» (line-clamp-5).
  ctx.font = `400 ${bodyFs}px 'Lexend', sans-serif`;
  const raw = wrapText(ctx, d.body || "", colW);
  const lines = raw.slice(0, 5);
  if (raw.length > 5 && lines.length > 0) {
    lines[lines.length - 1] = fitTextEllipsis(ctx, lines[lines.length - 1], colW);
  }
  const bodyH = lines.length * bodyLh;
  const cardH = padY * 2 + nameRowH + 4 * k + bodyH + 6 * k + footH;
  const cardTop = d.bottom - cardH;
  if (cardTop < 0) return; // no cabe: mejor no pintar una tarjeta cortada

  // Degradado del contenedor (pt-6 · pb-3 · from-black/90 via-black/70):
  // en el archivo llega hasta el borde inferior (el velo y el sello se
  // pintan después y quedan encima), así no queda costura sobre el pie.
  const gTop = cardTop - 24 * k;
  const gBot = H;
  const grad = ctx.createLinearGradient(0, gBot, 0, gTop);
  grad.addColorStop(0, "rgba(0,0,0,0.9)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.7)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, gTop, W, gBot - gTop);

  // Caja de la tarjeta (fondo neutral-950 al 85 % + borde blanco al 15 %).
  ctx.beginPath();
  pathRoundRect(ctx, cardX, cardTop, cardW, cardH, radius);
  ctx.fillStyle = "rgba(10,10,10,0.85)";
  ctx.fill();
  ctx.lineWidth = k;
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.stroke();

  const rowTop = cardTop + padY;
  const rowMid = rowTop + nameRowH / 2;
  ctx.textAlign = "start";
  ctx.textBaseline = "middle";

  // Avatar (recorte «cover») o letra inicial, con su anillo blanco al 20 %.
  const avCx = innerX + avatarSize / 2;
  const avCy = rowTop + avatarSize / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avCx, avCy, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  const iw = d.avatar ? d.avatar.naturalWidth || d.avatar.width : 0;
  const ih = d.avatar ? d.avatar.naturalHeight || d.avatar.height : 0;
  if (d.avatar && iw > 0 && ih > 0) {
    const s = Math.max(avatarSize / iw, avatarSize / ih);
    const sw = avatarSize / s;
    const sh = avatarSize / s;
    ctx.drawImage(
      d.avatar,
      (iw - sw) / 2,
      (ih - sh) / 2,
      sw,
      sh,
      avCx - avatarSize / 2,
      avCy - avatarSize / 2,
      avatarSize,
      avatarSize,
    );
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(
      avCx - avatarSize / 2,
      avCy - avatarSize / 2,
      avatarSize,
      avatarSize,
    );
    ctx.font = `700 ${13 * k}px 'Lexend', sans-serif`;
    ctx.fillStyle = "#a3a3a3";
    ctx.textAlign = "center";
    ctx.fillText(d.letter, avCx, avCy + 0.5 * k);
    ctx.textAlign = "start";
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(avCx, avCy, avatarSize / 2, 0, Math.PI * 2);
  ctx.lineWidth = k;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.stroke();

  // Nombre + check verificado + @usuario.
  ctx.font = `600 ${nameFs}px 'Lexend', sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  const nameText = fitTextEllipsis(ctx, d.name || "Usuario", colW * 0.45);
  ctx.fillText(nameText, colX, rowMid);
  const nameW = ctx.measureText(nameText).width;

  const badgeR = 6 * k;
  const badgeCx = colX + nameW + 4 * k + badgeR;
  ctx.beginPath();
  ctx.arc(badgeCx, rowMid, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = "#1d9bf0";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(badgeCx - 2.7 * k, rowMid + 0.1 * k);
  ctx.lineTo(badgeCx - 0.9 * k, rowMid + 1.9 * k);
  ctx.lineTo(badgeCx + 2.9 * k, rowMid - 2.3 * k);
  ctx.lineWidth = 1.7 * k;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  if (d.handle) {
    ctx.font = `400 ${handleFs}px 'Lexend', sans-serif`;
    ctx.fillStyle = "#a3a3a3";
    const hx = badgeCx + badgeR + 4 * k;
    ctx.fillText(
      fitTextEllipsis(ctx, d.handle, colX + colW - hx),
      hx,
      rowMid,
    );
  }

  // Cuerpo del tweet.
  ctx.font = `400 ${bodyFs}px 'Lexend', sans-serif`;
  ctx.fillStyle = "#f5f5f5";
  let ly = rowTop + nameRowH + 4 * k;
  for (const line of lines) {
    ctx.fillText(line, colX, ly + bodyLh / 2);
    ly += bodyLh;
  }

  // Pie: fecha (+ badge «ES» si está traducido) y métricas a la derecha.
  const footMid = rowTop + nameRowH + 4 * k + bodyH + 6 * k + footH / 2;
  ctx.font = `400 ${footFs}px 'Lexend', sans-serif`;
  ctx.fillStyle = "#737373";
  let lx = innerX;
  if (d.date) {
    ctx.fillText(d.date, lx, footMid);
    lx += ctx.measureText(d.date).width;
  }
  if (d.showEs) {
    lx += 6 * k;
    const esW = ctx.measureText("ES").width + 8 * k;
    const esH = 12 * k;
    ctx.beginPath();
    pathRoundRect(ctx, lx, footMid - esH / 2, esW, esH, 3 * k);
    ctx.lineWidth = k;
    ctx.strokeStyle = "rgba(56,189,248,0.4)";
    ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("ES", lx + 4 * k, footMid);
    ctx.fillStyle = "#737373";
    lx += esW;
  }

  const stats: Array<[string, string]> = [
    [TWEET_ICON_REPLY, "12"],
    [TWEET_ICON_RETWEET, "34"],
    [TWEET_ICON_LIKE, "567"],
  ];
  const statWs = stats.map(([, n]) => ctx.measureText(n).width);
  const statGap = 10 * k;
  const innerGap = 2 * k; // gap-0.5
  const totalW =
    stats.reduce((acc, _, i) => acc + iconSize + innerGap + statWs[i], 0) +
    statGap * (stats.length - 1);
  let sx = innerX + innerW - totalW;
  ctx.fillStyle = "#737373";
  for (let i = 0; i < stats.length; i++) {
    ctx.save();
    ctx.translate(sx, footMid - iconSize / 2);
    ctx.scale(iconSize / 24, iconSize / 24);
    ctx.fill(new Path2D(stats[i][0]));
    ctx.restore();
    ctx.fillText(stats[i][1], sx + iconSize + innerGap, footMid);
    sx += iconSize + innerGap + statWs[i] + statGap;
  }

  // Logotipo de X, arriba a la derecha de la fila.
  ctx.save();
  ctx.translate(innerX + innerW - xLogoSize, rowTop);
  ctx.scale(xLogoSize / 24, xLogoSize / 24);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill(new Path2D(TWEET_ICON_X));
  ctx.restore();
};

/** Sección plegable del generador.
 *
 *  El contenido se oculta con `hidden` y NO se desmonta: los controles
 *  conservan su valor, el foco no se pierde al recolocar y el JSON del
 *  borrador no cambia. Plegar es, por tanto, siempre reversible y nunca
 *  pierde nada — que es la condición para poder aligerar la columna de
 *  controles sin tocar funciones.
 *
 *  Va **controlada** desde el componente padre (`open` + `onToggle`) para
 *  que la cabecera de la columna pueda abrirlo o plegarlo todo de una vez.
 *
 *  Visual: mismo lenguaje que el resto del panel (etiqueta en versalitas,
 *  filete `border-white/5`, nada de bordes duros). Cerrada, la cabecera es
 *  una sola línea; abierta aparece el valor actual en mono a la derecha. */
const CollapseSection: React.FC<{
  title: string;
  icon?: React.ReactNode;
  /** Valor actual en mono junto al chevron; sólo se muestra abierta. */
  value?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, value, open, onToggle, children }) => {
  return (
    <div className={open ? "pt-3 border-t border-white/5 space-y-3" : "pt-0.5"}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 transition-colors group-hover:text-white">
          {icon}
          <span>{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {open && value ? (
            <span className="font-mono text-[10px] text-neutral-500">
              {value}
            </span>
          ) : null}
          <ChevronDown
            className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-200 group-hover:text-neutral-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>
      <div className={open ? "space-y-3" : "hidden"}>{children}</div>
    </div>
  );
};

/** Secciones plegables de la columna de controles. La lista es explícita
 *  (y no se deduce del DOM) para que «abrir todo / plegar todo» sepa
 *  siempre cuáles son. Sólo el formato de entrega arranca abierto: es lo
 *  único que suele cambiarse en cada export. */
const COLLAPSE_SECTION_KEYS = [
  "espaciado",
  "secciones-rapidas",
  "estilo-linea",
  "formato",
  "recortes",
  "duracion",
  "exposicion",
] as const;

type MediaFilter = "bw-high" | "bw-smooth" | "noir" | "color" | "muted-color";

// ── Prompt v2 del generador ────────────────────────────────────────────────
// El mismo texto alimenta la llamada directa (getClientSystemPrompt) y la
// plantilla que se copia para usar en una IA externa (buildAiPromptBase), y
// sus límites coinciden con buildSystemPrompt() de worker/ai.ts: los dos
// caminos (Worker y navegador) redactan con las mismas reglas.

/** Pregunta exacta cuando NO hay ninguna noticia que redactar: ni el cuadro
 *  de IA ni el post traen contexto. La IA pregunta en vez de inventar. */
const NO_CONTEXT_QUESTION = "¿Cuál es la noticia que debemos desarrollar?";

/** ¿El cuadro de partida habla de la MISMA noticia que el post? El cuadro se
 *  guarda de sesión en sesión, así que puede traer la noticia anterior: si no
 *  se cruza nada con el titular/bajada o con los países del post («delincuencia
 *  en Uruguay» frente a un post de Ucrania), ese texto es de otra noticia y
 *  sólo serviría para que la IA redacte sobre lo que ya no interesa. */
const isRelatedNews = (
  topic: string,
  postText: string,
  countries: CountryItem[],
): boolean => {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const t = norm(topic).trim();
  if (!t) return false;
  // Un país del post que aparezca en el cuadro: misma noticia.
  for (const c of countries) {
    const name = norm(c.name).trim();
    if (name && t.includes(name)) return true;
    const first = name.split(" ")[0];
    if (first.length >= 4 && t.includes(first)) return true;
  }
  // Raíces compartidas de 5 letras o más: «refinerías» casa con «refinería»,
  // «delincuencia» con «delincuencial». Hacen falta DOS para dar por buena la
  // coincidencia, así una palabra suelta tipo «gobierno» no mantiene un
  // texto viejo por casualidad.
  const roots = (s: string) =>
    Array.from(
      new Set(
        norm(s)
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 5),
      ),
    );
  const topicRoots = roots(t);
  const postRoots = new Set(roots(postText));
  return topicRoots.filter((w) => postRoots.has(w)).length >= 2;
};

/** Sistema propio de la reescritura por tono: es una tarea de texto plano,
 *  así que NO puede recibir el prompt de publicación (que exige JSON puro). */
const REWRITE_SYSTEM_PROMPT =
  "Eres el editor de BLACKNEWS. Reescribes un texto de publicación conservando el contenido y todos los datos: español neutro, grafía normal (Sentence Case), sin puntos suspensivos, sin saltos de línea, sin emojis, sin hashtags y sin explicaciones. Devuelve SOLO el texto reescrito, listo para pegar en el campo, y nada más.";

/** Quita lo que el modelo insista en meter en el cuerpo del tweet (corchete
 *  de banderas, «» y firma): el cliente vuelve a montarlo con los países
 *  reales del post. Espejo de `cleanTweetBody` de worker/ai.ts para que el
 *  tweet salga idéntico venga del Worker o del navegador. */
const cleanAiTweetBody = (value: string): string => {
  let body = value.replace(/\r\n?/g, "\n").trim();
  body = body.replace(/^\[[^\]\n]{0,40}\]\s*(?:[»\-–—:]\s*)?/u, "");
  body = body.replace(/(?:^|\s)(?:■\s*)?#BlackNews\b/giu, "");
  return body.replace(/\s+/g, " ").trim();
};

/** JSON tolerante del navegador (admite markdown y texto alrededor, como el
 *  Worker). Devuelve null si no hay nada parseable. */
const parseAiJson = (text: string): unknown | null => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

/** Núcleo del prompt: el texto literal de la plantilla de la redacción (de la
 *  introducción al apartado 6), sin el título ni la presentación, que cambia
 *  según se llame por API (JSON puro) o se copie para una IA externa. */
const buildEditorialPromptCore = (categories: string[]): string =>
  [
    "Actúa como editor periodístico de BlackNews, un medio internacional independiente. Tu tarea es transformar el contexto proporcionado en una publicación informativa y un texto para redes sociales.",
    "",
    "## 1. IDENTIFICAR LA NOTICIA",
    "",
    "- Identifica el tema principal a partir de la noticia, instrucciones y contexto proporcionados.",
    "- Trabaja exclusivamente sobre ese tema. No cambies de noticia ni mezcles acontecimientos independientes.",
    "- Los titulares y bajadas existentes son referencias que pueden corregirse, no instrucciones para conservar una noticia anterior.",
    "- Si existen varios temas, prioriza el que la redacción indique como principal.",
    `- Si no existe información suficiente para identificar la noticia, pregunta: ${NO_CONTEXT_QUESTION}`,
    "- No inventes información para completar datos faltantes.",
    "",
    "## 2. FORMATO DE SALIDA",
    "",
    "Entrega un objeto JSON válido con esta estructura exacta:",
    "",
    "{",
    '  "content": {',
    '    "title": "...",',
    '    "description": "...",',
    '    "category": "...",',
    '    "photoCaption": "...",',
    '    "selectedCountries": []',
    "  },",
    '  "tweetBody": "..."',
    "}",
    "",
    "No agregues propiedades.",
    "",
    "## 3. REDACCIÓN",
    "",
    "**TITLE**",
    "- Describe el hecho principal.",
    "- Exactamente 3 líneas, separadas por \\n.",
    "- Entre 5 y 6 palabras por línea.",
    "- Entre 21 y 26 caracteres por línea.",
    "- Grafía normal, sin mayúsculas completas.",
    "- No desarrolles detalles secundarios.",
    "",
    "**DESCRIPTION**",
    "- Entre 120 y 170 caracteres.",
    "- Una o dos frases en una sola línea.",
    "- Amplía el titular con cifras, fechas, protagonistas, antecedentes o consecuencias.",
    "- Evita repetir información ya expresada en el titular.",
    "",
    "**CATEGORY**",
    "",
    "Selecciona una sola categoría de esta lista:",
    "",
    ...(categories.length > 0 ? categories : ["(ninguna habilitada)"]),
    "",
    "**PHOTOCAPTION**",
    "- Máximo 60 caracteres.",
    "- Crédito o descripción de la fotografía.",
    '- Si no corresponde, utiliza "".',
    "",
    "**SELECTEDCOUNTRIES**",
    "- Entre 0 y 4 países relacionados directamente con la noticia.",
    "- Utiliza código ISO de dos letras en mayúsculas, nombre en español y bandera correcta.",
    "- Ordena por relevancia.",
    "- Si no corresponde, utiliza [].",
    "",
    "## 4. TWEET / REDES SOCIALES",
    "",
    "Genera un texto complementario sobre el mismo acontecimiento.",
    "",
    "- Una sola línea.",
    "- Máximo 215 caracteres.",
    "- Aporta un dato, antecedente, reacción o consecuencia que no esté desarrollado en el titular ni en la descripción.",
    "- No repitas innecesariamente información.",
    "- Sin emojis, hashtags, enlaces, comillas ni opiniones personales.",
    "- No agregues [banderas], el símbolo » ni #BlackNews: la plataforma los incorpora automáticamente.",
    "",
    "## 5. CRITERIO EDITORIAL",
    "",
    "- Español neutro.",
    "- Estilo profesional, directo, preciso y contundente.",
    "- Prioriza hechos verificables, cifras y fuentes identificables.",
    "- Diferencia hechos confirmados, propuestas, denuncias, investigaciones y especulaciones.",
    "- Atribuye las declaraciones a sus respectivas fuentes.",
    "- No presentes acusaciones como hechos probados.",
    "- No elogies ni condenes automáticamente a gobiernos, partidos o instituciones.",
    "- No utilices lenguaje propagandístico, burocrático ni adjetivos innecesarios.",
    "- No inventes cifras, fechas, nombres, declaraciones ni fuentes.",
    "- Si tienes acceso a herramientas de búsqueda, verifica los datos antes de redactar.",
    "",
    "## 6. REGLAS FINALES",
    "",
    "Antes de responder, comprueba que:",
    "- Los tres textos se refieren al mismo acontecimiento.",
    "- Cada campo aporta información diferente.",
    "- Se respetan las extensiones y formatos.",
    "- La categoría pertenece al catálogo.",
    "- Los países y sus banderas son correctos.",
    "- El JSON es válido y no contiene propiedades adicionales.",
  ].join("\n");

export const SocialPostGenerator: React.FC<SocialPostGeneratorProps> = ({
  reports = [],
  categories: propCategories = [],
  importPayload = null,
  onImportConsumed,
}) => {
  // Combine prop categories with expanded list without duplicates
  const allAvailableCategories = Array.from(
    new Set([
      ...EXPANDED_CATEGORIES,
      ...propCategories.filter((c) => c !== "TODAS"),
    ]),
  );

  // Secciones realmente habilitadas en «Gestión de Categorías». Es la lista
  // que la IA debe respetar y la que recibe el modelo en cada petición: si
  // mañana se añade o se quita una sección, ella la contempla sin desplegar
  // nada nuevo. Si el medio todavía no ha tocado el catálogo, manda la lista
  // canónica del sitio (allAvailableCategories incluye además secciones que
  // alguien pudiera haber borrado, así que no sirve como fuente de verdad).
  const liveCategories = propCategories.filter((c) => c !== "TODAS");
  const enabledCategories =
    liveCategories.length > 0 ? liveCategories : EXPANDED_CATEGORIES;

  // Post Text Content
  const [category, setCategory] = useState("GEOPOLÍTICA");
  const [title, setTitle] = useState(
    "Oriente Medio,\nen una nueva fase\nde incertidumbre",
  );
  const [description, setDescription] = useState(
    "La escalada de tensiones entre Israel e Irán reconfigura el tablero regional y pone a prueba la estabilidad global.",
  );
  // Optional caption/character at bottom right of photo
  const [photoCaption, setPhotoCaption] = useState<string>("");
  // Procedencia del hallazgo OSINT importado: franja visible con el enlace
  // original. Vive fuera del borrador JSON para no alterar su contrato.
  // Si la importación trajo traducción automática, conserva el texto
  // original de la fuente para que el editor pueda compararlo.
  const [osintSource, setOsintSource] = useState<
    {
      name: string;
      url: string;
      publishedAt?: string;
      machineTranslated?: boolean;
      originalTitle?: string;
      originalSnippet?: string;
    } | null
  >(null);

  // Countries / Regional attribution
  const [selectedCountries, setSelectedCountries] = useState<CountryItem[]>([
    { name: "Israel", code: "IL", flag: "🇮🇱" },
    { name: "Irán", code: "IR", flag: "🇮🇷" },
  ]);
  const [customCountryName, setCustomCountryName] = useState("");
  const [countryPlacement, setCountryPlacement] =
    useState<CountryPlacement>("line");
  const [countryFormat, setCountryFormat] = useState<
    "names" | "flags-names" | "flags-codes" | "flags-only"
  >("names");
  const [countrySearch, setCountrySearch] = useState("");
  // Catálogo reactivo (destacados + personalizados + resto + Internacional)
  const countryCatalog = useCountryCatalog();
  const [autoFitHeader, setAutoFitHeader] = useState(true);
  const [headerSize, setHeaderSize] = useState(20);

  // Media state
  // "audio" = modo podcast: el medio principal es un archivo de sonido y el
  // fondo es opcional (negro puro o una imagen plana oscurecida).
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio">(
    "image",
  );
  const [mediaSrc, setMediaSrc] = useState<string>(DEFAULT_MEDIA_SRC);
  const [mediaName, setMediaName] = useState<string>("Imagen predeterminada");
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Post podcast: variante AMOLED minimalista ──
  // "news" es la estética de siempre; "podcast" es la variante de las notas en
  // audio (fondo negro absoluto, onda y reloj). Subir un audio activa el modo
  // solo, y se puede volver a la estética clásica sin perder el archivo.
  const [postDesign, setPostDesign] = useState<"news" | "podcast">("news");
  // Fondo del podcast: imagen plana opcional (blob/data/https). Vacío = negro.
  const [podcastBgSrc, setPodcastBgSrc] = useState<string>("");
  const [podcastBgName, setPodcastBgName] = useState<string>("");
  // Picos de la onda (0..1) del audio cargado. Vacío = onda plana (todavía
  // analizando o sin audio decodificable).
  const [audioPeaks, setAudioPeaks] = useState<number[]>([]);
  // true mientras se decodifica el archivo para dibujar la onda.
  const [audioAnalyzing, setAudioAnalyzing] = useState(false);
  // Cabecera del podcast: serie y episodio, ambos opcionales.
  // Por defecto la serie arranca con "Noticias en 1 minuto".
  const [podcastSeries, setPodcastSeries] = useState("Noticias en 1 minuto");
  const [podcastEpisode, setPodcastEpisode] = useState("");
  // Titular automático con la fecha: serie en grande y fecha en línea separada más pequeña.
  const [podcastAutoTitle, setPodcastAutoTitle] = useState(true);
  // Cama musical de BlackNews: sonido de fondo MUY por debajo de la voz.
  // Se mezcla igual en la vista previa y en el archivo exportado.
  const [podcastMusicOn, setPodcastMusicOn] = useState(true);
  const [podcastMusicVol, setPodcastMusicVol] = useState(0.12);
  // Estilo de banderas/países de la tarjeta (ver PODCAST_FLAG_STYLES).
  const [podcastFlagStyle, setPodcastFlagStyle] =
    useState<PodcastFlagStyle>("auto");
  // Variante que se pinta de verdad: «auto» muestrea según cuántos países
  // haya en el post; el resto es el estilo fijo elegido en el panel.
  const podcastFlagMode: PodcastFlagMode =
    podcastFlagStyle === "auto"
      ? autoFlagMode(selectedCountries.length)
      : podcastFlagStyle;

  // Formato de salida: el mismo post se genera en 4:5 (1080×1350), 9:16
  // (1080×1920, el vertical de TikTok / Shorts / Reels) o 16:9 (1920×1080) con
  // estética de señal de televisión: bug de canal arriba, chyron de titular
  // abajo a la izquierda y ticker inferior. Lo comparten la vista previa, el
  // render del canvas y las dos rutas de exportación (PNG y video).
  const [postFormat, setPostFormat] = useState<"4:5" | "9:16" | "16:9">("4:5");
  const POST_W = postFormat === "16:9" ? 1920 : 1080;
  const POST_H =
    postFormat === "16:9" ? 1080 : postFormat === "9:16" ? 1920 : 1350;
  const formatSlug =
    postFormat === "16:9" ? "16x9" : postFormat === "9:16" ? "9x16" : "4x5";

  // Reloj del formato TV: en el lienzo se toma Date() al pintar (avanza en
  // cada fotograma del vídeo); la vista previa refresca cada 15 s con este
  // estado para que la esquina superior no quede congelada.
  const [tvNow, setTvNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (postFormat !== "16:9") return;
    const id = setInterval(() => setTvNow(new Date()), 15000);
    return () => clearInterval(id);
  }, [postFormat]);
  const tvPad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
  const tvClockLabel = `${tvPad2(tvNow.getHours())}:${tvPad2(tvNow.getMinutes())}`;
  // Cápsula "● EN DIRECTO" del bug superior: opcional. La hora de emisión se
  // muestra siempre (es parte del aire del canal).
  const [tvShowLive, setTvShowLive] = useState(true);
  // Hora de emisión en el bug superior: opcional (por defecto visible).
  const [tvShowClock, setTvShowClock] = useState(true);
  // Intro del post: pasada propia en la que el vídeo arranca desde su
  // principio y sin sonido; al terminar la intro el vídeo vuelve a empezar
  // desde el principio para no perderse nada. En 16:9 se pintan además las
  // fases de TV (B&N, chyron animado y su desaparición tras la intro).
  const [tvIntro, setTvIntro] = useState(true);
  const [tvIntroDur, setTvIntroDur] = useState(5); // segundos de intro
  // ─── Transición de texto en 4:5/9:16 ───
  // Al activarla, el texto (categoría, título, descripción) se oculta después
  // de unos segundos para mostrar el video de fondo, pero el logo BlackNews
  // SIEMPRE permanece visible en la esquina inferior izquierda.
  const [textFadeOut, setTextFadeOut] = useState(false);
  const [textFadeOutDur, setTextFadeOutDur] = useState(3); // segundos antes de ocultar
  // Progreso (0 → 1) de esa transición en la vista previa: lo mueve el reloj
  // de reproducción; el lienzo exportado lo calcula a partir de su propio
  // segundo de contenido (ver renderToCanvas).
  const [textFadeP, setTextFadeP] = useState(0);
  // Cierre de marca opcional (Blacknews.mp4): APAGADO por defecto. Cuando está
  // activo, la vista previa y el archivo exportado terminan reproduciendo el
  // sello de cierre — a sangre del lienzo, sin chyron ni ticker — y con su
  // audio (salvo que se exporte en silencio). Todos los formatos: 4:5, 9:16 y
  // 16:9.
  const [videoOutro, setVideoOutro] = useState(false);
  const [outroDuration, setOutroDuration] = useState(OUTRO_DUR_FALLBACK);
  // Marca de agua opcional (transparente) en el centro / esquina.
  const [watermark, setWatermark] = useState(false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.35);
  // Posición/escala del video en la vista previa (reposición opcional)
  const [mediaZoom, setMediaZoom] = useState(1);
  const [mediaOffsetX, setMediaOffsetX] = useState(0);
  const [mediaOffsetY, setMediaOffsetY] = useState(0);
  const [bgAudio, setBgAudio] = useState(false);
  const [bgVolume, setBgVolume] = useState(0.6);
  const bgAudioElementRef = useRef<HTMLAudioElement | null>(null);
  // Tweet pegado (texto o URL): se muestra en el preview sin API key.
  const [tweetText, setTweetText] = useState("");
  const [tweetHtml, setTweetHtml] = useState("");
  const [tweetLoading, setTweetLoading] = useState(false);
  // Datos de la tarjeta «tweet embebido» (se rellenan desde oEmbed si hay URL).
  const [tweetName, setTweetName] = useState("");
  const [tweetHandle, setTweetHandle] = useState("");
  const [tweetAvatar, setTweetAvatar] = useState("");
  const [tweetBody, setTweetBody] = useState("");
  const [tweetDate, setTweetDate] = useState("");
  // Traducción automática del cuerpo al español (sin API key).
  const [tweetTranslate, setTweetTranslate] = useState(true);
  const [tweetBodyEs, setTweetBodyEs] = useState("");
  const [tweetTranslating, setTweetTranslating] = useState(false);
  // true si el usuario subió/editó el avatar a mano (no lo pisa el oEmbed).
  const tweetAvatarManualRef = useRef(false);
  // Subida opcional de la tarjeta del tweet sobre el sello inferior (px).
  const [tweetLift, setTweetLift] = useState(0);
  // Cuándo se ve la tarjeta en vídeo: todo el clip, sólo los primeros N s o
  // sólo los últimos N s (en PNG sale siempre). `tweetOn` es el estado ya
  // resuelto del reloj: sólo cambia al cruzar el umbral, para no repintar
  // en cada fotograma.
  const [tweetShowMode, setTweetShowMode] = useState<
    "always" | "start" | "end"
  >("always");
  const [tweetShowSecs, setTweetShowSecs] = useState(5);
  const [tweetOn, setTweetOn] = useState(true);
  // Altura real del sello «BlackNews» de abajo: la tarjeta del tweet se apoya
  // justo encima para no quedar tapada ni «muy abajo».
  const previewFooterRef = useRef<HTMLDivElement>(null);
  const [previewFooterH, setPreviewFooterH] = useState(0);
  // true mientras el cierre ocupa la vista previa (y durante su fase en la
  // ruta clásica de exportación, donde el mismo <video> alimenta el lienzo).
  const [outroActive, setOutroActive] = useState(false);
  const outroActiveRef = useRef(false);
  // Pausa de la vista previa: aquí arriba para que el ciclo del tema de fondo
  // (justo debajo) pueda leerla en su efecto de fase.
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  // ── Ciclo del tema de fondo ──
  // Suena mientras se ve el vídeo —a partir del fundido «texto → vídeo», o
  // desde el arranque si ese fundido está apagado— y se desvanece con un fade
  // suave al entrar el outro o al pausar la vista previa. El elemento <audio>
  // sólo nace con el vídeo y el tema activado.
  const bgAudioRafRef = useRef(0);
  // Fase «sonando»: la decide el efecto de fase de abajo y la leen los otros.
  const bgAudioOnRef = useRef(false);
  // «Una vez el texto se fue, el tema sigue hasta el outro» (no se corta en
  // cada vuelta del lazo, cuando el titular vuelve a aparecer).
  const bgAudioLatchedRef = useRef(false);
  const bgVolumeRef = useRef(bgVolume);

  const stopBgRamp = () => {
    cancelAnimationFrame(bgAudioRafRef.current);
    bgAudioRafRef.current = 0;
  };

  // Volumen del tema con rampa: fade in/out en vez de cortes secos.
  const rampBgAudio = (to: number, ms: number) => {
    stopBgRamp();
    const el = bgAudioElementRef.current;
    if (!el) return;
    const from = el.volume;
    if (ms <= 0 || Math.abs(from - to) < 0.002) {
      el.volume = to;
      return;
    }
    const t0 = performance.now();
    const step = () => {
      const k = clamp01((performance.now() - t0) / ms);
      el.volume = from + (to - from) * k;
      if (k < 1) bgAudioRafRef.current = requestAnimationFrame(step);
    };
    bgAudioRafRef.current = requestAnimationFrame(step);
  };

  // Desbloqueo de autoplay: el <audio> sólo puede sonar tras una interacción
  // del usuario. Se queda reproduciendo en silencio y la fase de abajo decide
  // cuándo sube el volumen.
  useEffect(() => {
    if (!bgAudio) return;
    let unlocked = false;
    const tryPlay = () => {
      const el = bgAudioElementRef.current;
      if (!el || unlocked) return;
      el.volume = 0;
      el.play()
        .then(() => {
          unlocked = true;
          document.removeEventListener("mousedown", tryPlay);
          document.removeEventListener("touchstart", tryPlay);
          // Si la fase ya pide tema (p. ej. reactivar con el texto ya fuera),
          // el fade in arranca en cuanto el navegador lo permite.
          if (bgAudioOnRef.current) rampBgAudio(bgVolumeRef.current, 900);
        })
        .catch(() => {
          /* bloqueado por autoplay: se reintentará en la siguiente interacción */
        });
    };
    document.addEventListener("mousedown", tryPlay);
    document.addEventListener("touchstart", tryPlay);
    tryPlay();
    return () => {
      document.removeEventListener("mousedown", tryPlay);
      document.removeEventListener("touchstart", tryPlay);
    };
    // mediaType/postDesign desmontan y remontan el <audio>: hay que volver a
    // desbloquear el autoplay sobre el elemento nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgAudio, mediaType, postDesign]);

  // Fases del aviso en la vista previa: `warningActive` mientras suena el
  // cartel y `warningFrameActive` durante la portada de 3 s. Declarados aquí
  // (y no en el bloque del aviso, más abajo) porque el efecto del tema de
  // fondo, justo debajo, los usa para no sonar en esas fases: en el archivo
  // el tema espera a que termine el aviso.
  const [warningActive, setWarningActive] = useState(false);
  const [warningFrameActive, setWarningFrameActive] = useState(false);

  // Fase del tema: encendido cuando el texto empieza a irse (o desde el
  // arranque si «texto → vídeo» está apagado) y apagado con fade al entrar el
  // outro o al pausar la vista previa. El «latch» evita que el tema se corte
  // en cada vuelta del lazo, cuando el titular vuelve a aparecer: una vez
  // sonando, lo sigue hasta el outro.
  useEffect(() => {
    const el = bgAudioElementRef.current;
    const fadeArmed =
      textFadeOut &&
      mediaType === "video" &&
      postDesign !== "podcast" &&
      (postFormat === "4:5" || postFormat === "9:16");
    if (outroActive || !bgAudio || !fadeArmed) {
      bgAudioLatchedRef.current = false;
    }
    if (fadeArmed && textFadeP > 0) bgAudioLatchedRef.current = true;
    const wantSound =
      !!el &&
      bgAudio &&
      isVideoPlaying &&
      !outroActive &&
      // Durante el aviso el archivo mantiene el tema mudo (sube al llegar el
      // clip): la vista previa no debe sonar en la portada ni en el cartel.
      !(fadeArmed && (warningActive || warningFrameActive)) &&
      (fadeArmed ? bgAudioLatchedRef.current : true);
    const prev = bgAudioOnRef.current;
    bgAudioOnRef.current = wantSound;
    if (!el) {
      // Sin elemento (tema apagado o sin vídeo): cualquier rampa en curso
      // queda cancelada para no tocar un <audio> desmontado.
      stopBgRamp();
      return;
    }
    if (wantSound === prev) return;
    // Transición de fase: fade in (900 ms) o fade out (1 s) del tema.
    rampBgAudio(wantSound ? bgVolumeRef.current : 0, wantSound ? 900 : 1000);
  }, [
    bgAudio,
    textFadeP,
    outroActive,
    isVideoPlaying,
    textFadeOut,
    mediaType,
    postFormat,
    postDesign,
    warningActive,
    warningFrameActive,
  ]);

  // Cambio del volumen elegido: lo guarda la rampa y, si el tema suena,
  // asciende/desciende corto hasta el nuevo nivel.
  useEffect(() => {
    bgVolumeRef.current = bgVolume;
    if (bgAudioOnRef.current) rampBgAudio(bgVolume, 300);
  }, [bgVolume]);

  // Fetch oEmbed público de Twitter (sin API key) cuando el usuario pega una URL.
  // Rellena la tarjeta embebida: autor, @usuario, avatar (vía unavatar, sin key),
  // cuerpo del tweet y fecha.
  useEffect(() => {
    if (!tweetText) {
      setTweetHtml("");
      setTweetBody("");
      setTweetName("");
      setTweetHandle("");
      setTweetDate("");
      return;
    }
    const trimmed = tweetText.trim();
    const isUrl = /^https?:\/\/(?:twitter\.com|x\.com)\/[^\/]+\/status\/\d+/i.test(trimmed);
    if (!isUrl) {
      // Texto pegado a mano: se muestra tal cual (autor/avatar a cargo del usuario).
      setTweetHtml("");
      setTweetBody(trimmed);
      return;
    }
    setTweetLoading(true);
    const url = trimmed;
    fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`)
      .then(async (res) => {
        if (!res.ok) throw new Error("oEmbed no disponible");
        const data = await res.json();
        setTweetHtml(data.html || "");
        if (data.author_name) setTweetName(data.author_name);
        let handle = "";
        if (data.author_url) {
          const m = data.author_url.match(/(?:twitter|x)\.com\/([^\/\?\#]+)/i);
          if (m) handle = m[1];
        }
        if (handle) setTweetHandle(handle);
        // Avatar público (sin API key) salvo que el usuario haya puesto el suyo.
        if (!tweetAvatarManualRef.current) {
          setTweetAvatar(handle ? `https://unavatar.io/twitter/${handle}` : "");
        }
        // Cuerpo y fecha desde el HTML del bloque.
        if (data.html) {
          try {
            const doc = new DOMParser().parseFromString(data.html, "text/html");
            const p = doc.querySelector("blockquote p") || doc.querySelector("p");
            if (p) setTweetBody((p.textContent || "").trim());
            const links = Array.from(doc.querySelectorAll("a"));
            const dateLink = links.find((a) =>
              /(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}|\d{4})/i.test(
                a.textContent || ""
              )
            );
            if (dateLink) setTweetDate((dateLink.textContent || "").trim());
          } catch {
            /* el HTML no es parseable: seguimos con lo que haya */
          }
        }
      })
      .catch(() => {
        setTweetHtml("");
        setTweetBody(trimmed); // fallback: mostrar la URL mientras tanto
      })
      .finally(() => setTweetLoading(false));
  }, [tweetText]);

  // Traducción del cuerpo del tweet al español, sin API key: Google (gtx) y,
  // si ese falla, MyMemory como respaldo. Se debouncea para no disparar una
  // petición por tecla y se descarta si el texto cambia a mitad de vuelo.
  useEffect(() => {
    const src = tweetBody.trim();
    if (!src || !tweetTranslate) {
      setTweetBodyEs("");
      setTweetTranslating(false);
      return;
    }
    let cancelled = false;
    setTweetTranslating(true);
    const q = encodeURIComponent(src);
    // «Ya es español»: con acentos/¿¡ o palabras típicas no se traduce (y se
    // evita el respaldo, que asume origen inglés y podría destrozarlo).
    const looksEs =
      /[áéíóúñ¿¡]/i.test(src) ||
      /\b(el|la|los|las|de|que|en|un|una|por|con|para|como|esta|este|está|están|son|pero|muy)\b/i.test(
        src,
      );
    const timer = window.setTimeout(() => {
      (async () => {
        let out = "";
        try {
          const r = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${q}`,
          );
          if (r.ok) {
            const data: unknown = await r.json();
            const groups = Array.isArray(data) ? (data as unknown[]) : [];
            const first = Array.isArray(groups[0]) ? (groups[0] as unknown[]) : [];
            out = first
              .map((s) =>
                Array.isArray(s) && typeof s[0] === "string" ? (s[0] as string) : "",
              )
              .join("");
          }
        } catch {
          /* sin red o CORS: se intenta el respaldo */
        }
        if (!out.trim() && !looksEs) {
          try {
            const r = await fetch(
              `https://api.mymemory.translated.net/get?q=${q}&langpair=en|es`,
            );
            if (r.ok) {
              const data = (await r.json()) as {
                responseData?: { translatedText?: string };
              };
              out = data?.responseData?.translatedText || "";
            }
          } catch {
            /* se queda el texto original */
          }
        }
        if (cancelled) return;
        const clean = out.trim();
        setTweetBodyEs(clean && clean.toLowerCase() !== src.toLowerCase() ? clean : "");
        setTweetTranslating(false);
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tweetBody, tweetTranslate]);

  // Altura real del sello inferior: la tarjeta del tweet se apoya justo encima
  // (nunca por debajo) y puede subirse aún más con «Altura». Se re-mide al
  // cambiar de formato/diseño, con la leyenda o al redimensionar la ventana.
  useEffect(() => {
    const el = previewFooterRef.current;
    if (!el) return;
    const measure = () => setPreviewFooterH(el.offsetHeight);
    measure();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [postFormat, postDesign, photoCaption]);

  // ─── Aviso de contenido sensible (opcional): Blacknews-Advertencia.mp4 ───
  // Se inserta como fase previa antes del clip. El usuario puede elegir un
  // frame opcional (portada con titular) que las redes toman como miniatura.
  const [contentWarning, setContentWarning] = useState(false);
  const [warningFrameOrigin, setWarningFrameOrigin] = useState<"cover" | "first" | "last">("cover");
  const [warningFrameDur] = useState(3); // segundos del frame previo
  const [warningDuration, setWarningDuration] = useState(0); // actualizado al cargar el mp4
  const warningDurFallback = 16.02; // duración aproximada de Advertencia.mp4
  // Espejos en ref de los dos estados de fase (arriba), para leerlos desde
  // callbacks sin esperar al re-render.
  const warningActiveRef = useRef(false);
  const warningRef = useRef<HTMLVideoElement>(null);
  // Fase de portada (los 3 s que preceden al cartel): es la miniatura que
  // ven las redes. Se pausa y se reanuda con el mismo botón de play, así que
  // guarda su fecha límite y los ms que queden cuando se congela.
  const warningFrameActiveRef = useRef(false);
  const warningFrameTimerRef = useRef(0); // setTimeout de la portada
  const warningFrameEndRef = useRef(0); // fecha límite (performance.now)
  const warningFrameRemainRef = useRef(0); // ms restantes al pausar
  // Muestra del aviso de contenido sensible: se rellena con el MP4 importado.
  const warningVideoSrcValue = warningVideoSrc;

  // Filters & Appearance
  const [filter, setFilter] = useState<MediaFilter>("bw-high");
  const [isMuted, setIsMuted] = useState(true);
  const [blendFade, setBlendFade] = useState(true); // Smooth fade into black background
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(115);

  // Font sizes (base 1080x1350 canvas pixels)
  const [fontSizeTitle, setFontSizeTitle] = useState(62);
  const [fontSizeDesc, setFontSizeDesc] = useState(30);

  // Spacing & Line Height (base 1080x1350 canvas pixels, 1:1 synced with preview)
  const [gapCategoryToTitle, setGapCategoryToTitle] = useState(30);
  const [gapTitleToDesc, setGapTitleToDesc] = useState(26);
  const [titleLineHeightRatio, setTitleLineHeightRatio] = useState(1.18);
  const [descLineHeightRatio, setDescLineHeightRatio] = useState(1.42);

  // Video playback & optimization
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [fastExport, setFastExport] = useState(false); // ruta WebCodecs (sin tiempo real)
  const [videoQuality, setVideoQuality] = useState<"social" | "compact" | "hq">(
    "social",
  );
  const [videoFormat, setVideoFormat] = useState<"mp4" | "webm">("mp4");
  const [maxVideoDuration, setMaxVideoDuration] = useState<number>(0); // 5s, 10s, 15s, 30s, 60s or 0 (full)
  const [exportedVideoSize, setExportedVideoSize] = useState<string | null>(
    null,
  );
  const [videoSpeed, setVideoSpeed] = useState<number>(1.0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);

  // ── Normalización de texto: Sentence Case (Sc) para título y bajada ───
  const toSentenceCase = (s: string) =>
    s
      .toLowerCase()
      .replace(/(^\s*|[.!?]+\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase())
      .replace(/^[a-z]/, (c) => c.toUpperCase());

  // ── Desplazamiento manual en la vista previa ──
  // La barra de posición y el contador se escriben en el DOM desde un rAF
  // (sin estado ⇒ sin re-render por fotograma). `scrubbingRef` marca que la
  // barra está arrastrada —mientras tanto nadie toca el valor del <input>—
  // y `scrubResumeRef` recuerda si había reproducción en marcha al empezar.
  const previewPosRef = useRef<HTMLInputElement>(null);
  const previewTimeRef = useRef<HTMLSpanElement>(null);
  const previewPosLastRef = useRef(-1);
  const scrubbingRef = useRef(false);
  const scrubResumeRef = useRef(false);

  // JSON import/export modal states
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonInputText, setJsonInputText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // ─── Redacción asistida (OpenRouter + búsqueda web) ─────────────────────
  // Flujo: la persona escribe el tema, la IA busca información relacionada en
  // la web, redacta el JSON del post (que se importa con «Aplicar») y el
  // cuerpo del tweet, que aquí se monta con las banderas de los países
  // elegidos. Después ya de siempre: subir la foto o el vídeo, descargar los
  // assets y copiar el tweet.
  // El JSON y el tweet NO se guardan en el borrador: son material de trabajo
  // descartable y el JSON exportado no debe arrastrarlos. El tema sí se
  // conserva aparte, porque es lo que ha escrito la persona.
  const [aiJsonText, setAiJsonText] = useState("");
  const [aiTweet, setAiTweet] = useState("");
  const [aiTopic, setAiTopic] = useState<string>(() => {
    try {
      return localStorage.getItem("blacknews_ai_topic") || "";
    } catch {
      return "";
    }
  });
  const [aiSources, setAiSources] = useState<{ title: string; url: string }[]>(
    [],
  );
  const [aiSearch, setAiSearch] = useState<{
    searched: boolean;
    note?: string;
  } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<{
    kind: "ok" | "warn" | "error";
    text: string;
  } | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // ── Claves directas de IA gratuitas (fallback directo en navegador) ──────
  // Se guardan en localStorage del redactor: van directo de su navegador a Google o Groq.
  // 100% gratuitas: Groq (14.400 req/día) y Gemini (1.500 req/día).
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    try {
      return localStorage.getItem("blacknews_gemini_key") || "";
    } catch {
      return "";
    }
  });
  const [groqKey, setGroqKey] = useState<string>(() => {
    try {
      return localStorage.getItem("blacknews_groq_key") || "";
    } catch {
      return "";
    }
  });
  const [openRouterKey, setOpenRouterKey] = useState<string>(() => {
    try {
      return localStorage.getItem("blacknews_openrouter_key") || "";
    } catch {
      return "";
    }
  });
  const [openRouterModel, setOpenRouterModel] = useState<string>("openai/gpt-4o-mini");
  const [aiModelChoice, setAiModelChoice] = useState<string>("or-gpt");

  useEffect(() => {
    if (aiModelChoice === "or-gpt") setOpenRouterModel("openai/gpt-4o-mini");
    else if (aiModelChoice === "or-llama") setOpenRouterModel("meta-llama/llama-3.3-70b-instruct");
    else if (aiModelChoice === "or-gemini") setOpenRouterModel("google/gemini-2.0-flash-lite");
  }, [aiModelChoice]);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  /** La barra flotante del asistente: cerrada sólo se ve el botón de
   *  redactar; abierta despliega el cuadro de contexto. */
  const [aiComposerOpen, setAiComposerOpen] = useState(false);
  /** Alto del panel de contexto: se estira con el tirador y se recuerda. */
  const [aiComposerH, setAiComposerH] = useState<number>(() => {
    try {
      const saved = parseInt(
        localStorage.getItem("blacknews_ai_composer_h") || "",
        10,
      );
      if (Number.isFinite(saved)) return Math.min(420, Math.max(120, saved));
    } catch {}
    return AI_COMPOSER_H_DEFAULT;
  });
  /** Tarjeta de resultados del asistente: a la que se sube al abrir la
   *  configuración de claves desde la barra, que está abajo del todo. */
  const aiCardRef = useRef<HTMLDivElement | null>(null);

  /** Sube hasta la tarjeta de resultados: la barra está abajo del todo y el
   *  panel que se abre desde ella (claves o JSON) vive en la tarjeta. Se usa
   *  "start" y no "center" porque el panel de claves es muy alto: centrarlo
   *  dejaría su cabecera (y el cuadro de Groq) fuera de la pantalla. */
  const scrollAiCardIntoView = () => {
    // setTimeout y no rAF: con la pestaña en segundo plano no se disparan
    // frames, y el panel quedaría abriéndose fuera de la vista. 60 ms dan
    // tiempo a que React pinte el panel antes de medir.
    window.setTimeout(() => {
      aiCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  };

  /** Abre (o cierra) el panel de claves en la tarjeta de resultados y sube
   *  hasta él, para que no se abra fuera de pantalla. */
  const handleToggleAiSettings = () => {
    const next = !showAiSettings;
    setShowAiSettings(next);
    if (next) scrollAiCardIntoView();
  };

  /** Igual que el de claves, pero para el JSON técnico. */
  const handleToggleAiJson = () => {
    const next = !showAdvancedJson;
    setShowAdvancedJson(next);
    if (next) scrollAiCardIntoView();
  };

  /** Tirador del panel de contexto: arrastrando en vertical se agranda o se
   *  achica, y al soltar se guarda la medida para la próxima vez. */
  const handleComposerResizeStart = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const startY = event.clientY;
    const startH = aiComposerH;
    const onMove = (moveEvent: PointerEvent) => {
      setAiComposerH(
        Math.min(420, Math.max(120, startH + (startY - moveEvent.clientY))),
      );
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      setAiComposerH((current) => {
        try {
          localStorage.setItem("blacknews_ai_composer_h", String(current));
        } catch {}
        return current;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
  };
  /** Qué acordeones de la columna de controles están desplegados. Arranca
   *  sólo con el formato de entrega abierto, que es lo único que suele
   *  cambiarse en cada export; el resto se despliega bajo demanda. */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    formato: true,
  });
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const allSectionsOpen = COLLAPSE_SECTION_KEYS.every(
    (key) => openSections[key],
  );
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [groqKeySaved, setGroqKeySaved] = useState(false);
  const [openRouterKeySaved, setOpenRouterKeySaved] = useState(false);

  // El tema sobrevive a un refresco. Va fuera del borrador para que el JSON
  // que la redacción comparte no arrastre el texto de partida.
  useEffect(() => {
    try {
      localStorage.setItem("blacknews_ai_topic", aiTopic);
    } catch {}
  }, [aiTopic]);

  // …pero si el post cambia de noticia, ese texto guardado es de la noticia
  // anterior y sólo sirve para que la IA siga redactando sobre lo viejo (el
  // caso de «Delincuencia en Uruguay» en un post de Ucrania). Al cambiar el
  // titular se comprueba tras un momento de calma si el cuadro sigue hablando
  // de lo mismo y, si no, se vacía avisando. La comprobación NO se hace cuando
  // el titular cambia por aplicar un resultado de IA: ahí el cuadro acaba de
  // dar la noticia y es la referencia que hay que conservar.
  const lastTitleRef = useRef<string | null>(null);
  const skipTopicCheckRef = useRef<string | null>(null);
  useEffect(() => {
    if (skipTopicCheckRef.current === title) {
      skipTopicCheckRef.current = null;
      lastTitleRef.current = title;
      return;
    }
    if (lastTitleRef.current === title) return;
    lastTitleRef.current = title;
    const topic = aiTopic.trim();
    if (!topic || !title.trim()) return;
    const timer = window.setTimeout(() => {
      if (isRelatedNews(topic, `${title}\n${description}`, selectedCountries))
        return;
      setAiTopic("");
      setAiNotice({
        kind: "warn",
        text: "⚠︎ El cuadro de partida tenía otra noticia: se ha vaciado. Escribe ahí la noticia nueva.",
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [title, aiTopic, description, selectedCountries]);

  // Feedback states
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  // La portada es 16:9 (1920×1080) mientras que el post puede ser 4:5: el
  // modal de éxito usa este flag para mostrar las medidas y la proporción
  // correctas en lugar de las del formato social activo.
  const [exportedPortada, setExportedPortada] = useState(false);
  const [exportFileName, setExportFileName] = useState<string>(
    "blacknews-post-4x5.png",
  );
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportVideoFileName, setExportVideoFileName] = useState<string>(
    "blacknews-video-4x5.webm",
  );

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  // Progreso de grabación escrito directo en el DOM: re-renderizar este
  // componente durante la exportación provocaba picos de >100 ms (tirones).
  const recBarRef = useRef<HTMLDivElement>(null);
  const recPctRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // <audio> del modo podcast: mismo papel que el <video> (reloj de la vista
  // previa, recorte y fuente de audio de la ruta clásica de exportación).
  const audioRef = useRef<HTMLAudioElement>(null);
  // Imagen de fondo del podcast (opcional): se pinta oscurecida detrás de la
  // onda. Va en un <img> aparte para que el export pueda dibujarla.
  const podcastBgRef = useRef<HTMLImageElement>(null);
  // WebAudio del <audio>: igual que audioGraphRef, pero para el otro elemento
  // (un elemento sólo puede enrutarse una vez por nodo fuente).
  const audioOnlyGraphRef = useRef<{
    ctx: AudioContext;
    dest: MediaStreamAudioDestinationNode;
  } | null>(null);
  /** Elemento de medio activo: el <audio> en modo podcast y el <video> en los
   *  demás. Comparten currentTime/play/pause/duration, así que los controles
   *  de transporte (barra, ±, velocidad, silencio) valen para los dos. */
  const activeMediaEl = (): HTMLVideoElement | HTMLAudioElement | null =>
    mediaType === "audio" ? audioRef.current : videoRef.current;
  // Selector de archivo de la imagen de fondo del podcast (opcional).
  const podcastBgInputRef = useRef<HTMLInputElement>(null);
  // Cama musical: un <audio> aparte en bucle que acompaña a la vista previa.
  // Las exportaciones no leen este elemento (se mezcla desde el archivo para
  // que el MP4 salga igual en cualquier navegador).
  const podcastMusicRef = useRef<HTMLAudioElement>(null);
  // Cama ya decodificada, cacheada para las dos rutas de exportación.
  const soundtrackBufRef = useRef<AudioBuffer | null>(null);
  const soundtrackBuffer = async (): Promise<AudioBuffer> => {
    if (soundtrackBufRef.current) return soundtrackBufRef.current;
    const raw = await (await fetch(podcastSoundtrack)).arrayBuffer();
    const probe = new OfflineAudioContext(1, 1, 44100);
    const buf = await probe.decodeAudioData(raw);
    soundtrackBufRef.current = buf;
    return buf;
  };
  // Tema de fondo (bgAudio): ya decodificado y cacheado para las dos rutas de
  // exportación, igual que la cama del podcast. Se mezcla desde el archivo
  // (no desde el <audio> de la vista previa) para que el MP4 salga igual en
  // cualquier navegador y en segundo plano.
  const bgThemeBufRef = useRef<AudioBuffer | null>(null);
  const bgThemeBuffer = async (): Promise<AudioBuffer> => {
    if (bgThemeBufRef.current) return bgThemeBufRef.current;
    const raw = await (
      await fetch("/assets/audio/BlackNewsPress-Background.mp3")
    ).arrayBuffer();
    const probe = new OfflineAudioContext(1, 1, 44100);
    const buf = await probe.decodeAudioData(raw);
    bgThemeBufRef.current = buf;
    return buf;
  };
  // Modo «sale vídeo»: el vídeo de siempre y el audio del podcast (las redes
  // no aceptan audio suelto, así que la nota se exporta como vídeo con su
  // onda dentro). Comparten recorte, calidad y cierre de marca.
  const exportsVideo = mediaType === "video" || mediaType === "audio";
  // <video> del cierre de marca: lo comparten la vista previa y la fase de
  // cierre de la ruta clásica (queda visible mientras graba, para que el
  // navegador decodifique fotogramas y el usuario vea lo que se está grabando).
  const outroRef = useRef<HTMLVideoElement>(null);
  // Nodo WebAudio del cierre: un elemento sólo puede enrutarce una vez, así que
  // se guarda junto a su elemento por si React lo vuelve a montar.
  const outroAudioNodeRef = useRef<{
    el: HTMLVideoElement;
    node: MediaElementAudioSourceNode;
  } | null>(null);
  // Mismo criterio para el cartel del aviso: su audio entra en la pista de
  // la exportación a través de su propio nodo cacheado.
  const warningAudioNodeRef = useRef<{
    el: HTMLVideoElement;
    node: MediaElementAudioSourceNode;
  } | null>(null);
  // WebAudio graph for the preview video (created on first export with sound and
  // reused afterwards: a media element can only be routed through one source node)
  const audioGraphRef = useRef<{
    ctx: AudioContext;
    dest: MediaStreamAudioDestinationNode;
  } | null>(null);
  // true mientras el grabador de video controla el clip (desactiva el rebobinado
  // del preview, que si no reinicia en trimStart justo al llegar a trimEnd)
  const isRecordingRef = useRef(false);
  const isCancelledRef = useRef(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const uploadedVideoFileRef = useRef<File | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCancelVideoExport = () => {
    isCancelledRef.current = true;
    isRecordingRef.current = false;
    setIsRecordingVideo(false);
    setRecordingProgress(0);
    setRecordingPaused(false);
    setFastExport(false);
    try {
      if (videoRef.current) {
        videoRef.current.loop = true;
      }
    } catch {}
    showToast("Exportación de video cancelada.");
  };

  // Segundos reales que saldrán en la exportación de video (trim + duración
  // máxima + velocidad). Se muestra antes y durante la grabación para que
  // nunca sorprenda un clip más corto que el original.
  const exportClipSeconds = (() => {
    if (!exportsVideo || !(videoDuration > 0)) return null;
    const duration = videoDuration;
    const s = Math.max(0, Math.min(trimStart, Math.max(duration - 0.1, 0)));
    let e =
      trimEnd > s && duration > 0 ? Math.min(trimEnd, duration) : duration;
    if (maxVideoDuration > 0)
      e = Math.min(e, s + maxVideoDuration * videoSpeed);
    if (!(e > s)) return null;
    return Math.round(((e - s) / videoSpeed) * 10) / 10;
  })();
  // Total con el aviso de contenido sensible y el cierre BlackNews
  // encendidos: lo que de verdad durará el archivo. La intro TV 16:9 no se
  // suma aquí porque sólo alarga la salida.
  const warningPadSeconds = contentWarning
    ? warningFrameDur +
      (warningDuration > 0 ? warningDuration : warningDurFallback)
    : 0;
  const exportTotalSeconds =
    exportClipSeconds === null
      ? null
      : Math.round(
          (exportClipSeconds +
            (videoOutro ? outroDuration : 0) +
            warningPadSeconds) *
            10,
        ) / 10;

  // Toggle country selection — la identidad es el nombre: dos países
  // distintos pueden compartir código ISO (p. ej. un personalizado con el
  // código de Puerto Rico) y no deben interferirse entre sí.
  const handleToggleCountry = (country: CountryItem) => {
    const name = country.name.toLowerCase();
    setSelectedCountries((prev) => {
      const exists = prev.some((c) => c.name.toLowerCase() === name);
      if (exists) {
        return prev.filter((c) => c.name.toLowerCase() !== name);
      } else {
        return [...prev.filter((c) => c.name.toLowerCase() !== name), country];
      }
    });
  };

  // Add custom country: si el nombre ya existe en el catálogo se usa el
  // país real (con su bandera); si no, se da de alta en el listado
  // personalizado para reutilizarlo en próximos artículos y posts.
  const handleAddCustomCountry = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customCountryName.trim();
    if (!trimmed) return;

    const target = findCountryByName(trimmed) ?? addCustomCountry(trimmed);
    if (!target) return;

    if (
      !selectedCountries.some(
        (c) => c.name.toLowerCase() === target.name.toLowerCase(),
      )
    ) {
      setSelectedCountries([...selectedCountries, target]);
    }
    setCustomCountryName("");
    showToast(`País/Región "${target.name}" añadido al post`);
  };

  // Remove country — por nombre (identidad única entre seleccionados)
  const handleRemoveCountry = (country: CountryItem) => {
    const name = country.name.toLowerCase();
    setSelectedCountries((prev) =>
      prev.filter((c) => c.name.toLowerCase() !== name),
    );
  };

  // Pre-fill from an existing article
  const handleLoadFromReport = (reportId: string) => {
    const found = reports.find((r) => r.id === reportId);
    if (!found) return;

    setCategory(found.category || "GEOPOLÍTICA");
    setTitle(found.title);
    setDescription(found.subtitle || found.lead || "");
    setPhotoCaption(found.imageCaption || "");
    if (found.image) {
      setMediaType("image");
      setMediaSrc(found.image);
      setMediaName(found.title.slice(0, 25) + "...");
    }
    showToast(
      `Despacho "${found.title.slice(0, 30)}..." cargado en el generador`,
    );
  };

  // Drag and Drop & File Upload handling
  const handleFile = (file: File) => {
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");

    if (!isImage && !isVideo && !isAudio) {
      showToast("Por favor sube un archivo de imagen, video o audio válido.");
      return;
    }

    // El medio ya es un audio (modo podcast): una imagen que llegue por aquí es
    // el FONDO de la nota, no un reemplazo. Si se cambiara el medio sólo
    // quedaría exportar PNG y se perdería la nota hablada.
    if (isImage && mediaType === "audio") {
      setPostDesign("podcast");
      handlePodcastBgFile(file);
      return;
    }
    // Al revés: si el medio es una imagen y llega el audio, la imagen pasa a
    // ser el fondo y la nota manda (así se conserva todo junto).
    if (isAudio && mediaType === "image") {
      const prevSrc = mediaSrc;
      if (prevSrc && prevSrc !== DEFAULT_MEDIA_SRC && !podcastBgSrc) {
        setPodcastBgSrc(prevSrc);
        setPodcastBgName(mediaName);
      }
    }

    const objectUrl = URL.createObjectURL(file);
    setMediaSrc(objectUrl);
    setMediaType(isVideo ? "video" : isAudio ? "audio" : "image");
    setMediaName(file.name);

    if (isVideo || isAudio) {
      // Los bytes crudos quedan a mano para la exportación acelerada (demux
      // del MP4 o decodificación del audio: las dos rutas leen `raw`).
      uploadedVideoFileRef.current = file;
      // Para vídeo arrancamos la preview de inmediato; para audio esperamos
      // al evento onPlay del <audio> real — así la cama musical no empieza
      // antes de que el usuario dé a play.
      if (isVideo) setIsVideoPlaying(true);
      const tempEl = document.createElement(isAudio ? "audio" : "video");
      tempEl.preload = "metadata";
      tempEl.src = objectUrl;
      tempEl.onloadedmetadata = () => {
        const dur = Math.round((tempEl.duration || 0) * 10) / 10;
        if (dur > 0) {
          setVideoDuration(dur);
          setTrimStart(0);
          setTrimEnd(dur);
        }
      };
    }

    if (isAudio) {
      // Un audio es una nota hablada: entra en modo podcast, con sonido en la
      // vista previa (silenciada no se puede juzgar el corte).
      setPostDesign("podcast");
      setIsMuted(false);
      showToast(`Audio "${file.name}" cargado · modo podcast activo`);
      return;
    }

    showToast(
      `${isVideo ? "Video" : "Imagen"} "${file.name}" cargada correctamente`,
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // ── Onda del post-podcast ──
  // Se calcula una sola vez por medio cargado (el audio subido, o el audio
  // propio de un vídeo de fondo). Si el archivo no se puede decodificar —o
  // está bloqueado por CORS al venir de otra web— la onda sale plana y el
  // resto del post sigue funcionando: la barra de progreso no depende de ella.
  const peaksSrcRef = useRef("");
  useEffect(() => {
    if (postDesign !== "podcast" || mediaType === "image") return;
    if (!mediaSrc || mediaSrc === DEFAULT_MEDIA_SRC) return;
    if (peaksSrcRef.current === mediaSrc) return;
    peaksSrcRef.current = mediaSrc;
    setAudioPeaks([]);
    setAudioAnalyzing(true);
    let dead = false;
    void (async () => {
      try {
        const blob = await (await fetch(mediaSrc)).blob();
        const peaks = await computeAudioPeaks(blob);
        if (!dead) setAudioPeaks(peaks);
      } catch {
        if (!dead) setAudioPeaks([]);
      } finally {
        if (!dead) setAudioAnalyzing(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [postDesign, mediaType, mediaSrc]);

  // La cama suena en la vista previa exactamente mientras suena la nota, se
  // apaga con el cierre de marca y se calla mientras graba (allí la mezcla la
  // hace la exportación y, si no, se escucharía dos veces).
  // IMPORTANTE: sólo puede sonar en modo podcast con audio puro; nunca en
  // modo noticia ni mientras la nota esté pausada esperando a que el usuario
  // pulse play (isVideoPlaying lo pone true el evento onPlay real del <audio>,
  // no la carga del archivo).
  useEffect(() => {
    const m = podcastMusicRef.current;
    if (!m) return;
    m.volume = podcastMusicVol;
    const shouldPlay =
      postDesign === "podcast" &&
      mediaType === "audio" &&
      podcastMusicOn &&
      isVideoPlaying &&
      !outroActive &&
      !isRecordingVideo &&
      // El archivo arranca la pista tras el aviso (portada + cartel): aquí
      // tampoco debe sonar durante esas fases.
      !warningActive &&
      !warningFrameActive;
    if (shouldPlay) {
      if (m.paused) void m.play().catch(() => {});
    } else if (!m.paused) {
      m.pause();
    }
  }, [
    podcastMusicOn,
    podcastMusicVol,
    isVideoPlaying,
    outroActive,
    isRecordingVideo,
    postDesign,
    mediaType,
    warningActive,
    warningFrameActive,
  ]);

  /** Imagen de fondo del podcast: una imagen plana (blob/data/https). */
  const handlePodcastBgFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("El fondo del podcast tiene que ser una imagen.");
      return;
    }
    setPodcastBgSrc(URL.createObjectURL(file));
    setPodcastBgName(file.name);
    showToast(`Fondo "${file.name}" cargado · el audio sigue activo`);
  };

  const LOCAL_STORAGE_KEY = "blacknews_post_generator_draft";

  // Construct full post configuration JSON object
  const getPostConfigObject = () => {
    return {
      version: 2,
      outputFormat: postFormat,
      tvShowLive,
      tvShowClock,
      tvIntro,
      tvIntroDur,
      // Transición «texto → vídeo» del 4:5 (sólo con media de vídeo).
      textFadeOut,
      textFadeOutDur,
      appName: `BlackNews ${postFormat} Generator`,
      savedAt: new Date().toISOString(),
      content: {
        title,
        description,
        category,
        photoCaption,
        countryPlacement,
        countryFormat,
        selectedCountries,
      },
      typography: {
        fontSizeTitle,
        fontSizeDesc,
        gapCategoryToTitle,
        gapTitleToDesc,
        titleLineHeightRatio,
        descLineHeightRatio,
        headerSize,
        autoFitHeader,
      },
      appearance: {
        filter,
        brightness,
        contrast,
        blendFade,
      },
      mediaSettings: {
        mediaType,
        mediaName,
        isMuted,
        videoSpeed,
        trimStart,
        trimEnd,
        videoQuality,
        videoFormat,
        maxVideoDuration,
        // Cierre de marca (Blacknews.mp4) al final del vídeo. Por defecto false.
        videoOutro,
        // Aviso de contenido sensible antes del clip (portada + cartel).
        contentWarning,
        warningFrameOrigin,
        mediaUrl: mediaSrc.startsWith("blob:") ? null : mediaSrc,
        // Diseño del post (noticias o podcast) y ajustes de la variante de
        // audio. La onda se recalcula al cargar el archivo: aquí sólo va lo
        // editable (serie, episodio y fondo, si no es un blob de esta sesión).
        postDesign,
        podcastSeries,
        podcastEpisode,
        podcastAutoTitle,
        podcastMusicOn,
        podcastMusicVol,
        podcastFlagStyle,
        podcastBg: podcastBgSrc.startsWith("blob:") ? null : podcastBgSrc,
        podcastBgName: podcastBgSrc.startsWith("blob:") ? "" : podcastBgName,
      },
    };
  };

  // Copy JSON configuration to clipboard
  const handleCopyJson = () => {
    try {
      const config = getPostConfigObject();
      const jsonStr = JSON.stringify(config, null, 2);
      navigator.clipboard.writeText(jsonStr);
      showToast("✓ ¡Configuración JSON copiada al portapapeles!");
    } catch {
      showToast("No se pudo copiar directamente al portapapeles.");
    }
  };

  // Download JSON configuration file
  const handleDownloadJsonFile = () => {
    try {
      const config = getPostConfigObject();
      const jsonStr = JSON.stringify(config, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const slug = title
        .slice(0, 16)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      triggerDownload(url, `blacknews-post-${slug || "draft"}.json`);
      showToast("✓ Archivo JSON descargado");
    } catch {
      showToast("Error al descargar archivo JSON.");
    }
  };

  // Import JSON configuration. `silent` la usa la restauración del borrador al
  // montar: aplica la configuración sin tocar el modal de JSON ni el toast, y
  // sin marcar error si el guardado viene corrupto (así un borrador malo nunca
  // tumbla el generador).
  const handleApplyJson = (rawText: string, silent = false) => {
    try {
      if (!rawText.trim()) {
        if (!silent) setJsonError("Pega un contenido JSON válido.");
        return;
      }
      const data = JSON.parse(rawText);
      if (data.content) {
        if (typeof data.content.title === "string")
          setTitle(data.content.title);
        if (typeof data.content.description === "string")
          setDescription(data.content.description);
        if (typeof data.content.category === "string")
          setCategory(data.content.category);
        if (typeof data.content.photoCaption === "string")
          setPhotoCaption(data.content.photoCaption);
        if (data.content.countryPlacement)
          setCountryPlacement(data.content.countryPlacement);
        if (data.content.countryFormat)
          setCountryFormat(data.content.countryFormat);
        if (Array.isArray(data.content.selectedCountries)) {
          // Sólo entran países con forma {code, flag, name}: una cadena o un
          // objeto incompleto rompía el render en `c.name.toUpperCase()`.
          // Además se normalizan contra el catálogo (por código o por nombre):
          // así la bandera y el nombre oficiales mandan siempre y no puede
          // colarse una bandera cruzada (🇲🇽 con «Brasil») desde un JSON.
          const validCountries = data.content.selectedCountries
            .filter((c: unknown): c is CountryItem => {
              if (!c || typeof c !== "object") return false;
              const cand = c as Partial<CountryItem>;
              return (
                typeof cand.name === "string" &&
                cand.name.trim() !== "" &&
                typeof cand.code === "string" &&
                typeof cand.flag === "string"
              );
            })
            .map((c) => {
              const code = c.code.trim().toUpperCase();
              const found =
                countryCatalog.find((k) => k.code.toUpperCase() === code) ||
                countryCatalog.find(
                  (k) => countryKey(k.name) === countryKey(c.name),
                );
              return found || { ...c, code };
            });
          setSelectedCountries(validCountries);
        }
      }
      if (
        data.outputFormat === "4:5" ||
        data.outputFormat === "9:16" ||
        data.outputFormat === "16:9"
      )
        setPostFormat(data.outputFormat);
      if (typeof data.tvShowLive === "boolean") setTvShowLive(data.tvShowLive);
      if (typeof data.tvShowClock === "boolean")
        setTvShowClock(data.tvShowClock);
      if (typeof data.tvIntro === "boolean") setTvIntro(data.tvIntro);
      if (typeof data.tvIntroDur === "number" && data.tvIntroDur > 0) {
        setTvIntroDur(data.tvIntroDur);
      }
      if (typeof data.textFadeOut === "boolean")
        setTextFadeOut(data.textFadeOut);
      if (typeof data.textFadeOutDur === "number" && data.textFadeOutDur > 0)
        setTextFadeOutDur(data.textFadeOutDur);
      if (data.typography) {
        if (data.typography.fontSizeTitle)
          setFontSizeTitle(data.typography.fontSizeTitle);
        if (data.typography.fontSizeDesc)
          setFontSizeDesc(data.typography.fontSizeDesc);
        if (data.typography.gapCategoryToTitle)
          setGapCategoryToTitle(data.typography.gapCategoryToTitle);
        if (data.typography.gapTitleToDesc)
          setGapTitleToDesc(data.typography.gapTitleToDesc);
        if (data.typography.titleLineHeightRatio)
          setTitleLineHeightRatio(data.typography.titleLineHeightRatio);
        if (data.typography.descLineHeightRatio)
          setDescLineHeightRatio(data.typography.descLineHeightRatio);
        if (data.typography.headerSize)
          setHeaderSize(data.typography.headerSize);
        if (typeof data.typography.autoFitHeader === "boolean")
          setAutoFitHeader(data.typography.autoFitHeader);
      }
      if (data.appearance) {
        if (data.appearance.filter) setFilter(data.appearance.filter);
        if (typeof data.appearance.brightness === "number")
          setBrightness(data.appearance.brightness);
        if (typeof data.appearance.contrast === "number")
          setContrast(data.appearance.contrast);
        if (typeof data.appearance.blendFade === "boolean")
          setBlendFade(data.appearance.blendFade);
      }
      if (data.mediaSettings) {
        // El modo vídeo solo se restaura si su URL sigue siendo un vídeo: un
        // borrador con un vídeo local (blob ya inexistente) o con la imagen
        // por defecto reabre el generador en imagen, para no dejarlo en modo
        // vídeo sin medio reproducible.
        const mediaUrl = data.mediaSettings.mediaUrl || "";
        // Una URL blob sólo existe en la pestaña que la creó: al restaurar el
        // borrador (otra sesión, otro día) ya no está y la vista previa entra
        // en un bucle de errores de carga (net::ERR_FILE_NOT_FOUND en
        // producción). En el JSON nunca se guarda una —se guarda null—, así que
        // un blob aquí es residuo de una versión anterior y se ignora: es el
        // mismo camino que ya usa un vídeo local ya inexistente.
        const staleBlobMedia = /^blob:/.test(mediaUrl);
        const isVideoMedia =
          data.mediaSettings.mediaType === "video" &&
          !staleBlobMedia &&
          (/^data:video\//.test(mediaUrl) ||
            /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(mediaUrl));
        // El audio del podcast sigue el mismo camino que el vídeo: sólo se
        // restaura si la URL es reproducible (nunca un blob de otra sesión).
        const isAudioMedia =
          data.mediaSettings.mediaType === "audio" &&
          !staleBlobMedia &&
          (/^data:audio\//.test(mediaUrl) ||
            /\.(mp3|m4a|wav|aac|ogg|oga|opus|flac)(\?|#|$)/i.test(mediaUrl));
        const videoFallback =
          data.mediaSettings.mediaType === "video" && !isVideoMedia;
        if (data.mediaSettings.mediaType)
          setMediaType(
            isAudioMedia ? "audio" : isVideoMedia ? "video" : "image",
          );
        if (data.mediaSettings.mediaName)
          setMediaName(
            videoFallback || staleBlobMedia
              ? "Imagen predeterminada"
              : data.mediaSettings.mediaName,
          );
        if (typeof data.mediaSettings.isMuted === "boolean")
          setIsMuted(data.mediaSettings.isMuted);
        if (typeof data.mediaSettings.videoSpeed === "number")
          setVideoSpeed(data.mediaSettings.videoSpeed);
        if (typeof data.mediaSettings.trimStart === "number")
          setTrimStart(data.mediaSettings.trimStart);
        if (typeof data.mediaSettings.trimEnd === "number")
          setTrimEnd(data.mediaSettings.trimEnd);
        if (data.mediaSettings.videoQuality)
          setVideoQuality(data.mediaSettings.videoQuality);
        if (data.mediaSettings.videoFormat)
          setVideoFormat(data.mediaSettings.videoFormat);
        if (typeof data.mediaSettings.maxVideoDuration === "number")
          setMaxVideoDuration(data.mediaSettings.maxVideoDuration);
        if (typeof data.mediaSettings.videoOutro === "boolean")
          setVideoOutro(data.mediaSettings.videoOutro);
        // Aviso de contenido sensible: se restaura con su frame de portada.
        if (typeof data.mediaSettings.contentWarning === "boolean")
          setContentWarning(data.mediaSettings.contentWarning);
        if (
          data.mediaSettings.warningFrameOrigin === "cover" ||
          data.mediaSettings.warningFrameOrigin === "first" ||
          data.mediaSettings.warningFrameOrigin === "last"
        )
          setWarningFrameOrigin(data.mediaSettings.warningFrameOrigin);
        // Variante podcast: diseño, serie, episodio y fondo (si la URL sigue
        // viva). El diseño se aplica aunque el audio se haya perdido, para
        // que un JSON siga abriendo el post tal y como se dejó.
        if (
          data.mediaSettings.postDesign === "podcast" ||
          data.mediaSettings.postDesign === "news"
        )
          setPostDesign(data.mediaSettings.postDesign);
        if (typeof data.mediaSettings.podcastSeries === "string")
          setPodcastSeries(data.mediaSettings.podcastSeries);
        if (typeof data.mediaSettings.podcastEpisode === "string")
          setPodcastEpisode(data.mediaSettings.podcastEpisode);
        const savedBg =
          typeof data.mediaSettings.podcastBg === "string"
            ? data.mediaSettings.podcastBg
            : "";
        if (savedBg && !/^blob:/.test(savedBg)) {
          setPodcastBgSrc(savedBg);
          if (typeof data.mediaSettings.podcastBgName === "string")
            setPodcastBgName(data.mediaSettings.podcastBgName);
        }
        if (typeof data.mediaSettings.podcastAutoTitle === "boolean")
          setPodcastAutoTitle(data.mediaSettings.podcastAutoTitle);
        if (typeof data.mediaSettings.podcastMusicOn === "boolean")
          setPodcastMusicOn(data.mediaSettings.podcastMusicOn);
        if (typeof data.mediaSettings.podcastMusicVol === "number")
          setPodcastMusicVol(
            Math.min(0.4, Math.max(0, data.mediaSettings.podcastMusicVol)),
          );
        if (
          typeof data.mediaSettings.podcastFlagStyle === "string" &&
          PODCAST_FLAG_STYLES.some(
            (s) => s.value === data.mediaSettings.podcastFlagStyle,
          )
        )
          setPodcastFlagStyle(data.mediaSettings.podcastFlagStyle);
        if (mediaUrl && !staleBlobMedia) setMediaSrc(mediaUrl);
        else if (videoFallback || staleBlobMedia)
          setMediaSrc(DEFAULT_MEDIA_SRC);
      }
      if (!silent) {
        setIsJsonModalOpen(false);
        setJsonError(null);
        setJsonInputText("");
        showToast("✓ ¡Post restaurado con éxito desde JSON!");
      }
    } catch (err: any) {
      // Un borrador ilegible no debe romper el generador ni poner un error en
      // pantalla al cargar: en modo silencioso simplemente no se restaura nada.
      if (!silent)
        setJsonError(
          "Formato JSON no válido: " + (err.message || "error de sintaxis"),
        );
    }
  };

  // Upload and parse JSON file from disk
  const handleUploadJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        handleApplyJson(text);
      }
    };
    reader.readAsText(file);
  };

  // ─── IA editorial: JSON del post + tweet ───────────────────────────────
  // La IA decide sólo el contenido editorial (titular, bajada, sección, pie
  // de foto y países); la tipografía, los filtros y el medio siguen siendo
  // del usuario, así que se fusionan con la configuración actual para que el
  // JSON de la caja sea completo y apliquable con «Aplicar».
  const AI_TWEET_LIMIT = 250;
  // Plantilla:  [🇨🇳🇮🇷] » cuerpo      ← banderas + guillemet, a cargo de la web
  //             (línea en blanco)
  //             ■ #BlackNews
  const AI_TWEET_FOOTER = "\n\n■ #BlackNews";

  /** Banderas de los países del post. Sólo entran los códigos ISO reales: un
   *  país a medida (📍) o "Internacional" (🌐) no lleva bandera. */
  const aiTweetFlags = (countries: CountryItem[]) =>
    countries
      .map((c) => c.flag)
      .filter((flag) => /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(flag))
      .join("");

  // ── Lo que cabe en la tarjeta ────────────────────────────────────────────
  // En 4:5 la foto arranca fija al 40 % (540 px): cabecera 20 + huecos 30/26/40
  // + titular 73 px por línea + bajada 43 px por línea. Con 3 líneas de titular
  // y 3 de bajada se llega a 540 exactos; la cuarta línea ya pisa la foto.
  const AI_TITLE_LINES = 3;
  const AI_DESC_LINES = 3;
  const titleFont = `700 ${fontSizeTitle}px 'Lexend', sans-serif`;
  const descFont = `400 ${fontSizeDesc}px 'Lexend', sans-serif`;

  /** Corta en la última palabra entera, sin «…». */
  const cutWords = (text: string, max: number): string => {
    if (text.length <= max) return text;
    const head = text.slice(0, max + 1);
    const space = head.lastIndexOf(" ");
    return (
      space > max * 0.6 ? head.slice(0, space) : head.slice(0, max)
    ).trim();
  };

  /** Recorta por el final hasta que el texto quepa en `maxLines` líneas de la
   *  columna real del post, medido con la MISMA métrica que el lienzo
   *  (wrapLikeExport): así se adapta solo si el editor baja el cuerpo de la
   *  tipografía. Si ha sobrado algo cierra con «…»; si ya cabía, se devuelve
   *  tal cual, respetando los saltos de línea que haya escrito la IA. */
  const capToLines = (
    text: string,
    font: string,
    maxLines: number,
  ): { text: string; trimmed: boolean } => {
    const col = textColumnWidth;
    const lines = (value: string) => wrapLikeExport(font, value, col).length;
    let out = text;
    if (lines(out) <= maxLines) return { text: out, trimmed: false };
    // Recorta de 10 en 10 (siempre en palabra entera) dejando hueco a la «…».
    while (out.length > 40 && lines(`${out}…`) > maxLines) {
      out = cutWords(out, Math.max(30, out.length - 10));
    }
    return { text: `${out}…`, trimmed: true };
  };

  /** Corta el cuerpo en el presupuesto que queda tras el corchete y la firma.
   *  Preferible cortar por el final de frase más cercano que a media palabra:
   *  el tweet se lee entero aunque la IA se haya pasado. */
  const shortenAiBody = (text: string, max: number): string => {
    if (text.length <= max) return text;
    const head = text.slice(0, max);
    const floor = Math.floor(max * 0.6);
    let cut = -1;
    for (const stop of [". ", "; ", ", ", ": "]) {
      const at = head.lastIndexOf(stop);
      if (at > floor) cut = Math.max(cut, at + 1);
    }
    if (cut <= 0) {
      const space = head.lastIndexOf(" ");
      cut = space > 20 ? space : max;
    }
    return text.slice(0, cut).trim();
  };

  /** Monta el tweet final a partir del cuerpo que devuelve la IA y de los
   *  países que acaban de elegirse, para que el corchete coincida SIEMPRE con
   *  los países que lleva el post. Sin banderas, el corchete no aparece.
   *  Si el cuerpo no cabe en el tope, se recorta y se devuelve la marca para
   *  que la tarjeta lo avise. */
  const buildAiTweet = (
    body: string,
    countries: CountryItem[],
  ): { tweet: string; trimmed: boolean } => {
    const flags = aiTweetFlags(countries);
    // El modelo puede insistir en escribir el corchete, el «» o la firma:
    // se limpian ANTES de medir, así el tweet montado nunca sale duplicado.
    const oneLine = cleanAiTweetBody(body);
    const prefix = flags ? `[${flags}] » ` : "";
    const budget = Math.max(
      40,
      AI_TWEET_LIMIT - prefix.length - AI_TWEET_FOOTER.length,
    );
    const short = shortenAiBody(oneLine, budget);
    return {
      tweet: `${prefix}${short}${AI_TWEET_FOOTER}`,
      trimmed: short.length < oneLine.length,
    };
  };

  /** Clave de comparación de secciones: la IA puede devolver la misma cadena
   *  sin acentos o con distinto espaciado ("Geopolítica" vs "geopolitica"). */
  const sectionKey = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  /** Devuelve la sección tal y como está habilitada, o null si la IA se la
   *  inventó (para no dejar el post con una sección fantasma). */
  const matchEnabledCategory = (value: string): string | null => {
    if (!value) return null;
    const exact = enabledCategories.find((c) => c === value);
    if (exact) return exact;
    const key = sectionKey(value);
    return enabledCategories.find((c) => sectionKey(c) === key) || null;
  };

  /** Sólo entran países que existan en el catálogo (mismo código o mismo
   *  nombre): así el código ISO que se pinta en la bandera siempre es real. */
  const resolveAiCountries = (value: unknown): CountryItem[] => {
    if (!Array.isArray(value)) return selectedCountries;
    const out: CountryItem[] = [];
    const used = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const cand = item as Partial<CountryItem>;
      const code =
        typeof cand.code === "string" ? cand.code.trim().toUpperCase() : "";
      const name = typeof cand.name === "string" ? cand.name.trim() : "";
      if (!code && !name) continue;
      const found =
        countryCatalog.find((c) => code && c.code.toUpperCase() === code) ||
        (name
          ? countryCatalog.find((c) => countryKey(c.name) === countryKey(name))
          : undefined);
      if (!found || used.has(found.code)) continue;
      used.add(found.code);
      out.push(found);
      if (out.length >= 6) break;
    }
    return out;
  };

  /** Devuelve true si se aplicó un post; false si la IA no trajo contenido
   *  (pregunta por la noticia, respuesta vacía o inesperada), caso en el que
   *  sólo se avisa y NO se toca nada del post. */
  const applyAiResult = (payload: unknown): boolean => {
    const root =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const raw =
      root.content && typeof root.content === "object"
        ? (root.content as Record<string, unknown>)
        : {};

    // Sin contexto la IA no inventa: devuelve {"question":"…"} (o nada).
    // Se muestra tal cual para que el usuario complete la noticia.
    const question =
      typeof root.question === "string" && root.question.trim()
        ? root.question.trim()
        : typeof raw.question === "string" && raw.question.trim()
          ? raw.question.trim()
          : "";
    const hasTitle = typeof raw.title === "string" && raw.title.trim() !== "";
    if (question || !hasTitle) {
      setAiNotice({
        kind: "warn",
        text: `⚠︎ ${question || NO_CONTEXT_QUESTION}`,
      });
      return false;
    }

    const pick = (key: string, max: number, fallback: string) =>
      typeof raw[key] === "string"
        ? (raw[key] as string).trim().slice(0, max) || fallback
        : fallback;

    // Lo que el Worker no pudo ajustar en su segunda pasada: repeticiones
    // entre campos o textos que no encajan en la plantilla.
    const serverWarnings = Array.isArray(root.warnings)
      ? root.warnings.filter((item): item is string => typeof item === "string")
      : [];

    // Titular y bajada sólo se recortan si vienen de la IA: si el modelo no
    // los devuelve, se conserva intacto lo que ya estaba en el post.
    const rawAiTitle =
      typeof raw.title === "string"
        ? raw.title
            .replace(/\r/g, "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join("\n")
        : "";
    const rawAiDesc =
      typeof raw.description === "string"
        ? raw.description.replace(/\s+/g, " ").trim()
        : "";
    const titleCap = rawAiTitle
      ? capToLines(rawAiTitle, titleFont, AI_TITLE_LINES)
      : { text: pick("title", 400, title), trimmed: false };
    const descCap = rawAiDesc
      ? capToLines(rawAiDesc, descFont, AI_DESC_LINES)
      : { text: pick("description", 420, description), trimmed: false };
    const nextTitle = titleCap.text;
    const nextDescription = descCap.text;
    const nextPhotoCaption = pick("photoCaption", 120, photoCaption);

    const rawCategory =
      typeof raw.category === "string" ? raw.category.trim() : "";
    const matchedCategory = matchEnabledCategory(rawCategory);
    const nextCategory = matchedCategory || category;

    const givenCountries = Array.isArray(raw.selectedCountries)
      ? raw.selectedCountries
      : null;
    const resolvedCountries = resolveAiCountries(givenCountries);
    const nextCountries =
      resolvedCountries.length > 0 ? resolvedCountries : selectedCountries;

    const base = getPostConfigObject();
    setAiJsonText(
      JSON.stringify(
        {
          ...base,
          content: {
            ...base.content,
            title: nextTitle,
            description: nextDescription,
            category: nextCategory,
            photoCaption: nextPhotoCaption,
            selectedCountries: nextCountries,
          },
        },
        null,
        2,
      ),
    );

    // ── Autocompletar automáticamente los campos del generador ──
    // El titular va a cambiar por una noticia que SÍ sale del cuadro de
    // partida: se marca para que la comprobación de arriba no lo vacíe.
    skipTopicCheckRef.current = nextTitle;
    setTitle(nextTitle);
    setDescription(nextDescription);
    setCategory(nextCategory);
    setSelectedCountries(nextCountries);
    if (nextPhotoCaption) {
      setPhotoCaption(nextPhotoCaption);
    }

    // El corchete con las banderas y la firma los monta la web: así el
    // corchete coincide siempre con los países que acaban de elegirse.
    const rawBody =
      typeof root.tweetBody === "string"
        ? root.tweetBody
        : typeof root.tweet === "string"
          ? root.tweet
          : "";
    const nextTweet = buildAiTweet(rawBody, nextCountries);
    setAiTweet(nextTweet.tweet);

    setAiSources(
      Array.isArray(root.sources)
        ? root.sources
            .map((item) =>
              item && typeof item === "object"
                ? (item as Record<string, unknown>)
                : null,
            )
            .filter((item) => !!item && typeof item.url === "string")
            .map((item) => ({
              title:
                typeof item.title === "string" ? item.title : String(item.url),
              url: String(item.url),
            }))
            .slice(0, 6)
        : [],
    );
    setAiSearch({
      searched: root.searched === true,
      note: typeof root.note === "string" ? root.note : undefined,
    });

    const notes: string[] = [];
    if (titleCap.trimmed) {
      notes.push(
        `el titular se recortó a ${AI_TITLE_LINES} líneas para no pisar la foto; amplíalo a mano si falta`,
      );
    }
    if (descCap.trimmed) {
      notes.push(
        `la bajada se recortó a ${AI_DESC_LINES} líneas para que entre con el titular`,
      );
    }
    if (rawCategory && !matchedCategory) {
      notes.push(
        `la sección «${rawCategory}» no está habilitada, se mantiene «${nextCategory}»`,
      );
    }
    if (
      givenCountries &&
      givenCountries.length > 0 &&
      resolvedCountries.length === 0
    ) {
      notes.push(
        "ningún país propuesto existía en el catálogo, se mantienen los actuales",
      );
    }
    const tweetLength = nextTweet.tweet.length;
    if (nextTweet.trimmed) {
      notes.push(
        `el cuerpo del tweet se recortó para no pasar de ${AI_TWEET_LIMIT} caracteres; amplíalo a mano en la caja si falta algo`,
      );
    } else if (tweetLength > AI_TWEET_LIMIT) {
      notes.push(
        `el tweet tiene ${tweetLength} caracteres, tope ${AI_TWEET_LIMIT}`,
      );
    }

    // Los tres textos se publican juntos: si la IA repite frases entre ellos
    // se está quedando sin sitio para información nueva. El Worker ya ha
    // intentado corregirlo en su segunda pasada y devuelve lo que sigue
    // sobrando (repeticiones o textos que no caben en la plantilla).
    for (const warning of serverWarnings) {
      notes.push(warning);
    }

    setAiNotice(
      notes.length
        ? { kind: "warn", text: `⚠︎ ${notes.join(" · ")}` }
        : {
            kind: "ok",
            text: "✓ Post autocompletado y tweet redactado. Ahora solo sube tu imagen o video.",
          },
    );
    showToast("✓ ¡Post y tweet redactados con éxito!");
    return true;
  };

  // ── Prompt compartido para llamadas directas desde el navegador ────────
  /** Aplica el resultado de la IA y cierra el compositor flotante: cuando ya
   *  hay post redactado, lo que interesa es mirarlo, no la caja de texto. */
  const applyAiResultAndClose = (payload: unknown) => {
    // Sólo se cierra si la IA redactó de verdad: si preguntó por la noticia
    // el compositor se queda abierto para responderle.
    if (applyAiResult(payload)) setAiComposerOpen(false);
  };

  /** Sistema de la llamada directa (Groq / Gemini / OpenRouter): la misma
   *  plantilla, pero con el apartado 7 de JSON puro, porque estos proveedores
   *  se llaman con `response_format: json_object` (o `response_mime_type:
   *  application/json`). Si no hay noticia, la pregunta viaja DENTRO del
   *  objeto para que la UI pueda mostrarla. */
  const getClientSystemPrompt = () =>
    [
      "# BLACKNEWS — GENERADOR DE PUBLICACIONES",
      "",
      buildEditorialPromptCore(enabledCategories),
      "",
      "## 7. FORMATO DE ESTA RESPUESTA",
      "Devuelve EXCLUSIVAMENTE el objeto JSON del apartado 2: nada de markdown, ni bloques de código, ni texto antes o después (este entorno exige JSON puro).",
      `Si el apartado 1 determina que no hay información suficiente para identificar la noticia, no inventes: devuelve exactamente {"question":"${NO_CONTEXT_QUESTION}"} y ninguna otra propiedad.`,
    ].join("\n");

  /** Texto que copian los botones «Prompt» y «Todo»: la plantilla literal de
   *  la redacción, tal cual y sin nada añadido (sin bloque de contexto, sin
   *  JSON y sin tweet): la noticia se pega aparte en la IA externa. */
  const buildAiPromptBase = () =>
    [
      "# BLACKNEWS — GENERADOR DE PUBLICACIONES",
      "",
      buildEditorialPromptCore(enabledCategories),
      "",
      "## 7. PRESENTACIÓN",
      "",
      "Entrega siempre en este orden:",
      "",
      "**A. JSON PARA BLACKNEWS 4:5 GENERATOR**",
      "",
      "Un bloque de código JSON válido y editable.",
      "",
      "**B. TWEET / REDES SOCIALES**",
      "",
      "El contenido exacto de tweetBody, sin modificaciones.",
      "",
      "No agregues explicaciones ni comentarios adicionales.",
    ].join("\n");

  /** Alias del «Todo»: la misma plantilla. El JSON y el tweet se copian con
   *  sus propios botones, no van dentro del prompt. */
  const buildAiTodoClipboard = () => buildAiPromptBase();

  const callGroqDirect = async (
    topic: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    const key = groqKey.trim();
    if (!key) return { success: false, error: "no_key" };

    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: getClientSystemPrompt() },
              { role: "user", content: `Redacta sobre: ${topic}` },
            ],
            temperature: 0.6,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(45000),
        },
      );

      if (res.status === 401)
        return {
          success: false,
          error: "Clave de Groq inválida. Compruébala en console.groq.com.",
        };
      if (res.status === 429)
        return {
          success: false,
          error:
            "Límite temporal de Groq alcanzado. Espera unos instantes o usa Gemini.",
        };
      if (!res.ok)
        return { success: false, error: `Groq respondió ${res.status}.` };

      const raw = await res.json().catch(() => null);
      const text: string | undefined = raw?.choices?.[0]?.message?.content;
      if (!text) return { success: false, error: "Groq no devolvió texto." };

      const parsed = parseAiJson(text) as Record<string, unknown> | null;
      if (!parsed)
        return {
          success: false,
          error: `Groq no devolvió JSON válido: ${text.slice(0, 200)}`,
        };
      return {
        success: true,
        data: {
          question:
            typeof parsed.question === "string" ? parsed.question : undefined,
          content: parsed.content ?? parsed,
          tweetBody: parsed.tweetBody ?? parsed.tweet ?? "",
          sources: [],
          searched: false,
          note: "Modo directo Groq Cloud (Llama 3.3 · 14.400 req/día gratis).",
          model: "llama-3.3-70b-versatile (Groq)",
        },
      };
    } catch (err) {
      if (
        err instanceof Error &&
        /timeout|abort/i.test(err.name + err.message)
      ) {
        return {
          success: false,
          error: "Groq no respondió a tiempo (45 s). Intenta de nuevo.",
        };
      }
      return {
        success: false,
        error: "No se pudo conectar con Groq. Comprueba tu conexión.",
      };
    }
  };

  // ── Llamada directa a Gemini Flash (sin worker): gratis, 1.500 req/día ──
  const callGeminiDirect = async (
    topic: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    const key = geminiKey.trim();
    if (!key) return { success: false, error: "no_key" };

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: getClientSystemPrompt() }] },
          contents: [
            { role: "user", parts: [{ text: `Redacta sobre: ${topic}` }] },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.7,
          },
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.status === 400)
        return {
          success: false,
          error:
            "Clave de Gemini inválida o mal formada. Revisa la API key en aistudio.google.com.",
        };
      if (res.status === 403)
        return {
          success: false,
          error:
            "La clave de Gemini no tiene permisos. Genera una nueva en aistudio.google.com.",
        };
      if (res.status === 429)
        return {
          success: false,
          error:
            "Límite de Gemini alcanzado (1.500 req/día gratuitas). Prueba con Groq.",
        };
      if (!res.ok)
        return { success: false, error: `Gemini respondió ${res.status}.` };

      const raw = await res.json().catch(() => null);
      const text: string | undefined =
        raw?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { success: false, error: "Gemini no devolvió texto." };

      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start)
        return {
          success: false,
          error: `Gemini no devolvió JSON válido: ${text.slice(0, 200)}`,
        };
      const parsed = parseAiJson(text) as Record<string, unknown> | null;
      if (!parsed)
        return {
          success: false,
          error: `Gemini no devolvió JSON válido: ${text.slice(0, 200)}`,
        };

      return {
        success: true,
        data: {
          question:
            typeof parsed.question === "string" ? parsed.question : undefined,
          content: parsed.content ?? parsed,
          tweetBody: parsed.tweetBody ?? parsed.tweet ?? "",
          sources: [],
          searched: false,
          note: "Modo directo Google Gemini (Flash Lite · 1.500 req/día gratis).",
          model: "gemini-2.0-flash-lite (directo)",
        },
      };
    } catch (err) {
      if (
        err instanceof Error &&
        /timeout|abort/i.test(err.name + err.message)
      ) {
        return {
          success: false,
          error: "Gemini no respondió a tiempo (60 s). Intenta de nuevo.",
        };
      }
      return {
        success: false,
        error: "No se pudo conectar con Gemini. Comprueba tu conexión.",
      };
    }
  };

  const callOpenRouterDirect = async (topic: string): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    const key = openRouterKey.trim();
    if (!key) return { success: false, error: "no_key" };
    const model = openRouterModel.trim() || "openai/gpt-4o-mini";
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: getClientSystemPrompt() }, { role: "user", content: `Redacta sobre: ${topic}` }], temperature: 0.6, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) return { success: false, error: `OpenRouter respondió ${res.status}.` };
      const raw = await res.json().catch(() => null);
      const text = raw?.choices?.[0]?.message?.content;
      if (!text) return { success: false, error: "OpenRouter no devolvió texto." };
      const parsed = parseAiJson(text) as Record<string, unknown> | null;
      if (!parsed) return { success: false, error: `OpenRouter no devolvió JSON válido: ${text.slice(0, 200)}` };
      return { success: true, data: { question: typeof parsed.question === "string" ? parsed.question : undefined, content: parsed.content ?? parsed, tweetBody: parsed.tweetBody ?? parsed.tweet ?? "", sources: [], searched: false, note: `Modo directo OpenRouter (${model} · gratuito)`, model: `${model} (OpenRouter)` } };
    } catch { return { success: false, error: "No se pudo conectar con OpenRouter." }; }
  };

  const handleGenerateAi = async () => {
    if (aiBusy) return;
    // Contexto de partida: lo que se escribió en el cuadro de IA o, si está
    // vacío, lo que ya hay en el post. Sin nada de esto, no se pide redacción
    // (la IA sólo puede inventar): se lanza la pregunta por la noticia.
    const topic =
      aiTopic.trim() || title.trim() || description.trim();
    if (!topic) {
      setAiNotice({ kind: "warn", text: `⚠︎ ${NO_CONTEXT_QUESTION}` });
      return;
    }
    setAiBusy(true);
    setAiNotice(null);
    setAiSources([]);
    setAiSearch(null);
    try {
      // 1) Intentar primero el worker de Cloudflare (Workers AI / Groq / Gemini del backend)
      let workerUnavailable = false;
      try {
        const response = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: topic,
            categories: enabledCategories,
            countries: countryCatalog.map((c) => ({
              code: c.code,
              name: c.name,
            })),
          }),
          signal: AbortSignal.timeout(95000),
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.success) {
          applyAiResultAndClose(data.data);
          return;
        }
        if (response.status === 503) {
          workerUnavailable = true;
        } else if (response.status === 429) {
          setAiNotice({
            kind: "error",
            text: "Límite del worker alcanzado. Prueba con tu clave directa de Groq o Gemini.",
          });
          return;
        } else {
          workerUnavailable = true;
        }
      } catch {
        workerUnavailable = true;
      }

      // 2) Según modelo elegido por el usuario, intentamos primero ese proveedor
      const preferGroq = aiModelChoice === "groq-llama";
      const preferGemini = aiModelChoice === "gemini-flash";
      const preferOpenRouter = aiModelChoice.startsWith("or-");

      if (preferGroq && groqKey.trim()) {
        const groqRes = await callGroqDirect(topic);
        if (groqRes.success && groqRes.data) { applyAiResultAndClose(groqRes.data); return; }
      }
      if (preferGemini && geminiKey.trim()) {
        const geminiRes = await callGeminiDirect(topic);
        if (geminiRes.success && geminiRes.data) { applyAiResultAndClose(geminiRes.data); return; }
      }
      if (preferOpenRouter && openRouterKey.trim()) {
        const openRouterRes = await callOpenRouterDirect(topic);
        if (openRouterRes.success && openRouterRes.data) { applyAiResultAndClose(openRouterRes.data); return; }
      }

      // 3) Fallbacks en orden: Groq → Gemini → OpenRouter (si no fue elegido primero)
      if (!preferGroq && groqKey.trim()) {
        const groqRes = await callGroqDirect(topic);
        if (groqRes.success && groqRes.data) { applyAiResultAndClose(groqRes.data); return; }
        if (groqRes.error && !geminiKey.trim() && !openRouterKey.trim()) { setAiNotice({ kind: "error", text: groqRes.error }); return; }
      }
      if (!preferGemini && geminiKey.trim()) {
        const geminiRes = await callGeminiDirect(topic);
        if (geminiRes.success && geminiRes.data) { applyAiResultAndClose(geminiRes.data); return; }
        if (geminiRes.error && !openRouterKey.trim()) { setAiNotice({ kind: "error", text: geminiRes.error }); return; }
      }
      if (!preferOpenRouter && openRouterKey.trim()) {
        const openRouterRes = await callOpenRouterDirect(topic);
        if (openRouterRes.success && openRouterRes.data) { applyAiResultAndClose(openRouterRes.data); return; }
        if (openRouterRes.error) { setAiNotice({ kind: "error", text: openRouterRes.error }); return; }
      }

      // 5) Si ningún proveedor está disponible, abrir configuración con instrucciones
      setShowAiSettings(true);
      scrollAiCardIntoView();
      setAiNotice({
        kind: "warn",
        text: "Introduce una clave gratuita de Groq (14.400 req/día) o Gemini (1.500 req/día) en el panel de arriba para redactar sin coste alguno desde tu navegador.",
      });
    } finally {
      setAiBusy(false);
    }
  };

  /** Mete en la caja la configuración actual, por si se quiere partir de
   *  ella a mano antes de pedirle nada a la IA. */
  const handleLoadCurrentJson = () => {
    setAiJsonText(JSON.stringify(getPostConfigObject(), null, 2));
    setAiNotice(null);
  };

  const handlePasteAiJson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setAiJsonText(text);
        setAiNotice(null);
        showToast("✓ JSON pegado desde el portapapeles");
      }
    } catch {
      showToast("Usa Ctrl+V para pegar en el cuadro");
    }
  };

  const handleApplyAiJson = () => {
    if (!aiJsonText.trim()) {
      setAiNotice({ kind: "warn", text: "No hay JSON que aplicar todavía." });
      return;
    }
    try {
      JSON.parse(aiJsonText);
    } catch (err) {
      // handleApplyJson pondría el error en el modal de copia de seguridad,
      // que está cerrado: aquí se avisa en la propia tarjeta.
      setAiNotice({
        kind: "error",
        text:
          "El JSON no es válido: " +
          (err instanceof Error ? err.message : "error de sintaxis"),
      });
      return;
    }
    setAiNotice(null);
    handleApplyJson(aiJsonText);
  };

  const handleCopyAiTweet = async () => {
    if (!aiTweet) {
      setAiNotice({ kind: "warn", text: "Todavía no hay tweet que copiar." });
      return;
    }
    try {
      await navigator.clipboard.writeText(aiTweet);
      showToast("✓ Tweet copiado al portapapeles");
    } catch {
      showToast("No se pudo copiar directamente al portapapeles.");
    }
  };

  // ── Reescritura por tono (usando la misma llamada directa a Groq) ────
  const rewriteTone = async (text: string, tone: string, setText: (v: string) => void) => {
    if (!groqKey.trim() && !openRouterKey.trim()) {
      setAiNotice({ kind: "warn", text: `Necesitas una clave de Groq o OpenRouter gratuita para reescribir en tono "${tone}".` });
      return;
    }
    setAiBusy(true);
    try {
      const prompt = `Reescribe EXCLUSIVAMENTE el siguiente texto con el tono indicado (sólo el texto, sin explicaciones, sin markdown, sin comillas extra):\n\nTEXTO ORIGINAL:\n${text}\n\nTONO: ${tone}\n\nREGLAS: grafía normal (Sentence Case), sin puntos suspensivos (...), sin saltos de línea (\\n), sin hashtags ni emojis, máximo 120 caracteres en título y 170 en bajada según corresponda. Sólo el texto reescrito.`;
      const preferGroq = aiModelChoice === "groq-llama";
      const preferOpenRouter = aiModelChoice.startsWith("or-");
      const useOpenRouter = preferOpenRouter ? openRouterKey.trim() : (!groqKey.trim() && openRouterKey.trim());
      const url = useOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
      const auth = useOpenRouter ? openRouterKey.trim() : groqKey.trim();
      let modelName = useOpenRouter ? (openRouterModel.trim() || "openai/gpt-4o-mini") : "llama-3.3-70b-versatile";
      if (preferOpenRouter) {
        if (aiModelChoice === "or-llama") modelName = "meta-llama/llama-3.3-70b-instruct";
        else if (aiModelChoice === "or-gemini") modelName = "google/gemini-2.0-flash-lite";
        else modelName = "openai/gpt-4o-mini";
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${auth}` },
        body: JSON.stringify({ model: modelName, messages: [{ role: "system", content: REWRITE_SYSTEM_PROMPT }, { role: "user", content: prompt }], temperature: 0.7, max_tokens: 300 }),
        signal: AbortSignal.timeout(useOpenRouter ? 60000 : 45000),
      });
      const raw = await res.json().catch(() => null);
      const rewritten = raw?.choices?.[0]?.message?.content || "";
      if (rewritten) {
        const cleaned = rewritten.replace(/^["']|["']$/g, "").replace(/^Texto reescrito:\s*/, "").replace(/^Reescrito:\s*/, "");
        setText(cleaned.trim());
        showToast(`✓ Reescrito en tono "${tone}"`);
      }
    } catch {
      setAiNotice({ kind: "error", text: "No se pudo reescribir con ese tono. Intenta de nuevo." });
    } finally {
      setAiBusy(false);
    }
  };

  // El borrador sólo se restaura una vez al montar; mientras tanto el
  // autoguardado de abajo no debe escribir, o pisaría la configuración
  // guardada (formato 16:9, modo vídeo, controles de TV) con los valores por
  // defecto y se perdería para siempre.
  const draftRestoredRef = useRef(false);

  // Auto-save to localStorage so updates or refreshes never wipe their work
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!draftRestoredRef.current) return;
      try {
        const config = getPostConfigObject();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      } catch {}
    }, 600);
    return () => clearTimeout(timeout);
  }, [
    title,
    description,
    category,
    countryPlacement,
    countryFormat,
    selectedCountries,
    fontSizeTitle,
    fontSizeDesc,
    gapCategoryToTitle,
    gapTitleToDesc,
    titleLineHeightRatio,
    descLineHeightRatio,
    filter,
    brightness,
    contrast,
    blendFade,
    isMuted,
    mediaType,
    videoSpeed,
    trimStart,
    trimEnd,
    videoQuality,
    videoFormat,
    maxVideoDuration,
    videoOutro,
    postFormat,
    postDesign,
    podcastSeries,
    podcastEpisode,
    podcastAutoTitle,
    podcastMusicOn,
    podcastMusicVol,
    podcastFlagStyle,
    podcastBgSrc,
    tvShowLive,
    tvShowClock,
    tvIntro,
    tvIntroDur,
    textFadeOut,
    textFadeOutDur,
  ]);

  // Restore draft on initial load if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Se restaura siempre que sea un objeto de borrador, aunque el titular
        // esté vacío: el formato de salida, el modo vídeo y los ajustes de TV
        // viven aquí y perderlos por un campo vacío dejaba el generador en los
        // valores por defecto (4:5 + imagen, sin Intro ni Cierre BlackNews).
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          handleApplyJson(saved, true);
        }
      }
    } catch {
    } finally {
      draftRestoredRef.current = true;
    }
  }, []);

  // Prellenado desde el Centro de Investigación OSINT: titular original,
  // fragmento de la fuente, países (cuando la fuente los informa), crédito
  // de origen e imagen si existe. El resultado queda como borrador
  // editable: la publicación sigue siendo un paso manual del editor.
  useEffect(() => {
    if (!importPayload) return;
    const p = importPayload;
    if (p.title) setTitle(p.title);
    if (p.description) setDescription(p.description);
    if (p.category && enabledCategories.includes(p.category)) setCategory(p.category);
    if (p.countries.length > 0) setSelectedCountries(p.countries);
    setPhotoCaption(`Fuente: ${p.sourceName}`);
    if (p.imageUrl) {
      setMediaSrc(p.imageUrl);
      setMediaType("image");
      setMediaName("hallazgo-osint");
    }
    setOsintSource({
      name: p.sourceName,
      url: p.sourceUrl,
      publishedAt: p.publishedAt,
      machineTranslated: p.machineTranslated,
      originalTitle: p.originalTitle,
      originalSnippet: p.originalSnippet,
    });
    onImportConsumed?.();
  }, [importPayload, onImportConsumed]);

  // Las líneas de la vista previa se miden con la métrica real de Lexend: al
  // terminar de cargar la fuente se re-mide para no quedar con la métrica de
  // la fuente de respaldo.
  const [, setFontsReadyTick] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) setFontsReadyTick((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Sync video speed with preview media element (el <audio> del podcast también)
  useEffect(() => {
    const el = activeMediaEl();
    if (el) el.playbackRate = videoSpeed;
  }, [videoSpeed, mediaType]);

  // Global paste listener (Ctrl+V / Cmd+V for images)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleFile(blob);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Compute CSS filter style for live preview
  // `forceColor` descarta el desaturado del filtro (color original) y deja solo
  // el ajuste tonal: es el estado que se revela cuando termina la intro TV.
  const getFilterCss = (forceColor = false) => {
    let base = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (forceColor) return base;
    switch (filter) {
      case "bw-high":
        return `grayscale(100%) contrast(${contrast + 15}%) brightness(${brightness - 5}%)`;
      case "bw-smooth":
        return `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%)`;
      case "noir":
        return `grayscale(100%) contrast(${contrast + 35}%) brightness(${brightness - 10}%)`;
      case "muted-color":
        return `saturate(45%) contrast(${contrast}%) brightness(${brightness}%)`;
      case "color":
      default:
        return base;
    }
  };

  // Compute canvas filter string
  const getCanvasFilterString = (forceColor = false) => {
    let b = brightness / 100;
    let c = contrast / 100;
    if (forceColor)
      return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)})`;
    switch (filter) {
      case "bw-high":
        return `grayscale(100%) contrast(${(c * 1.15).toFixed(2)}) brightness(${(b * 0.95).toFixed(2)})`;
      case "bw-smooth":
        return `grayscale(100%) contrast(${c.toFixed(2)}) brightness(${b.toFixed(2)})`;
      case "noir":
        return `grayscale(100%) contrast(${(c * 1.35).toFixed(2)}) brightness(${(b * 0.9).toFixed(2)})`;
      case "muted-color":
        return `saturate(45%) contrast(${c.toFixed(2)}) brightness(${b.toFixed(2)})`;
      case "color":
      default:
        return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)})`;
    }
  };

  // Formatted countries string for display and canvas
  const getFormattedCountries = (
    fmt: "names" | "flags-names" | "flags-codes" | "flags-only" = countryFormat,
  ) => {
    if (selectedCountries.length === 0) return "";
    switch (fmt) {
      case "flags-codes":
        return selectedCountries.map((c) => `${c.flag} ${c.code}`).join(" · ");
      case "flags-names":
        return selectedCountries
          .map((c) => `${c.flag} ${c.name.toUpperCase()}`)
          .join(" · ");
      case "flags-only":
        // Sin texto: para medir la línea sólo cuenta el ancho de cada bandera.
        return selectedCountries.map((c) => `${c.flag} `).join("");
      case "names":
      default:
        return selectedCountries.map((c) => c.name.toUpperCase()).join(" · ");
    }
  };

  // ── Formato TV 16:9 (1920×1080): geometría compartida ─────────────────────
  // La usan por igual renderToCanvas (el archivo exportado) y la vista previa
  // (que escala este mismo lienzo con transform), así el chyron corta igual
  // carácter a carácter en ambos.
  const TV_W = 1920;
  const TV_H = 1080;
  // Escala de la interfaz gráfica de la señal (bug, chyron y ticker): se
  // pidió un 15% más pequeña. Sólo se reducen TAMAÑOS (fuentes, cajas y
  // huecos); los márgenes de emisión (TV_PAD y las y superiores) no cambian.
  const TV_UI = 0.85;
  const tvUi = (n: number) => Math.round(n * TV_UI);
  const TV_PAD = 64; // margen de seguridad de emisión
  const TV_TICKER_H = tvUi(64); // altura del ticker inferior
  // Velocidad del marquee inferior (px/s a escala 1920): la comparten el
  // lienzo (desfase por segundo de salida) y la vista previa (duración de la
  // animación CSS, calculada sobre la celda medida). Escala con la interfaz
  // para conservar el mismo ritmo relativo al tamaño del texto.
  const TV_TICKER_SPEED = tvUi(140);
  const TV_STACK_W = tvUi(1240); // ancho del chyron (columna inferior izquierda)
  const TV_STACK_PAD = tvUi(36); // aire interior del chyron
  const TV_ACCENT_W = tvUi(10); // filete emerald en el borde izquierdo
  const TV_TAG_H = tvUi(56); // altura de la etiqueta de sección
  const TV_GAP_TAG_TITLE = tvUi(26);
  const TV_GAP_TITLE_DESC = tvUi(20);
  // Detalles de la interfaz, todos a TV_UI y compartidos por el lienzo y la
  // vista previa para que sigan calmando carácter a carácter.
  const TV_BUG_SQ = tvUi(40); // cuadro blanco del cuño
  const TV_BUG_FS = tvUi(44); // «BLACKNEWS.»
  const TV_BUG_DX = tvUi(58); // texto del bug desde TV_PAD
  const TV_BUG_GAP = tvUi(18); // hueco cuadro → texto (preview)
  const TV_CLOCK_FS = tvUi(40); // hora de emisión
  const TV_LIVE_FS = tvUi(26); // «● EN DIRECTO»
  const TV_LIVE_H = tvUi(52); // alto de la cápsula
  const TV_LIVE_GAP = tvUi(28); // hueco cápsula → hora
  const TV_LIVE_PAD_L = tvUi(16); // padding izquierdo de la cápsula
  const TV_LIVE_PAD_R = tvUi(24); // padding derecho (y cierre del ancho)
  const TV_LIVE_DOT = tvUi(14); // punto rojo y hueco punto → texto
  const TV_LIVE_DX = tvUi(38); // texto desde el borde de la cápsula
  const TV_TAG_FS = tvUi(30); // «GEOPOLÍTICA» de la etiqueta
  const TV_TAG_PADX = tvUi(24); // texto dentro de la etiqueta
  const TV_TAG_WPAD = tvUi(48); // ancho extra de la etiqueta
  const TV_TAG_DY = tvUi(40); // desfase de entrada de la etiqueta
  const TV_CTRY_FS = tvUi(24); // fila de países
  const TV_CTRY_GAP = tvUi(22); // etiqueta → países (fila)
  const TV_CTRY_ITEM_GAP = tvUi(14); // hueco entre países (preview)
  const TV_CTRY_SEP_GAP = tvUi(8); // hueco del «·» de cada país (preview)
  const TV_CTRY_DY = tvUi(12); // línea base de la fila de países
  const TV_FLAG_W = tvUi(34);
  const TV_FLAG_H = tvUi(23);
  const TV_FLAG_DX = tvUi(42); // paso por bandera
  const TV_LINE_DY = tvUi(50); // desfase de entrada de titular/bajada
  const TV_EXIT_DY = tvUi(60); // desfase de salida del chyron
  const TV_TICKER_FS = tvUi(24); // texto del marquee
  const TV_TICKER_SQ = tvUi(16); // cuño cuadrado del marquee
  const TV_TICKER_DX = tvUi(34); // texto del marquee tras el cuño
  const TV_TICKER_GAP = tvUi(18); // hueco cuño → celda (preview)
  const TV_TICKER_FLAG_W = tvUi(26); // bandera de país en el marquee
  const TV_TICKER_FLAG_H = tvUi(18); // alto de la bandera en el marquee
  const TV_TICKER_FLAG_GAP = tvUi(8); // aire bandera → texto
  const TV_CAP_FS = tvUi(24); // crédito de foto sobre el ticker
  const tvStackInnerW = TV_STACK_W - TV_ACCENT_W - TV_STACK_PAD * 2;
  // Fuentes del chyron escaladas a la interfaz: el preview del 16:9 y el
  // lienzo usan estas medidas (en 4:5/9:16 mandan las originales).
  const tvTitleFs = Math.round(fontSizeTitle * TV_UI);
  const tvDescFs = Math.round(fontSizeDesc * TV_UI);
  const tvTitleLineH = Math.round(tvTitleFs * titleLineHeightRatio);
  const tvDescLineH = Math.round(tvDescFs * descLineHeightRatio);
  const tvTitleLines = capLines(
    wrapLikeExport(
      `700 ${tvTitleFs}px 'Lexend', sans-serif`,
      title || "Escribe un titular impactante...",
      tvStackInnerW,
    ),
    3,
  );
  const tvDescLines = description.trim()
    ? capLines(
        wrapLikeExport(
          `400 ${tvDescFs}px 'Lexend', sans-serif`,
          description,
          tvStackInnerW,
        ),
        2,
      )
    : [];
  const tvStackH =
    TV_STACK_PAD * 2 +
    TV_TAG_H +
    TV_GAP_TAG_TITLE +
    tvTitleLines.length * tvTitleLineH +
    (tvDescLines.length > 0
      ? TV_GAP_TITLE_DESC + tvDescLines.length * tvDescLineH
      : 0);
  const tvStackY = TV_H - TV_TICKER_H - tvStackH;
  // Cinta del ticker: cuño de marca + (con intro: el titular) + países, que
  // forman la celda que el marquee inferior desplaza en bucle infinito durante
  // el vídeo. Con la intro activa el titular también viaja por el ticker para
  // que no desaparezca de la señal al irse el chyron.
  //
  // Los países viajan por segmentos (bandera + nombre): los emoji de bandera
  // no se renderizan en Windows, así que el marquee dibuja la imagen de la
  // bandera (flagcdn) igual que ya hace el chyron.
  const tvTickerCountries: TickerSeg[] = [];
  if (countryFormat !== "names") {
    // Con «solo banderas» cada país va sin texto y el hueco es aire, no punto.
    const flagsOnly = countryFormat === "flags-only";
    selectedCountries.forEach((c, i) => {
      if (i > 0)
        tvTickerCountries.push({ text: flagsOnly ? "   " : " · " });
      tvTickerCountries.push({
        code: c.code,
        emoji: c.flag,
        text:
          countryFormat === "flags-codes"
            ? c.code
            : flagsOnly
              ? ""
              : c.name.toUpperCase(),
      });
    });
  } else {
    selectedCountries.forEach((c, i) => {
      if (i > 0) tvTickerCountries.push({ text: " · " });
      tvTickerCountries.push({ text: c.name.toUpperCase() });
    });
  }
  const tvTickerTitle = title.replace(/\s+/g, " ").trim().toUpperCase();
  const tvTickerItems: TickerItem[] = [
    "BLACKNEWS",
    ...(tvIntro && tvTickerTitle
      ? [
          tvTickerTitle.length > 110
            ? `${tvTickerTitle.slice(0, 110)}…`
            : tvTickerTitle,
        ]
      : []),
    ...(tvTickerCountries.length ? [tvTickerCountries] : []),
  ];

  /** Dibuja la composición completa de señal de TV sobre el lienzo 1920×1080:
   *  fondo a sangre, velos de legibilidad, bug de canal con enlace y hora,
   *  chyron inferior izquierda (etiqueta + titular + bajada) y marquee inferior.
   *  `outTime` es el segundo de la salida (faltante o 0 = estado estático):
   *  con la intro activa manda sus fases (entrada sobre imagen en B&N y salida
   *  al revelarse el vídeo en color) y siempre desplaza el marquee del ticker. */
  const drawTvFrame = (
    ctx: CanvasRenderingContext2D,
    mediaElement?: HTMLImageElement | HTMLVideoElement,
    frameOverride?: {
      source: CanvasImageSource;
      width: number;
      height: number;
      rotation?: number;
    },
    isOverlayOnly = false,
    flagsData: Array<{
      code: string;
      img: HTMLImageElement | null;
      text: string;
    }> = [],
    outTime?: number,
  ) => {
    const W = TV_W;
    const H = TV_H;

    // Fases de la intro TV: `introOn` sólo cuando llega un tiempo explícito
    // (la exportación PNG de póster usa el estado en HOLD vía outTime).
    const introOn = tvIntro && typeof outTime === "number";
    const introT = introOn ? outTime : 0;
    const inIntro = introOn && introT < tvIntroDur;
    const revealed = introOn && !inIntro;

    // 1) Fondo: foto o fotograma de vídeo a sangre (cover) — en la pasada de
    //    overlay tipográfico se queda fondo negro pleno.
    if (isOverlayOnly) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
    } else if (mediaElement || frameOverride) {
      ctx.save();
      // «Escala»/«Reposición»: recorte al rectángulo de la señal y transform
      // con origen en su centro, igual que el CSS del preview (16:9 = 1920 px
      // de lienzo frente a los 480 px nominales de la tarjeta).
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      applyMediaZoom(ctx, 0, 0, W, H, "16:9", mediaZoom, mediaOffsetX, mediaOffsetY);
      // Intro: imagen en B&N (sin color). Tras la intro: color original
      // (sólo ajuste tonal), ignorando el desaturado del filtro elegido.
      const canvasFilter =
        getCanvasFilterString(revealed) + (inIntro ? " grayscale(100%)" : "");
      if (canvasFilter !== "brightness(1.00) contrast(1.00)") {
        ctx.filter = canvasFilter;
      }
      let elW: number;
      let elH: number;
      if (frameOverride) {
        elW = frameOverride.width;
        elH = frameOverride.height;
      } else {
        elW =
          (mediaElement as HTMLVideoElement).videoWidth ||
          (mediaElement as HTMLImageElement).naturalWidth ||
          1280;
        elH =
          (mediaElement as HTMLVideoElement).videoHeight ||
          (mediaElement as HTMLImageElement).naturalHeight ||
          720;
      }
      const rot = frameOverride?.rotation ?? 0;
      const dispW = rot % 180 === 90 ? elH : elW;
      const dispH = rot % 180 === 90 ? elW : elH;
      const targetRatio = W / H;
      const sourceRatio = dispW / dispH;
      let sx = 0,
        sy = 0,
        sw = dispW,
        sh = dispH;
      if (sourceRatio > targetRatio) {
        sw = dispH * targetRatio;
        sx = (dispW - sw) / 2;
      } else {
        sh = dispW / targetRatio;
        sy = (dispH - sh) / 2;
      }
      const src = (
        frameOverride ? frameOverride.source : mediaElement!
      ) as CanvasImageSource;
      if (!rot) {
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
      } else {
        let csx = sx,
          csy = sy,
          csw = sw,
          csh = sh;
        if (rot === 90) {
          csx = sy;
          csy = dispW - sx - sw;
          csw = sh;
          csh = sw;
        } else if (rot === 180) {
          csx = dispW - sx - sw;
          csy = dispH - sy - sh;
        } else if (rot === 270) {
          csx = dispH - sy - sh;
          csy = sx;
          csw = sh;
          csh = sw;
        }
        ctx.translate(W / 2, H / 2);
        ctx.rotate((rot * Math.PI) / 180);
        const dw = rot % 180 === 90 ? H : W;
        const dh = rot % 180 === 90 ? W : H;
        ctx.drawImage(src, csx, csy, csw, csh, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();
    }

    // 2) Velos de legibilidad: el superior respalda el bug de canal, que
    //    siempre está en pantalla; el inferior existe sólo para el chyron,
    //    así que cuando la intro termina y queda vídeo limpio tampoco se
    //    pinta (el ticker lleva su propia barra opaca).
    ctx.save();
    const topScrim = ctx.createLinearGradient(0, 0, 0, 260);
    topScrim.addColorStop(0, "rgba(0,0,0,0.92)");
    topScrim.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, W, 260);
    if (!revealed) {
      const botScrim = ctx.createLinearGradient(0, H - 640, 0, H);
      botScrim.addColorStop(0, "rgba(0,0,0,0)");
      botScrim.addColorStop(1, "rgba(0,0,0,0.94)");
      ctx.fillStyle = botScrim;
      ctx.fillRect(0, H - 640, W, 640);
    }
    if (blendFade) {
      const fade = ctx.createLinearGradient(0, 0, 0, 220);
      fade.addColorStop(0, "#000000");
      fade.addColorStop(0.4, "rgba(0,0,0,0.55)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, 220);
    }
    ctx.restore();

    // 3) Bug de canal (superior izquierda): cuño + marca
    ctx.save();
    ctx.textBaseline = "top";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(TV_PAD, 50, TV_BUG_SQ, TV_BUG_SQ);
    ctx.font = `700 ${TV_BUG_FS}px 'Lexend', sans-serif`;
    ctx.letterSpacing = "-0.5px";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("BLACKNEWS.", TV_PAD + TV_BUG_DX, 52);
    ctx.letterSpacing = "0px";

    // 4) Enlace en directo + hora de emisión (superior derecha), ambos opcionales
    const now = new Date();
    const clockStr = `${tvPad2(now.getHours())}:${tvPad2(now.getMinutes())}`;
    ctx.font = `700 ${TV_CLOCK_FS}px 'Lexend', sans-serif`;
    ctx.letterSpacing = "1px";
    const timeW = ctx.measureText(clockStr).width;
    const timeX = W - TV_PAD - timeW;
    if (tvShowLive) {
      ctx.font = `700 ${TV_LIVE_FS}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "3px";
      const liveW = ctx.measureText("EN DIRECTO").width;
      const pillH = TV_LIVE_H;
      const pillW = TV_LIVE_DX + liveW + TV_LIVE_PAD_R;
      // Con hora visible la cápsula va a su izquierda; sin hora, a ras del
      // margen de emisión.
      const pillX = (tvShowClock ? timeX - TV_LIVE_GAP : W - TV_PAD) - pillW;
      const pillY = 46;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        pillX + TV_LIVE_PAD_L + TV_LIVE_DOT / 2,
        pillY + pillH / 2,
        TV_LIVE_DOT / 2,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "#EF4444";
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textBaseline = "middle";
      ctx.fillText("EN DIRECTO", pillX + TV_LIVE_DX, pillY + pillH / 2 + 1);
      ctx.textBaseline = "top";
    }
    if (tvShowClock) {
      ctx.font = `700 ${TV_CLOCK_FS}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "1px";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(clockStr, timeX, 52);
      ctx.letterSpacing = "0px";
    }
    ctx.restore();

    // 5) Chyron (bloque inferior izquierdo): etiqueta + titular + bajada.
    //    Con la intro activa se anima la entrada escalonada (la caja crece
    //    desde la izquierda) y el bloque sale desvaneciéndose al final de la
    //    intro; cuando la intro termina no se dibuja (vídeo limpio) y el
    //    titular queda sólo en el ticker inferior.
    if (!revealed) {
      const boxIn = inIntro ? tvIntroBoxIn(introT) : 1;
      const exitQ = inIntro ? tvIntroExit(introT, tvIntroDur) : 0;
      const gAlpha = 1 - exitQ * exitQ;
      const gDy = exitQ * exitQ * TV_EXIT_DY;
      const tagP = inIntro ? tvIntroTagIn(introT) : 1;
      const boxW = TV_STACK_W * boxIn;
      const stackX = TV_PAD;
      ctx.save();
      ctx.globalAlpha = gAlpha;
      ctx.translate(0, gDy);
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fillRect(stackX, tvStackY, boxW, tvStackH);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(stackX, tvStackY, boxW, 1);
      ctx.fillStyle = "#10B981";
      ctx.fillRect(stackX, tvStackY, TV_ACCENT_W * boxIn, tvStackH);

      // El contenido queda recortado a la caja exacta (mismo corte que el
      // overflow-hidden de la vista previa).
      ctx.save();
      ctx.beginPath();
      ctx.rect(stackX, tvStackY, boxW, tvStackH);
      ctx.clip();
      ctx.textBaseline = "top";

      let chX = stackX + TV_ACCENT_W + TV_STACK_PAD;
      let chY = tvStackY + TV_STACK_PAD;

      // Etiqueta de sección (bloque emerald con texto negro)
      ctx.save();
      ctx.globalAlpha = gAlpha * tagP;
      ctx.translate(0, (1 - tagP) * TV_TAG_DY);
      const cat = (category || "GEOPOLÍTICA").trim().toUpperCase();
      ctx.font = `700 ${TV_TAG_FS}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "2.5px";
      const tagW = ctx.measureText(cat).width + TV_TAG_WPAD;
      ctx.fillStyle = "#10B981";
      ctx.fillRect(chX, chY, tagW, TV_TAG_H);
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "middle";
      ctx.fillText(cat, chX + TV_TAG_PADX, chY + TV_TAG_H / 2 + 1);
      ctx.textBaseline = "top";

      // Países junto a la etiqueta (banderas según el formato elegido)
      if (flagsData.length > 0) {
        ctx.font = `600 ${TV_CTRY_FS}px 'Lexend', sans-serif`;
        ctx.letterSpacing = "1.5px";
        let cx = chX + tagW + TV_CTRY_GAP;
        const rowMidY = chY + TV_TAG_H / 2;
        // Tope del recorte de la fila en la vista previa (borde del chyron
        // menos su aire interior): así países y banderas cortan igual.
        const maxCx = stackX + boxW - TV_STACK_PAD;
        for (let i = 0; i < flagsData.length && cx < maxCx; i++) {
          const item = flagsData[i];
          if (countryFormat !== "names" && item.img) {
            ctx.drawImage(
              item.img,
              cx,
              rowMidY - TV_CTRY_DY,
              TV_FLAG_W,
              TV_FLAG_H,
            );
            cx += TV_FLAG_DX;
          }
          if (countryFormat !== "flags-only") {
            ctx.fillStyle = "#94A3B8";
            ctx.fillText(item.text, cx, rowMidY - TV_CTRY_DY);
            cx += ctx.measureText(item.text).width;
          }
          if (i < flagsData.length - 1) {
            const cSep = countryFormat === "flags-only" ? "   " : "  ·  ";
            ctx.fillStyle = "#64748B";
            ctx.fillText(cSep, cx, rowMidY - TV_CTRY_DY);
            cx += ctx.measureText(cSep).width;
          }
        }
      }
      ctx.restore();

      // Titular (máx. 3 líneas) y bajada (máx. 2) con las métricas del usuario
      chY += TV_TAG_H + TV_GAP_TAG_TITLE;
      ctx.font = `700 ${tvTitleFs}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "0px";
      ctx.fillStyle = "#FFFFFF";
      for (let i = 0; i < tvTitleLines.length; i++) {
        const p = inIntro ? tvIntroLineIn(introT, i) : 1;
        ctx.save();
        ctx.globalAlpha = gAlpha * p;
        ctx.translate(0, (1 - p) * TV_LINE_DY);
        if (tvTitleLines[i]) {
          ctx.fillText(tvTitleLines[i], chX, chY);
        }
        ctx.restore();
        chY += tvTitleLineH;
      }
      if (tvDescLines.length > 0) {
        chY += TV_GAP_TITLE_DESC;
        ctx.font = `400 ${tvDescFs}px 'Lexend', sans-serif`;
        ctx.fillStyle = "#CBD5E1";
        for (let j = 0; j < tvDescLines.length; j++) {
          const p = inIntro
            ? tvIntroLineIn(introT, tvTitleLines.length + j)
            : 1;
          ctx.save();
          ctx.globalAlpha = gAlpha * p;
          ctx.translate(0, (1 - p) * TV_LINE_DY);
          if (tvDescLines[j]) {
            ctx.fillText(tvDescLines[j], chX, chY);
          }
          ctx.restore();
          chY += tvDescLineH;
        }
      }
      ctx.restore(); // fin recorte de caja
      ctx.restore(); // fin grupo del chyron
    }

    // 6) Marquee inferior (cinta de última hora): cuño emerald fijo + celda
    //    de marca/titular/países desplazándose en bucle infinito. El desfase
    //    sale del tiempo de salida, así que avanza con el vídeo (y queda fijo
    //    en el PNG, que es un solo fotograma).
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H - TV_TICKER_H, W, TV_TICKER_H);
    ctx.clip();
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, H - TV_TICKER_H, W, TV_TICKER_H);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(0, H - TV_TICKER_H, W, 1);
    const tickerMidY = H - TV_TICKER_H / 2;
    ctx.font = `600 ${TV_TICKER_FS}px 'Lexend', sans-serif`;
    ctx.letterSpacing = "1.6px";
    ctx.textBaseline = "middle";
    // Cuño fijo a la izquierda (el texto del marquee pasa a su lado).
    ctx.fillStyle = "#10B981";
    ctx.fillRect(
      TV_PAD,
      tickerMidY - TV_TICKER_SQ / 2,
      TV_TICKER_SQ,
      TV_TICKER_SQ,
    );
    const tickerTextX = TV_PAD + TV_TICKER_DX;
    const tickerSep = "   ·   ";
    const tickerSepW = ctx.measureText(tickerSep).width;
    // Banderas ya cargadas por el mismo origen que el chyron (flagsData).
    const flagImgByCode = new Map<string, HTMLImageElement>();
    for (const f of flagsData) {
      if (f.img) flagImgByCode.set(f.code, f.img);
    }
    /** Ancho de un segmento: bandera (imagen o emoji dibujable) + texto. */
    const tickerSegW = (seg: TickerSeg): number => {
      let w = 0;
      if (seg.code) {
        const img = flagImgByCode.get(seg.code);
        if (img) w += TV_TICKER_FLAG_W + TV_TICKER_FLAG_GAP;
        else if (seg.emoji && !isRegionalFlagEmoji(seg.emoji))
          w += ctx.measureText(seg.emoji).width + TV_TICKER_FLAG_GAP;
      }
      return w + ctx.measureText(seg.text).width;
    };
    const tickerItemW = (it: TickerItem): number =>
      typeof it === "string"
        ? ctx.measureText(it).width
        : it.reduce((sum, seg) => sum + tickerSegW(seg), 0);
    const tickerItemWs = tvTickerItems.map(tickerItemW);
    const tickerCellW = tickerItemWs.reduce(
      (sum, w) => sum + w + tickerSepW,
      0,
    );
    if (Number.isFinite(tickerCellW) && tickerCellW > 0) {
      const tickerCycle =
        ((((typeof outTime === "number" ? outTime : 0) * TV_TICKER_SPEED) %
          tickerCellW) +
          tickerCellW) %
        tickerCellW;
      ctx.save();
      ctx.beginPath();
      ctx.rect(tickerTextX, H - TV_TICKER_H, W - tickerTextX, TV_TICKER_H);
      ctx.clip();
      for (
        let copyX = tickerTextX - tickerCycle;
        copyX < W;
        copyX += tickerCellW
      ) {
        let cx = copyX;
        for (let i = 0; i < tvTickerItems.length; i++) {
          ctx.fillStyle = i === 0 ? "#FFFFFF" : "#E2E8F0";
          const item = tvTickerItems[i];
          if (typeof item === "string") {
            ctx.fillText(item, cx, tickerMidY + 1);
          } else {
            // País: bandera como imagen (los emoji de bandera no se pintan
            // en Windows) seguida de su nombre o código.
            let sx = cx;
            for (const seg of item) {
              if (seg.code) {
                const img = flagImgByCode.get(seg.code);
                if (img) {
                  ctx.drawImage(
                    img,
                    sx,
                    tickerMidY - TV_TICKER_FLAG_H / 2 + 1,
                    TV_TICKER_FLAG_W,
                    TV_TICKER_FLAG_H,
                  );
                  sx += TV_TICKER_FLAG_W + TV_TICKER_FLAG_GAP;
                } else if (seg.emoji && !isRegionalFlagEmoji(seg.emoji)) {
                  ctx.fillText(seg.emoji, sx, tickerMidY + 1);
                  sx += ctx.measureText(seg.emoji).width + TV_TICKER_FLAG_GAP;
                }
              }
              if (seg.text) {
                ctx.fillText(seg.text, sx, tickerMidY + 1);
                sx += ctx.measureText(seg.text).width;
              }
            }
          }
          cx += tickerItemWs[i];
          ctx.fillStyle = "#475569";
          ctx.fillText(tickerSep, cx, tickerMidY + 1);
          cx += tickerSepW;
        }
      }
      ctx.restore();
    }
    ctx.restore();

    // 7) Crédito de foto (derecha, sobre el ticker). Con sombra suave: en el
    //    vídeo limpio ya no hay velo detrás y debe seguir legible, igual que
    //    el crédito del formato 4:5/9:16.
    if (photoCaption && photoCaption.trim()) {
      ctx.save();
      ctx.font = `500 ${TV_CAP_FS}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "0px";
      ctx.fillStyle = "#E2E8F0";
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 6;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      const maxCapW = W - TV_PAD - (TV_PAD + TV_STACK_W + tvUi(40));
      let cap = photoCaption.trim();
      if (maxCapW > 80 && ctx.measureText(cap).width > maxCapW) {
        while (ctx.measureText(cap + "…").width > maxCapW && cap.length > 3) {
          cap = cap.slice(0, -1);
        }
        cap += "…";
      }
      ctx.fillText(cap, W - TV_PAD, H - TV_TICKER_H - 44);
      ctx.restore();
    }
  };

  // Render high-res canvas (1080×1350 en 4:5, 1080×1920 en 9:16, 1920×1080 en 16:9)
  // ── Post podcast: variante AMOLED minimalista ──────────────────────────
  // Composición propia para las notas en audio: fondo negro absoluto (o el
  // vídeo/imagen de fondo oscurecido), sección y países arriba (mismo formato
  // que la noticia), titular en dos líneas (serie grande, fecha pequeña), onda
  // con reloj y la marca con el episodio abajo. Todo lo que se ve depende de
  // `outTime`, así que la vista previa y el archivo exportado coinciden
  // fotograma a fotograma.
  // ── Titular del podcast ──
  // Con el automático no hay que escribir nada cada día: la fecha se calcula en
  // cada pintado, así que un export hecho mañana sale con su fecha.
  const podcastFecha = (() => {
    const d = new Date();
    const meses = [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ];
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
  })();
  const podcastTitulo = podcastAutoTitle
    ? `${podcastSeries.trim() || "Noticias en 1 minuto"}\n${podcastFecha}`
    : title;

  const drawPodcastFrame = (
    ctx: CanvasRenderingContext2D,
    opts: {
      mediaElement?: HTMLImageElement | HTMLVideoElement | HTMLAudioElement;
      frameOverride?: {
        source: CanvasImageSource;
        width: number;
        height: number;
        rotation?: number;
      };
      /** Segundo dentro del clip: mueve reloj, onda y barra de progreso. */
      outTime?: number;
      /** La vista previa pinta el estado real; el archivo, siempre sonando. */
      playing?: boolean;
      /** Banderas ya cargadas (imagen o texto), igual que en el resto. */
      flagsData?: Array<{
        code: string;
        img: HTMLImageElement | null;
        text: string;
      }>;
    },
  ) => {
    const { mediaElement, frameOverride, outTime, playing } = opts;
    const flagsData = opts.flagsData ?? [];
    const W = POST_W;
    const H = POST_H;
    const isWide = postFormat === "16:9";
    const isTall = postFormat === "9:16";
    // Unidad tipográfica: 4:5 y 9:16 van a 1080 de ancho, 16:9 crece algo
    // (no en proporción: su alto es 1080 y el texto no puede dispararse).
    const u = isWide ? 1.12 : isTall ? 1.04 : 1;
    const padX = isWide ? 104 : 84;
    const padTop = isWide ? 60 : isTall ? PAD_TOP_9X16 : 76;
    const padRight = isWide ? 104 : isTall ? PAD_RIGHT_9X16 : 84;
    const padBottom = isWide ? 56 : isTall ? 150 : Math.round(80 * u);
    const contentW = W - padX - padRight;

    // Reloj y progreso: segundos dentro del clip (0 = arranque del recorte).
    const dur = trimEnd > trimStart ? trimEnd - trimStart : videoDuration;
    const cur = Math.min(Math.max(outTime ?? 0, 0), Math.max(dur, 0));
    const progress = dur > 0 ? Math.min(1, cur / dur) : 0;

    // ── Fondo: negro absoluto o medio oscurecido ──
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    // El <audio> no aporta píxeles: el fondo, si lo hay, llega como <img>.
    const bgEl = mediaElement;
    const bgIsAudio =
      !!bgEl && (bgEl as HTMLAudioElement).tagName.toLowerCase() === "audio";
    const bgSrc: CanvasImageSource | undefined = frameOverride
      ? frameOverride.source
      : bgEl && !bgIsAudio
        ? (bgEl as CanvasImageSource)
        : undefined;
    if (bgSrc) {
      const bgW = frameOverride
        ? frameOverride.width
        : (bgEl as HTMLVideoElement).videoWidth ||
          (bgEl as HTMLImageElement).naturalWidth ||
          W;
      const bgH = frameOverride
        ? frameOverride.height
        : (bgEl as HTMLVideoElement).videoHeight ||
          (bgEl as HTMLImageElement).naturalHeight ||
          H;
      ctx.save();
      ctx.filter = getCanvasFilterString();
      // «Escala»/«Reposición»: mismo transform con origen en el centro del
      // rectángulo que el resto de ramas (fondo a sangre en podcast).
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      applyMediaZoom(
        ctx,
        0,
        0,
        W,
        H,
        postFormat === "16:9" ? "16:9" : postFormat === "9:16" ? "9:16" : "4:5",
        mediaZoom,
        mediaOffsetX,
        mediaOffsetY,
      );
      drawCoverFrame(ctx, bgSrc, bgW, bgH, frameOverride?.rotation ?? 0, W, H);
      ctx.restore();
      // Velo: el texto manda. Con vídeo en movimiento basta con 58 % para que
      // la onda se lea sin perder el ambiente de la toma.
      ctx.fillStyle = "rgba(0,0,0,0.58)";
      ctx.fillRect(0, 0, W, H);
    }
    // Ajuste inferior a negro puro: el reloj y el pie descansan sobre negro,
    // sea cual sea el fondo (y con fondo negro ni se nota).
    const fade = ctx.createLinearGradient(0, H * 0.42, 0, H);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    // ── Cabecera: sección editorial y países (mismo formato que en los otros modos) ──
    let curY = padTop;
    const epText = podcastEpisode.trim() ? `EP. ${podcastEpisode.trim()}` : "";
    const catUpper = (category || "GEOPOLÍTICA").trim().toUpperCase();
    const maxTextWidth = contentW - 65; // Deja espacio para al menos 45px de línea

    let curHeaderSize = autoFitHeader
      ? Math.round(20 * u)
      : Math.round(headerSize * u);
    let curLetterSpacing = 2.0;

    // ── Muestreo de banderas del podcast ──
    // `podcastFlagMode` resuelve el estilo activo («auto» elige variante según
    // cuántos países haya; el resto son estilos fijos). De aquí sale todo:
    // si se pinta bandera (imagen), si se pinta texto (nombre o código ISO)
    // y cuánto ocupa cada país en la línea.
    const flagMode = podcastFlagMode;
    const wantImgs =
      flagMode === "flags-names" ||
      flagMode === "flags-codes" ||
      flagMode === "flags-only";
    const wantText =
      flagMode === "flags-names" ||
      flagMode === "flags-codes" ||
      flagMode === "names";
    const showCountries = flagMode !== "ocultar" && flagsData.length > 0;
    // Con «solo banderas» los países van sin puntos: hueco fijo en su lugar.
    const itemSep = wantText ? " · " : "   ";
    const itemTextOf = (it: { code: string; text: string }) =>
      flagMode === "flags-codes"
        ? it.code
        : (
            selectedCountries.find((c) => c.code === it.code)?.name || it.text
          ).toUpperCase();
    /** Ancho de un país con la fuente ya puesta: bandera + 6 + texto. */
    const itemWOf = (
      it: { code: string; text: string; img: HTMLImageElement | null },
      fs: number,
    ) => {
      // Con estilo de bandera, el país ocupa su bloque aunque no tenga imagen
      // (entonces se pinta el cuadrito gris, que mide lo mismo).
      let w = wantImgs ? Math.round(fs * 1.3) + 6 : 0;
      if (wantText) w += ctx.measureText(itemTextOf(it)).width;
      return w;
    };

    /**
     * Empaqueta los países en filas por ancho real (máx. 2 filas) con el estilo
     * activo. Devuelve las filas de índices, el hueco usado y cuántos quedan
     * fuera (se pintarán como +N). Compone con `drawFlagRows`.
     */
    const packFlagRows = (
      fs: number,
      maxRowW: number,
    ): { rows: number[][]; hidden: number; gap: number } => {
      ctx.font = `600 ${fs}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "1.5px";
      const gap = wantText
        ? ctx.measureText("   ·   ").width
        : Math.round(10 * u);
      const widths = flagsData.map((it) => itemWOf(it, fs));
      const rows: number[][] = [];
      let cur: number[] = [];
      let curW = 0;
      for (let i = 0; i < flagsData.length; i++) {
        const add = (cur.length ? gap : 0) + widths[i];
        if (cur.length > 0 && curW + add > maxRowW) {
          rows.push(cur);
          cur = [];
          curW = 0;
          if (rows.length >= 2) break;
        }
        cur.push(i);
        curW += (cur.length > 1 ? gap : 0) + widths[i];
      }
      if (rows.length < 2 && cur.length) rows.push(cur);
      const used = () => rows.reduce((s, r) => s + r.length, 0);
      let hidden = flagsData.length - used();
      // Si queda alguno fuera, el +N tiene que caber en la última fila.
      while (hidden > 0 && rows.length > 0) {
        const last = rows[rows.length - 1];
        const extra =
          gap + ctx.measureText(` +${hidden}`).width + Math.round(6 * u);
        const lastW = last.reduce(
          (s, idx, j) => s + (j ? gap : 0) + widths[idx],
          0,
        );
        if (lastW + extra <= maxRowW) break;
        last.pop();
        if (last.length === 0) rows.pop();
        hidden = flagsData.length - used();
      }
      return { rows, hidden, gap };
    };

    /** Altura de una fila de países (la bandera mide algo más que el texto). */
    const flagRowH = (fs: number) =>
      Math.max(fs, Math.round(fs * 1.3 * 0.68)) + Math.round(8 * u);

    /**
     * Pinta las filas empaquetadas desde `y0` y devuelve la Y final.
     * `alignRight` alinea cada fila al margen derecho (formas «Arriba dcha.»
     * y «Pie»); el resto arranca en el margen izquierdo.
     */
    const drawFlagRows = (
      rows: number[][],
      hidden: number,
      y0: number,
      fs: number,
      gap: number,
      alignRight: boolean,
    ): number => {
      if (!rows.length) return y0;
      ctx.save();
      ctx.textBaseline = "top";
      ctx.font = `600 ${fs}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "1.5px";
      const flagW = Math.round(fs * 1.3);
      const flagH = Math.round(flagW * 0.68);
      const flagOffsetY = Math.round((fs - flagH) / 2);
      const rowW = (r: number[]) =>
        r.reduce(
          (s, idx, j) => s + (j ? gap : 0) + itemWOf(flagsData[idx], fs),
          0,
        );
      let ry = y0;
      rows.forEach((rowIdxs, ri) => {
        const isLast = ri === rows.length - 1 && hidden > 0;
        const suffixW = isLast
          ? gap + ctx.measureText(` +${hidden}`).width + Math.round(6 * u)
          : 0;
        let bX = alignRight ? W - padRight - rowW(rowIdxs) - suffixW : padX;
        rowIdxs.forEach((idx, j) => {
          if (j > 0) {
            if (wantText) {
              ctx.fillStyle = "#64748B";
              ctx.fillText("   ·   ", bX, ry);
            }
            bX += gap;
          }
          const it = flagsData[idx];
          if (wantImgs) {
            if (it.img) {
              ctx.drawImage(it.img, bX, ry + flagOffsetY, flagW, flagH);
            } else {
              // Sin imagen: pequeño cuadrado gris
              ctx.fillStyle = "#475569";
              ctx.fillRect(bX, ry + flagOffsetY, flagW, flagH);
            }
            bX += flagW + 6;
          }
          if (wantText) {
            ctx.fillStyle = "#CBD5E1";
            const label = itemTextOf(it);
            ctx.fillText(label, bX, ry);
            bX += ctx.measureText(label).width;
          }
        });
        if (isLast) {
          if (wantText) {
            ctx.fillStyle = "#64748B";
            ctx.fillText("   ·   ", bX, ry);
          }
          bX += gap;
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(` +${hidden}`, bX, ry);
        }
        ry += flagRowH(fs);
      });
      ctx.restore();
      return ry;
    };

    // Medida de la línea completa: se encoge hasta que cabe en una sola línea
    const computeTotalWidth = (fSize: number, lSpacing: number) => {
      ctx.font = `600 ${fSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${lSpacing}px`;
      let totalW = ctx.measureText(catUpper).width;
      if (countryPlacement === "line" && showCountries) {
        totalW += ctx.measureText("  ·  ").width;
        for (let i = 0; i < flagsData.length; i++) {
          totalW += itemWOf(flagsData[i], fSize);
          if (i < flagsData.length - 1) {
            totalW += ctx.measureText(itemSep).width;
          }
        }
      }
      return totalW;
    };

    while (
      computeTotalWidth(curHeaderSize, curLetterSpacing) > maxTextWidth &&
      curHeaderSize > 10.5
    ) {
      curHeaderSize -= 0.5;
      curLetterSpacing = Math.max(
        0.5,
        Number((curHeaderSize * 0.1).toFixed(1)),
      );
    }

    // Si incluso al tamaño mínimo sigue desbordando (muchos países con nombres
    // largos), recortamos la lista hasta que quepa y añadimos un indicador +N.
    let podcastVisibleFlags = flagsData;
    let podcastHiddenCount = 0;
    if (
      countryPlacement === "line" &&
      showCountries &&
      computeTotalWidth(curHeaderSize, curLetterSpacing) > maxTextWidth
    ) {
      ctx.font = `600 ${curHeaderSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${curLetterSpacing}px`;
      for (let limit = flagsData.length - 1; limit >= 0; limit--) {
        const hidden = flagsData.length - limit;
        let w = ctx.measureText(catUpper).width;
        if (limit > 0) {
          w += ctx.measureText("  ·  ").width;
          for (let i = 0; i < limit; i++) {
            w += itemWOf(flagsData[i], curHeaderSize);
            if (i < limit - 1) w += ctx.measureText(itemSep).width;
          }
        }
        if (hidden > 0) w += ctx.measureText(` +${hidden}`).width;
        if (w <= maxTextWidth) {
          podcastVisibleFlags = flagsData.slice(0, limit);
          podcastHiddenCount = hidden;
          break;
        }
      }
    }

    ctx.save();
    ctx.textBaseline = "top";
    ctx.font = `600 ${curHeaderSize}px 'Lexend', sans-serif`;
    ctx.letterSpacing = `${curLetterSpacing}px`;
    ctx.fillStyle = "#FFFFFF";

    let curX = padX;
    ctx.fillText(catUpper, curX, curY);
    curX += ctx.measureText(catUpper).width;

    if (countryPlacement === "line" && showCountries && podcastVisibleFlags.length > 0) {
      ctx.fillStyle = "#64748B";
      const sepStr = "  ·  ";
      ctx.fillText(sepStr, curX, curY);
      curX += ctx.measureText(sepStr).width;

      const flagW = Math.round(curHeaderSize * 1.3);
      const flagH = Math.round(flagW * 0.68);
      const flagOffsetY = Math.round((curHeaderSize - flagH) / 2);

      for (let i = 0; i < podcastVisibleFlags.length; i++) {
        const item = podcastVisibleFlags[i];
        if (wantImgs) {
          if (item.img) {
            ctx.drawImage(item.img, curX, curY + flagOffsetY, flagW, flagH);
          } else {
            // Sin imagen (país sin código ISO): cuadrito gris, como en insignia.
            ctx.fillStyle = "#475569";
            ctx.fillRect(curX, curY + flagOffsetY, flagW, flagH);
          }
          curX += flagW + 6;
        }
        if (wantText) {
          ctx.fillStyle = "#E2E8F0";
          const label = itemTextOf(item);
          ctx.fillText(label, curX, curY);
          curX += ctx.measureText(label).width;
        }

        if (i < podcastVisibleFlags.length - 1) {
          ctx.fillStyle = "#64748B";
          ctx.fillText(itemSep, curX, curY);
          curX += ctx.measureText(itemSep).width;
        }
      }

      if (podcastHiddenCount > 0) {
        ctx.fillStyle = "#64748B";
        const moreLabel = ` +${podcastHiddenCount}`;
        ctx.fillText(moreLabel, curX, curY);
        curX += ctx.measureText(moreLabel).width;
      }
    }

    // Filete blanco horizontal: idéntico a los otros modos
    const lineStartX = curX + 18;
    const lineEndX = Math.min(lineStartX + 60, W - padRight);

    if (lineEndX > lineStartX + 8) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const lineCenterY = Math.round(curY + curHeaderSize / 2);
      ctx.moveTo(lineStartX, lineCenterY);
      ctx.lineTo(lineEndX, lineCenterY);
      ctx.stroke();
    }
    ctx.restore();

    // ── Países arriba a la derecha: misma fila que la categoría ──
    // Ocupan lo que deja libre la categoría + el filete; si no caben en una
    // fila bajan a una segunda (también a la derecha) y la cabecera crece para
    // no pisar el titular.
    let topRightEndY = curY + curHeaderSize;
    if (countryPlacement === "top-right" && showCountries) {
      ctx.font = `600 ${curHeaderSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${curLetterSpacing}px`;
      const catW = ctx.measureText(catUpper).width;
      const ruleW = lineEndX > lineStartX + 8 ? lineEndX - lineStartX : 0;
      const trMaxW = Math.max(
        Math.round(150 * u),
        contentW - catW - ruleW - Math.round(28 * u),
      );
      const trFs = Math.round(18 * u);
      const tr = packFlagRows(trFs, trMaxW);
      topRightEndY = drawFlagRows(
        tr.rows,
        tr.hidden,
        curY,
        trFs,
        tr.gap,
        true,
      );
    }

    curY =
      Math.max(topRightEndY, curY + curHeaderSize) +
      Math.round(gapCategoryToTitle * u);

    // Fila de insignias de países (si countryPlacement === "badge"): se
    // rellena midiendo el ancho real con el estilo activo, hasta 2 filas, y lo
    // que no cabe se recorta con un indicador +N en lugar de descolocar la
    // estructura de la tarjeta.
    if (countryPlacement === "badge" && showCountries) {
      const bFontSize = Math.round(18 * u);
      const pack = packFlagRows(bFontSize, contentW);
      curY =
        drawFlagRows(pack.rows, pack.hidden, curY, bFontSize, pack.gap, false) +
        Math.round(gapCategoryToTitle * u);
    }

    // ── Titular del podcast: serie y fecha en dos líneas separadas ──
    // Línea 1: Serie ("Noticias en 1 minuto" o cualquier serie introducida) en tamaño grande
    // Línea 2: Fecha en tamaño más pequeño en línea separada
    const titleFs = Math.round((isWide ? 58 : 62) * u);
    const titleLH = Math.round(titleFs * 1.16);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";

    const serieText = podcastSeries.trim() || "Noticias en 1 minuto";

    if (podcastAutoTitle) {
      ctx.font = `700 ${titleFs}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "0px";
      const serieLines = capLines(wrapText(ctx, serieText, contentW), 2);
      serieLines.forEach((line, i) => {
        ctx.fillText(line, padX, curY + i * titleLH);
      });
      curY += serieLines.length * titleLH;

      // Fecha en una línea separada, con tamaño diferenciado y menor
      const dateFs = Math.round(28 * u);
      ctx.font = `600 ${dateFs}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${Math.round(2 * u)}px`;
      ctx.fillStyle = "#94a3b8";
      curY += Math.round(14 * u);
      ctx.fillText(podcastFecha.toUpperCase(), padX, curY);
      ctx.letterSpacing = "0px";
      curY += dateFs;
    } else {
      ctx.font = `700 ${titleFs}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "0px";
      const mainTitle = title.trim() || serieText;
      const titleLines = capLines(wrapText(ctx, mainTitle, contentW), 3);
      titleLines.forEach((line, i) => {
        ctx.fillText(line, padX, curY + i * titleLH);
      });
      curY += titleLines.length * titleLH;

      if (podcastSeries.trim()) {
        const dateFs = Math.round(26 * u);
        ctx.font = `500 ${dateFs}px 'Lexend', sans-serif`;
        ctx.letterSpacing = `${Math.round(1.5 * u)}px`;
        ctx.fillStyle = "#94a3b8";
        curY += Math.round(12 * u);
        ctx.fillText(
          `${podcastSeries.trim().toUpperCase()} · ${podcastFecha.toUpperCase()}`,
          padX,
          curY,
        );
        ctx.letterSpacing = "0px";
        curY += dateFs;
      }
    }

    // ── Países bajo el titular: fila propia entre titular y bajada ──
    if (countryPlacement === "under-title" && showCountries) {
      const utFs = Math.round(20 * u);
      const ut = packFlagRows(utFs, contentW);
      curY += Math.round(18 * u);
      curY =
        drawFlagRows(ut.rows, ut.hidden, curY, utFs, ut.gap, false) +
        Math.round(12 * u);
    }

    // ── Bajada: el guion resumido, breve ──
    if (description.trim()) {
      const descFs = Math.round(24 * u);
      ctx.font = `400 ${descFs}px 'Lexend', sans-serif`;
      const descLines = capLines(
        wrapText(ctx, description.trim(), contentW),
        3,
      );
      const descLH = Math.round(descFs * 1.45);
      curY += Math.round(22 * u);
      ctx.fillStyle = "#cbd5e1";
      descLines.forEach((line, i) => {
        ctx.fillText(line, padX, curY + i * descLH);
      });
    }

    // ── Reproductor: botón, onda y reloj ──
    const footH = Math.round(30 * u);
    const footY = H - padBottom - footH;
    const clockY = footY - Math.round(62 * u);
    const waveH = Math.round((isTall ? 130 : 110) * u);
    const waveBottom = clockY - Math.round(22 * u);
    const waveTop = waveBottom - waveH;
    const badgeR = Math.round(32 * u);
    const badgeCx = padX + badgeR;
    const waveX = padX + badgeR * 2 + Math.round(28 * u);
    const waveW = W - padX - waveX;

    // Disco del botón (indica "esto suena").
    ctx.beginPath();
    ctx.arc(badgeCx, waveTop + waveH / 2, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = Math.max(1, Math.round(1.5 * u));
    ctx.stroke();
    // Glifo: barras (sonando) o triángulo (en pausa).
    ctx.fillStyle = "#ffffff";
    const gcx = badgeCx;
    const gcy = waveTop + waveH / 2;
    if (playing !== false) {
      const bw = Math.round(5.5 * u);
      const bh = Math.round(26 * u);
      const gap = Math.round(9 * u);
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(gcx - gap - bw, gcy - bh / 2, bw, bh, bw / 2);
        ctx.roundRect(gcx + gap, gcy - bh / 2, bw, bh, bw / 2);
      } else {
        ctx.rect(gcx - gap - bw, gcy - bh / 2, bw, bh);
        ctx.rect(gcx + gap, gcy - bh / 2, bw, bh);
      }
      ctx.fill();
    } else {
      const s = Math.round(13 * u);
      ctx.beginPath();
      ctx.moveTo(gcx - s * 0.6, gcy - s);
      ctx.lineTo(gcx + s, gcy);
      ctx.lineTo(gcx - s * 0.6, gcy + s);
      ctx.closePath();
      ctx.fill();
    }

    // Onda: barras fijas (picos del archivo) con las ya sonadas en blanco.
    const peaks = audioPeaks.length > 0 ? audioPeaks : null;
    const bars = peaks ? peaks.length : PODCAST_BARS;
    const slotW = waveW / bars;
    const barW = Math.max(
      2,
      Math.min(Math.round(slotW * 0.56), Math.round(9 * u)),
    );
    const playedTo = progress * bars;
    for (let i = 0; i < bars; i++) {
      const peak = peaks ? Math.max(0.06, peaks[i]) : 0.28;
      const bh = Math.max(Math.round(6 * u), Math.round(peak * waveH));
      const bx = Math.round(waveX + i * slotW + (slotW - barW) / 2);
      const by = Math.round(waveTop + (waveH - bh) / 2);
      ctx.fillStyle = i < playedTo ? "#ffffff" : "rgba(255,255,255,0.16)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bx, by, barW, bh, barW / 2);
      } else {
        ctx.rect(bx, by, barW, bh);
      }
      ctx.fill();
    }
    // Cabeza de lectura.
    const headX = Math.round(waveX + progress * waveW);
    ctx.fillStyle = "#34d399";
    ctx.fillRect(
      Math.min(headX, W - padX - Math.round(2 * u)),
      waveTop - Math.round(6 * u),
      Math.round(2 * u),
      waveH + Math.round(12 * u),
    );

    // Reloj: transcurrido a la izquierda, total a la derecha.
    ctx.font = `500 ${Math.round(21 * u)}px 'Lexend', sans-serif`;
    ctx.letterSpacing = `${Math.round(0.6 * u)}px`;
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText(fmtPodcastClock(cur), waveX, clockY);
    ctx.textAlign = "right";
    ctx.fillStyle = "#52525b";
    ctx.fillText(fmtPodcastClock(dur), W - padX, clockY);
    ctx.textAlign = "left";
    ctx.letterSpacing = "0px";

    // ── Pie: la marca como en el modo noticia (cuadro blanco + wordmark) y,
    //    pegada a ella, la línea del episodio cuando la hay ──
    const brandSize = Math.round(32 * u);
    const brandY = H - padBottom - Math.round(20 * u);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(padX, brandY, brandSize, brandSize);
    ctx.font = `700 ${Math.round(34 * u)}px 'Lexend', sans-serif`;
    ctx.letterSpacing = `${Math.round(0.4 * u)}px`;
    const bnX = padX + brandSize + Math.round(12 * u);
    const bnY = brandY - Math.round(1 * u);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("BlackNews", bnX, bnY);
    if (epText) {
      const bnW = ctx.measureText("BlackNews").width;
      ctx.font = `500 ${Math.round(19 * u)}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${Math.round(2 * u)}px`;
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(`  ·  ${epText}`, bnX + bnW, bnY + Math.round(11 * u));
    }
    ctx.letterSpacing = "0px";

    // ── Países en el pie: a la derecha, en la línea de la marca ──
    if (countryPlacement === "bottom" && showCountries) {
      const btFs = Math.round(18 * u);
      // Hueco real de la marca (cuadro + wordmark + episodio si lo hay).
      ctx.font = `700 ${Math.round(34 * u)}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${Math.round(0.4 * u)}px`;
      let brandW =
        brandSize + Math.round(12 * u) + ctx.measureText("BlackNews").width;
      if (epText) {
        ctx.font = `500 ${Math.round(19 * u)}px 'Lexend', sans-serif`;
        ctx.letterSpacing = `${Math.round(2 * u)}px`;
        brandW += ctx.measureText(`  ·  ${epText}`).width;
      }
      const bt = packFlagRows(
        btFs,
        Math.max(Math.round(150 * u), contentW - brandW - Math.round(32 * u)),
      );
      const btY =
        brandY +
        Math.round((brandSize - flagRowH(btFs) * bt.rows.length) / 2);
      drawFlagRows(bt.rows, bt.hidden, btY, btFs, bt.gap, true);
      ctx.letterSpacing = "0px";
    }

    // ── Barra de progreso a sangre ──
    const barY = H - Math.round(6 * u);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, barY, W, Math.round(6 * u));
    ctx.fillStyle = "#34d399";
    ctx.fillRect(0, barY, Math.round(W * progress), Math.round(6 * u));
  };

  const renderToCanvas = async (
    targetCanvas: HTMLCanvasElement,
    mediaElement?: HTMLImageElement | HTMLVideoElement | HTMLAudioElement,
    cachedFlags?: Array<{
      code: string;
      img: HTMLImageElement | null;
      text: string;
    }>,
    isOverlayOnly = false,
    // Fuente externa (p. ej. un VideoFrame de WebCodecs) con sus dimensiones y
    // rotación declaradas: el elemento <video> aplica la rotación solo, un
    // fotograma decodificado llega "en crudo" y hay que girarlo al dibujar.
    frameOverride?: {
      source: CanvasImageSource;
      width: number;
      height: number;
      rotation?: number;
    },
    // Segundo de la salida para la intro TV (16:9) y el marquee del ticker:
    // faltante = composición estática (marquee en su posición 0).
    outTime?: number,
    // Segundo de CONTENIDO (desde el inicio del clip, sin el desfase de la
    // pasada de intro ni el del cierre): gobierna la transición «texto →
    // vídeo» del 4:5 y el 9:16, que así se mantiene sincronizada con la
    // vista previa.
    contentTime?: number,
    // true = dibujar la tarjeta del tweet pase lo que pase (PNG y copia al
    // portapapeles: la portada siempre la muestra, aunque en el vídeo esté
    // limitada a unos segundos).
    forceTweet = false,
  ): Promise<void> => {
    const W = POST_W;
    const H = POST_H;

    // Transición «texto → vídeo» (4:5 y 9:16): pasado `textFadeOutDur` s de
    // contenido el bloque de texto se desvanece y la foto sube hasta sangrar
    // la tarjeta. El sello BlackNews de abajo a la izquierda se pinta
    // SIEMPRE, al final.
    const fadeP =
      textFadeOut &&
      (postFormat === "4:5" || postFormat === "9:16") &&
      typeof contentTime === "number"
        ? clamp01((contentTime - textFadeOutDur) / TEXT_FADE_MOVE)
        : 0;
    const textAlpha = 1 - fadeP;

    // 1) Todo el trabajo asíncrono ANTES de tocar el lienzo: si esperamos fuentes
    //    o banderas despejándolo, el capturador del grabador de video puede leer un
    //    fotograma a medio pintar (parpadeos, "rayas" y macrobloques en el archivo).
    //    Esperamos las fuentes también con banderas precargadas: si Lexend 600
    //    llegara a mitad de export, `measureText` cambiaría y la cinta saltaría.
    if (document.fonts) {
      await document.fonts.ready;
    }
    const flagsData =
      cachedFlags ||
      (await Promise.all(
        selectedCountries.map(async (c) => {
          const img =
            (countryFormat !== "names" || postDesign === "podcast")
            ? await loadFlagImage(c.code)
            : null;
          const text =
            countryFormat === "flags-codes" ? c.code : c.name.toUpperCase();
          return { code: c.code, img, text };
        }),
      ));

    // Tarjeta del tweet (sólo en la rama de noticias 4:5/9:16, que es donde
    // también se muestra la vista previa): todo lo async aquí, ANTES de tocar
    // el lienzo. El avatar se carga con CORS para no «teñir» el canvas.
    // En vídeo el corte temporal se resuelve con `contentTime` (segundos de
    // contenido ya normalizados a `videoSpeed`, igual que en la vista previa);
    // sin reloj —imagen o composición estática— se ve siempre.
    const speedTweet = videoSpeed > 0 ? videoSpeed : 1;
    const tweetClipDur =
      (trimEnd > trimStart ? trimEnd - trimStart : videoDuration) / speedTweet;
    const tweetHere =
      postDesign !== "podcast" &&
      (postFormat === "4:5" || postFormat === "9:16") &&
      !!(tweetText || tweetHtml) &&
      (forceTweet ||
        (typeof contentTime === "number"
          ? tweetShownAt(tweetShowMode, tweetShowSecs, contentTime, tweetClipDur)
          : tweetOn));
    const tweetAvatarImg = tweetHere
      ? await loadTweetAvatarImg(tweetAvatar)
      : null;

    // 2) Lienzo y estado de forma síncrona: solo redimensionar si hace falta
    //    (reasignar el tamaño reinicia el bitmap y rearmada la capa capturada)
    //    y de ahí en adelante no se vuelve a esperar nada antes de dibujar.
    if (targetCanvas.width !== W) targetCanvas.width = W;
    if (targetCanvas.height !== H) targetCanvas.height = H;
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "0px";

    // 3. Background
    if (isOverlayOnly) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, 540);
    } else {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
    }

    // Post podcast: variante AMOLED. Manda su propio diseño en los tres
    // formatos (también en 16:9, donde no hay señal de televisión).
    if (postDesign === "podcast") {
      drawPodcastFrame(ctx, {
        mediaElement,
        frameOverride,
        outTime,
        playing: true,
        flagsData,
      });
      return;
    }

    // Formato TV 16:9: composición propia de señal de televisión.
    if (postFormat === "16:9") {
      drawTvFrame(
        ctx,
        mediaElement as HTMLImageElement | HTMLVideoElement,
        frameOverride,
        isOverlayOnly,
        flagsData,
        outTime,
      );
      return;
    }

    // Padding parameters
    const padX = 84;
    // Zonas seguras de TikTok en 9:16: el texto arranca más abajo (160 px) y
    // deja 140 px libres a la derecha (raíl de acciones). En 4:5: 76/84 de
    // toda la vida. El suelo de la foto no cambia.
    const padTop = postFormat === "9:16" ? PAD_TOP_9X16 : 76;
    const padRight = postFormat === "9:16" ? PAD_RIGHT_9X16 : 84;
    const contentWidth = W - padX - padRight;
    let curY = padTop;

    // En noticias sólo hay tres formas de mostrar países: barra superior,
    // insignia y ocultar. Las formas extra (arriba dcha., bajo titular y pie)
    // son del podcast y aquí se pintan en la barra superior.
    const newsPlacement: "line" | "badge" | "none" =
      countryPlacement === "badge" || countryPlacement === "none"
        ? countryPlacement
        : "line";

    // 2. Category & Country Header Line (Guaranteed Single Line with Vector Flags)
    ctx.save();
    // Con el texto en salida la cabecera se desvanece junto al resto del bloque.
    ctx.globalAlpha = textAlpha;
    ctx.textBaseline = "top";
    const catUpper = category.trim().toUpperCase();
    const maxTextWidth = contentWidth - 65; // Leaves space for at least 45px line

    let curHeaderSize = autoFitHeader ? 20 : headerSize;
    let curLetterSpacing = 2.0;

    // Helper to calculate total width of header with flags
    const computeTotalWidth = (fSize: number, lSpacing: number) => {
      ctx.font = `600 ${fSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${lSpacing}px`;
      let totalW = ctx.measureText(catUpper).width;
      if (newsPlacement === "line" && flagsData.length > 0) {
        const flagsOnly = countryFormat === "flags-only";
        totalW += ctx.measureText("  ·  ").width;
        const flagW = Math.round(fSize * 1.3);
        for (let i = 0; i < flagsData.length; i++) {
          if (countryFormat !== "names" && flagsData[i].img) {
            totalW += flagW + 6;
          }
          if (!flagsOnly) totalW += ctx.measureText(flagsData[i].text).width;
          if (i < flagsData.length - 1) {
            totalW += ctx.measureText(flagsOnly ? "   " : " · ").width;
          }
        }
      }
      return totalW;
    };

    while (
      computeTotalWidth(curHeaderSize, curLetterSpacing) > maxTextWidth &&
      curHeaderSize > 10.5
    ) {
      curHeaderSize -= 0.5;
      curLetterSpacing = Math.max(
        0.5,
        Number((curHeaderSize * 0.1).toFixed(1)),
      );
    }

    // Si aún desborda con el mínimo (muchos países con nombres largos),
    // recortar progresivamente hasta que quepa y mostrar +N.
    let normalVisibleFlags = flagsData;
    let normalHiddenCount = 0;
    if (
      newsPlacement === "line" &&
      computeTotalWidth(curHeaderSize, curLetterSpacing) > maxTextWidth
    ) {
      ctx.font = `600 ${curHeaderSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${curLetterSpacing}px`;
      const nFlagW = Math.round(curHeaderSize * 1.3);
      const cutFlagsOnly = countryFormat === "flags-only";
      for (let limit = flagsData.length - 1; limit >= 0; limit--) {
        const hidden = flagsData.length - limit;
        let w = ctx.measureText(catUpper).width;
        if (limit > 0) {
          w += ctx.measureText("  ·  ").width;
          for (let i = 0; i < limit; i++) {
            if (countryFormat !== "names" && flagsData[i].img) w += nFlagW + 6;
            if (!cutFlagsOnly) w += ctx.measureText(flagsData[i].text).width;
            if (i < limit - 1)
              w += ctx.measureText(cutFlagsOnly ? "   " : " · ").width;
          }
        }
        if (hidden > 0) w += ctx.measureText(` +${hidden}`).width;
        if (w <= maxTextWidth) {
          normalVisibleFlags = flagsData.slice(0, limit);
          normalHiddenCount = hidden;
          break;
        }
      }
    }

    ctx.font = `600 ${curHeaderSize}px 'Lexend', sans-serif`;
    ctx.letterSpacing = `${curLetterSpacing}px`;
    ctx.fillStyle = "#FFFFFF";

    let curX = padX;
    ctx.fillText(catUpper, curX, curY);
    curX += ctx.measureText(catUpper).width;

    if (newsPlacement === "line" && normalVisibleFlags.length > 0) {
      const flagsOnly = countryFormat === "flags-only";
      ctx.fillStyle = "#64748B";
      const sepStr = "  ·  ";
      ctx.fillText(sepStr, curX, curY);
      curX += ctx.measureText(sepStr).width;

      const flagW = Math.round(curHeaderSize * 1.3);
      const flagH = Math.round(flagW * 0.68);
      const flagOffsetY = Math.round((curHeaderSize - flagH) / 2);

      for (let i = 0; i < normalVisibleFlags.length; i++) {
        const item = normalVisibleFlags[i];
        if (countryFormat !== "names" && item.img) {
          ctx.drawImage(item.img, curX, curY + flagOffsetY, flagW, flagH);
          curX += flagW + 6;
        }
        if (!flagsOnly) {
          ctx.fillStyle = "#E2E8F0";
          ctx.fillText(item.text, curX, curY);
          curX += ctx.measureText(item.text).width;
        }

        if (i < normalVisibleFlags.length - 1) {
          ctx.fillStyle = "#64748B";
          const midSep = flagsOnly ? "   " : " · ";
          ctx.fillText(midSep, curX, curY);
          curX += ctx.measureText(midSep).width;
        }
      }

      if (normalHiddenCount > 0) {
        ctx.fillStyle = "#64748B";
        const moreLabel = ` +${normalHiddenCount}`;
        ctx.fillText(moreLabel, curX, curY);
        curX += ctx.measureText(moreLabel).width;
      }
    }

    // Line divider
    const lineStartX = curX + 18;
    const lineEndX = Math.min(lineStartX + 60, W - padRight);

    if (lineEndX > lineStartX + 8) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const lineCenterY = Math.round(curY + curHeaderSize / 2);
      ctx.moveTo(lineStartX, lineCenterY);
      ctx.lineTo(lineEndX, lineCenterY);
      ctx.stroke();
    }
    ctx.restore();

    curY += curHeaderSize + gapCategoryToTitle;

    // 2.1 Country Badge (if placement is 'badge')
    // ≤4: bandera + nombre | 5-8: solo banderas en 1 fila | >8: 2 filas de banderas
    if (newsPlacement === "badge" && flagsData.length > 0) {
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.textBaseline = "top";
      const n = flagsData.length;
      // Con «solo banderas» la insignia nunca muestra nombres: pinta las
      // banderas sueltas (1 fila hasta 8, 2 filas a partir de ahí).
      const showNames = n <= 4 && countryFormat !== "flags-only";
      const twoRows = n > 8;

      const badgeFontSize = 18;
      const bFlagW = Math.round(badgeFontSize * 1.3);
      const bFlagH = Math.round(bFlagW * 0.68);
      const bFlagOffsetY = Math.round((badgeFontSize - bFlagH) / 2);

      if (showNames) {
        ctx.font = `600 ${badgeFontSize}px 'Lexend', sans-serif`;
        ctx.letterSpacing = "1.5px";
        let bX = padX;
        for (let i = 0; i < n; i++) {
          const item = flagsData[i];
          if (item.img) {
            ctx.drawImage(item.img, bX, curY + bFlagOffsetY, bFlagW, bFlagH);
            bX += bFlagW + 7;
          }
          ctx.fillStyle = "#CBD5E1";
          ctx.fillText(item.text, bX, curY);
          bX += ctx.measureText(item.text).width;
          if (i < n - 1) {
            ctx.fillStyle = "#64748B";
            const sep = "   ·   ";
            ctx.fillText(sep, bX, curY);
            bX += ctx.measureText(sep).width;
          }
        }
        curY += badgeFontSize + gapCategoryToTitle;
      } else {
        const gap = 10;
        const perRow = twoRows ? Math.min(10, Math.ceil(n / 2)) : n;
        const rows = twoRows ? 2 : 1;
        const rowH = bFlagH + 6;
        for (let row = 0; row < rows; row++) {
          const start = row * perRow;
          const end = Math.min(start + perRow, n);
          let bX = padX;
          for (let i = start; i < end; i++) {
            const item = flagsData[i];
            const rowY = curY + row * rowH;
            if (item.img) {
              ctx.drawImage(item.img, bX, rowY, bFlagW, bFlagH);
            } else {
              ctx.fillStyle = "#475569";
              ctx.fillRect(bX, rowY, bFlagW, bFlagH);
            }
            bX += bFlagW + gap;
          }
        }
        curY += rows * rowH + gapCategoryToTitle;
      }
      ctx.restore();
    }

    // 3. Title (Lexend Bold)
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.font = `700 ${fontSizeTitle}px 'Lexend', sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "top";
    const titleLineHeight = Math.round(fontSizeTitle * titleLineHeightRatio);
    const titleLines = wrapText(ctx, title, contentWidth);
    for (const line of titleLines) {
      if (line) {
        ctx.fillText(line, padX, curY);
      }
      curY += titleLineHeight;
    }
    ctx.restore();

    curY += gapTitleToDesc;

    // 4. Description (Lexend Medium/Normal)
    if (description.trim()) {
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.font = `400 ${fontSizeDesc}px 'Lexend', sans-serif`;
      ctx.fillStyle = "#E2E8F0";
      ctx.textBaseline = "top";
      const descLineHeight = Math.round(fontSizeDesc * descLineHeightRatio);
      // Mismo tope que la vista previa (5 líneas con "…" de corte): lo que no
      // cabe en pantalla tampoco se dibuja en el archivo exportado.
      const descLines = capDescLines(wrapText(ctx, description, contentWidth));
      for (const line of descLines) {
        if (line) {
          ctx.fillText(line, padX, curY);
        }
        curY += descLineHeight;
      }
      ctx.restore();
    }

    curY += 40;

    // 5. Draw Media (Image or Video Frame)
    // Entero a propósito: una y fraccional deja una costura antialias de 1 px
    // entre el fondo negro y el video (la "raya" del borde superior).
    // Suelo de zona de texto: 38,5 % del alto en 4:5 y 30 % en 9:16 —el
    // formato vertical lo mueve la foto, que así gana altura—.
    const textZoneFloor =
      postFormat === "9:16" ? H * MEDIA_FLOOR_RATIO_9X16 : (520 * H) / 1350;
    // Con el texto en salida la foto sube proporcionalmente hasta ocupar la
    // tarjeta entera: es cuando se ve el vídeo de fondo a sangre.
    const mediaTopFull = Math.round(Math.max(curY, textZoneFloor));
    const mediaTopY = Math.round(mediaTopFull * (1 - fadeP));
    const mediaHeight = H - mediaTopY;

    // Mismo trato que la vista previa para el bloque de media: la escala
    // («Escala») y la reposición se aplican con origen en el centro del
    // rectángulo —igual que el CSS `scale() translate()` del contenedor— y
    // todo queda recortado a ese rectángulo (la vista previa monta el vídeo
    // en un contenedor con overflow-hidden). Los offsets viajan en px de
    // vista previa y aquí se pasan a px de lienzo.
    const clipMediaRect = (c: CanvasRenderingContext2D) => {
      c.beginPath();
      c.rect(0, mediaTopY, W, mediaHeight);
      c.clip();
    };
    const mediaZoomed = (c: CanvasRenderingContext2D) => {
      if (mediaZoom === 1 && mediaOffsetX === 0 && mediaOffsetY === 0) return;
      const cx = W / 2;
      const cy = mediaTopY + mediaHeight / 2;
      const toCanvas = W / previewCardWidthFor(postFormat);
      c.translate(cx, cy);
      c.scale(mediaZoom, mediaZoom);
      c.translate(mediaOffsetX * toCanvas, mediaOffsetY * toCanvas);
      c.translate(-cx, -cy);
    };

    if ((mediaElement || frameOverride) && !isOverlayOnly) {
      ctx.save();
      clipMediaRect(ctx);
      mediaZoomed(ctx);
      const canvasFilter = getCanvasFilterString();
      // Identidad (brillo/contraste al 100%): saltarnos ctx.filter acelera mucho
      // el dibujo por fotograma y evita el filo que el filtro deja en los bordes.
      if (canvasFilter !== "brightness(1.00) contrast(1.00)") {
        ctx.filter = canvasFilter;
      }

      let elW: number;
      let elH: number;
      if (frameOverride) {
        elW = frameOverride.width;
        elH = frameOverride.height;
      } else {
        elW =
          (mediaElement as HTMLVideoElement).videoWidth ||
          (mediaElement as HTMLImageElement).naturalWidth ||
          1280;
        elH =
          (mediaElement as HTMLVideoElement).videoHeight ||
          (mediaElement as HTMLImageElement).naturalHeight ||
          720;
      }
      const rot = frameOverride?.rotation ?? 0;
      // Con giro, las dimensiones vistas por el usuario intercambian ancho/alto
      const dispW = rot % 180 === 90 ? elH : elW;
      const dispH = rot % 180 === 90 ? elW : elH;

      const targetRatio = W / mediaHeight;
      const sourceRatio = dispW / dispH;

      let sx = 0,
        sy = 0,
        sw = dispW,
        sh = dispH;
      if (sourceRatio > targetRatio) {
        sw = dispH * targetRatio;
        sx = (dispW - sw) / 2;
      } else {
        sh = dispW / targetRatio;
        sy = (dispH - sh) / 2;
      }

      const src = (
        frameOverride ? frameOverride.source : mediaElement!
      ) as CanvasImageSource;
      if (!rot) {
        ctx.drawImage(src, sx, sy, sw, sh, 0, mediaTopY, W, mediaHeight);
      } else {
        // El recorte se expresa en píxeles del origen sin girar y el dibujo se
        // hace girando el sistema al centro del rectángulo destino.
        let csx = sx,
          csy = sy,
          csw = sw,
          csh = sh;
        if (rot === 90) {
          csx = sy;
          csy = dispW - sx - sw;
          csw = sh;
          csh = sw;
        } else if (rot === 180) {
          csx = dispW - sx - sw;
          csy = dispH - sy - sh;
        } else if (rot === 270) {
          csx = dispH - sy - sh;
          csy = sx;
          csw = sh;
          csh = sw;
        }
        ctx.translate(W / 2, mediaTopY + mediaHeight / 2);
        ctx.rotate((rot * Math.PI) / 180);
        const dw = rot % 180 === 90 ? mediaHeight : W;
        const dh = rot % 180 === 90 ? W : mediaHeight;
        ctx.drawImage(src, csx, csy, csw, csh, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();
    }

    // Soft Top Gradient Fade to Black (seamless transition from solid black header)
    // Se apaga con la transición: a sangre completa, el velo solo oscurecería el vídeo.
    if (blendFade && fadeP < 1) {
      ctx.save();
      clipMediaRect(ctx);
      mediaZoomed(ctx);
      ctx.globalAlpha = 1 - fadeP;
      const fadeHeight = Math.min(220, mediaHeight * 0.42);
      const grad = ctx.createLinearGradient(
        0,
        mediaTopY,
        0,
        mediaTopY + fadeHeight,
      );
      grad.addColorStop(0, "#000000");
      grad.addColorStop(0.3, "rgba(0, 0, 0, 0.7)");
      grad.addColorStop(0.7, "rgba(0, 0, 0, 0.2)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad;
      ctx.fillRect(0, mediaTopY, W, fadeHeight);
      ctx.restore();
    }

    // 7. Tarjeta «tweet embebido» sobre el sello: la MISMA composición que la
    //    vista previa, con todas las medidas en px de tarjeta × `k` (ancho del
    //    lienzo / ancho nominal de la tarjeta). La base se apoya en el sello
    //    medido (`previewFooterH`) + «Altura» + el padding inferior del
    //    contenedor, igual que en pantalla. Se pinta ANTES del velo y del
    //    sello: su degradado baja hasta el borde inferior (sin costura) y el
    //    sello se dibuja después, por encima, siempre nítido. El save/restore
    //    aísla el estado de texto que deja la tarjeta.
    if (tweetHere) {
      const k = W / previewCardWidthFor(postFormat);
      const footerPx = previewFooterH > 0 ? previewFooterH : 95 / k;
      ctx.save();
      drawTweetCard(ctx, {
        W,
        H,
        k,
        bottom: H - (footerPx + tweetLift + 12) * k,
        name: tweetName,
        handle: tweetHandle,
        body: tweetBodyEs || tweetBody || tweetText,
        date: tweetDate,
        showEs: !!tweetBodyEs,
        avatar: tweetAvatarImg,
        letter:
          (tweetName || tweetHandle || "B").replace(/^@/, "").charAt(0).toUpperCase() ||
          "B",
      });
      ctx.restore();
    }

    // Subtle bottom shadow vignette behind logo and caption
    ctx.save();
    clipMediaRect(ctx);
    mediaZoomed(ctx);
    const bottomGrad = ctx.createLinearGradient(0, H - 160, 0, H);
    bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
    bottomGrad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, H - 160, W, 160);
    ctx.restore();

    // 6. Watermark Logo at Bottom-Left: "■ BlackNews"
    ctx.save();
    const logoY = H - 65;
    const logoBoxSize = 34;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(padX, logoY - logoBoxSize + 4, logoBoxSize, logoBoxSize);

    ctx.font = `700 36px 'Lexend', sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 6;
    ctx.fillText("BlackNews", padX + logoBoxSize + 16, logoY);

    // 6.1 Compact Photo Caption / Personaje at Bottom-Right (same height as logo, only if present)
    if (photoCaption && photoCaption.trim()) {
      ctx.font = `500 24px 'Lexend', sans-serif`;
      ctx.fillStyle = "#E2E8F0";
      ctx.textAlign = "right";
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 6;

      const maxCapWidth = contentWidth - (logoBoxSize + 16 + 260);
      let capText = photoCaption.trim();
      if (ctx.measureText(capText).width > maxCapWidth) {
        while (
          ctx.measureText(capText + "...").width > maxCapWidth &&
          capText.length > 3
        ) {
          capText = capText.slice(0, -1);
        }
        capText += "...";
      }
      ctx.fillText(capText, W - padX, logoY);
    }
    ctx.restore();
  };

  // Helper to safely trigger browser download
  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1200);
  };

  // Helper to load image safely without crossOrigin tainting
  const loadImageSafely = async (
    src: string,
  ): Promise<HTMLImageElement | null> => {
    if (!src) return null;
    return new Promise((resolve) => {
      const img = new Image();
      if (!src.startsWith("data:") && !src.startsWith("blob:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback without crossOrigin
        if (img.crossOrigin) {
          const fallback = new Image();
          fallback.onload = () => resolve(fallback);
          fallback.onerror = () => resolve(null);
          fallback.src = src;
        } else {
          resolve(null);
        }
      };
      img.src = src;
    });
  };

  // Avatar del tweet para el lienzo exportado: SÓLO con crossOrigin
  // «anonymous» — sin él, el canvas queda tainted y se rompen PNG y
  // captureStream. Si el servidor no envía CORS, se resuelve null y la
  // tarjeta pinta la letra inicial. Cacheado por URL.
  const tweetAvatarImgCache = useRef<Map<string, HTMLImageElement | null>>(
    new Map(),
  );
  const loadTweetAvatarImg = async (
    src: string,
  ): Promise<HTMLImageElement | null> => {
    if (!src) return null;
    const hit = tweetAvatarImgCache.current.get(src);
    if (hit !== undefined) return hit;
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      if (!src.startsWith("data:") && !src.startsWith("blob:")) {
        el.crossOrigin = "anonymous";
      }
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = src;
    });
    tweetAvatarImgCache.current.set(src, img);
    return img;
  };

  // Export High-Res PNG
  const handleExportPng = async () => {
    try {
      setIsExporting(true);
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      if (postDesign === "podcast") {
        // Post podcast: el PNG es el frame que se ve en la vista previa, con
        // el reloj de la onda en su sitio actual.
        const el = activeMediaEl();
        const cur = el ? Math.max(0, el.currentTime - trimStart) : 0;
        let bg: HTMLImageElement | HTMLVideoElement | null = null;
        if (mediaType === "video") bg = videoRef.current;
        else if (mediaType === "audio") bg = podcastBgRef.current;
        else bg = await loadImageSafely(mediaSrc);
        await renderToCanvas(
          canvas,
          bg ?? undefined,
          podcastFlags,
          false,
          undefined,
          cur,
        );
      } else if (mediaType === "video" && videoRef.current) {
        // Con la intro activa el PNG sale en el estado "HOLD" de la intro
        // (titular visible sobre la imagen en B&N): es la cara del clip. El
        // póster siempre lleva texto (contentTime 0), nunca el estado de salida.
        await renderToCanvas(
          canvas,
          videoRef.current,
          undefined,
          false,
          undefined,
          tvIntro ? tvIntroDur * 0.5 : 0,
          0,
          true,
        );
      } else {
        const img = await loadImageSafely(mediaSrc);
        await renderToCanvas(
          canvas,
          img && img.complete && img.naturalWidth > 0 ? img : undefined,
          undefined,
          false,
          undefined,
          tvIntro ? tvIntroDur * 0.5 : 0,
          0,
          true,
        );
      }

      const slug = title
        .slice(0, 20)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const filename = `blacknews-post-${slug || "post"}-${formatSlug}-${Date.now()}.png`;
      setExportFileName(filename);
      setExportedPortada(false);

      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            // Fallback to toDataURL
            try {
              const dataUrl = canvas.toDataURL("image/png");
              triggerDownload(dataUrl, filename);
              setExportedImageUrl(dataUrl);
              showToast(
                `¡Post ${postFormat} exportado en PNG con éxito (${POST_W}×${POST_H})!`,
              );
            } catch (canvasErr) {
              console.error(canvasErr);
              showToast(
                "La imagen tiene restricciones de origen. Te mostramos la vista previa para guardar.",
              );
            }
            setIsExporting(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          triggerDownload(url, filename);
          setExportedImageUrl(url);
          showToast(
            `¡Post ${postFormat} exportado en PNG con éxito (${POST_W}×${POST_H})!`,
          );
          setIsExporting(false);
        }, "image/png");
      } catch (toBlobErr) {
        console.error(toBlobErr);
        try {
          const dataUrl = canvas.toDataURL("image/png");
          triggerDownload(dataUrl, filename);
          setExportedImageUrl(dataUrl);
          showToast(
            `¡Post ${postFormat} exportado en PNG con éxito (${POST_W}×${POST_H})!`,
          );
        } catch {
          showToast(
            "Error de exportación por origen de imagen. Prueba subiendo la foto directamente.",
          );
        }
        setIsExporting(false);
      }
    } catch (err) {
      console.error(err);
      showToast("Ocurrió un error al exportar la imagen.");
      setIsExporting(false);
    }
  };

  // ── Portada ────────────────────────────────────────────────────────────────
  // Composición aparte del post: el fotograma actual a sangre, un velo para que
  // el texto respire y, encima, la sección con banderas y el titular con el
  // logo. No pasa por renderToCanvas porque la portada no lleva las bandas de
  // texto sobre fondo negro: la imagen ocupa todo el lienzo.
  const PORTADA_W = 1920;
  const PORTADA_H = 1080;
  const PORTADA_PAD_X = 104;
  const PORTADA_MESES = [
    "ENE",
    "FEB",
    "MAR",
    "ABR",
    "MAY",
    "JUN",
    "JUL",
    "AGO",
    "SEP",
    "OCT",
    "NOV",
    "DIC",
  ];

  // Encaja el titular en varias líneas sin desbordar el bloque: baja de 112 px
  // hasta 52 px y, si ni así cabe, se queda con las líneas que entren.
  const fitPortadaHeadline = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number,
  ) => {
    const sourceLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    let last: { lines: string[]; size: number; lineH: number } | null = null;

    for (let size = 112; size >= 52; size -= 4) {
      const lineH = Math.round(size * 1.06);
      ctx.font = `800 ${size}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "-0.5px";
      const lines: string[] = [];
      for (const src of sourceLines) {
        let current = "";
        for (const word of src.split(/\s+/)) {
          const candidate = current ? `${current} ${word}` : word;
          if (!current || ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
          } else {
            lines.push(current);
            current = word;
          }
        }
        if (current) lines.push(current);
      }
      last = { lines, size, lineH };
      if (lines.length * lineH <= maxHeight) return last;
    }

    const fit = last as { lines: string[]; size: number; lineH: number };
    return {
      ...fit,
      lines: fit.lines.slice(0, Math.max(1, Math.floor(maxHeight / fit.lineH))),
    };
  };

  const renderPortadaToCanvas = async (
    targetCanvas: HTMLCanvasElement,
    mediaElement?: HTMLImageElement | HTMLVideoElement,
    flagsData?: Array<{
      code: string;
      img: HTMLImageElement | null;
      text: string;
    }>,
  ): Promise<void> => {
    // Las fuentes antes de tocar el lienzo: si Lexend llegara a mitad de dibujo,
    // measureText cambiaría y el titular saldría cortado.
    if (document.fonts) await document.fonts.ready;

    const W = PORTADA_W;
    const H = PORTADA_H;
    if (targetCanvas.width !== W) targetCanvas.width = W;
    if (targetCanvas.height !== H) targetCanvas.height = H;
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.letterSpacing = "0px";
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    // Base AMOLED: si no hay medio cargado la portada sigue siendo válida.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);

    // 1) Fotograma a sangre (cover) con el mismo tratamiento que el post
    if (mediaElement) {
      const sw =
        mediaElement instanceof HTMLVideoElement
          ? mediaElement.videoWidth
          : mediaElement.naturalWidth;
      const sh =
        mediaElement instanceof HTMLVideoElement
          ? mediaElement.videoHeight
          : mediaElement.naturalHeight;
      if (sw > 0 && sh > 0) {
        const scale = Math.max(W / sw, H / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const canvasFilter = getCanvasFilterString();
        ctx.save();
        if (canvasFilter !== "brightness(1.00) contrast(1.00)") {
          ctx.filter = canvasFilter;
        }
        ctx.drawImage(mediaElement, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.restore();
      }
    }

    // 2) Velo en tres franjas: inferior (titular), izquierda (logo) y superior
    ctx.save();
    const bottomVeil = ctx.createLinearGradient(0, H * 0.26, 0, H);
    bottomVeil.addColorStop(0, "rgba(0,0,0,0)");
    bottomVeil.addColorStop(0.5, "rgba(0,0,0,0.55)");
    bottomVeil.addColorStop(1, "rgba(0,0,0,0.97)");
    ctx.fillStyle = bottomVeil;
    ctx.fillRect(0, 0, W, H);

    const leftVeil = ctx.createLinearGradient(0, 0, W * 0.62, 0);
    leftVeil.addColorStop(0, "rgba(0,0,0,0.70)");
    leftVeil.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = leftVeil;
    ctx.fillRect(0, 0, W * 0.62, H);

    const topVeil = ctx.createLinearGradient(0, 0, 0, 240);
    topVeil.addColorStop(0, "rgba(0,0,0,0.72)");
    topVeil.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topVeil;
    ctx.fillRect(0, 0, W, 240);
    ctx.restore();

    // 3) Logo superior izquierdo: ■ BlackNews (mismo dibujo que la marca de agua)
    const logoBox = 42;
    const logoBaseline = 132;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(PORTADA_PAD_X, logoBaseline - logoBox + 4, logoBox, logoBox);
    ctx.font = "700 46px 'Lexend', sans-serif";
    ctx.letterSpacing = "0.5px";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("BlackNews", PORTADA_PAD_X + logoBox + 18, logoBaseline);
    ctx.restore();

    // 4) Fecha superior derecha
    const now = new Date();
    const fecha = `${String(now.getDate()).padStart(2, "0")} ${
      PORTADA_MESES[now.getMonth()]
    } ${now.getFullYear()}`;
    ctx.save();
    ctx.textAlign = "right";
    ctx.font = "500 26px 'JetBrains Mono', monospace";
    ctx.letterSpacing = "3px";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(fecha, W - PORTADA_PAD_X, logoBaseline - 6);
    ctx.restore();

    // 5) Titular anclado abajo, con sombra suave sobre la foto
    const headlineText =
      title.trim() || description.trim() || category.trim() || "BlackNews";
    const contentWidth = W - PORTADA_PAD_X - 180;
    const headlineMaxH = 360;
    const headlineBottom = H - 160;
    const ruleY = H - 124;
    const fit = fitPortadaHeadline(
      ctx,
      headlineText,
      contentWidth,
      headlineMaxH,
    );
    const headlineTop = headlineBottom - fit.lines.length * fit.lineH;

    ctx.save();
    ctx.textBaseline = "top";
    ctx.font = `800 ${fit.size}px 'Lexend', sans-serif`;
    ctx.letterSpacing = "-0.5px";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 26;
    fit.lines.forEach((line, i) => {
      ctx.fillText(line, PORTADA_PAD_X, headlineTop + i * fit.lineH);
    });
    ctx.restore();

    // 6) Sección + países, justo encima del titular, con filete esmeralda
    const badgeParts = [
      category.trim().toUpperCase(),
      ...(flagsData || []).map((f) => f.text),
    ].filter(Boolean);
    if (badgeParts.length > 0) {
      const badgeY = Math.max(180, headlineTop - 56);
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#10b981";
      ctx.fillRect(PORTADA_PAD_X, badgeY - 17, 6, 34);

      let x = PORTADA_PAD_X + 26;
      const cat = category.trim().toUpperCase();
      let drawnSomething = false;
      if (cat) {
        ctx.font = "700 27px 'Lexend', sans-serif";
        ctx.letterSpacing = "3.5px";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(cat, x, badgeY);
        x += ctx.measureText(cat).width + 24;
        drawnSomething = true;
      }

      // Con «solo banderas» sólo viajan los PNG: el hueco entre banderas es
      // aire, no punto (el «·» sólo separa la categoría de la primera).
      const badgeFlagsOnly = countryFormat === "flags-only";
      (flagsData || []).forEach((f, i) => {
        // Corta antes del margen derecho: con muchos países el badge no
        // puede pasar del ancho de contenido.
        if (x > W - PORTADA_PAD_X) return;
        // Separador «·» entre bloques, con el mismo tracking del resto.
        if (drawnSomething) {
          if (badgeFlagsOnly && i > 0) {
            x += 22;
          } else {
            ctx.font = "700 27px 'Lexend', sans-serif";
            ctx.letterSpacing = "3.5px";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText("·", x, badgeY);
            x += ctx.measureText("·").width + 22;
          }
        }
        const hasFlagImg = Boolean(f.img && f.img.naturalWidth > 0);
        if (hasFlagImg && f.img) {
          ctx.drawImage(f.img, x, badgeY - 14, 40, 28);
          x += 40 + 12;
        }
        if (!badgeFlagsOnly) {
          ctx.font = "600 27px 'Lexend', sans-serif";
          ctx.letterSpacing = "3px";
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.fillText(f.text, x, badgeY);
          x += ctx.measureText(f.text).width + 24;
        } else if (!hasFlagImg) {
          x += 24;
        }
        drawnSomething = true;
      });
      ctx.restore();
    }

    // 7) Filete esmeralda bajo el titular (acento de marca)
    ctx.save();
    ctx.fillStyle = "#10b981";
    ctx.fillRect(PORTADA_PAD_X, ruleY, 168, 5);
    ctx.restore();
  };

  const handleExportPortada = async () => {
    try {
      setIsExporting(true);
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      // El fotograma actual del vídeo (pausado donde esté) o la imagen cargada.
      let mediaEl: HTMLImageElement | HTMLVideoElement | undefined;
      if (mediaType === "video" && videoRef.current) {
        mediaEl = videoRef.current;
      } else {
        const img = await loadImageSafely(mediaSrc);
        if (img && img.complete && img.naturalWidth > 0) mediaEl = img;
      }

      // En «names» solo viaja el texto; con banderas se cargan además los PNG.
      const flagsData = await Promise.all(
        selectedCountries.map(async (c) => ({
          code: c.code,
          img: (countryFormat !== "names" || postDesign === "podcast")
            ? await loadFlagImage(c.code)
            : null,
          text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
        })),
      );

      await renderPortadaToCanvas(canvas, mediaEl, flagsData);

      const slug = title
        .slice(0, 20)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const filename = `blacknews-portada-${slug || "portada"}-${Date.now()}.png`;
      setExportFileName(filename);
      setExportedPortada(true);

      canvas.toBlob((blob) => {
        if (!blob) {
          try {
            const dataUrl = canvas.toDataURL("image/png");
            triggerDownload(dataUrl, filename);
            setExportedImageUrl(dataUrl);
            showToast(`¡Portada descargada! (1920×1080)`);
          } catch {
            showToast(
              "La imagen tiene restricciones de origen. Prueba subiendo la foto directamente.",
            );
          }
          setIsExporting(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, filename);
        setExportedImageUrl(url);
        showToast(`¡Portada descargada! (1920×1080)`);
        setIsExporting(false);
      }, "image/png");
    } catch (err) {
      console.error(err);
      showToast("No se pudo generar la portada.");
      setIsExporting(false);
    }
  };

  // Copy PNG image to clipboard
  const handleCopyToClipboard = async () => {
    try {
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      let mediaEl:
        | HTMLImageElement
        | HTMLVideoElement
        | HTMLAudioElement
        | undefined = undefined;
      if (mediaType === "video" && videoRef.current) {
        mediaEl = videoRef.current;
      } else if (mediaType === "audio") {
        // Post podcast: el fondo (si lo hay) es la imagen plana; la <audio>
        // no aporta píxeles y el pintor se queda en negro absoluto.
        mediaEl = podcastBgRef.current ?? undefined;
      } else {
        const img = await loadImageSafely(mediaSrc);
        if (img && img.complete && img.naturalWidth > 0) mediaEl = img;
      }

      await renderToCanvas(
        canvas,
        mediaEl,
        postDesign === "podcast" ? podcastFlags : undefined,
        false,
        undefined,
        postDesign === "podcast"
          ? Math.max(0, (activeMediaEl()?.currentTime ?? 0) - trimStart)
          : tvIntro
            ? tvIntroDur * 0.5
            : 0,
        // Copia = póster: el bloque de texto siempre visible.
        0,
        true,
      );

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopySuccess(true);
          showToast("¡Imagen copiada al portapapeles!");
          setTimeout(() => setCopySuccess(false), 3000);
        } catch {
          showToast("Usa el botón de descargar PNG.");
        }
      }, "image/png");
    } catch {
      showToast("No se pudo copiar directamente al portapapeles.");
    }
  };

  // Copia la portada (16:9) al portapapeles: vuelve a componerla por si el
  // canvas se ha reescrito con el post entre la descarga y este clic.
  const handleCopyPortada = async () => {
    try {
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      let mediaEl: HTMLImageElement | HTMLVideoElement | undefined = undefined;
      if (mediaType === "video" && videoRef.current) {
        mediaEl = videoRef.current;
      } else {
        const img = await loadImageSafely(mediaSrc);
        if (img && img.complete && img.naturalWidth > 0) mediaEl = img;
      }

      // En «names» solo viaja el texto; con banderas se cargan además los PNG.
      const flagsData = await Promise.all(
        selectedCountries.map(async (c) => ({
          code: c.code,
          img: (countryFormat !== "names" || postDesign === "podcast")
            ? await loadFlagImage(c.code)
            : null,
          text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
        })),
      );

      await renderPortadaToCanvas(canvas, mediaEl, flagsData);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopySuccess(true);
          showToast("¡Portada copiada al portapapeles!");
          setTimeout(() => setCopySuccess(false), 3000);
        } catch {
          showToast("Usa el botón de descargar portada.");
        }
      }, "image/png");
    } catch {
      showToast("No se pudo copiar la portada al portapapeles.");
    }
  };

  // ─── Miniatura de portada (vista previa en vivo) ────────────────────────
  // La miniatura se pinta con el MISMO renderPortadaToCanvas de la descarga,
  // así que lo que se ve es exactamente lo que se baja (1920×1080, a esa
  // resolución y no en un lienzo de mentira). Como medir y rellenar el titular
  // en 1920×1080 no es gratis, el repintado va con retardo de 400 ms: nunca se
  // redibuja por cada tecla mientras se escribe.
  const portadaCanvasRef = useRef<HTMLCanvasElement>(null);
  const portadaImgCacheRef = useRef<{
    src: string;
    img: HTMLImageElement | null;
  }>({ src: "", img: null });
  const portadaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portadaRenderRef = useRef<() => Promise<void>>(async () => {});

  const renderPortadaPreview = async () => {
    const canvas = portadaCanvasRef.current;
    if (!canvas) return;

    let mediaEl: HTMLImageElement | HTMLVideoElement | undefined;
    if (mediaType === "video") {
      const v = videoRef.current;
      if (v && v.readyState >= 2) mediaEl = v;
    } else {
      // La foto se cachea por URL: sin ella se crearía un <img> nuevo (y una
      // decodificación) en cada repintado, que va a ritmo de un segundo.
      if (portadaImgCacheRef.current.src !== mediaSrc) {
        const img = await loadImageSafely(mediaSrc);
        portadaImgCacheRef.current = { src: mediaSrc, img };
      }
      const img = portadaImgCacheRef.current.img;
      if (img && img.complete && img.naturalWidth > 0) mediaEl = img;
    }

    const flagsData = await Promise.all(
      selectedCountries.map(async (c) => ({
        code: c.code,
        img: (countryFormat !== "names" || postDesign === "podcast")
            ? await loadFlagImage(c.code)
            : null,
        text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
      })),
    );

    await renderPortadaToCanvas(canvas, mediaEl, flagsData);
  };

  // Los bucles de más abajo (intervalo del vídeo y «seeked») viven mucho
  // tiempo: apuntan a esta referencia para que siempre repinten con el titular
  // y los países de ahora, no con los del render en que se montaron.
  useEffect(() => {
    portadaRenderRef.current = renderPortadaPreview;
  });

  // Primer pintado sin esperar al retardo, para que el hueco no salga negro.
  useEffect(() => {
    void portadaRenderRef.current();
  }, []);

  useEffect(() => {
    if (portadaTimerRef.current) clearTimeout(portadaTimerRef.current);
    portadaTimerRef.current = setTimeout(() => {
      void portadaRenderRef.current();
    }, 400);
    return () => {
      if (portadaTimerRef.current) clearTimeout(portadaTimerRef.current);
    };
  }, [
    title,
    description,
    category,
    selectedCountries,
    countryFormat,
    filter,
    brightness,
    contrast,
    mediaSrc,
    mediaType,
    isVideoPlaying,
    videoDuration,
  ]);

  // Con el vídeo en marcha la miniatura sigue el fotograma (uno por segundo):
  // el fotograma de la portada se elige pausando, y al pausar el cambio de
  // isVideoPlaying ya dispara el repintado con retardo.
  useEffect(() => {
    if (mediaType !== "video") return;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.ended || v.readyState < 2) return;
      void portadaRenderRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [mediaType]);

  // Al arrastrar el recorte (seek) no cambia ningún estado: sin este listener
  // la miniatura se quedaría en el fotograma anterior hasta el siguiente
  // segundo en marcha.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onSeek = () => {
      void portadaRenderRef.current();
    };
    v.addEventListener("seeked", onSeek);
    return () => v.removeEventListener("seeked", onSeek);
  }, [mediaType, mediaSrc]);

  // ─── Exportación de video 100% en el navegador ─────────────────────────
  // El post (frame del video + overlay tipográfico) se compone en un canvas y se
  // exporta en el equipo del usuario: nada se sube a un servidor (el antiguo
  // endpoint FFmpeg /api/video/* sigue retirado → 410). Hay dos rutas:
  //   1) RUTA RÁPIDA (WebCodecs): mp4box demuxea el MP4, se decodifica y compone
  //      cada fotograma en un canvas dedicado y se re-codifica H.264+AAC con el
  //      acelerador de hardware. No usa requestAnimationFrame ni MediaRecorder,
  //      así que CONTINÚA aunque la pestaña pase a segundo plano o la ventana
  //      esté tapada, y va más rápido que el tiempo real.
  //   2) RUTA CLÁSICA (MediaRecorder): grabación en tiempo real con sus
  //      protecciones de segundo plano. Es el respaldo para WebM, archivos no
  //      MP4 y navegadores sin WebCodecs.
  const exportVideoFast = async (): Promise<
    "done" | "unsupported" | "cancelled"
  > => {
    if (
      typeof VideoDecoder === "undefined" ||
      typeof VideoEncoder === "undefined" ||
      typeof AudioEncoder === "undefined"
    ) {
      return "unsupported";
    }

    if (isCancelledRef.current) return "cancelled";
    let raw: ArrayBuffer | null = null;
    try {
      const uploaded = uploadedVideoFileRef.current;
      if (uploaded) {
        raw = await uploaded.arrayBuffer();
      } else if (mediaSrc) {
        raw = await (await fetch(mediaSrc)).arrayBuffer();
      }
    } catch {
      raw = null;
    }
    if (isCancelledRef.current) return "cancelled";
    if (!raw || raw.byteLength < 256) return "unsupported";
    // Modo podcast: el medio es un audio puro, no hay pista de vídeo que
    // demuxear. Los frames salen pintados ranura a ranura (ver feed) y la
    // pista de sonido viene directamente del archivo.
    const audioOnly = mediaType === "audio";
    // En modo podcast la exportación nunca sale muda: el sonido ES el
    // contenido. `isMuted` sólo goberna la vista previa.
    const mutedForExport = audioOnly ? false : isMuted;
    // Solo MP4/MOV (primer átomo "ftyp"). WebM y demás → ruta clásica.
    try {
      if (
        !audioOnly &&
        new TextDecoder().decode(new Uint8Array(raw, 4, 4)) !== "ftyp"
      )
        return "unsupported";
    } catch {
      return "unsupported";
    }

    setIsRecordingVideo(true);
    setFastExport(true);
    setRecordingPaused(false);
    setRecordingProgress(4);
    isRecordingRef.current = true;
    isCancelledRef.current = false;
    try {
      videoRef.current?.pause();
    } catch {}
    setIsVideoPlaying(false);

    let decoder: VideoDecoder | null = null;
    let outroDecoder: VideoDecoder | null = null;
    let warningDecoder: VideoDecoder | null = null;
    let encoder: VideoEncoder | null = null;
    let audioEncoder: AudioEncoder | null = null;
    // Tiempos por fase: visibles en DevTools con nivel "Verbose" ([export-rapida])
    const tStart = performance.now();
    const snap = (label: string) =>
      console.debug(
        `[export-rapida] ${label}: ${Math.round(performance.now() - tStart)}ms`,
      );

    try {
      const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

      // ── 1. Demux: muestras de vídeo en orden de decodificación ──
      // En modo podcast no hay pista de vídeo: no se demuxea nada y la rejilla
      // de frames se pinta a mano (bloque «ranura» más abajo).
      const clip = audioOnly ? null : await demuxAvcClip(raw);
      snap("demux");
      if (!clip && !audioOnly) return "unsupported";
      const { samples, description, rot, codec } = clip ?? {
        samples: [] as DemuxedAvcClip["samples"],
        ts: 1,
        srcDur: 0,
        description: new Uint8Array(0),
        rot: 0,
        codec: "avc1.640028",
      };

      // ── 1b. Aviso de contenido sensible (Blacknews-Advertencia.mp4) ──
      // Fase previa [portada de 3 s + cartel] ANTES de todo lo demás. Como el
      // cierre, es un extra: si algo falla aquí se omite y el vídeo sale sin
      // aviso, nunca aborta la exportación (`warnPad` queda en 0 y no se
      // desplaza ni el reloj ni el audio).
      let warningClip: DemuxedAvcClip | null = null;
      let warningAudio: AudioBuffer | null = null;
      let warnPad = 0;
      let warnCoverDur = 0;
      if (contentWarning) {
        try {
          const wRaw = await (await fetch(warningVideoSrc)).arrayBuffer();
          if (wRaw.byteLength > 256) {
            warningClip = await demuxAvcClip(wRaw);
            if (warningClip && warningClip.samples.length < 2)
              warningClip = null;
            if (warningClip && !mutedForExport) {
              try {
                const probe = new OfflineAudioContext(1, 1, 44100);
                const full = await probe.decodeAudioData(wRaw.slice(0));
                const oac = new OfflineAudioContext(
                  2,
                  Math.max(1, Math.ceil(full.duration * 48000)),
                  48000,
                );
                const node = oac.createBufferSource();
                node.buffer = full;
                node.connect(oac.destination);
                node.start(0);
                warningAudio = await oac.startRendering();
              } catch {
                warningAudio = null; // el cartel sale mudo
              }
            }
          }
        } catch {
          warningClip = null;
          warningAudio = null;
        }
        if (warningClip) {
          warnCoverDur = warningFrameDur;
          warnPad =
            warnCoverDur +
            (warningClip.srcDur > 0
              ? warningClip.srcDur
              : warningClip.samples.length / 30);
        } else {
          console.warn("[export-rapida] aviso omitido: sin muestras AVC");
        }
        snap("warning-prep");
      }

      // ── 2. Ventana de exportación (mismo criterio que la ruta clásica) ──
      const ts = clip?.ts ?? 1;
      const srcDur = clip?.srcDur ?? 0;
      // En MP4 fragmentados (p. ej. los que graba MediaRecorder) el moov
      // inicial sólo declara el primer segmento y la pista "dura" 0,2 s
      // aunque el archivo tenga el clip entero: el <video> sí ve la duración
      // real, así que nos quedamos con el mayor de los dos. En modo podcast
      // la duración la declara el <audio>.
      const elemDur = Number(
        (audioOnly ? audioRef.current?.duration : videoRef.current?.duration) ??
          videoDuration,
      );
      const duration =
        Number.isFinite(elemDur) && elemDur > srcDur
          ? elemDur
          : Number.isFinite(srcDur) && srcDur > 0
            ? srcDur
            : videoDuration;
      const start = Math.max(
        0,
        Math.min(trimStart, Math.max(duration - 0.1, 0)),
      );
      let end =
        trimEnd > start && duration > 0
          ? Math.min(trimEnd, duration)
          : duration;
      if (maxVideoDuration > 0)
        end = Math.min(end, start + maxVideoDuration * videoSpeed);
      if (!(end > start)) {
        throw new Error(
          "El recorte de video no es válido: revisa inicio y fin.",
        );
      }
      const speed = videoSpeed > 0 ? videoSpeed : 1;
      const outDur = (end - start) / speed;
      // Con intro TV la salida suma una pasada previa: el clip se muestra en
      // B/N y sin sonido durante tvIntroDur s (dando vueltas si es más corto)
      // y, al terminar, vuelve a empezar en color con sonido — la misma
      // estructura que la ruta clásica. La salida total es introPad + outDur.
      // El post-podcast no es una señal de televisión: nunca suma esa pasada.
      const introPad =
        tvIntro && !audioOnly && postDesign !== "podcast" ? tvIntroDur : 0;

      const inRange = samples.filter((s) => {
        const t = s.cts / ts;
        return t >= start - 0.05 && t <= end + 0.05;
      });
      // En modo podcast `inRange` queda vacío (no hay pista de vídeo): los
      // frames se pintan en el bloque «ranura».
      if (!audioOnly && inRange.length < 2)
        throw new Error("No hay fotogramas en el rango seleccionado.");
      const outUs = (s: (typeof inRange)[number]) =>
        Math.max(0, Math.round((s.cts / ts - start) * (1 / speed) * 1e6));
      // Con B-frames el orden de llegada no es el de presentación: se reordena
      // por timestamp para que el archivo final no salga con fotogramas trocados.
      const sortedPts = inRange.map(outUs).sort((a, b) => a - b);
      const syncPts = new Set<number>();
      for (const s of inRange) if (s.is_sync) syncPts.add(outUs(s));
      if (sortedPts.length > 0) syncPts.add(sortedPts[0]);
      // Orden de la salida: pasada de intro (vueltas al clip hasta introPad)
      // y después la pasada completa. Cada chunk se sella con su tiempo de
      // SALIDA (µs): el decodificador lo entrega en ese orden y, como sólo se
      // alimenta lo que va a la pantalla, no hace falta filtrar por rango.
      const feed: Array<{ s: (typeof inRange)[number]; outUs: number }> = [];
      if (introPad > 0) {
        for (let lap = 0; lap * outDur < introPad; lap++) {
          for (const s of inRange) {
            const disp = lap * outDur + outUs(s) / 1e6;
            if (disp >= introPad) break;
            feed.push({ s, outUs: Math.round(disp * 1e6) });
          }
        }
      }
      for (const s of inRange) {
        feed.push({ s, outUs: Math.round(introPad * 1e6 + outUs(s)) });
      }

      // ── 3. Audio: decodificación completa + corte/velocidad en modo offline ──
      // La cama musical se mezcla aquí mismo, por debajo de la voz: arranca en
      // el segundo 0 de la salida y buclea sola, así que tapa los silencios sin
      // descolocar el reloj ni depender de la duración de la pista.
      // El tema de fondo entra aquí igual, pero NO le gobierna `mutedForExport`
      // (que sólo apaga la voz del clip): en la vista previa es un <audio>
      // aparte que el botón de silencio no toca. La mezcla cubre la pasada de
      // intro + el clip, para que el tema respete el mismo desfase que en
      // pantalla (silencio durante la intro si el fundido texto→vídeo está
      // armado; desde el primer fotograma si no).
      const themeFadeArmed =
        textFadeOut &&
        postDesign !== "podcast" &&
        (postFormat === "4:5" || postFormat === "9:16");
      const themeInAt =
        warnPad + (themeFadeArmed ? introPad + textFadeOutDur : 0);
      const themeOutAt = warnPad + introPad + outDur;
      const themeWanted = bgAudio && !audioOnly && bgVolume > 0;
      let renderedAudio: AudioBuffer | null = null;
      let hasTheme = false;
      if (!mutedForExport || themeWanted) {
        try {
          const decoderCtx = new OfflineAudioContext(1, 1, 44100);
          const outRate = 48000;
          // Fase de aviso + pasada de intro + clip: la voz entra al terminar
          // la intro y el cartel del aviso suena donde le toca, por delante.
          const mixDur = warnPad + introPad + outDur;
          const oac = new OfflineAudioContext(
            2,
            Math.max(1, Math.ceil(mixDur * outRate)),
            outRate,
          );
          let hasVoice = false;
          if (!mutedForExport) {
            try {
              const fullAudio = await decoderCtx.decodeAudioData(raw.slice(0));
              const srcNode = oac.createBufferSource();
              srcNode.buffer = fullAudio;
              srcNode.playbackRate.value = speed;
              srcNode.connect(oac.destination);
              srcNode.start(warnPad + introPad, start);
              hasVoice = true;
            } catch {
              // Voz no decodificable: si hay cama o tema, sigue sonando.
            }
          }
          let hasMusic = false;
          if (
            !mutedForExport &&
            postDesign === "podcast" &&
            podcastMusicOn &&
            podcastMusicVol > 0
          ) {
            try {
              const musicBuf = await soundtrackBuffer();
              const mNode = oac.createBufferSource();
              mNode.buffer = musicBuf;
              mNode.loop = true;
              const mGain = oac.createGain();
              mGain.gain.value = podcastMusicVol;
              mNode.connect(mGain);
              mGain.connect(oac.destination);
              mNode.start(warnPad + introPad);
              hasMusic = true;
            } catch {
              // Cama no disponible: se exporta sin ella (nunca aborta).
            }
          }
          if (themeWanted && themeOutAt > themeInAt) {
            try {
              const themeBuf = await bgThemeBuffer();
              const tNode = oac.createBufferSource();
              tNode.buffer = themeBuf;
              tNode.loop = true;
              const tGain = oac.createGain();
              automateThemeGain(tGain, 0, themeInAt, themeOutAt, bgVolume);
              tNode.connect(tGain);
              tGain.connect(oac.destination);
              tNode.start(0);
              hasTheme = true;
            } catch {
              // Tema no disponible: se exporta sin él (nunca aborta).
            }
          }
          // Audio del cartel: suena tras los 3 s de portada (que van en
          // silencio) y termina justo cuando empieza la pasada de intro.
          let hasWarning = false;
          if (warnPad > 0 && warningAudio) {
            try {
              const wNode = oac.createBufferSource();
              wNode.buffer = warningAudio;
              wNode.connect(oac.destination);
              wNode.start(warnCoverDur);
              hasWarning = true;
            } catch {
              // Cartel sin audio: la fase previa sale muda (nunca aborta).
            }
          }
          if (hasVoice || hasMusic || hasTheme || hasWarning)
            renderedAudio = await oac.startRendering();
        } catch {
          renderedAudio = null; // sin audio exportable → el MP4 sale mudo
        }
      }
      // ── 3b. Cierre opcional (Blacknews.mp4): demux + audio del sello ──
      // El cierre es un extra: si algo falla aquí se omite y el vídeo sale
      // igual, sin abortar la exportación.
      let outroClip: DemuxedAvcClip | null = null;
      let outroAudio: AudioBuffer | null = null;
      if (videoOutro) {
        try {
          const outroRaw = await (await fetch(outroVideoSrc)).arrayBuffer();
          if (outroRaw.byteLength > 256) {
            outroClip = await demuxAvcClip(outroRaw);
            if (outroClip && outroClip.samples.length < 2) outroClip = null;
            if (outroClip && !mutedForExport) {
              try {
                const probe = new OfflineAudioContext(1, 1, 44100);
                const full = await probe.decodeAudioData(outroRaw.slice(0));
                const oac = new OfflineAudioContext(
                  2,
                  Math.max(1, Math.ceil(full.duration * 48000)),
                  48000,
                );
                const node = oac.createBufferSource();
                node.buffer = full;
                node.connect(oac.destination);
                node.start(0);
                outroAudio = await oac.startRendering();
              } catch {
                outroAudio = null; // el cierre sale mudo
              }
            }
          }
        } catch {
          outroClip = null;
          outroAudio = null;
        }
        if (!outroClip)
          console.warn("[export-rapida] cierre omitido: sin muestras AVC");
        snap("outro-prep");
      }
      const outroDurSec = !outroClip
        ? 0
        : outroClip.srcDur > 0
          ? outroClip.srcDur
          : outroClip.samples.length / 30;
      // El audio de la salida cubre todo el cierre: su propio audio o silencio.
      // En silencio (isMuted) no se genera pista… salvo que suene el tema:
      // entonces la pista existe y hay que estirarla hasta el final del sello.
      const outroAudioLen = !outroClip
        ? 0
        : mutedForExport && !hasTheme
          ? 0
          : outroAudio
            ? outroAudio.length
            : Math.round(outroDurSec * 48000);

      const hasAudio =
        (!!renderedAudio && renderedAudio.length > 0) || outroAudioLen > 0;
      snap("audio");

      // Primer error capturado (codificadores, muxer, decoder…): se propaga a
      // todas las esperas y aborta el bucle para caer a la ruta clásica.
      let fail: Error | null = null;
      const failWith = (e: unknown) => {
        if (!fail) fail = e instanceof Error ? e : new Error(String(e));
      };

      // Esperas orientadas a EVENTOS: nunca a timers, porque Chrome limita los
      // temporizadores a 1 Hz con la pestaña oculta y eso paralizaría la
      // exportación en segundo plano. Los eventos decodificador/codificador
      // despiertan al instante; el timer solo es salvaguarda.
      const waiters: Array<() => void> = [];
      const notify = () => {
        while (waiters.length) waiters.shift()!();
      };
      const hardStop =
        performance.now() +
        Math.max(
          45000,
          (warnPad + introPad + outDur + outroDurSec) * 1000 + 45000,
        );
      const waitWhile = async (cond: () => boolean): Promise<void> => {
        while (cond()) {
          if (isCancelledRef.current) throw new Error("EXPORT_CANCELLED");
          if (fail) throw fail;
          if (performance.now() > hardStop) {
            throw new Error(
              "La exportación acelerada superó su tiempo máximo.",
            );
          }
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolve, 5);
            waiters.push(() => {
              window.clearTimeout(timer);
              resolve();
            });
          });
        }
        if (isCancelledRef.current) throw new Error("EXPORT_CANCELLED");
        if (fail) throw fail;
      };

      // ── 4. Muxer + codificadores por hardware ──
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: "avc", width: POST_W, height: POST_H, frameRate: 30 },
        ...(hasAudio
          ? {
              audio: {
                codec: "aac" as const,
                sampleRate: 48000,
                numberOfChannels: 2,
              },
            }
          : {}),
        fastStart: "in-memory",
        firstTimestampBehavior: "offset",
      });

      const bitrate =
        videoQuality === "hq"
          ? 6_000_000
          : videoQuality === "compact"
            ? 1_500_000
            : 3_000_000;
      let videoConfig: VideoEncoderConfig | null = null;
      for (const codecName of ["avc1.640028", "avc1.4D4028", "avc1.64002A"]) {
        try {
          const candidate: VideoEncoderConfig = {
            codec: codecName,
            width: POST_W,
            height: POST_H,
            bitrate,
            framerate: 30,
            latencyMode: "realtime",
            avc: { format: "avc" },
          };
          const support = await VideoEncoder.isConfigSupported(candidate);
          if (support.supported) {
            videoConfig = support.config;
            break;
          }
        } catch {
          // probamos el siguiente códec
        }
      }
      if (!videoConfig) return "unsupported";

      encoder = new VideoEncoder({
        output: (chunk, meta) => {
          try {
            muxer.addVideoChunk(chunk, meta);
          } catch (e) {
            failWith(e);
          }
          notify();
        },
        error: failWith,
      });
      encoder.configure(videoConfig);

      if (hasAudio) {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            try {
              muxer.addAudioChunk(chunk, meta);
            } catch (e) {
              failWith(e);
            }
            notify();
          },
          error: failWith,
        });
        audioEncoder.configure({
          codec: "mp4a.40.2",
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 96_000,
        });
      }

      // ── 5. Canvas dedicado (no pisa la vista previa) + calentamiento ──
      const canvas = document.createElement("canvas");
      canvas.width = POST_W;
      canvas.height = POST_H;
      const cachedFlags = await Promise.all(
        selectedCountries.map(async (c) => ({
          code: c.code,
          img: (countryFormat !== "names" || postDesign === "podcast")
            ? await loadFlagImage(c.code)
            : null,
          text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
        })),
      );
      // Fuentes y overlay base (marquee en su posición 0 / arranque de intro).
      await renderToCanvas(canvas, undefined, cachedFlags, false, undefined, 0, 0);
      setRecordingProgress(10);
      snap("warmup");

      // ── 6. Bucle decodificar → componer → codificar con cola FIFO sin bloqueos ──
      let draining = false;
      // Cada fotograma lleva su bandera: `warn` es el cartel del aviso (a
      // sangre con paintOutroFrame), `outro` es el sello de cierre, y el
      // resto pasa por renderToCanvas.
      const decodedQueue: Array<{
        frame: VideoFrame;
        outro: boolean;
        warn: boolean;
      }> = [];
      const targetFps = 30;
      const targetFrameDurationUs = Math.round(1_000_000 / targetFps);

      // ── Rejilla de salida: la línea de tiempo la marcan estas ranuras ──
      // El audio ya se coloca por muestras exactas (intro en silencio +
      // outDur + cierre), así que el vídeo debe emitir EXACTAMENTE esos
      // fotogramas. Emitir «un fotograma por fotograma de la fuente» —lo que
      // hacía el contador de emisiones— desincroniza el cierre con cualquier
      // fuente que no sea de 30 fps: un clip de 32 fps alargaba el tramo
      // principal un 6,7 % y el sello entraba con el audio ya sonando.
      const warnSlots = warnPad > 0 ? Math.round(warnPad * targetFps) : 0;
      const coverSlots =
        warnPad > 0 ? Math.min(warnSlots, Math.round(warnCoverDur * targetFps)) : 0;
      const introSlots = Math.round(introPad * targetFps);
      const mainSlots = Math.max(2, Math.round(outDur * targetFps));
      const outroBaseSlot = warnSlots + introSlots + mainSlots;
      // El cierre dura lo que dure su audio o su vídeo (el mayor): así el
      // vídeo nunca termina antes que el sonido.
      const outroEndSlot = outroClip
        ? outroBaseSlot +
          Math.max(
            1,
            Math.ceil(Math.max(outroDurSec, outroAudioLen / 48000) * targetFps),
          )
        : outroBaseSlot;
      // Próxima ranura a rellenar (el recuento es también el progreso).
      let nextSlot = 0;
      let paintedOnce = false;

      const updateProgress = () => {
        const totalEstimate = Math.max(1, outroEndSlot);
        const pct = Math.min(
          99,
          10 + Math.round((nextSlot / totalEstimate) * 85),
        );
        if (recPctRef.current) recPctRef.current.textContent = `${pct}%`;
        if (recBarRef.current)
          recBarRef.current.style.width = `${Math.max(5, pct)}%`;
      };

      // Emite el lienzo actual en la ranura `slot` (fotograma normal o de
      // relleno). El sello temporal sale de la ranura: es la única fuente de
      // verdad del reloj de salida, de modo que si el codificador descarta
      // un fotograma lo que viene después conserva su sitio exacto.
      const emitSlot = (slot: number) => {
        const out = new VideoFrame(canvas, {
          timestamp: Math.round(slot * targetFrameDurationUs),
          duration: targetFrameDurationUs,
        });
        try {
          (encoder as VideoEncoder).encode(out, { keyFrame: slot % 60 === 0 });
        } catch (e) {
          failWith(e);
        }
        out.close();
        nextSlot = slot + 1;
        updateProgress();
      };

      // Sostiene el lienzo hasta la ranura `target`: los huecos que la fuente
      // no cubre (más lenta que 30 fps, arranque tardío…) se rellenan para
      // no adelantarle el sitio al audio.
      const padUntil = async (target: number): Promise<void> => {
        if (!paintedOnce) return;
        while (nextSlot < target) {
          await waitWhile(() => (encoder as VideoEncoder).encodeQueueSize > 10);
          emitSlot(nextSlot);
        }
      };

      const processQueue = async () => {
        if (draining) return;
        draining = true;
        try {
          while (decodedQueue.length > 0) {
            if (isCancelledRef.current) break;
            const item = decodedQueue.shift()!;
            const frame = item.frame;
            await waitWhile(
              () => (encoder as VideoEncoder).encodeQueueSize > 10,
            );
            // Ranura que le toca a este fotograma en la rejilla (en el
            // cierre, contando desde el final del clip). No se filtra por
            // rango: sólo entra en el decodificador lo que se va a emitir
            // (pasada de intro + pasada completa + cierre), y aquí se decide
            // qué ranuras cubre cada uno. Los del clip se recortan a SU fase:
            // la ventana de ±50 ms del rango admite fotogramas que caen más
            // allá del borde (intro→clip o clip→cierre) y no deben colarse
            // en la fase siguiente ni adelantarle el sitio al audio.
            const rawSlot = Math.round((frame.timestamp / 1e6) * targetFps);
            // Ranura en la rejilla: el aviso ocupa [0, warnSlots) — la
            // portada del 0 al coverSlots y el cartel después —, la intro y
            // el clip se desplazan por warnSlots y el cierre sigue rematando
            // desde outroBaseSlot. Los fotogramas de más se recortan a SU
            // fase para no colarse en la siguiente.
            const slot = item.warn
              ? Math.min(
                  coverSlots + Math.max(0, rawSlot),
                  Math.max(coverSlots, warnSlots - 1),
                )
              : item.outro
                ? outroBaseSlot + Math.max(0, rawSlot)
                : warnSlots +
                  (frame.timestamp < introPad * 1e6
                    ? Math.min(rawSlot, Math.max(0, introSlots - 1))
                    : Math.min(rawSlot, introSlots + mainSlots - 1));
            if (slot < nextSlot) {
              // De más: la fuente va más rápida que 30 fps o la ranura ya
              // quedó cubierta; se descarta sin romper la cadena.
              frame.close();
              continue;
            }
            // Hueco con el lienzo ya pintado: se rellena ANTES de pintar
            // este fotograma, para que los huecos muestren el cuadro
            // anterior y no adelanten el cambio.
            if (paintedOnce) await padUntil(slot);
            if (item.warn) {
              // Cartel del aviso: a sangre sobre negro, sin overlays.
              paintOutroFrame(
                canvas,
                POST_W,
                POST_H,
                frame,
                frame.displayWidth,
                frame.displayHeight,
                warningClip ? warningClip.rot : 0,
              );
            } else if (item.outro) {
              // Cierre: sello a sangre sobre negro, sin overlays ni velos.
              paintOutroFrame(
                canvas,
                POST_W,
                POST_H,
                frame,
                frame.displayWidth,
                frame.displayHeight,
                outroClip ? outroClip.rot : 0,
              );
            } else {
              await renderToCanvas(
                canvas,
                undefined,
                cachedFlags,
                false,
                {
                  source: frame,
                  width: frame.displayWidth,
                  height: frame.displayHeight,
                  rotation: rot,
                },
                // Segundo de salida SIN la fase de aviso: la intro TV y las
                // animaciones conservan su reloj de siempre.
                ((slot - warnSlots) * targetFrameDurationUs) / 1e6,
                // Segundo de contenido: sin el desfase de la pasada de intro
                // (los fotogramas de esa pasada quedan en 0, con texto).
                Math.max(0, frame.timestamp / 1e6 - introPad),
              );
            }
            paintedOnce = true;
            // Primer fotograma: cubre también las ranuras previas para no
            // arrancar en negro.
            await padUntil(slot);
            emitSlot(slot);
            frame.close();
          }
        } catch (e) {
          failWith(e);
        } finally {
          draining = false;
          notify();
          if (decodedQueue.length > 0) void processQueue();
        }
      };

      // ── 6a. Fase previa del aviso: portada (3 s) + cartel ──
      // Se emite ANTES de tocar el clip: las ranuras son monotónicas y el
      // primer fotograma pintado es el que rellena los huecos previos, así
      // que la portada y el cartel no pueden llegar después del clip.
      if (warnSlots > 0 && warningClip) {
        // Frame de la portada: un fotograma síncrono real del clip (el más
        // cercano al inicio, o al final con «Último fotograma»). Decoder
        // aparte y descartable: sólo aporta un cuadro, y si no decodifica la
        // portada sale igual, sin foto debajo de la composición.
        const coverOut: { frame: VideoFrame | null } = { frame: null };
        if (!audioOnly) {
          const at = warningFrameOrigin === "last" ? end : start;
          let best: (typeof inRange)[number] | null = null;
          for (const s of inRange) {
            if (!s.is_sync) continue;
            if (
              !best ||
              Math.abs(s.cts / ts - at) < Math.abs(best.cts / ts - at)
            )
              best = s;
          }
          if (best) {
            try {
              const cd = new VideoDecoder({
                output: (f) => {
                  coverOut.frame = f;
                },
                error: (e) =>
                  console.warn("[export-rapida] portada sin frame:", e),
              });
              cd.configure({ codec, description });
              cd.decode(
                new EncodedVideoChunk({
                  type: "key",
                  timestamp: 0,
                  duration: targetFrameDurationUs,
                  data: best.data,
                }),
              );
              await cd.flush();
              cd.close();
            } catch {
              coverOut.frame = null;
            }
          }
        }
        const coverFrame = coverOut.frame;
        if (
          !audioOnly &&
          postDesign !== "podcast" &&
          warningFrameOrigin !== "cover" &&
          coverFrame
        ) {
          // «Primer/Último fotograma»: el frame crudo, a sangre. En podcast
          // no: allí la vista previa pinta la composición (onda y reloj) y el
          // archivo tiene que hacer lo mismo.
          paintOutroFrame(
            canvas,
            POST_W,
            POST_H,
            coverFrame,
            coverFrame.displayWidth,
            coverFrame.displayHeight,
            rot,
          );
        } else {
          // «Portada con titular» (y podcast): la composición del post con
          // el frame real como fondo; sin frame, sobre negro.
          await renderToCanvas(
            canvas,
            audioOnly ? (podcastBgRef.current ?? undefined) : undefined,
            cachedFlags,
            false,
            !audioOnly && coverFrame
              ? {
                  source: coverFrame,
                  width: coverFrame.displayWidth,
                  height: coverFrame.displayHeight,
                  rotation: rot,
                }
              : undefined,
            // Reloj del podcast = posición del frame elegido (lo que marca
            // la vista previa al pausar sobre él); con intro TV, la portada
            // se pinta en el estado HOLD (el mismo del PNG): titular
            // desplegado sobre la imagen en B&N.
            postDesign === "podcast"
              ? Math.max(
                  0,
                  (warningFrameOrigin === "last" ? end : start) - trimStart,
                )
              : tvIntro
                ? tvIntroDur * 0.5
                : 0,
            0,
          );
        }
        paintedOnce = true;
        // Los 3 s de portada ocupan sus ranuras con este único cuadro.
        for (let slot = 0; slot < coverSlots; slot++) {
          if (isCancelledRef.current) throw new Error("EXPORT_CANCELLED");
          if (fail) throw fail;
          await waitWhile(() => (encoder as VideoEncoder).encodeQueueSize > 6);
          emitSlot(slot);
        }
        coverFrame?.close();
        snap("warning-cover");
        // Cartel: sus fotogramas entran al mismo codificador con la bandera
        // `warn` y ocupan las ranuras que quedan hasta el final de la fase.
        const wc = warningClip;
        const wd = new VideoDecoder({
          output: (frame) => {
            decodedQueue.push({ frame, outro: false, warn: true });
            void processQueue();
            notify();
          },
          error: failWith,
        });
        warningDecoder = wd;
        wd.configure({ codec: wc.codec, description: wc.description });
        for (const s of wc.samples) {
          await waitWhile(() => wd.decodeQueueSize > 32);
          wd.decode(
            new EncodedVideoChunk({
              type: s.is_sync ? "key" : "delta",
              timestamp: Math.round((s.cts / wc.ts) * 1e6),
              duration: Math.max(1, Math.round((s.duration / wc.ts) * 1e6)),
              data: s.data,
            }),
          );
        }
        await wd.flush();
        snap("warning-feed");
        await waitWhile(
          () =>
            decodedQueue.length > 0 ||
            draining ||
            (encoder as VideoEncoder).encodeQueueSize > 0,
        );
        snap("warning-encode");
        // Borde exacto aviso → intro: la fase dura exactamente warnSlots
        // ranuras (si el cartel venía corto se sostiene su último cuadro; si
        // venía largo, processQueue ya lo recortó).
        await padUntil(warnSlots);
      }

      if (audioOnly) {
        // Sin pista de vídeo que decodificar: cada ranura de la rejilla se
        // pinta a mano con drawPodcastFrame (fondo, onda y reloj en su
        // instante) y se emite. Sólo este bucle escribe en el codificador,
        // así que el orden de las ranuras es estricto y el audio calza.
        const bgEl = podcastBgRef.current ?? undefined;
        // Las ranuras [0, warnSlots) ya las ocupó la fase del aviso: este
        // bucle arranca donde la deja y el reloj se mide desde ahí.
        for (let slot = warnSlots; slot < outroBaseSlot; slot++) {
          if (isCancelledRef.current) throw new Error("EXPORT_CANCELLED");
          if (fail) throw fail;
          await waitWhile(() => (encoder as VideoEncoder).encodeQueueSize > 6);
          await renderToCanvas(
            canvas,
            bgEl,
            cachedFlags,
            false,
            undefined,
            (slot - warnSlots) / targetFps,
          );
          paintedOnce = true;
          // Huecos previos: se rellenan antes de emitir este fotograma para
          // que los huecos muestren el cuadro anterior (sin adelantar el
          // cambio) y el reloj no se despegue del audio.
          await padUntil(slot);
          emitSlot(slot);
        }
        snap("feed");
        await waitWhile(() => (encoder as VideoEncoder).encodeQueueSize > 0);
        snap("encode");
        // Borde exacto clip → cierre (sin cierre, no pinta nada).
        await padUntil(outroBaseSlot);
      } else {
        decoder = new VideoDecoder({
          output: (frame) => {
            decodedQueue.push({ frame, outro: false, warn: false });
            void processQueue();
            notify();
          },
          error: failWith,
        });
        decoder.configure({ codec, description });

        for (const item of feed) {
          await waitWhile(() => (decoder as VideoDecoder).decodeQueueSize > 32);
          (decoder as VideoDecoder).decode(
            new EncodedVideoChunk({
              type: item.s.is_sync ? "key" : "delta",
              timestamp: item.outUs,
              duration: Math.max(
                1,
                Math.round((item.s.duration / ts) * (1 / speed) * 1e6),
              ),
              data: item.s.data,
            }),
          );
        }
        await (decoder as VideoDecoder).flush();
        snap("feed");
        await waitWhile(
          () =>
            decodedQueue.length > 0 ||
            draining ||
            (encoder as VideoEncoder).encodeQueueSize > 0,
        );
        snap("encode");
        // Borde exacto clip → cierre: si a la fuente le sobraron o le faltaron
        // fotogramas respecto a la rejilla, el tramo principal se iguala para
        // que el audio del cierre arranque justo cuando aparece el sello.
        await padUntil(outroBaseSlot);
      }

      // ── 6b. Cierre opcional: se decodifica DESPUÉS de drenar el clip
      //      principal, para que sus fotogramas entren en orden al mismo
      //      codificador. La línea de tiempo la marca el contador de
      //      fotogramas emitidos, así que el sello sigue la secuencia sin
      //      más.
      const oc = outroClip;
      if (oc && oc.samples.length > 0) {
        const od = new VideoDecoder({
          output: (frame) => {
            decodedQueue.push({ frame, outro: true, warn: false });
            void processQueue();
            notify();
          },
          error: failWith,
        });
        outroDecoder = od;
        od.configure({ codec: oc.codec, description: oc.description });
        for (const s of oc.samples) {
          await waitWhile(() => od.decodeQueueSize > 32);
          od.decode(
            new EncodedVideoChunk({
              type: s.is_sync ? "key" : "delta",
              timestamp: Math.round((s.cts / oc.ts) * 1e6),
              duration: Math.max(1, Math.round((s.duration / oc.ts) * 1e6)),
              data: s.data,
            }),
          );
        }
        await od.flush();
        snap("outro-feed");
        await waitWhile(
          () =>
            decodedQueue.length > 0 ||
            draining ||
            (encoder as VideoEncoder).encodeQueueSize > 0,
        );
        snap("outro-encode");
        // El cierre se estira hasta cubrir su audio (o su vídeo, lo que dure
        // más): la pista de vídeo nunca termina antes que la de sonido.
        await padUntil(outroEndSlot);
      }

      // ── 7. Audio → AAC (rápido: los búfers ya están renderizados) ──
      const ra = renderedAudio;
      const oa = outroAudio;
      const ae = audioEncoder;
      if (ae) {
        const frameSize = 1024;
        // Aviso + intro TV: la mezcla (`ra`) cubre ya la fase previa (con el
        // cartel sonando tras su portada), la pasada de intro y el clip, y
        // sólo el tema suena durante esas fases (la voz entra al reiniciarse
        // el vídeo). Sin mezcla, aviso e intro se rellenan de silencio. Si hay
        // cierre, su audio (o silencio si el sello va mudo) cierra la pista y
        // la iguala a la duración del vídeo.
        const leadSamples = Math.round((warnPad + introPad) * 48000);
        // La mezcla (`ra`) ya incluye aviso e intro, así que va pegada al
        // inicio de la pista; sin ella, el hueco de esas fases se rellena de
        // silencio como antes para que el cierre caiga en su segundo exacto.
        const mainStart = ra ? 0 : leadSamples;
        const mainLen = ra
          ? ra.length
          : outroAudioLen > 0
            ? Math.round(outDur * 48000)
            : 0;
        const segs: Array<{
          buf: AudioBuffer | null;
          start: number;
          len: number;
        }> = [
          { buf: ra, start: mainStart, len: mainLen },
          { buf: oa, start: mainStart + mainLen, len: outroAudioLen },
        ];
        const outLen = mainStart + mainLen + outroAudioLen;
        for (let i = 0; i < outLen; i += frameSize) {
          await waitWhile(() => ae.encodeQueueSize > 8);
          const n = Math.min(frameSize, outLen - i);
          // Ceros = silencio: rellena la intro y cualquier hueco.
          const data = new Float32Array(n * 2);
          for (const seg of segs) {
            if (!seg.buf || seg.len <= 0) continue;
            const from = Math.max(0, seg.start - i);
            const to = Math.min(n, seg.start + seg.len - i);
            if (to <= from) continue;
            const s0 = from + i - seg.start;
            const len = to - from;
            const c0 = seg.buf.getChannelData(0);
            const c1 =
              seg.buf.numberOfChannels > 1 ? seg.buf.getChannelData(1) : c0;
            data.set(c0.subarray(s0, s0 + len), from);
            data.set(c1.subarray(s0, s0 + len), n + from);
          }
          ae.encode(
            new AudioData({
              format: "f32-planar",
              sampleRate: 48000,
              numberOfFrames: n,
              numberOfChannels: 2,
              timestamp: Math.round((i / 48000) * 1e6),
              data,
            }),
          );
        }
        await ae.flush();
      }
      snap("audio-encode");

      await (encoder as VideoEncoder).flush();
      if (fail) throw fail;
      snap("flush");
      muxer.finalize();

      // ── 8. Resultado ──
      const blob = new Blob([target.buffer], { type: "video/mp4" });
      const slug = title
        .slice(0, 20)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const filename = `blacknews-video-${slug || "video"}-${formatSlug}-${Date.now()}.mp4`;
      setExportVideoFileName(filename);
      const url = URL.createObjectURL(blob);
      const sizeFormatted =
        blob.size < 1024 * 1024
          ? `${Math.round(blob.size / 1024)} KB`
          : `${(blob.size / (1024 * 1024)).toFixed(1)} MB`;
      setExportedVideoSize(sizeFormatted);
      setExportedVideoUrl(url);
      setRecordingProgress(100);
      triggerDownload(url, filename);
      // El cierre puede quedarse fuera si mp4box no extrae sus muestras AVC:
      // se avisa en el mismo toast para que no se descubra al subir el vídeo.
      const outroNote =
        videoOutro && (!outroClip || outroClip.samples.length === 0)
          ? " ⚠️ El cierre BlackNews no pudo incluirse: el archivo sale sin el sello final."
          : "";
      const warnNote =
        contentWarning && !warningClip
          ? " ⚠️ El aviso de contenido sensible no pudo incluirse: el archivo sale sin la fase previa."
          : "";
      showToast(
        `¡Video ${postFormat} exportado en tu navegador (${sizeFormatted}) — exportación acelerada!${warnNote}${outroNote}`,
      );
      snap("finalize");
      return "done";
    } catch (err: any) {
      if (err?.message === "EXPORT_CANCELLED" || isCancelledRef.current) {
        return "cancelled";
      }
      throw err;
    } finally {
      try {
        if (decoder && decoder.state !== "closed") decoder.close();
      } catch {}
      try {
        if (outroDecoder && outroDecoder.state !== "closed")
          outroDecoder.close();
      } catch {}
      try {
        if (warningDecoder && warningDecoder.state !== "closed")
          warningDecoder.close();
      } catch {}
      try {
        if (encoder && encoder.state !== "closed") encoder.close();
      } catch {}
      try {
        if (audioEncoder && audioEncoder.state !== "closed")
          audioEncoder.close();
      } catch {}
      try {
        if (videoRef.current) videoRef.current.loop = true;
      } catch {}
      isRecordingRef.current = false;
      setIsRecordingVideo(false);
      setRecordingProgress(0);
      setRecordingPaused(false);
      setFastExport(false);
    }
  };

  const handleExportVideo = async () => {
    // La imagen exporta PNG; el vídeo y el audio (modo podcast) exportan vídeo:
    // las redes no admiten audio suelto.
    if (mediaType !== "video" && mediaType !== "audio") return;
    const video = activeMediaEl();
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas) {
      showToast("Carga un video o un audio antes de exportar.");
      return;
    }
    // En modo podcast la exportación nunca sale muda: el sonido ES el
    // contenido. `isMuted` sólo goberna la vista previa.
    const mutedForExport = mediaType === "audio" ? false : isMuted;
    // Elemento que aporta el FONDO al lienzo: el vídeo, la imagen plana del
    // podcast o nada (audio puro → negro absoluto).
    const bgEl:
      | HTMLImageElement
      | HTMLVideoElement
      | HTMLAudioElement
      | undefined =
      mediaType === "audio" ? (podcastBgRef.current ?? undefined) : video;

    isCancelledRef.current = false;

    // Si la vista previa estaba mostrando el cierre, se corta antes de
    // grabar: durante la exportación manda el grabador (el sello se repetirá
    // dentro del archivo, no encima de la tarjeta).
    if (outroActiveRef.current) {
      outroActiveRef.current = false;
      setOutroActive(false);
      try {
        outroRef.current?.pause();
      } catch {}
    }

    // Intenta WebCodecs primero (tanto para MP4 como para WebM si está disponible)
    try {
      const result = await exportVideoFast();
      if (result === "done") return;
      if (result === "cancelled") return;
    } catch (fastErr) {
      console.error(
        "Exportación acelerada falló; se usa el método clásico con Web Worker:",
        fastErr,
      );
    }

    if (
      typeof MediaRecorder === "undefined" ||
      typeof canvas.captureStream !== "function"
    ) {
      showToast(
        "Tu navegador no admite exportación de video. Prueba con Chrome o Edge.",
      );
      return;
    }

    const pickCodec = (): { mimeType: string; ext: "mp4" | "webm" } => {
      const mp4 = [
        "video/mp4;codecs=avc1.640028,mp4a.40.2",
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
      ];
      const webm = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const groups = videoFormat === "mp4" ? [mp4, webm] : [webm, mp4];
      for (const group of groups) {
        for (const mime of group) {
          if (MediaRecorder.isTypeSupported(mime)) {
            return {
              mimeType: mime,
              ext: mime.startsWith("video/mp4") ? "mp4" : "webm",
            };
          }
        }
      }
      return { mimeType: "", ext: "webm" };
    };

    let liveStream: MediaStream | null = null;
    let timerWorker: Worker | null = null;
    let workerUrl: string | null = null;
    // Tema de fondo («Tema») de la ruta clásica: BufferSource en bucle con su
    // Gain, dentro del mismo grafo que la voz. Se declara fuera del `try` para
    // poder apagarlo también en el `finally` si la exportación falla a mitad.
    let themeNode: AudioBufferSourceNode | null = null;
    let themeGain: GainNode | null = null;
    let themeCtx: AudioContext | null = null;

    try {
      setIsRecordingVideo(true);
      setRecordingProgress(2);

      const { mimeType, ext } = pickCodec();
      const formatNote =
        videoFormat === "mp4" && ext !== "mp4"
          ? " Este navegador no graba MP4: se exportó en WebM."
          : "";

      const duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : videoDuration;
      const start = Math.max(
        0,
        Math.min(trimStart, Math.max(duration - 0.1, 0)),
      );
      let end =
        trimEnd > start && duration > 0
          ? Math.min(trimEnd, duration)
          : duration;
      if (maxVideoDuration > 0)
        end = Math.min(end, start + maxVideoDuration * videoSpeed);
      if (!(end > start)) {
        showToast("El recorte de video no es válido: revisa inicio y fin.");
        return;
      }

      const cachedFlags = await Promise.all(
        selectedCountries.map(async (c) => ({
          code: c.code,
          img: (countryFormat !== "names" || postDesign === "podcast")
            ? await loadFlagImage(c.code)
            : null,
          text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
        })),
      );
      await renderToCanvas(canvas, bgEl, cachedFlags, false, undefined, 0, 0);
      setRecordingProgress(10);

      video.pause();
      video.loop = false;
      video.playbackRate = videoSpeed;
      // Con intro, la salida arranca en silencio; `step()` abre el audio al
      // terminar la intro, cuando el vídeo reinicia en color con sonido.
      video.muted = mutedForExport || tvIntro;

      const seekTo = (t: number) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const onSeeked = () => {
            if (settled) return;
            settled = true;
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          try {
            video.currentTime = t;
          } catch {
            onSeeked();
          }
          window.setTimeout(onSeeked, 3000);
        });

      if (Math.abs(video.currentTime - start) > 0.05) {
        await seekTo(start);
      }

      // Aviso de contenido sensible: fase previa [portada + cartel] antes del
      // clip. Se espera a los metadatos del <video> (preload="auto": casi
      // siempre ya están cargados) para conocer su duración exacta; sin ellos
      // no se inserta nada, para no descolocar el reloj de salida.
      const warnEl = contentWarning ? warningRef.current : null;
      if (warnEl && warnEl.readyState < 1) {
        await new Promise<void>((res) => {
          const done = () => {
            warnEl.removeEventListener("loadedmetadata", done);
            res();
          };
          warnEl.addEventListener("loadedmetadata", done);
          window.setTimeout(done, 3000);
        });
      }
      const warnPad =
        contentWarning && warnEl && warnEl.duration > 0
          ? warningFrameDur + warnEl.duration
          : 0;
      const warnNote =
        contentWarning && warnPad === 0
          ? " ⚠️ El aviso de contenido sensible no pudo incluirse: el archivo sale sin la fase previa."
          : "";
      // Con «Último fotograma» la portada se pinta sobre el final del clip;
      // con portada o primer frame, el clip ya está aparcado en su inicio.
      if (warnPad > 0 && warningFrameOrigin === "last") {
        await seekTo(Math.max(start, end - 0.05));
      }

      // Pasada de intro y duración del clip de salida: los mismos valores que
      // usa `step()` más abajo. Se calculan aquí porque el tema de fondo los
      // necesita para programar sus fundidos antes de arrancar la grabación.
      const introPad = tvIntro ? tvIntroDur : 0;
      const clipOutDur = (end - start) / Math.max(videoSpeed, 0.01);
      let audioTrack: MediaStreamTrack | null = null;
      // Cama de la ruta clásica: BufferSource en bucle dentro del mismo grafo
      // que la voz. Se corta en `finish` y justo cuando entra el cierre.
      let musicNode: AudioBufferSourceNode | null = null;
      // Tema de fondo («Tema»): NO le gobierna `mutedForExport` — que sólo
      // apaga la voz del clip — porque en la vista previa es un <audio> aparte
      // que el botón de silencio no toca. Sólo hace falta el grafo de audio.
      const themeWanted = bgAudio && mediaType === "video" && bgVolume > 0;
      const themeFadeArmed =
        textFadeOut &&
        postDesign !== "podcast" &&
        (postFormat === "4:5" || postFormat === "9:16");
      // Segundos de SALIDA en que el tema empieza a subir (la fase de aviso y
      // la pasada de intro van mudas si el fundido texto→vídeo está armado) y
      // en el que debe quedar en 0, que es justo cuando entra el cierre.
      const themeInAt =
        warnPad + (themeFadeArmed ? introPad + textFadeOutDur : 0);
      const themeOutAt = warnPad + introPad + clipOutDur;
      if (!mutedForExport || themeWanted) {
        try {
          // Un MediaElementSource por elemento (sólo se puede crear uno): el
          // <video> y el <audio> del podcast tienen cada uno su grafo cacheado.
          const graphRef =
            mediaType === "audio" ? audioOnlyGraphRef : audioGraphRef;
          let graph = graphRef.current;
          if (!graph) {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(video);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioCtx.destination);
            graph = { ctx: audioCtx, dest };
            graphRef.current = graph;
          }
          if (graph.ctx.state === "suspended") await graph.ctx.resume();
          audioTrack = graph.dest.stream.getAudioTracks()[0] ?? null;
          if (
            audioTrack &&
            postDesign === "podcast" &&
            podcastMusicOn &&
            podcastMusicVol > 0
          ) {
            try {
              const musicBuf = await soundtrackBuffer();
              const mNode = graph.ctx.createBufferSource();
              mNode.buffer = musicBuf;
              mNode.loop = true;
              const mGain = graph.ctx.createGain();
              mGain.gain.value = podcastMusicVol;
              mNode.connect(mGain);
              mGain.connect(graph.dest);
              mGain.connect(graph.ctx.destination);
              mNode.start();
              musicNode = mNode;
            } catch (musicErr) {
              console.warn("Cama musical no disponible:", musicErr);
            }
          }
          // Tema de fondo: BufferSource en bucle + Gain en el mismo grafo (va
          // a la pista de audio y también a los altavoces, como la cama). Los
          // fundidos se programan al arrancar la grabación, cuando se conoce
          // el segundo 0 real de la salida.
          if (themeWanted && audioTrack) {
            try {
              const themeBuf = await bgThemeBuffer();
              const tNode = graph.ctx.createBufferSource();
              tNode.buffer = themeBuf;
              tNode.loop = true;
              const tGain = graph.ctx.createGain();
              tGain.gain.value = 0;
              tNode.connect(tGain);
              tGain.connect(graph.dest);
              tGain.connect(graph.ctx.destination);
              themeNode = tNode;
              themeGain = tGain;
              themeCtx = graph.ctx;
            } catch (themeErr) {
              console.warn("Tema de fondo no disponible:", themeErr);
              themeNode = null;
              themeGain = null;
              themeCtx = null;
            }
          }
        } catch (audioErr) {
          console.warn("Audio no disponible en la grabación:", audioErr);
        }
      }
      setRecordingProgress(14);

      const stream = canvas.captureStream(30);
      liveStream = stream;
      if (audioTrack) stream.addTrack(audioTrack);
      const videoBitsPerSecond =
        videoQuality === "hq"
          ? 6_000_000
          : videoQuality === "compact"
            ? 1_500_000
            : 3_000_000;
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond,
        audioBitsPerSecond: 96_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () =>
          resolve(
            new Blob(chunks, {
              type: recorder.mimeType || mimeType || "video/webm",
            }),
          );
        recorder.addEventListener("error", (e) =>
          reject(
            (e as unknown as { error?: Error }).error ??
              new Error("Error de grabación"),
          ),
        );
      });

      const slug = title
        .slice(0, 20)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const filename = `blacknews-video-${slug || "video"}-${formatSlug}-${Date.now()}.${ext}`;
      setExportVideoFileName(filename);

      let stopped = false;
      let lastPct = 14;
      // Arranca ya consumido: el primer setRecordingProgress en caliente dispara
      // un re-render del generador y provoca un tirón visible al inicio.
      let lastProgressAt = performance.now();
      // Reloj de la intro: los primeros tvIntroDur s de salida son
      // una pasada propia — el clip desde su principio y sin sonido (en 16:9,
      // además en B/N con las fases de TV) — y al terminar el vídeo vuelve a
      // empezar para no perderse nada. La salida total suma ese desfase
      // (introPad) a la duración del clip. `introPad` y `clipOutDur` están
      // calculados arriba, junto al tema de fondo.
      const outroSec = videoOutro ? outroDuration : 0;
      let introPhase2 = false;
      let introWall0 = 0;
      // Fase de cierre (Blacknews.mp4): se activa al terminar el clip y la
      // dirige la misma máquina de estados (enterOutro/stepOutro/finish).
      let outroPhase = false;
      let outroEl: HTMLVideoElement | null = null;
      let outroOnEnded: (() => void) | null = null;
      // Rastro del cierre para el aviso final: `enterOutro` puede rendirse
      // (interruptor apagado o <video> del sello sin montar) y `stepOutro`
      // puede cerrar antes de pintar nada. El toast lo cuenta en vez de dejar
      // el archivo mudo: un sello que no entra es un problema visible, no un
      // detalle que se descubra al subirlo.
      let outroEntered = false;
      let outroDrew = false;
      // Instante en que el sello empezó a intentar despegar de su final.
      let outroStartAt = 0;
      // Fase de aviso (portada → cartel) ANTES de la intro/clip: espejo de
      // `outroPhase`. `stepWarning` pinta y `schedule` elige el elemento
      // vivo; la portada corre con setTimeout porque el clip está en pausa y
      // rVFC no dispara con un elemento parado.
      let warnPhase: "frame" | "card" | null = null;
      let warnFrameStartAt = 0;
      let warnCardStartAt = 0;
      let warnDrew = false;
      // Segundo de SALIDA absoluto (la fase de aviso va incluida): manda para
      // el progreso y para decidir qué se pinta en cada fase.
      const outTNow = () => {
        if (warnPhase === "frame") {
          return Math.min(
            warningFrameDur,
            (performance.now() - warnFrameStartAt) / 1000,
          );
        }
        if (warnPhase === "card") {
          return warningFrameDur + (warnEl?.currentTime ?? 0);
        }
        if (outroPhase) {
          return warnPad + introPad + clipOutDur + (outroEl?.currentTime ?? 0);
        }
        const mediaT = Math.max(
          0,
          (video.currentTime - start) / Math.max(videoSpeed, 0.01),
        );
        if (!tvIntro) return warnPad + mediaT;
        if (!introPhase2) {
          return (
            warnPad +
            Math.min(
              introWall0 > 0 ? (performance.now() - introWall0) / 1000 : 0,
              tvIntroDur,
            )
          );
        }
        return warnPad + introPad + mediaT;
      };
      let hardDeadline =
        performance.now() +
        warnPad * 1000 +
        introPad * 1000 +
        clipOutDur * 1000 +
        outroSec * 1000 +
        8000;

      const stopRecording = () => {
        if (stopped) return;
        stopped = true;
        try {
          if (timerWorker) {
            timerWorker.postMessage("stop");
            timerWorker.terminate();
          }
        } catch {}
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } catch {}
        try {
          video.pause();
          video.loop = true;
        } catch {}
        try {
          if (outroEl) outroEl.pause();
        } catch {}
        try {
          if (warnEl) {
            warnEl.pause();
            warnEl.currentTime = 0;
          }
        } catch {}
        outroPhase = false;
        warnPhase = null;
        outroActiveRef.current = false;
        setOutroActive(false);
        warningActiveRef.current = false;
        setWarningActive(false);
        setWarningFrameActive(false);
        setIsVideoPlaying(false);
      };

      // Web Worker Timer: ticks a 15 ms para procesamiento ultra acelerado en segundo plano
      const workerScript = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(function() { self.postMessage('tick'); }, 15);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };
      `;
      const workerBlob = new Blob([workerScript], {
        type: "application/javascript",
      });
      workerUrl = URL.createObjectURL(workerBlob);
      timerWorker = new Worker(workerUrl);

      isRecordingRef.current = true;
      // Tema de fondo: aquí empieza el segundo 0 real de la grabación, así
      // que es el instante en que se programan sus fundidos (subida cuando el
      // texto se va, bajada al entrar el cierre de marca).
      if (themeNode && themeGain && themeCtx) {
        try {
          if (themeCtx.state === "suspended") await themeCtx.resume();
          const t0 = themeCtx.currentTime;
          automateThemeGain(
            themeGain,
            t0,
            t0 + themeInAt,
            t0 + themeOutAt,
            bgVolume,
          );
          themeNode.start(t0, 0);
        } catch (themeErr) {
          console.warn("Tema de fondo no arrancó:", themeErr);
          themeNode = null;
          themeGain = null;
          themeCtx = null;
        }
      }
      recorder.start(100);

      const targetFps = 30;
      const vTrack = stream.getVideoTracks()[0] as
        | CanvasCaptureMediaStreamTrack
        | undefined;

      // Reproducción en tiempo real + requestVideoFrameCallback: el navegador
      // decodifica la fuente de forma fluida (WebM incluido) y cada fotograma
      // presentado se compone y se captura en su instante real. La búsqueda
      // fotograma a fotograma anterior era lenta en WebM (sin índice de cues el
      // navegador tarda más de 150 ms en buscar) y el timeout de 150 ms dibujaba
      // fotogramas caducos: el vídeo exportado salía entrecortado y sin audio.
      const frameStats = { n: 0, sum: 0, max: 0, slow: 0, lastMediaT: start };
      const reportProgress = () => {
        const dur = clipOutDur;
        const totalOut = warnPad + introPad + dur + outroSec;
        const frac = Math.min(1, Math.max(0, outTNow() / totalOut));
        const pct = Math.min(99, Math.max(lastPct, Math.round(14 + frac * 85)));
        if (pct > lastPct) {
          lastPct = pct;
          if (recPctRef.current) recPctRef.current.textContent = `${pct}%`;
          if (recBarRef.current)
            recBarRef.current.style.width = `${Math.max(5, pct)}%`;
          // setRecordingProgress re-renderiza el generador entero: hacerlo en
          // cada fotograma frena el bucle de captura y el vídeo sale cortado.
          // Se estrangula a un refresco de estado como máximo cada1,5 s.
          const now = performance.now();
          if (now - lastProgressAt > 1500 || pct >= 99) {
            lastProgressAt = now;
            setRecordingProgress(pct);
          }
        }
      };

      await new Promise<void>((resolve) => {
        let active = true;
        let deadlineTimer = 0;
        const finish = (reason: string) => {
          if (!active) return;
          active = false;
          video.removeEventListener("ended", onEnded);
          window.clearTimeout(deadlineTimer);
          try {
            if (outroEl && outroOnEnded)
              outroEl.removeEventListener("ended", outroOnEnded);
          } catch {}
          try {
            if (outroEl) outroEl.pause();
          } catch {}
          try {
            if (musicNode) musicNode.stop();
          } catch {}
          musicNode = null;
          // El tema se corta con la grabación: si aún sonara (deriva de unos
          // ms entre el reloj del AudioContext y el del vídeo), se apaga ya.
          try {
            if (themeGain && themeCtx) {
              const now = themeCtx.currentTime;
              const cur = themeGain.gain.value;
              themeGain.gain.cancelScheduledValues(now);
              themeGain.gain.setValueAtTime(cur, now);
              if (cur > 0.001)
                themeGain.gain.linearRampToValueAtTime(0, now + 0.2);
            }
            if (themeNode) themeNode.stop();
          } catch {}
          themeNode = null;
          themeGain = null;
          themeCtx = null;
          outroPhase = false;
          outroActiveRef.current = false;
          setOutroActive(false);
          try {
            if (warnEl) {
              warnEl.pause();
              warnEl.currentTime = 0;
            }
          } catch {}
          warnPhase = null;
          warningActiveRef.current = false;
          setWarningActive(false);
          setWarningFrameActive(false);
          const summary =
            `${reason} frames=${frameStats.n} ` +
            `avgMs=${frameStats.n ? (frameStats.sum / frameStats.n).toFixed(1) : 0} ` +
            `maxMs=${frameStats.max.toFixed(1)} slow>33ms=${frameStats.slow} ` +
            `capturado=${frameStats.lastMediaT.toFixed(2)}/${(end - start).toFixed(2)}s`;
          console.debug(`[export-clasica] ${summary}`);
          // Resumen diagnóstico accesible desde DevTools y desde el DOM.
          document.documentElement.setAttribute("data-export-clasica", summary);
          resolve();
        };
        // Cierre de marca: tras el clip, el sello BlackNews ocupa la tarjeta y
        // el lienzo SIN chyron ni ticker (mismo dibujo que la vista previa).
        /** Rebobina el sello a su principio. `currentTime = 0` puede quedar en
         *  el aire si el elemento no tenía metadatos todavía, así que se pide
         *  otra vez desde stepOutro hasta que el reloj confirme el arranque. */
        const rewindOutro = (el: HTMLVideoElement) => {
          try {
            el.currentTime = 0;
          } catch {}
        };
        const enterOutro = (): boolean => {
          if (outroPhase || !videoOutro) return false;
          const el = outroRef.current;
          if (!el) return false;
          outroPhase = true;
          outroEntered = true;
          outroStartAt = 0;
          outroEl = el;
          outroActiveRef.current = true;
          setOutroActive(true);
          try {
            video.pause();
          } catch {}
          // La cama se corta al entrar el sello: el cierre tiene su sonido.
          try {
            if (musicNode) musicNode.stop();
          } catch {}
          musicNode = null;
          // El tema ya baja solo justo hasta aquí (automatización programada
          // al arrancar); si aún quedara algo audible, se apaga con fundido
          // corto para que no se cuele por debajo del sello.
          try {
            if (themeGain && themeCtx) {
              const now = themeCtx.currentTime;
              const cur = themeGain.gain.value;
              themeGain.gain.cancelScheduledValues(now);
              themeGain.gain.setValueAtTime(cur, now);
              if (cur > 0.001)
                themeGain.gain.linearRampToValueAtTime(0, now + 0.3);
            }
            if (themeNode && themeCtx)
              themeNode.stop(themeCtx.currentTime + 0.35);
          } catch {}
          themeNode = null;
          themeGain = null;
          themeCtx = null;
          el.muted = mutedForExport;
          rewindOutro(el);
          // El sello entra en la misma pista de audio que el clip: el nodo
          // MediaElementSource de un elemento sólo se crea una vez, por eso
          // queda cacheado en outroAudioNodeRef.
          const outroGraph = (
            mediaType === "audio" ? audioOnlyGraphRef : audioGraphRef
          ).current;
          if (!mutedForExport && outroGraph) {
            try {
              const graph = outroGraph;
              if (
                !outroAudioNodeRef.current ||
                outroAudioNodeRef.current.el !== el
              ) {
                const node = graph.ctx.createMediaElementSource(el);
                node.connect(graph.dest);
                node.connect(graph.ctx.destination);
                outroAudioNodeRef.current = { el, node };
              }
              if (graph.ctx.state === "suspended") void graph.ctx.resume();
            } catch (audioErr) {
              console.warn("Audio del cierre no disponible:", audioErr);
            }
          }
          // Un «ended» residual de la reproducción anterior (el sello estaba
          // aparcado en su final) no debe cerrar el archivo sin haber pintado
          // ni un cuadro: en ese caso manda stepOutro, que rebobina y cuenta
          // su propio plazo de gracia.
          outroOnEnded = () => {
            if (!outroDrew) return;
            finish("fin-del-cierre");
          };
          el.addEventListener("ended", outroOnEnded);
          el.play().catch(() => {});
          // El plazo calculado para el clip ya no sirve: se amplía con el
          // cierre para que la red de seguridad no corte el sello.
          window.clearTimeout(deadlineTimer);
          deadlineTimer = window.setTimeout(
            () => finish("plazo-de-seguridad-cierre"),
            (el.duration > 0 ? el.duration : outroSec) * 1000 + 8000,
          );
          console.debug("[export-clasica] entra-el-cierre");
          return true;
        };

        // ── Aviso: portada (3 s) → cartel Blacknews-Advertencia.mp4 ──
        // Espejo del cierre: `stepWarning` pinta cada fase y `schedule` elige
        // el elemento vivo. Al terminar, el clip (o su pasada de intro) arranca
        // desde trimStart con su propio reloj.
        const enterClipAfterWarning = async (): Promise<void> => {
          warnPhase = null;
          if (warnEl) {
            try {
              warnEl.pause();
              warnEl.currentTime = 0;
            } catch {}
          }
          warningActiveRef.current = false;
          setWarningActive(false);
          setWarningFrameActive(false);
          // La portada pudo dejar el clip aparcado al final del recorte: se
          // vuelve a su inicio y la intro TV coge su reloj justo aquí.
          if (Math.abs(video.currentTime - start) > 0.05) {
            await seekTo(start);
          }
          introWall0 = performance.now();
          if (video.paused) video.play().catch(() => {});
          schedule();
        };
        const enterWarningCard = () => {
          const el = warnEl;
          if (!el) return;
          warnPhase = "card";
          warnCardStartAt = 0;
          warnDrew = false;
          setWarningFrameActive(false);
          try {
            video.pause();
          } catch {}
          el.muted = mutedForExport;
          try {
            el.currentTime = 0;
          } catch {}
          // El cartel entra en la misma pista de audio que el clip: un
          // elemento sólo puede enrutarce una vez, por eso queda cacheado.
          const warnGraph = (
            mediaType === "audio" ? audioOnlyGraphRef : audioGraphRef
          ).current;
          if (!mutedForExport && warnGraph) {
            try {
              const graph = warnGraph;
              if (
                !warningAudioNodeRef.current ||
                warningAudioNodeRef.current.el !== el
              ) {
                const node = graph.ctx.createMediaElementSource(el);
                node.connect(graph.dest);
                node.connect(graph.ctx.destination);
                warningAudioNodeRef.current = { el, node };
              }
              if (graph.ctx.state === "suspended") void graph.ctx.resume();
            } catch (audioErr) {
              console.warn("Audio del aviso no disponible:", audioErr);
            }
          }
          // El <video> queda visible en la vista previa, como el sello, para
          // que se vea qué se está grabando.
          warningActiveRef.current = true;
          setWarningActive(true);
          el.play().catch(() => {});
          console.debug("[export-clasica] entra-el-aviso");
        };
        /** Fotograma pintado en la tarjeta: contabiliza como el resto. */
        const noteWarnFrame = (ms: number, mediaT: number) => {
          frameStats.n++;
          frameStats.sum += ms;
          if (ms > frameStats.max) frameStats.max = ms;
          if (ms > 33) frameStats.slow++;
          frameStats.lastMediaT = mediaT;
        };
        const stepWarning = async () => {
          if (!active || !warnPhase) return;
          if (isCancelledRef.current) return finish("cancelado");
          if (stopped) return finish("detenido");
          if (warnPhase === "frame") {
            // Portada: cuadro estático durante warningFrameDur s. Es la
            // miniatura que las redes toman del enlace.
            if (
              performance.now() - warnFrameStartAt >=
              warningFrameDur * 1000
            ) {
              if (warnEl) {
                enterWarningCard();
                return schedule();
              }
              await enterClipAfterWarning();
              return;
            }
            const tRender = performance.now();
            if (
              warningFrameOrigin === "cover" ||
              mediaType !== "video" ||
              postDesign === "podcast"
            ) {
              await renderToCanvas(
                canvas,
                bgEl,
                cachedFlags,
                false,
                undefined,
                // Igual que la ruta rápida: reloj del podcast = posición del
                // frame elegido; con intro TV, portada en estado HOLD (el
                // mismo del PNG: titular desplegado sobre B&N).
                postDesign === "podcast"
                  ? Math.max(
                      0,
                      (warningFrameOrigin === "last" ? end : start) -
                        trimStart,
                    )
                  : tvIntro
                    ? tvIntroDur * 0.5
                    : 0,
                0,
              );
            } else {
              // «Primer/Último fotograma»: el cuadro crudo del clip (en
              // podcast no: allí manda la composición, como la vista previa).
              const raw = video as HTMLVideoElement;
              paintOutroFrame(
                canvas,
                POST_W,
                POST_H,
                raw,
                raw.videoWidth,
                raw.videoHeight,
              );
            }
            noteWarnFrame(performance.now() - tRender, video.currentTime);
            if (!active) return;
            if (vTrack && typeof (vTrack as any).requestFrame === "function") {
              (vTrack as any).requestFrame();
            }
            reportProgress();
            schedule();
            return;
          }
          // Fase de cartel: sus cuadros a sangre hasta que termina.
          const el = warnEl;
          if (!el) {
            await enterClipAfterWarning();
            return;
          }
          const dur = el.duration > 0 ? el.duration : warningDurFallback;
          const atEnd = el.ended || (dur > 0 && el.currentTime >= dur - 0.03);
          if (atEnd) {
            if (warnDrew) {
              await enterClipAfterWarning();
              return;
            }
            // El cartel puede seguir aparcado en su final (tras sonar en la
            // vista previa): se rebobina y se espera OUTRO_START_GRACE_MS a
            // que el reloj confirme el arranque. Si no arranca, se sale de la
            // fase para no atascar la exportación.
            if (warnCardStartAt === 0) warnCardStartAt = performance.now();
            if (performance.now() - warnCardStartAt > OUTRO_START_GRACE_MS) {
              console.warn(
                "[export-clasica] el aviso no arrancó: se sale sin cartel",
              );
              await enterClipAfterWarning();
              return;
            }
            try {
              el.currentTime = 0;
            } catch {}
            if (el.paused) el.play().catch(() => {});
            // rVFC no dispara con el elemento parado: reintento con reloj.
            window.setTimeout(() => void stepWarning(), 60);
            return;
          }
          warnCardStartAt = 0;
          if (el.readyState >= 2) {
            const tRender = performance.now();
            paintOutroFrame(
              canvas,
              POST_W,
              POST_H,
              el,
              el.videoWidth,
              el.videoHeight,
            );
            noteWarnFrame(performance.now() - tRender, el.currentTime);
            warnDrew = true;
            if (!active) return;
            if (vTrack && typeof (vTrack as any).requestFrame === "function") {
              (vTrack as any).requestFrame();
            }
          }
          reportProgress();
          schedule();
        };
        const onEnded = () => {
          // Durante el aviso manda su propia máquina (stepWarning).
          if (warnPhase) return;
          // En la intro el clip se da vuelta hasta completar tvIntroDur.
          if (tvIntro && !introPhase2) {
            video.currentTime = start;
            if (video.paused) video.play().catch(() => {});
            return;
          }
          if (enterOutro()) return schedule();
          finish("ended-del-video");
        };
        const doneReason = () => {
          if (isCancelledRef.current) return "cancelado";
          if (stopped) return "detenido";
          // Ya manda el aviso: se cierra por su propio reloj (stepWarning).
          if (warnPhase) return null;
          // Ya manda el cierre: se cierra por su propio reloj (stepOutro).
          if (outroPhase) return null;
          if (tvIntro && !introPhase2) return null; // la intro se repite
          if (video.ended) return enterOutro() ? null : "fin-del-video";
          if (video.currentTime >= end - 0.02)
            return enterOutro() ? null : "llego-al-trim";
          return null;
        };
        const schedule = () => {
          if (!active) return;
          // En la fase de portada el clip está en pausa y rVFC no dispara:
          // se muestrea con el mismo respaldo temporal que usa la intro.
          if (warnPhase === "frame") {
            window.setTimeout(() => void step(), Math.round(1000 / targetFps));
            return;
          }
          // El reloj lo marca el elemento vivo: el cartel o el sello.
          const el =
            (outroPhase && outroEl) ||
            (warnPhase === "card" && warnEl) ||
            video;
          const anyVideo = el as unknown as {
            requestVideoFrameCallback?: (cb: () => void) => number;
          };
          if (typeof anyVideo.requestVideoFrameCallback === "function") {
            anyVideo.requestVideoFrameCallback(() => void step());
          } else {
            // Respaldo sin rVFC: muestreo fijo a targetFps
            window.setTimeout(() => void step(), Math.round(1000 / targetFps));
          }
        };
        // Fotograma del cierre: sello a sangre sobre negro, sin overlays.
        const stepOutro = async () => {
          if (!active || !outroPhase || !outroEl) return;
          if (isCancelledRef.current) return finish("cancelado");
          if (stopped) return finish("detenido");
          const el = outroEl;
          const dur = el.duration > 0 ? el.duration : outroSec;
          const atEnd = el.ended || (dur > 0 && el.currentTime >= dur - 0.03);
          // El sello puede seguir aparcado en su último fotograma (tras sonar
          // en la vista previa): no se cierra todavía. Se vuelve a rebobinar y
          // se espera OUTRO_START_GRACE_MS a que el reloj confirme el arranque.
          // Sólo entonces manda el final del sello, y sólo después de haber
          // pintado al menos un cuadro: el archivo nunca se cierra vacío.
          if (atEnd) {
            if (outroDrew) return finish("fin-del-cierre");
            if (outroStartAt === 0) outroStartAt = performance.now();
            if (performance.now() - outroStartAt > OUTRO_START_GRACE_MS) {
              console.warn(
                "[export-clasica] el sello no arrancó: se cierra sin cierre",
              );
              return finish("cierre-no-arranco");
            }
            rewindOutro(el);
            if (el.paused) el.play().catch(() => {});
            // rVFC no dispara con el elemento parado: el reintento lleva
            // reloj propio para no depender de que el sello despegue.
            window.setTimeout(() => void stepOutro(), 60);
            return;
          }
          outroStartAt = 0;
          if (el.readyState >= 2) {
            const tRender = performance.now();
            paintOutroFrame(
              canvas,
              POST_W,
              POST_H,
              el,
              el.videoWidth,
              el.videoHeight,
            );
            const ms = performance.now() - tRender;
            frameStats.n++;
            frameStats.sum += ms;
            if (ms > frameStats.max) frameStats.max = ms;
            if (ms > 33) frameStats.slow++;
            frameStats.lastMediaT = el.currentTime;
            outroDrew = true;
            if (!active) return;
            if (vTrack && typeof (vTrack as any).requestFrame === "function") {
              (vTrack as any).requestFrame();
            }
          }
          reportProgress();
          schedule();
        };
        const step = async () => {
          if (!active) return;
          // La fase de aviso tiene su propio pintado (portada o cartel).
          if (warnPhase) return stepWarning();
          const early = doneReason();
          if (early) return finish(early);
          // doneReason pudo dar paso al cierre de marca: no se pinta ya el clip.
          if (outroPhase) return stepOutro();
          // Intro TV: los primeros tvIntroDur s son una pasada propia. Al
          // llegar al final el vídeo vuelve a empezar (color y sonido); si el
          // clip es más corto que la intro, se da vuelta hasta completarla.
          if (tvIntro && !introPhase2) {
            const wrap = async () => {
              await seekTo(start);
              if (video.paused) {
                try {
                  await video.play();
                } catch {}
              }
            };
            if (performance.now() - introWall0 >= tvIntroDur * 1000) {
              introPhase2 = true;
              await wrap();
              return schedule();
            }
            if (
              video.ended ||
              video.currentTime >= end - 0.02 ||
              video.currentTime < start - 0.05
            ) {
              await wrap();
              return schedule();
            }
          }
          // Segundo de salida (pasada de intro): manda el render y el audio.
          // `outT` es absoluto (incluye la fase de aviso): para la intro TV
          // sólo cuenta el tiempo desde que termina el aviso.
          const outT = outTNow();
          if (tvIntro) {
            const wantMuted = mutedForExport || outT - warnPad < tvIntroDur;
            if (video.muted !== wantMuted) video.muted = wantMuted;
          }
          // Segundo de contenido para la transición «texto → vídeo» (4:5):
          // durante la pasada de intro el texto se queda donde está.
          const contentT =
            tvIntro && !introPhase2
              ? 0
              : Math.max(
                  0,
                  (video.currentTime - start) / Math.max(videoSpeed, 0.01),
                );
          const tRender = performance.now();
          await renderToCanvas(
            canvas,
            bgEl,
            cachedFlags,
            false,
            undefined,
            // Sin la fase de aviso: las animaciones conservan su reloj.
            Math.max(0, outT - warnPad),
            contentT,
          );
          const ms = performance.now() - tRender;
          frameStats.n++;
          frameStats.sum += ms;
          if (ms > frameStats.max) frameStats.max = ms;
          if (ms > 33) frameStats.slow++;
          frameStats.lastMediaT = video.currentTime;
          if (!active) return;
          if (vTrack && typeof (vTrack as any).requestFrame === "function") {
            (vTrack as any).requestFrame();
          }
          reportProgress();
          const late = doneReason();
          if (late) return finish(late);
          if (outroPhase) return stepOutro();
          schedule();
        };

        video.addEventListener("ended", onEnded);
        // Red de seguridad: si rVFC no vuelve a disparar (vídeo detenido por
        // política de reproducción, pestaña oculta…), se cierra igualmente.
        deadlineTimer = window.setTimeout(
          () => finish("plazo-de-seguridad"),
          (warnPad +
            introPad +
            (end - start) / Math.max(videoSpeed, 0.01) +
            outroSec) *
            1000 +
            6000,
        );
        if (warnPad > 0) {
          // Arranca la fase de aviso: primero la portada estática; el cartel
          // y después el clip los encadena stepWarning / step.
          warnPhase = "frame";
          warnFrameStartAt = performance.now();
          setWarningFrameActive(true);
          try {
            video.pause();
          } catch {}
          schedule();
        } else {
          introWall0 = performance.now();
          video
            .play()
            .then(() => schedule())
            .catch((playErr) => finish(`play-error ${playErr}`));
        }
      });

      setRecordingProgress(99);
      if (recorder.state !== "inactive") recorder.stop();
      video.pause();
      video.loop = true;
      video.muted = isMuted;
      setIsVideoPlaying(false);

      const blob = await finished;
      if (isCancelledRef.current) return;
      stream.getVideoTracks().forEach((track) => track.stop());
      const url = URL.createObjectURL(blob);
      const sizeFormatted =
        blob.size < 1024 * 1024
          ? `${Math.round(blob.size / 1024)} KB`
          : `${(blob.size / (1024 * 1024)).toFixed(1)} MB`;
      setExportedVideoSize(sizeFormatted);
      setExportedVideoUrl(url);
      setRecordingProgress(100);
      triggerDownload(url, filename);
      // El cierre estaba activado pero no llegó a pintarse: el archivo sale con
      // la longitud del clip y sin el sello. Se avisa aquí para que no se
      // descubra al subirlo, en lugar de fallar en silencio.
      const outroNote =
        videoOutro && !outroDrew
          ? outroEntered
            ? " ⚠️ El cierre BlackNews se quedó a medias: se exportó sin el sello final."
            : " ⚠️ El cierre BlackNews no pudo arrancar: se exportó sin el sello final."
          : "";
      showToast(
        `¡Video ${postFormat} exportado en tu navegador (${sizeFormatted})!${formatNote}${warnNote}${outroNote}`,
      );
    } catch (err: any) {
      if (!isCancelledRef.current) {
        console.error("Error exportando video:", err);
        showToast(
          err?.message || "No se pudo exportar el video en el navegador.",
        );
      }
    } finally {
      isRecordingRef.current = false;
      setIsRecordingVideo(false);
      setRecordingProgress(0);
      setRecordingPaused(false);
      // Devuelve el estado de audio normal aunque la exportación falle.
      video.muted = isMuted;
      // El cartel del aviso puede quedar a media reproducción: se aparca.
      try {
        warningRef.current?.pause();
      } catch {}
      warningActiveRef.current = false;
      setWarningActive(false);
      setWarningFrameActive(false);
      // Apaga el tema si la exportación se cortó antes de que lo hicieran
      // `finish`/`enterOutro` (un lazo sonando en segundo plano no sirve de nada).
      try {
        if (themeNode) themeNode.stop();
      } catch {}
      themeNode = null;
      themeGain = null;
      themeCtx = null;
      try {
        if (timerWorker) timerWorker.terminate();
        if (workerUrl) URL.revokeObjectURL(workerUrl);
      } catch {}
      liveStream?.getVideoTracks().forEach((track) => track.stop());
    }
  };

  // Real-time proportional metrics for live preview (canvas: 1080px wide;
  // la tarjeta mide 480 px en 16:9, 420 px en 4:5 y 340 px en 9:16 para no
  // disparar en alto).
  // Valores fraccionales exactos: al redondear, la vista previa partía las
  // líneas en sitios distintos a los del archivo exportado.
  const previewCardWidth = previewCardWidthFor(postFormat);
  const previewScale = previewCardWidth / 1080;
  // Ancho REAL de la tarjeta de vista previa. El formato TV escala un lienzo
  // fijo de 1920 px, así que con este medidor el conjunto nunca se recorta
  // cuando el contenedor es más estrecho que el ancho máximo (móvil).
  const [previewCardElW, setPreviewCardElW] = useState(previewCardWidth);
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setPreviewCardElW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Intro TV en la vista previa ──────────────────────────────────────────
  // La intro es una pasada propia: al arrancar el vídeo parte desde su
  // principio (sin sonido ni color) y, al terminar la intro, vuelve a empezar
  // en color y con sonido. El reloj acumula tiempo de reproducción en vivo —
  // no el currentTime, que vuelve a 0 en cada vuelta o en el reinicio — y
  // queda latcheado al final de la intro para que no se repita sola.
  const [tvIntroT, setTvIntroT] = useState(0);
  const tvIntroDoneRef = useRef(false);
  const tvIntroAccumRef = useRef(0);
  const tvIntroWallRef = useRef(0);
  // Instante (ms de performance.now) en que terminó la última pasada de intro:
  // el reloj del fade «texto → vídeo» lo mide desde aquí, porque el propio
  // currentTime del vídeo vuelve a 0 al reiniciarse (así el texto se oculta
  // aunque el elemento esté de nuevo en el principio).
  const introEndWallRef = useRef(0);
  // Instante (ms de performance.now) en que empezó el fade del texto: el reloj
  // del fade es de pared (no del currentTime) porque, al reiniciarse el vídeo,
  // currentTime vuelve a 0 y el progreso retrocedería.
  const fadeStartWallRef = useRef(0);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const updateIntroClock = (v: HTMLVideoElement) => {
    if (isRecordingRef.current) return;
    // Los tres formatos comparten la misma pasada de intro que ya exporta la
    // ruta de vídeo (silencio durante tvIntroDur y reinicio en trimStart); el
    // poddcast, en cambio, nunca la suma.
    if (!tvIntro || mediaType !== "video" || postDesign === "podcast")
      return;
    if (tvIntroDoneRef.current) {
      // Intro terminada: el vídeo ya reinició; el reloj se queda al final y
      // el elemento se sincroniza con el silencio elegido por el usuario.
      if (v.muted !== isMutedRef.current) v.muted = isMutedRef.current;
      setTvIntroT((prev) => (prev >= tvIntroDur ? prev : tvIntroDur));
      return;
    }
    const now = performance.now();
    const last = tvIntroWallRef.current || now;
    tvIntroWallRef.current = now;
    if (!v.paused && !v.ended) {
      // Tope de 250 ms para que un rAF atrasado (o el respaldo ~4 Hz de
      // timeupdate) no dispare el salto de la intro.
      tvIntroAccumRef.current += Math.min(250, now - last) / 1000;
    }
    const acc = tvIntroAccumRef.current;
    if (acc >= tvIntroDur) {
      // Fin de la intro: el vídeo vuelve a empezar con color y con sonido.
      tvIntroDoneRef.current = true;
      introEndWallRef.current = performance.now();
      v.currentTime = trimStart;
      v.muted = isMutedRef.current;
      setTvIntroT(tvIntroDur);
      return;
    }
    v.muted = true;
    setTvIntroT((prev) => (Math.abs(prev - acc) >= 0.02 ? acc : prev));
  };

  useEffect(() => {
    if (!tvIntro || mediaType !== "video" || postDesign === "podcast") return;
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      updateIntroClock(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postFormat, postDesign, tvIntro, mediaType, trimStart, tvIntroDur]);

  // Arranque de la intro: el vídeo parte desde su principio y en silencio;
  // al terminar, el reloj de arriba lo reinicia en color y con sonido. Se
  // rearma al activar la intro, cambiar de formato, cambiar la duración
  // o cargar otro vídeo: cada activación repite la pasada completa.
  useEffect(() => {
    if (!tvIntro || mediaType !== "video" || postDesign === "podcast") return;
    if (isRecordingRef.current) return;
    tvIntroDoneRef.current = false;
    tvIntroAccumRef.current = 0;
    tvIntroWallRef.current = 0;
    introEndWallRef.current = 0;
    setTvIntroT(0);
    const v = videoRef.current;
    if (v) {
      if (Math.abs(v.currentTime - trimStart) > 0.05) v.currentTime = trimStart;
      v.muted = true;
      // «Cuando arranque la intro, arranca el vídeo»: con la intro armada la
      // reproducción arranca aunque el elemento estuviera pausado.
      v.play().catch(() => {});
    }
    return () => {
      // Al desarmarse se restaura el silencio elegido por el usuario.
      const el = videoRef.current;
      if (el && !isRecordingRef.current) el.muted = isMutedRef.current;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvIntro, postFormat, postDesign, mediaType, mediaSrc, tvIntroDur]);

  // Portada del aviso en «Primer/Último fotograma»: el archivo pinta el frame
  // crudo a sangre (paintOutroFrame: encuadre «contain» sobre negro, sin
  // filtros, sin escala y sin overlays), así que durante esos 3 s la vista
  // previa sube el media por encima de la composición y lo encaja igual, para
  // no prometer una portada con titular que el MP4 no lleva. Sólo aplica al
  // vídeo de noticias: en podcast el archivo también pinta la composición y
  // en audio no hay frame crudo que mostrar.
  const warningCoverClean =
    warningFrameActive &&
    warningFrameOrigin !== "cover" &&
    mediaType === "video" &&
    postDesign !== "podcast";
  // Fase de la intro para la vista previa: con vídeo se sigue el tiempo real;
  // con imagen se pinta el estado "HOLD" (el mismo que exporta el PNG). Sólo
  // la señal de TV 16:9 lleva chyron y fases animadas; en 4:5 y 9:16 la intro
  // es la misma pasada muda con reinicio, pero sin overlay de TV. Durante la
  // portada del aviso se fuerza el HOLD: la exportación pinta la portada en
  // ese mismo estado (el del PNG), con el titular ya desplegado.
  const tvPhaseT =
    postFormat === "16:9" && tvIntro
      ? warningFrameActive || mediaType !== "video"
        ? tvIntroDur * 0.5
        : tvIntroT
      : null;
  const tvInIntro = tvPhaseT !== null && tvPhaseT < tvIntroDur;
  const tvExitQ = tvInIntro ? tvIntroExit(tvPhaseT as number, tvIntroDur) : 0;
  const tvBoxIn = tvInIntro ? tvIntroBoxIn(tvPhaseT as number) : 1;
  const tvTagP = tvInIntro ? tvIntroTagIn(tvPhaseT as number) : 1;
  // El chyron sólo existe durante la intro: al terminar queda vídeo limpio.
  const tvShowChyron = !tvIntro || tvInIntro;
  // Filtro del media: intro = sin color; tras la intro = color original
  // (sólo ajuste tonal), como pidió el usuario. Sólo la señal de TV se
  // desatura: el export 4:5/9:16 pinta su pasada de intro en color.
  const mediaFilterCss =
    !tvIntro || postFormat !== "16:9"
      ? getFilterCss()
      : tvInIntro
        ? `${getFilterCss()} grayscale(100%)`
        : getFilterCss(true);

  // ── Marquee del ticker en la vista previa ────────────────────────────────
  // La celda (marca + titular + países) se mide en px de lienzo 1920 para
  // que la animación CSS recorra exactamente a TV_TICKER_SPEED px/s: la
  // misma velocidad que aplica el lienzo exportado por segundo de salida.
  const tickerCellRef = useRef<HTMLDivElement>(null);
  const [tickerCellW, setTickerCellW] = useState(0);
  const tvTickerKey = tvTickerItems
    .map((it) =>
      typeof it === "string"
        ? it
        : it.map((seg) => `${seg.code ?? ""}\u0001${seg.text}`).join("\u0002"),
    )
    .join("\u0000");
  useEffect(() => {
    const el = tickerCellRef.current;
    if (!el) return;
    const measure = () => setTickerCellW(el.offsetWidth);
    measure();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    ro?.observe(el);
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    return () => ro?.disconnect();
  }, [tvTickerKey, postFormat]);
  const tickerMarqueeDur = tickerCellW > 0 ? tickerCellW / TV_TICKER_SPEED : 20;

  const previewTitleSize = fontSizeTitle * previewScale;
  const previewDescSize = fontSizeDesc * previewScale;
  const padTopCanvas = postFormat === "9:16" ? PAD_TOP_9X16 : 76;
  const previewPadTop = padTopCanvas * previewScale;
  const previewPadRight =
    (postFormat === "9:16" ? PAD_RIGHT_9X16 : 84) * previewScale;
  // Columna idéntica a la del export: 912 px en 4:5 · 856 px seguros en 9:16.
  const textColumnWidth =
    postFormat === "9:16" ? 1080 - 84 - PAD_RIGHT_9X16 : TEXT_COLUMN_WIDTH;
  const previewPadX = 84 * previewScale;
  const previewGapCatTitle = gapCategoryToTitle * previewScale;
  const previewGapTitleDesc = gapTitleToDesc * previewScale;
  // Altura de línea: la misma del lienzo (entera) llevada a escala de tarjeta
  const previewTitleLineH =
    Math.round(fontSizeTitle * titleLineHeightRatio) * previewScale;
  const previewDescLineH =
    Math.round(fontSizeDesc * descLineHeightRatio) * previewScale;

  // Líneas idénticas a las del export: se miden con la métrica real del
  // lienzo (Lexend Bold/Regular, columna real según formato, sin tracking) y
  // aquí solo se pintan, así titular y bajada cortan igual que en el archivo.
  const previewTitleLines = wrapLikeExport(
    `700 ${fontSizeTitle}px 'Lexend', sans-serif`,
    title || "Escribe un titular impactante...",
    textColumnWidth,
  );
  const previewDescLines = description.trim()
    ? capDescLines(
        wrapLikeExport(
          `400 ${fontSizeDesc}px 'Lexend', sans-serif`,
          description,
          textColumnWidth,
        ),
      )
    : [];

  // Inicio de la foto: replica el recorrido de curY del export (padTop →
  // cabecera → insignia → titular → bajada → 40 px de aire) y aplica el mismo
  // suelo (30 % del alto en 9:16). En 4:5 se conserva el 40 % fijo de siempre.
  const previewTextEndCanvas =
    padTopCanvas +
    (autoFitHeader ? 20 : headerSize) +
    gapCategoryToTitle +
    (countryPlacement === "badge" && selectedCountries.length > 0
      ? 18 + gapCategoryToTitle
      : 0) +
    previewTitleLines.length *
      Math.round(fontSizeTitle * titleLineHeightRatio) +
    gapTitleToDesc +
    (description.trim()
      ? previewDescLines.length * Math.round(fontSizeDesc * descLineHeightRatio)
      : 0) +
    40;
  const previewMediaTopPct =
    postFormat === "9:16"
      ? (Math.max(previewTextEndCanvas, POST_H * MEDIA_FLOOR_RATIO_9X16) /
          POST_H) *
        100
      : 40;

  // Dynamic header sizing calculation to strictly fit in ONE single line
  const countriesLineText =
    countryPlacement === "line" ? getFormattedCountries() : "";
  const headerTotalLength =
    (category || "GEOPOLÍTICA").length +
    (countriesLineText ? countriesLineText.length + 3 : 0);

  let previewHeaderSize = autoFitHeader
    ? headerTotalLength > 48
      ? 8
      : headerTotalLength > 36
        ? 9
        : headerTotalLength > 24
          ? 10
          : 11.5
    : Math.max(8, Math.round(headerSize * previewScale * 10) / 10);

  let previewHeaderTracking =
    previewHeaderSize < 9.5
      ? "0.04em"
      : previewHeaderSize < 11
        ? "0.08em"
        : "0.14em";

  // Filtered countries for search (catálogo amplio + personalizados;
  // la búsqueda ignora acentos y también casa por código ISO)
  // El cierre sólo existe con media de vídeo y con el interruptor encendido:
  // al apagarlo (o al cambiar a imagen) se corta de inmediato, por si estaba
  // reproduciéndose en la vista previa.
  useEffect(() => {
    if (videoOutro && exportsVideo) return;
    const el = outroRef.current;
    if (el) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {}
    }
    if (outroActiveRef.current) {
      outroActiveRef.current = false;
      setOutroActive(false);
      const main = activeMediaEl();
      if (main && !isRecordingRef.current) main.play().catch(() => {});
    }
  }, [videoOutro, mediaType]);

  // Con el aviso apagado (o al cambiar de medio) se corta cualquier fase en
  // marcha: la portada no puede quedarse congelada sobre la tarjeta.
  useEffect(() => {
    cancelPreviewWarning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentWarning, mediaType]);

  const filteredCountries = searchCountries(countrySearch, countryCatalog);

  // ── Cierre de marca en la vista previa ──
  // Al llegar al final del recorte, la tarjeta pasa al sello BlackNews y el
  // clip queda en pausa detrás (nunca a la vez: sería doble audio). Con el
  // cierre apagado, o si el <video> aún no tiene metadatos, el bucle de
  // siempre. Nunca actúa mientras exporta: allí manda el grabador.
  const endPreviewOutro = () => {
    if (!outroActiveRef.current) return;
    outroActiveRef.current = false;
    setOutroActive(false);
    const main = activeMediaEl();
    if (main) {
      if (trimEnd > trimStart) main.currentTime = trimStart;
      main.play().catch(() => {});
    }
    setIsVideoPlaying(true);
  };
  const startPreviewOutro = (): boolean => {
    if (outroActiveRef.current) return true;
    const el = outroRef.current;
    if (!el || el.readyState < 1) return false;
    outroActiveRef.current = true;
    setOutroActive(true);
    el.muted = isMuted;
    try {
      el.currentTime = 0;
    } catch {}
    el.play().catch(() => {});
    activeMediaEl()?.pause();
    setIsVideoPlaying(true);
    return true;
  };

  // ─── Aviso de contenido sensible en la vista previa ───────────────────────
  // Secuencia al arrancar desde el principio con el interruptor encendido:
  // portada de 3 s (la miniatura que ven las redes) → cartel
  // Blacknews-Advertencia.mp4 → clip desde trimStart. La portada se pausa y
  // se reanuda con el mismo botón de play; un salto manual la cancela.
  const cancelPreviewWarning = () => {
    // Durante la exportación manda el grabador (usa el mismo <video>).
    if (isRecordingRef.current) return;
    if (warningFrameTimerRef.current) {
      window.clearTimeout(warningFrameTimerRef.current);
      warningFrameTimerRef.current = 0;
    }
    warningFrameActiveRef.current = false;
    setWarningFrameActive(false);
    if (warningActiveRef.current) {
      warningActiveRef.current = false;
      setWarningActive(false);
    }
    const el = warningRef.current;
    if (el) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {}
    }
  };
  /** Fin del aviso (cartel terminado o inutilizable): arranca el clip. */
  const endPreviewWarning = () => {
    if (warningFrameTimerRef.current) {
      window.clearTimeout(warningFrameTimerRef.current);
      warningFrameTimerRef.current = 0;
    }
    warningFrameActiveRef.current = false;
    setWarningFrameActive(false);
    warningActiveRef.current = false;
    setWarningActive(false);
    const el = warningRef.current;
    if (el) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {}
    }
    // Al terminar el aviso, arranca el clip desde trimStart: la portada pudo
    // dejarlo aparcado al final del recorte («Último fotograma»).
    const main = activeMediaEl();
    if (main) {
      const dur = videoDuration || main.duration || 0;
      const lo = trimEnd > trimStart ? trimStart : 0;
      const hi = trimEnd > trimStart ? trimEnd : dur;
      if (main.currentTime < lo || main.currentTime > Math.max(hi - 0.1, lo)) {
        try {
          main.currentTime = lo;
        } catch {}
      }
      main.play().catch(() => {});
    }
    setIsVideoPlaying(true);
  };
  /** Portada agotada: entra el cartel (o se salta al clip si no puede). */
  const showWarningCard = () => {
    warningFrameTimerRef.current = 0;
    warningFrameActiveRef.current = false;
    setWarningFrameActive(false);
    const el = warningRef.current;
    if (!el || el.readyState < 1) {
      endPreviewWarning();
      return;
    }
    if (!warningActiveRef.current) {
      warningActiveRef.current = true;
      setWarningActive(true);
      el.muted = isMuted;
      try {
        el.currentTime = 0;
      } catch {}
      el.play().catch(() => endPreviewWarning());
    }
    activeMediaEl()?.pause();
    setIsVideoPlaying(true);
  };
  /** Arranca la secuencia (portada → cartel). false si no procede. */
  const startPreviewWarning = (): boolean => {
    if (warningActiveRef.current || warningFrameActiveRef.current) return true;
    if (!contentWarning || !exportsVideo) return false;
    const el = warningRef.current;
    const main = activeMediaEl();
    if (!el || !main) return false;
    // Portada: el clip queda en pausa sobre el frame elegido durante 3 s.
    main.pause();
    // La portada se pinta como contenido en 0 (titular entero, como en el
    // archivo): el reloj del fundido «texto → vídeo» se reinicia para que un
    // fade anterior no siga corriendo en pausa y me desvanezca el bloque.
    fadeStartWallRef.current = 0;
    setTextFadeP(0);
    const dur = videoDuration || main.duration || 0;
    const target =
      warningFrameOrigin === "last" && dur > 0
        ? Math.max(0, Math.min(trimEnd > trimStart ? trimEnd : dur, dur) - 0.05)
        : trimStart;
    if (Math.abs(main.currentTime - target) > 0.05) {
      try {
        main.currentTime = target;
      } catch {}
    }
    warningFrameActiveRef.current = true;
    setWarningFrameActive(true);
    setIsVideoPlaying(true);
    warningFrameRemainRef.current = warningFrameDur * 1000;
    warningFrameEndRef.current =
      performance.now() + warningFrameRemainRef.current;
    warningFrameTimerRef.current = window.setTimeout(
      showWarningCard,
      warningFrameRemainRef.current,
    );
    return true;
  };

  // ── Desplazamiento manual en la vista previa ──
  // Barra de posición y botones ±: la búsqueda cierra el sello si estaba en
  // pantalla y respeta el estado de reproducción. Fuera del rango de recorte
  // el clip queda en pausa sobre ese fotograma (así se inspecciona y se
  // fija el inicio/fin); al volver a dar a play se entra al rango exportado.
  const fmtClock = (t: number) => {
    const d = Math.max(0, Math.floor(t * 10));
    const m = Math.floor(d / 600);
    // toFixed antes de rellenar: sin él, 6 s daría "6" y el relleno
    // escribiría «0006» en vez de «06.0».
    return `${String(m).padStart(2, "0")}:${((d % 600) / 10).toFixed(1).padStart(4, "0")}`;
  };

  /** Escribe contador (y barra, salvo mientras se arrastra) en el DOM. */
  const writePreviewPos = (raw: number, setInput: boolean) => {
    const label = previewTimeRef.current;
    const input = previewPosRef.current;
    const v = activeMediaEl();
    const dur = videoDuration || (v ? v.duration : 0) || 0;
    const t = Math.min(Math.max(raw, 0), dur);
    if (input) {
      const max = String(Math.max(0.1, dur));
      if (input.max !== max) input.max = max;
      if (setInput) input.value = String(t);
    }
    if (label) label.textContent = `${fmtClock(t)} / ${fmtClock(dur)}`;
    previewPosLastRef.current = t;
  };

  // Sincronización con la reproducción: la llama el rAF (suave) y también
  // timeupdate (~4 Hz), porque el navegador baja el rAF a 1 Hz con la
  // ventana oculta y así barra y contador siguen al vídeo igualmente.
  const syncPreviewPos = () => {
    if (scrubbingRef.current || isRecordingRef.current) return;
    const v = activeMediaEl();
    if (!v) return;
    if (Math.abs(v.currentTime - previewPosLastRef.current) < 0.02) return;
    writePreviewPos(v.currentTime, true);
  };

  const seekPreview = (target: number) => {
    const v = activeMediaEl();
    if (!v || isRecordingRef.current) return;
    const dur = videoDuration || v.duration || 0;
    if (!(dur > 0)) return;
    const t = Math.min(Math.max(target, 0), Math.max(0, dur - 0.05));
    const lo = trimEnd > trimStart ? trimStart : 0;
    const hi = trimEnd > trimStart ? trimEnd : dur;
    const inRange = t >= lo && t < hi;
    const wasOutro = outroActiveRef.current;
    // Un salto manual cancela el aviso en curso (portada o cartel): manda la
    // barra, no la secuencia.
    const wasWarning =
      warningActiveRef.current || warningFrameActiveRef.current;
    if (wasWarning) cancelPreviewWarning();
    if (wasOutro) {
      outroActiveRef.current = false;
      setOutroActive(false);
      const o = outroRef.current;
      if (o) {
        try {
          o.pause();
          o.currentTime = 0;
        } catch {}
      }
    }
    v.currentTime = t;
    // Con la barra arrastrada el valor del <input> ya lo pinta el navegador:
    // ahí sólo se mueve el contador.
    writePreviewPos(t, !scrubbingRef.current);
    // Con la barra arrastrada quién decide al soltar es endScrub.
    if (scrubbingRef.current) return;
    // Fuera del recorte se inspecciona el fotograma (aunque viniera del
    // cierre); dentro, el sello cierra y el clip vuelve a la vida.
    if (!inRange) {
      v.pause();
      setIsVideoPlaying(false);
    } else if (wasOutro || wasWarning) {
      v.play().catch(() => {});
      setIsVideoPlaying(true);
    }
  };

  const nudgePreview = (delta: number) => {
    const v = activeMediaEl();
    if (v) seekPreview(v.currentTime + delta);
  };

  // Arranque y suelte de la barra: se pausa mientras se arrastra (la
  // posición no se escapa de las manos) y, al soltar, sólo se retoma si el
  // destino cae dentro del recorte.
  const startScrub = () => {
    const v = activeMediaEl();
    if (!v || isRecordingRef.current) return;
    // Arrastrar la barra corta el aviso en marcha: decide la posición manual.
    cancelPreviewWarning();
    scrubbingRef.current = true;
    scrubResumeRef.current = outroActiveRef.current || !v.paused;
    if (!v.paused) {
      v.pause();
      setIsVideoPlaying(false);
    }
  };
  const endScrub = () => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    // Sin movimiento (la barra no emitió input): el sello sigue mandando.
    if (outroActiveRef.current) return;
    const v = activeMediaEl();
    if (!v || isRecordingRef.current) return;
    const dur = videoDuration || v.duration || 0;
    const lo = trimEnd > trimStart ? trimStart : 0;
    const hi = trimEnd > trimStart ? trimEnd : dur;
    if (scrubResumeRef.current && v.currentTime >= lo && v.currentTime < hi) {
      v.play().catch(() => {});
      setIsVideoPlaying(true);
    } else {
      setIsVideoPlaying(false);
    }
    // Barra y contador vuelven a seguimiento normal tras el arrastre.
    previewPosLastRef.current = -1;
    syncPreviewPos();
  };

  // Play/pause único de la vista previa (fila bajo la tarjeta, vale para
  // los tres formatos): con el sello en pantalla gobierna el cierre.
  const togglePreviewPlay = () => {
    if (isRecordingRef.current) return;
    if (outroActiveRef.current) {
      const o = outroRef.current;
      if (!o) return;
      if (o.paused) {
        o.play().catch(() => {});
        setIsVideoPlaying(true);
      } else {
        o.pause();
        setIsVideoPlaying(false);
      }
      return;
    }
    // El aviso (portada o cartel) manda mientras dure: el botón lo pausa y
    // lo reanuda con su propio reloj (la portada guarda los ms restantes).
    if (warningActiveRef.current || warningFrameActiveRef.current) {
      if (isVideoPlaying) {
        if (warningFrameActiveRef.current) {
          if (warningFrameTimerRef.current) {
            window.clearTimeout(warningFrameTimerRef.current);
            warningFrameTimerRef.current = 0;
          }
          warningFrameRemainRef.current = Math.max(
            0,
            warningFrameEndRef.current - performance.now(),
          );
        } else {
          warningRef.current?.pause();
        }
        setIsVideoPlaying(false);
      } else if (warningFrameActiveRef.current) {
        const remain =
          warningFrameRemainRef.current > 0
            ? warningFrameRemainRef.current
            : warningFrameDur * 1000;
        warningFrameEndRef.current = performance.now() + remain;
        warningFrameTimerRef.current = window.setTimeout(
          showWarningCard,
          remain,
        );
        setIsVideoPlaying(true);
      } else {
        warningRef.current?.play().catch(() => endPreviewWarning());
        setIsVideoPlaying(true);
      }
      return;
    }
    const v = activeMediaEl();
    if (!v) return;
    if (v.paused) {
      // Arranque desde el principio con el aviso encendido: portada + cartel
      // antes que el clip, igual que saldrá en el archivo exportado. Una
      // reproducción que se reanuda un poco más adelante no repite el aviso.
      const lo = trimEnd > trimStart ? trimStart : 0;
      if (
        contentWarning &&
        exportsVideo &&
        v.currentTime <= lo + 0.1 &&
        startPreviewWarning()
      )
        return;
      v.play().catch(() => {});
      setIsVideoPlaying(true);
    } else {
      v.pause();
      setIsVideoPlaying(false);
    }
  };

  // Seguimiento de posición: barra y contador se actualizan en el DOM a
  // velocidad de fotograma. Nunca con la barra arrastrada ni durante la
  // exportación (allí el grabador es el que mueve el currentTime); timeupdate
  // cubre el caso de rAF reducido a 1 Hz con la ventana oculta.
  useEffect(() => {
    if (mediaType !== "video") return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      syncPreviewPos();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, videoDuration]);

  // Cuándo se ve la tarjeta del tweet en vídeo: se resuelve con un reloj rAF
  // que sólo llama a `setState` al cruzar el umbral (el resto de fotogramas
  // no re-renderiza nada). Sin tweet, sin vídeo o con el modo «todo», la
  // tarjeta está siempre visible.
  useEffect(() => {
    const wanted =
      (!tweetText && !tweetHtml) ||
      mediaType !== "video" ||
      postDesign === "podcast" ||
      tweetShowMode === "always";
    if (wanted) {
      setTweetOn(true);
      return;
    }
    let raf = 0;
    const speed = videoSpeed > 0 ? videoSpeed : 1;
    const clipDur =
      trimEnd > trimStart ? (trimEnd - trimStart) / speed : videoDuration;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = videoRef.current;
      if (!v) return;
      const contentT = Math.max(0, (v.currentTime - trimStart) / speed);
      const on = tweetShownAt(tweetShowMode, tweetShowSecs, contentT, clipDur);
      setTweetOn((prev) => (prev === on ? prev : on));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tweetText,
    tweetHtml,
    mediaType,
    postDesign,
    tweetShowMode,
    tweetShowSecs,
    trimStart,
    trimEnd,
    videoSpeed,
    videoDuration,
  ]);

  // Reloj de la transición «texto → vídeo» (4:5 y 9:16): mientras el vídeo
  // corre, el bloque de texto se desvanece pasado `textFadeOutDur` s y la foto
  // sube hasta ocupar la tarjeta entera; al dar la vuelta del lazo el titular
  // vuelve. Durante la pasada de intro el bloque NO se desvanece (el export
  // cuenta ese tramo como contenido en 0). Con imagen (sin reloj) el texto
  // queda fijo, igual que en el PNG exportado.
  useEffect(() => {
    if (
      (postFormat !== "4:5" && postFormat !== "9:16") ||
      !textFadeOut ||
      mediaType !== "video" ||
      postDesign === "podcast"
    ) {
      setTextFadeP(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = videoRef.current;
      if (!v) return;
      // Tiempo de contenido: mientras el texto está visible se mide con el
      // currentTime; cuando empieza a desvanecerse se reinicia el vídeo y el
      // reloj pasa a ser de pared, manteniendo la continuidad del fade.
      let contentTime: number;
      if (fadeStartWallRef.current > 0) {
        contentTime = (performance.now() - fadeStartWallRef.current) / 1000 + textFadeOutDur;
      } else {
        contentTime = Math.max(0, v.currentTime - trimStart);
      }
      const p = clamp01((contentTime - textFadeOutDur) / TEXT_FADE_MOVE);
      // Al cruzar el umbral (texto empieza a irse): reiniciar video y arrancar
      // el reloj de pared con la continuidad exacta del momento.
      if (p > 0 && fadeStartWallRef.current === 0) {
        fadeStartWallRef.current = performance.now() - textFadeOutDur * 1000;
        if (Math.abs(v.currentTime - trimStart) > 0.05) v.currentTime = trimStart;
        v.play().catch(() => {});
      }
      if (p === 0 && fadeStartWallRef.current > 0) {
        fadeStartWallRef.current = 0;
      }
      // Sólo se re-renderiza cuando el progreso avanza de verdad (los extremos
      // 0 y 1 siempre se aplican, para no quedarse pegados a un paso previo).
      setTextFadeP((prev) =>
        p === prev
          ? prev
          : p === 0 || p === 1 || Math.abs(p - prev) >= 0.02
            ? p
            : prev,
      );
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postFormat, textFadeOut, mediaType, trimStart, textFadeOutDur, postDesign]);

  // Estilo compartido de los botones de salto de la fila de transporte:
  // minimalista, sin bordes duros, sólo contraste al pasar el cursor.
  const seekBtnCls =
    "p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:pointer-events-none";

  // Elemento de media de la vista previa: un único <video>/<img> compartido
  // por los formatos 4:5/9:16 y por el 16:9 de TV, para que videoRef siga
  // apuntando siempre al preview (la exportación PNG lee el mismo elemento).
  const previewMediaEl =
    mediaType === "video" ? (
      <video
        ref={videoRef}
        src={mediaSrc}
        crossOrigin={
          mediaSrc.startsWith("blob:") || mediaSrc.startsWith("data:")
            ? undefined
            : "anonymous"
        }
        autoPlay
        loop
        muted={isMuted}
        playsInline
        style={{
          // Portada cruda del aviso: el archivo pinta el frame tal cual sale
          // del decodificador (sin filtro, «contain» sobre negro); el media
          // sube a z-1 para quedar por encima de los velos de su capa.
          filter: warningCoverClean ? "none" : mediaFilterCss,
          objectFit: warningCoverClean ? "contain" : "cover",
          backgroundColor: warningCoverClean ? "#000000" : undefined,
          position: warningCoverClean ? "relative" : undefined,
          zIndex: warningCoverClean ? 1 : undefined,
        }}
        className="w-full h-full object-cover"
        onLoadedMetadata={(e) => {
          const dur = Math.round((e.currentTarget.duration || 0) * 10) / 10;
          if (dur > 0) {
            setVideoDuration(dur);
            if (trimEnd === 0 || trimEnd > dur) {
              setTrimEnd(dur);
            }
          }
        }}
        onTimeUpdate={(e) => {
          // Durante la exportación no se recorta: el límite lo marca el grabador
          if (isRecordingRef.current) return;
          const v = e.currentTarget;
          // Pausado = fotograma en inspección: ni el lazo ni el sello tocan la
          // posición. Así una búsqueda manual fuera del recorte se queda donde
          // está en lugar de ser arrastrada de vuelta al rango (y al reproducir
          // vuelve a entrar en él, que es lo que exporta).
          if (!v.paused && trimEnd > trimStart) {
            if (v.currentTime >= trimEnd) {
              // Con cierre activo, el final del recorte abre el sello. En la
              // pasada de intro todavía no: esa primera vuelta es muda y, si
              // el clip es más corto que la intro, se da otra vuelta.
              const introLooming =
                tvIntro &&
                postDesign !== "podcast" &&
                !tvIntroDoneRef.current;
              if (videoOutro && !introLooming && startPreviewOutro()) return;
              v.currentTime = trimStart;
            } else if (v.currentTime < trimStart) {
              v.currentTime = trimStart;
            }
          }
          // Respaldo del seguimiento de la intro TV: el rAF puede caer a 1 Hz
          // en segundo plano y timeupdate llega ~4 veces por segundo.
          updateIntroClock(v);
          // Barra y contador: el mismo respaldo para la posición.
          syncPreviewPos();
        }}
      />
    ) : (
      <img
        src={mediaSrc}
        alt="Post preview"
        style={{ filter: mediaFilterCss }}
        className="w-full h-full object-cover"
      />
    );

  // El hueco inferior deja sitio a la barra flotante del asistente y a su
  // panel de contexto: crece con la altura real del panel (que el usuario
  // puede estirar), para que nada quede tapado ni inalcanzable detrás.
  // ── Vista previa del post-podcast ──
  // Se pinta con el MISMO drawPodcastFrame del archivo exportado, en un lienzo
  // real escalado a tamaño de tarjeta: lo que se ve es literalmente el frame
  // que saldrá, onda y reloj incluidos. El rAF sólo repinta cuando avanza el
  // reloj del medio, así que en pausa la tarjeta no gasta.
  const podcastCanvasRef = useRef<HTMLCanvasElement>(null);
  const podcastRenderRef = useRef<() => void>(() => {});
  // Banderas del pie, cargadas con el mismo pipeline que el resto de formatos.
  const [podcastFlags, setPodcastFlags] = useState<
    Array<{ code: string; img: HTMLImageElement | null; text: string }>
  >([]);
  useEffect(() => {
    if (postDesign !== "podcast") return;
    let dead = false;
    void (async () => {
      const data = await Promise.all(
        selectedCountries.map(async (c) => ({
          code: c.code,
          img: (countryFormat !== "names" || postDesign === "podcast")
            ? await loadFlagImage(c.code)
            : null,
          text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
        })),
      );
      if (!dead) setPodcastFlags(data);
    })();
    return () => {
      dead = true;
    };
  }, [postDesign, countryFormat, selectedCountries]);

  // Las formas de ubicación extra (arriba dcha., bajo titular y pie) sólo
  // existen en el podcast: al volver a noticias se restaura la barra
  // superior, que es una de las tres formas que el modo noticia pinta.
  useEffect(() => {
    if (
      postDesign !== "podcast" &&
      PODCAST_ONLY_PLACEMENTS.includes(countryPlacement)
    ) {
      setCountryPlacement("line");
    }
  }, [postDesign, countryPlacement]);

  const paintPodcastPreview = () => {
    const canvas = podcastCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const el = activeMediaEl();
    const cur = el ? Math.max(0, el.currentTime - trimStart) : 0;
    // Fondo: el vídeo a sangre, o la imagen plana (en audio puro, la <audio>
    // no aporta píxeles y el pintor se queda en negro absoluto).
    const bgEl: HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null =
      mediaType === "audio" ? podcastBgRef.current : videoRef.current;
    drawPodcastFrame(ctx, {
      mediaElement: bgEl ?? undefined,
      outTime: cur,
      playing: !!el && !el.paused,
      flagsData: podcastFlags,
    });
  };
  podcastRenderRef.current = paintPodcastPreview;

  // Reloj de la vista previa: repinta sólo cuando cambia el tiempo de
  // reproducción (en pausa la tarjeta se queda en su fotograma).
  useEffect(() => {
    if (postDesign !== "podcast") return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = activeMediaEl();
      const t = el ? el.currentTime : 0;
      if (Math.abs(t - last) < 0.02) return;
      last = t;
      podcastRenderRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [postDesign, mediaType]);

  // Cambios estáticos (titular, onda, fondo, banderas, formato…): repintado
  // inmediato, sin esperar a que se mueva el reloj.
  useEffect(() => {
    if (postDesign !== "podcast") return;
    podcastRenderRef.current();
  }, [
    postDesign,
    mediaType,
    podcastFlags,
    audioPeaks,
    title,
    description,
    category,
    podcastSeries,
    podcastEpisode,
    podcastAutoTitle,
    podcastBgSrc,
    countryPlacement,
    countryFormat,
    selectedCountries,
    podcastFlagStyle,
    gapCategoryToTitle,
    trimStart,
    trimEnd,
    videoDuration,
    postFormat,
    filter,
    brightness,
    contrast,
    mediaZoom,
    mediaOffsetX,
    mediaOffsetY,
  ]);

  return (
    <div
      className="font-['Lexend',sans-serif] space-y-8"
      style={{
        paddingBottom: aiComposerOpen
          ? `calc(var(--bn-nav-h) + ${aiComposerH + 76}px)`
          : "calc(var(--bn-nav-h) + 4.5rem)",
      }}
    >
      {/* Franja de procedencia OSINT: conserva el enlace del hallazgo
          importado mientras el editor trabaja (no forma parte del JSON
          del borrador). Se cierra sin tocar los campos ya precompletados. */}
      {osintSource && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-200">
          <span className="font-bold uppercase tracking-wider">Hallazgo OSINT importado</span>
          <span className="text-neutral-300">
            {osintSource.name}
            {osintSource.publishedAt
              ? ` · publicado ${new Date(osintSource.publishedAt).toLocaleDateString("es-UY")}`
              : ""}
          </span>
          <a
            href={osintSource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white truncate max-w-[40ch]"
          >
            {osintSource.url}
          </a>
          {osintSource.machineTranslated && (
            <>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Texto adaptado por IA (reescrito)
              </span>
              <details className="w-full sm:w-auto">
                <summary className="cursor-pointer text-[13px] text-amber-300/90 hover:text-amber-200">
                  Ver texto original de la fuente
                </summary>
                <div className="mt-1 space-y-1 text-neutral-300 leading-relaxed">
                  <p className="font-semibold">{osintSource.originalTitle}</p>
                  {osintSource.originalSnippet && <p>{osintSource.originalSnippet}</p>}
                </div>
              </details>
            </>
          )}
          <button
            type="button"
            onClick={() => setOsintSource(null)}
            aria-label="Ocultar la franja de procedencia OSINT"
            className="ml-auto px-2 py-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* High-res processing canvas (positioned offscreen to maintain active compositor pipeline for captureStream) */}
      <canvas
        ref={hiddenCanvasRef}
        width={POST_W}
        height={POST_H}
        style={{
          position: "fixed",
          left: "-9999px",
          top: "-9999px",
          width: `${POST_W}px`,
          height: `${POST_H}px`,
          pointerEvents: "none",
          opacity: 0,
          zIndex: -9999,
        }}
        aria-hidden="true"
      />

      {/* Medio del modo podcast: el <audio> (fuente de sonido y reloj de la
          vista previa) y la imagen de fondo opcional. Fuera de pantalla pero
          montados: la exportación clásica lee el elemento y la ruta rápida
          sus bytes. */}
      <audio
        ref={audioRef}
        src={mediaType === "audio" ? mediaSrc : undefined}
        preload="auto"
        muted={isMuted}
        loop
        className="hidden"
        onLoadedMetadata={(e) => {
          const dur = Math.round((e.currentTarget.duration || 0) * 10) / 10;
          if (dur > 0) {
            setVideoDuration(dur);
            if (trimEnd === 0 || trimEnd > dur) setTrimEnd(dur);
          }
        }}
        onPlay={() => setIsVideoPlaying(true)}
        onPause={() => setIsVideoPlaying(false)}
        onTimeUpdate={(e) => {
          // Durante la exportación no se recorta: el límite lo marca el grabador
          if (isRecordingRef.current) return;
          const a = e.currentTarget;
          if (!a.paused && trimEnd > trimStart && a.currentTime >= trimEnd) {
            const main = activeMediaEl();
            if (videoOutro && startPreviewOutro()) return;
            if (main) main.currentTime = trimStart;
          }
          syncPreviewPos();
        }}
      />
      {mediaType === "audio" && podcastBgSrc && (
        <img
          ref={podcastBgRef}
          src={podcastBgSrc}
          alt=""
          crossOrigin={
            podcastBgSrc.startsWith("blob:") || podcastBgSrc.startsWith("data:")
              ? undefined
              : "anonymous"
          }
          className="hidden"
          aria-hidden="true"
          onLoad={() => {
            // Repinta al cargar: mientras la imagen no tiene píxeles el
            // pintor se queda en negro absoluto y no vuelve a tocar el lienzo.
            podcastRenderRef.current();
          }}
          onError={() => podcastRenderRef.current()}
        />
      )}

      {/* Cama musical del podcast: bucle continuo a volumen muy bajo. La
          exportación la vuelve a mezclar desde el MP3 para que el archivo
          suene igual que la vista previa. */}
      {postDesign === "podcast" && (
        <audio
          ref={podcastMusicRef}
          src={podcastSoundtrack}
          loop
          preload="auto"
          className="hidden"
          aria-hidden="true"
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold mb-1">
            <Smartphone className="w-3.5 h-3.5 text-white shrink-0" />
            <span>FORMATO VERTICAL {postFormat} · SUPER AMOLED BLACK</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Generador de Posts {postFormat}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-light max-w-2xl leading-relaxed">
            Publicaciones visuales de alto impacto con fondo negro absoluto,
            tipografía Lexend, atribución geográfica por países, filtros
            fotográficos y controles de audio para video.
          </p>
        </div>

        {/* Header Actions: Quick Report Pre-fill Dropdown & JSON Backup buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* JSON Export / Import Buttons */}
          <div className="flex items-center gap-1.5 bg-neutral-950 border border-white/10 p-1 rounded-xl shadow-lg">
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5"
              title="Copiar configuración completa del post como JSON"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Copiar JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setJsonError(null);
                setJsonInputText("");
                setIsJsonModalOpen(true);
              }}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5"
              title="Pegar o restaurar configuración desde JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pegar JSON</span>
            </button>
          </div>

          {/* Quick Report Pre-fill Dropdown */}
          {reports.length > 0 && (
            <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 rounded-xl p-2 max-w-xs shadow-lg">
              <FileText className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
              <select
                onChange={(e) => handleLoadFromReport(e.target.value)}
                defaultValue=""
                className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer truncate max-w-[190px] font-medium"
              >
                <option
                  value=""
                  disabled
                  className="bg-neutral-900 text-neutral-400"
                >
                  ⚡ Autocompletar desde despacho...
                </option>
                {reports.map((r) => (
                  <option
                    key={r.id}
                    value={r.id}
                    className="bg-neutral-900 text-white"
                  >
                    {r.category}: {r.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification. Se sitúa sobre la altura real de la barra: con
          el panel abierto sube lo que mide él. */}
      {toastMessage && (
        <div
          style={{
            bottom: `calc(var(--bn-nav-h) + ${
              aiComposerOpen ? aiComposerH + 84 : 76
            }px)`,
          }}
          className="fixed left-4 sm:left-auto right-6 z-50 bg-white text-black px-4 py-2.5 text-xs font-sans font-medium rounded-xl border border-neutral-200 shadow-2xl flex items-center gap-2 animate-in fade-in"
        >
          <span className="w-2 h-2 rounded-full bg-black inline-block"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Barra flotante del asistente IA.
          Dos piezas negras flotantes y despegadas: una píldora con la acción
          principal, y encima (con un hueco de 12 px) el panel del contexto,
          que se estira con el tirador y guarda su medida. Baja del todo para
          no estorbar; los toasts se sitúan sobre la altura real de la barra. */}
      <aside
        aria-label="Asistente IA de redacción"
        className="fixed left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-xl flex flex-col items-center gap-3 bottom-[calc(var(--bn-nav-h)_+_1.25rem)] sm:bottom-[calc(var(--bn-nav-h)_+_1rem)] lg:bottom-4 animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Panel del contexto: suelto respecto de la píldora */}
        {aiComposerOpen && (
          <div
            style={{ height: aiComposerH }}
            className="w-full min-h-0 shrink-0 rounded-2xl bg-black/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {/* Tirador: arrastra para agrandar o achicar. Doble clic vuelve
                al tamaño inicial. */}
            <div
              onPointerDown={handleComposerResizeStart}
              onDoubleClick={() => setAiComposerH(AI_COMPOSER_H_DEFAULT)}
              title="Arrastra para agrandar o achicar el cuadro (doble clic: tamaño inicial)"
              className="shrink-0 h-4 flex items-center justify-center cursor-ns-resize bg-white/[0.03] border-b border-white/5 touch-none select-none"
            >
              <span className="w-8 h-1 rounded-full bg-white/20"></span>
            </div>

            <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-2">
              {aiNotice && (
                <div
                  className={`shrink-0 p-2 rounded-lg text-[11px] font-medium leading-snug border ${
                    aiNotice.kind === "error"
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : aiNotice.kind === "warn"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  }`}
                >
                  {aiNotice.text}
                </div>
              )}

              <label htmlFor="ai-topic-input" className="sr-only">
                Tema, noticia o contexto de partida
              </label>
              <textarea
                id="ai-topic-input"
                value={aiTopic}
                onChange={(e) => {
                  setAiTopic(e.target.value);
                  setAiNotice(null);
                }}
                placeholder="Tema, titular de partida o contexto (ej: Bombardeos de precisión en instalaciones nucleares en Isfahán provocan alerta máxima en el Golfo Pérsico...)"
                className="flex-1 min-h-0 w-full resize-none bg-neutral-950 border border-white/10 rounded-xl p-2.5 text-[13px] text-neutral-100 leading-relaxed placeholder-neutral-600 focus:outline-none focus:border-white/25 font-['Lexend']"
              />

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleAiJson}
                  title={
                    showAdvancedJson
                      ? "Ocultar el JSON"
                      : "Ver el JSON del post"
                  }
                  className={`px-2.5 h-7 rounded-full text-[11px] font-semibold transition-colors cursor-pointer border ${
                    showAdvancedJson
                      ? "bg-white/10 border-white/20 text-white"
                      : "bg-transparent border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  JSON
                </button>

                {aiTopic && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiTopic("");
                      setAiNotice(null);
                    }}
                    title="Borrar el texto"
                    className="px-2.5 h-7 rounded-full text-[11px] font-semibold bg-transparent border border-white/10 text-neutral-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Borrar
                  </button>
                )}

                <span className="ml-auto text-[10px] font-mono text-neutral-600 tabular-nums">
                  {aiTopic.trim().length} car.
                </span>
              </div>
            </div>
          </div>
        )}

        </aside>

        {/* Barra flotante limpia */}
        <aside className="rounded-2xl bg-neutral-950/95 border border-white/10 backdrop-blur-md shadow-2xl p-2 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => aiComposerOpen ? handleGenerateAi() : setAiComposerOpen(true)} disabled={aiBusy} title={aiBusy ? "Redactando con IA..." : aiComposerOpen ? "Redactar y autocompletar" : "Abrir asistente IA"} className="h-9 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 text-black text-[11px] font-bold uppercase tracking-wide transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/10"><Sparkles className="w-4 h-4" /><span className="truncate">{aiBusy ? "Redactando..." : aiComposerOpen ? "Redactar" : "Generar 4:5"}</span></button>
          <div className="h-6 w-px bg-white/10 mx-1" />
          <div className="flex items-center gap-1 bg-neutral-900 rounded-lg border border-white/5 px-2 py-0.5 overflow-x-auto max-w-[42vw] sm:max-w-xs"><span className="text-[9px] text-neutral-500 font-mono shrink-0">Modelo:</span>{[
            { key: "groq-llama", label: "L3.3" }, { key: "gemini-flash", label: "Flash" }, { key: "or-gpt", label: "GPT-4o" }, { key: "or-llama", label: "L3.3" }, { key: "or-gemini", label: "Flash" },
          ].map(m => <button key={m.key} type="button" onClick={() => setAiModelChoice(m.key)} className={`text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${aiModelChoice === m.key ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-neutral-400 hover:text-white"}`}>{m.label}</button>)}</div>
          <div className="h-6 w-px bg-white/10 mx-1" />
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(buildAiPromptBase()); showToast("✓ Prompt copiado"); } catch {} }} className="text-[10px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors font-medium cursor-pointer" title="Copia la plantilla tal cual para pegarla en otra IA">Prompt</button>
          <button type="button" onClick={() => { if (aiTweet) { navigator.clipboard.writeText(aiTweet).catch(()=>{}); showToast("✓ Tweet"); } else showToast("Sin tweet aun"); }} className="text-[10px] px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors font-medium cursor-pointer">Tweet</button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(buildAiTodoClipboard());
                showToast("✓ Prompt copiado");
              } catch {}
            }}
            title="Copia la plantilla tal cual para pegarla en otra IA"
            className="text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors font-medium cursor-pointer"
          >
            Todo
          </button>
          <button type="button" onClick={handleToggleAiSettings} title="Claves de IA" className="h-8 w-8 rounded-lg grid place-items-center text-amber-300 hover:text-white hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"><Zap className="w-3.5 h-3.5" /></button>
          {aiComposerOpen && <button type="button" onClick={() => setAiComposerOpen(false)} title="Cerrar" className="h-8 w-8 rounded-lg grid place-items-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
        </aside>

      {/* Main Grid: Controls (Left) vs Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* LEFT COLUMN: Controls & Settings (7 cols).
            En móvil va DESPUÉS de la vista previa (order-2) para que el
            resultado sea lo primero que se ve al abrir la pestaña. */}
        <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
          {/* Abrir o plegar todas las secciones de la columna de una vez.
              Discreto a propósito: no debe competir con el asistente IA. */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setOpenSections(
                  Object.fromEntries(
                    COLLAPSE_SECTION_KEYS.map((key) => [key, !allSectionsOpen]),
                  ),
                )
              }
              className="text-[11px] font-medium text-neutral-500 hover:text-white transition-colors cursor-pointer"
            >
              {allSectionsOpen ? "Plegar todo" : "Abrir todo"}
            </button>
          </div>

          {/* Card 0: resultados del asistente. Sólo aparece cuando hay algo
              que enseñar: el acceso a la IA vive en la barra flotante de
              abajo, así que el generador arranca sin este bloque. */}
          {(aiTweet ||
            aiSources.length > 0 ||
            showAiSettings ||
            showAdvancedJson ||
            (aiNotice && !aiComposerOpen)) && (
            <div
              ref={aiCardRef}
              className="bg-linear-to-b from-neutral-900/90 via-neutral-950/90 to-neutral-950 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl relative overflow-hidden"
            >
              {/* Aviso: éxito, salvaguarda o error. Con el compositor abierto
                se enseña allí, que es donde se está trabajando. */}
              {aiNotice && !aiComposerOpen && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-medium leading-relaxed border ${
                    aiNotice.kind === "error"
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : aiNotice.kind === "warn"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  }`}
                >
                  {aiNotice.text}
                </div>
              )}

              {/* Panel de Configuración de Claves Gratuitas (Groq / Gemini) */}
              {showAiSettings && (
                <div className="bg-neutral-900/90 border border-white/10 rounded-xl p-4 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        Proveedores de IA 100% Gratuitos (Sin Tarjeta)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAiSettings(false)}
                      className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-300 leading-relaxed font-light">
                    BlackNews funciona con modelos de lenguaje gratuitos. Las
                    claves se guardan solo en tu navegador y van directo a los
                    proveedores:
                  </p>

                  {/* Opción 1: Groq Cloud (Recomendada · 14.400 req/día) */}
                  <div className="bg-neutral-950/80 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                        Groq Cloud · Llama 3.3 70B (Recomendado)
                      </span>
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-orange-400 hover:text-orange-300 underline font-medium"
                      >
                        Obtener clave gratis (14.400/día) →
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={groqKey}
                        onChange={(e) => {
                          setGroqKey(e.target.value);
                          setGroqKeySaved(false);
                        }}
                        placeholder="gsk_..."
                        className="flex-1 bg-neutral-900 border border-white/10 focus:border-orange-400 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const k = groqKey.trim();
                          try {
                            if (k)
                              localStorage.setItem("blacknews_groq_key", k);
                            else localStorage.removeItem("blacknews_groq_key");
                          } catch {}
                          setGroqKeySaved(true);
                          showToast(
                            k
                              ? "✓ Clave de Groq guardada"
                              : "Clave de Groq borrada",
                          );
                        }}
                        className="px-3.5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        {groqKeySaved ? "✓ Guardada" : "Guardar"}
                      </button>
                    </div>
                  </div>

                  {/* Opción 2: Google Gemini (1.500 req/día) */}
                  <div className="bg-neutral-950/80 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        Google Gemini · Flash Lite
                      </span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                      >
                        Obtener clave gratis (1.500/día) →
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => {
                          setGeminiKey(e.target.value);
                          setGeminiKeySaved(false);
                        }}
                        placeholder="AIza..."
                        className="flex-1 bg-neutral-900 border border-white/10 focus:border-blue-400 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const k = geminiKey.trim();
                          try {
                            if (k)
                              localStorage.setItem("blacknews_gemini_key", k);
                            else
                              localStorage.removeItem("blacknews_gemini_key");
                          } catch {}
                          setGeminiKeySaved(true);
                          showToast(
                            k
                              ? "✓ Clave de Gemini guardada"
                              : "Clave de Gemini borrada",
                          );
                        }}
                        className="px-3.5 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        {geminiKeySaved ? "✓ Guardada" : "Guardar"}
                      </button>
                    </div>
                  </div>

                  {/* Opción 3: OpenRouter (modelos gratuitos: openai/gpt-4o-mini, meta-llama/llama-3.3-70b, google/gemini-2.0-flash-lite) */}
                  <div className="bg-neutral-950/80 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                        OpenRouter · Gratis
                      </span>
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium">Obtener clave →</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="password" value={openRouterKey} onChange={(e) => { setOpenRouterKey(e.target.value); setOpenRouterKeySaved(false); }} placeholder="sk-or-v1-..." className="flex-1 bg-neutral-900 border border-white/10 focus:border-rose-400 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none" />
                      <button type="button" onClick={() => { const k = openRouterKey.trim(); try { if (k) localStorage.setItem("blacknews_openrouter_key", k); else localStorage.removeItem("blacknews_openrouter_key"); } catch {} setOpenRouterKeySaved(true); showToast(k ? "✓ Clave de OpenRouter guardada" : "Clave borrada"); }} className="px-3.5 py-2 bg-rose-500 hover:bg-rose-400 text-black font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0">{openRouterKeySaved ? "✓ Guardada" : "Guardar"}</button>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {["openai/gpt-4o-mini","meta-llama/llama-3.3-70b-instruct","google/gemini-2.0-flash-lite"].map((m) => (
                        <button key={m} type="button" onClick={() => setOpenRouterModel(m)} className={`text-[9px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${openRouterModel === m ? "bg-rose-500/20 text-rose-300 border-rose-400/50 font-bold" : "bg-neutral-900 text-neutral-400 border-white/10 hover:text-white"}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tweet Result Card (si ya se ha redactado) */}
              {aiTweet && (
                <div className="bg-neutral-900/90 border border-white/15 rounded-xl p-4 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        Tweet Redactado (X)
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          aiTweet.length > AI_TWEET_LIMIT
                            ? "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-neutral-800 text-neutral-300 border-white/10"
                        }`}
                      >
                        {aiTweet.length}/{AI_TWEET_LIMIT} caracteres
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyAiTweet}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Tweet</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            buildAiTodoClipboard(),
                          );
                          showToast("✓ Prompt copiado");
                        } catch {}
                      }}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Copia la plantilla tal cual para pegarla en otra IA"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Prompt</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={aiTweet}
                    onChange={(e) => setAiTweet(e.target.value)}
                    className="w-full bg-neutral-950 border border-white/10 rounded-lg p-3 text-xs text-neutral-200 font-mono leading-relaxed focus:outline-none focus:border-amber-400 resize-y"
                  />
                </div>
              )}

              {/* Fuentes consultadas (si las hay) */}
              {(aiSearch?.note || aiSources.length > 0) && (
                <div className="space-y-2">
                  {aiSearch?.note && (
                    <p className="text-[11px] leading-relaxed text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                      {aiSearch.note}
                    </p>
                  )}
                  {aiSources.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
                        Fuentes web consultadas:
                      </span>
                      <ul className="space-y-1">
                        {aiSources.map((source) => (
                          <li
                            key={source.url}
                            className="text-[11px] text-neutral-400 flex items-start gap-1.5"
                          >
                            <Globe className="w-3 h-3 mt-0.5 shrink-0 text-neutral-600" />
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-white transition-colors underline decoration-white/20 truncate"
                            >
                              {source.title || source.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Panel de JSON Técnico Colapsable */}
              {showAdvancedJson && (
                <div className="bg-neutral-950/80 border border-white/10 rounded-xl p-4 space-y-3 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>JSON Técnico del Post</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLoadCurrentJson}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs rounded-lg transition-colors cursor-pointer border border-white/5"
                      >
                        Cargar actual
                      </button>
                      <button
                        type="button"
                        onClick={handlePasteAiJson}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs rounded-lg transition-colors cursor-pointer border border-white/5"
                      >
                        Pegar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!aiJsonText) return;
                          try {
                            await navigator.clipboard.writeText(aiJsonText);
                            showToast("✓ JSON copiado al portapapeles");
                          } catch {}
                        }}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs rounded-lg transition-colors cursor-pointer border border-white/5"
                      >
                        Copiar
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyAiJson}
                        className="px-3 py-1 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        Aplicar al Post
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={aiJsonText}
                    onChange={(e) => setAiJsonText(e.target.value)}
                    spellCheck={false}
                    placeholder='{\n  "version": 2,\n  "content": {\n    "title": "...",\n    "description": "..."\n  }\n}'
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-neutral-200 leading-relaxed focus:outline-none focus:border-cyan-400 resize-y"
                  />
                </div>
              )}
            </div>
          )}

          {/* Card 1: Text Content & Typography */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-white" />
                <span>1. Contenido Editorial & Tipografía</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                Lexend Bold & Medium
              </span>
            </div>

            {/* Headline / Titular */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Titular (Lexend Bold)</span>
                </label>

                {/* Real-time size control & presets */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs font-mono font-bold text-white bg-neutral-900 px-2 py-0.5 rounded-lg border border-white/10">
                    {fontSizeTitle}px
                  </span>
                  <input
                    type="range"
                    min={42}
                    max={82}
                    value={fontSizeTitle}
                    onChange={(e) => setFontSizeTitle(Number(e.target.value))}
                    className="w-24 accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    title="Ajustar tamaño en tiempo real"
                  />
                  <div className="flex items-center gap-1">
                    {[
                      { label: "XS", size: 42 },
                      { label: "S", size: 48 },
                      { label: "M", size: 62 },
                      { label: "L", size: 74 },
                      { label: "XL", size: 82 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setFontSizeTitle(p.size)}
                        title={`Titular de ${p.size}px`}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          fontSizeTitle === p.size
                            ? "bg-white text-black font-bold"
                            : "bg-neutral-900 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea
                rows={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titular en impacto directo..."
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-sm sm:text-base font-bold text-white leading-snug focus:outline-none focus:border-white/40 resize-none font-['Lexend']"
              />
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setTitle((t) => toSentenceCase(t))}
                  className="text-[10px] font-mono bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 hover:border-white/30 rounded-md px-2 py-0.5 transition-colors cursor-pointer"
                  title="Sentence Case — primera letra de cada oración en mayúscula"
                >
                  Sc
                </button>
                <span className={`text-[11px] font-mono ${title.length > 120 ? "text-amber-400 font-bold" : title.length > 90 ? "text-amber-200" : "text-neutral-400"} font-light`}>
                  {title.length}/120
                </span>
                <div className="h-1 bg-neutral-800 rounded-full w-12 overflow-hidden">
                  <div className={`h-full rounded-full ${title.length > 120 ? "bg-amber-400" : title.length > 90 ? "bg-amber-300" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (title.length / 120) * 100)}%` }} />
                </div>
                <span className="text-[9px] text-neutral-500 uppercase tracking-wider">Tono:</span>
                {["Conciso","Impactante","Indignante","Serio","Urgente"].map((t) => (
                  <button key={t} type="button" onClick={() => rewriteTone(title, t, setTitle)} disabled={aiBusy} className="text-[10px] font-mono bg-neutral-950 border border-white/10 text-neutral-300 hover:text-white hover:border-white/30 rounded px-1.5 py-0.5 transition-colors cursor-pointer disabled:opacity-40" title={`Reescribir con tono: ${t}`}>{t}</button>
                ))}
              </div>
              <span className="text-[11px] text-neutral-500 font-light block mt-1">
                Presiona Enter para romper la línea exactamente donde quieras
                equilibrar el texto.
              </span>
            </div>

            {/* Description / Bajada */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Descripción / Bajada (Lexend Normal)</span>
                </label>

                {/* Real-time size control */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs font-mono font-bold text-white bg-neutral-900 px-2 py-0.5 rounded-lg border border-white/10">
                    {fontSizeDesc}px
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={42}
                    value={fontSizeDesc}
                    onChange={(e) => setFontSizeDesc(Number(e.target.value))}
                    className="w-24 accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    title="Ajustar tamaño en tiempo real"
                  />
                  <div className="flex items-center gap-1">
                    {[
                      { label: "XS", size: 20 },
                      { label: "S", size: 24 },
                      { label: "M", size: 30 },
                      { label: "L", size: 38 },
                      { label: "XL", size: 42 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setFontSizeDesc(p.size)}
                        title={`Bajada de ${p.size}px`}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          fontSizeDesc === p.size
                            ? "bg-white text-black font-bold"
                            : "bg-neutral-900 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setDescription((d) => toSentenceCase(d))}
                  className="text-[10px] font-mono bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 hover:border-white/30 rounded-md px-2 py-0.5 transition-colors cursor-pointer"
                  title="Sentence Case — primera letra de cada oración en mayúscula"
                >
                  Sc
                </button>
                <span className={`text-[10px] font-mono ${description.length > 150 ? "text-amber-400 font-bold" : description.length > 120 ? "text-amber-200" : description.length > 100 ? "text-amber-100" : "text-neutral-400"} font-light`}>
                  {description.length}/150
                </span>
                <div className="h-1 bg-neutral-800 rounded-full w-16 overflow-hidden">
                  <div className={`h-full rounded-full ${description.length > 150 ? "bg-amber-400" : description.length > 120 ? "bg-amber-300" : description.length > 100 ? "bg-amber-300" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (description.length / 150) * 100)}%` }} />
                </div>
                <span className="text-[9px] text-neutral-500 uppercase tracking-wider">Tono:</span>
                {["Conciso","Impactante","Indignante","Serio","Urgente"].map((t) => (
                  <button key={t} type="button" onClick={() => rewriteTone(description, t, setDescription)} disabled={aiBusy} className="text-[10px] font-mono bg-neutral-950 border border-white/10 text-neutral-300 hover:text-white hover:border-white/30 rounded px-1.5 py-0.5 transition-colors cursor-pointer disabled:opacity-40" title={`Reescribir con tono: ${t}`}>{t}</button>
                ))}
              </div>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle o contexto clave que complementa el titular..."
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-xs sm:text-sm font-normal text-neutral-200 leading-relaxed focus:outline-none focus:border-white/40 resize-none font-['Lexend']"
              />
            </div>

            {/* Espaciado e interlineado · plegado por defecto: es la parte
                más densa de la tarjeta y sólo hace falta al ajustar maquetación. */}
            <CollapseSection
              title="Espaciado e interlineado"
              open={openSections.espaciado}
              onToggle={() => toggleSection("espaciado")}
              icon={<Sliders className="h-3.5 w-3.5 text-neutral-400" />}
              value={`Sep ${gapTitleToDesc}px · Interl ${titleLineHeightRatio}x`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-900/60 p-3 rounded-xl border border-white/5">
                {/* Gap Title to Desc */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">
                      Separación Titular ↔ Bajada
                    </span>
                    <span className="font-mono text-white font-bold">
                      {gapTitleToDesc}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={56}
                    value={gapTitleToDesc}
                    onChange={(e) => setGapTitleToDesc(Number(e.target.value))}
                    className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    {[16, 26, 38].map((gap) => (
                      <button
                        key={gap}
                        type="button"
                        onClick={() => setGapTitleToDesc(gap)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          gapTitleToDesc === gap
                            ? "bg-white text-black font-bold"
                            : "bg-neutral-800 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {gap === 16
                          ? "Compacto"
                          : gap === 26
                            ? "Equilibrado"
                            : "Amplio"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gap Category to Title */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">
                      Separación Cabecera ↔ Titular
                    </span>
                    <span className="font-mono text-white font-bold">
                      {gapCategoryToTitle}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={48}
                    value={gapCategoryToTitle}
                    onChange={(e) =>
                      setGapCategoryToTitle(Number(e.target.value))
                    }
                    className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    {[22, 30, 40].map((gap) => (
                      <button
                        key={gap}
                        type="button"
                        onClick={() => setGapCategoryToTitle(gap)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          gapCategoryToTitle === gap
                            ? "bg-white text-black font-bold"
                            : "bg-neutral-800 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {gap === 22
                          ? "Pegado"
                          : gap === 30
                            ? "Estándar"
                            : "Holgado"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Line height presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">
                    Interlineado Titular:
                  </span>
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                    {[1.12, 1.18, 1.25].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setTitleLineHeightRatio(ratio)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          titleLineHeightRatio === ratio
                            ? "bg-white text-black font-bold"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {ratio}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">Interlineado Bajada:</span>
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                    {[1.32, 1.42, 1.54].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setDescLineHeightRatio(ratio)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          descLineHeightRatio === ratio
                            ? "bg-white text-black font-bold"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {ratio}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CollapseSection>
          </div>

          {/* Card 2: Categorías & Atribución de Países */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-white" />
                <span>2. Sección Editorial & Países Involucrados</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {allAvailableCategories.length} Secciones
              </span>
            </div>

            {/* Category selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                Sección Editorial (Escribe o elige una)
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value.toUpperCase())}
                  placeholder="Ej: GEOPOLÍTICA, DEFENSA & INTELIGENCIA..."
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-white tracking-widest uppercase focus:outline-none focus:border-white/40"
                />

                <select
                  onChange={(e) => {
                    if (e.target.value) setCategory(e.target.value);
                  }}
                  value=""
                  className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none cursor-pointer max-w-[150px] sm:max-w-xs truncate"
                >
                  <option value="" disabled>
                    Elegir del catálogo ({allAvailableCategories.length})
                  </option>
                  {allAvailableCategories.map((c) => (
                    <option
                      key={c}
                      value={c}
                      className="bg-neutral-900 text-white"
                    >
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Category Chips · plegadas por defecto: el desplegable del
                  catálogo de arriba ofrece las mismas secciones en una línea. */}
              <CollapseSection
                title="Secciones rápidas"
                open={openSections["secciones-rapidas"]}
                onToggle={() => toggleSection("secciones-rapidas")}
                icon={<Layers className="h-3.5 w-3.5 text-neutral-400" />}
                value={category}
              >
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {allAvailableCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                        category === c
                          ? "bg-white text-black font-bold shadow-sm"
                          : "bg-neutral-900 text-neutral-400 hover:text-white border border-white/5"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </CollapseSection>
            </div>

            {/* Countries Section */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Países o Regiones del Acontecimiento</span>
                  </label>
                  <p className="text-[11px] text-neutral-400 font-light">
                    Muestra a qué actores internacionales corresponde la noticia
                    (ej. Israel e Irán).
                  </p>
                </div>

                {/* Country Display Placement: tres formas base (línea,
                    insignia, ocultar) y tres extra del podcast (arriba dcha.,
                    bajo titular, pie) que sólo se ofrecen en ese diseño. */}
                <div className="flex flex-wrap items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-white/10 text-[11px]">
                  {COUNTRY_PLACEMENTS.filter(
                    (p) => !p.podcastOnly || postDesign === "podcast",
                  ).map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setCountryPlacement(p.value)}
                      className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                        countryPlacement === p.value
                          ? "bg-white text-black font-bold"
                          : "text-neutral-400 hover:text-white"
                      }`}
                      title={p.hint}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single-line Format & Sizing Controls · plegado: sólo aparece
                  con países en la barra superior y sólo hace falta al cambiar
                  de estilo o al desactivar el auto-ajuste. */}
              {countryPlacement === "line" && selectedCountries.length > 0 && (
                <CollapseSection
                  title="Estilo y auto-ajuste de la línea"
                  open={openSections["estilo-linea"]}
                  onToggle={() => toggleSection("estilo-linea")}
                  icon={<Globe className="h-3.5 w-3.5 text-neutral-400" />}
                  value={
                    postDesign === "podcast"
                      ? PODCAST_FLAG_MODE_LABEL[podcastFlagMode]
                      : countryFormat === "names"
                        ? "Nombres"
                        : countryFormat === "flags-only"
                          ? "Solo banderas"
                          : countryFormat === "flags-names"
                            ? "Banderas"
                            : "Códigos"
                  }
                >
                  <div className="p-3 bg-neutral-900/90 rounded-xl border border-white/10 space-y-2.5">
                    {/* En podcast el formato de países lo manda el selector
                        «Banderas (países)» de más abajo: estos botones no
                        pintan nada en esa tarjeta, así que no se ofrecen. */}
                    {postDesign !== "podcast" && (
                      <div className="flex flex-wrap items-center justify-end gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                          type="button"
                          onClick={() => setCountryFormat("names")}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            countryFormat === "names"
                              ? "bg-white text-black font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                          title="Solo nombres: ISRAEL · IRÁN"
                        >
                          Nombres
                        </button>
                        <button
                          type="button"
                          onClick={() => setCountryFormat("flags-names")}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            countryFormat === "flags-names"
                              ? "bg-white text-black font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                          title="Banderas y nombres: 🇮🇱 ISRAEL · 🇮🇷 IRÁN"
                        >
                          Banderas + Nombres
                        </button>
                        <button
                          type="button"
                          onClick={() => setCountryFormat("flags-codes")}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            countryFormat === "flags-codes"
                              ? "bg-white text-black font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                          title="Ultra compacto para muchos países: 🇮🇱 IL · 🇮🇷 IR"
                        >
                          Códigos (Compacto)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCountryFormat("flags-only")}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            countryFormat === "flags-only"
                              ? "bg-white text-black font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                          title="Solo banderas: 🇮🇱 🇮🇷"
                        >
                          Solo banderas
                        </button>
                      </div>
                    )}

                    {/* Header Auto-Fit vs Manual Size */}
                    <div
                      className={`flex items-center justify-between text-[11px] ${
                        postDesign !== "podcast"
                          ? "pt-1 border-t border-white/5"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="autoFitCheck"
                          checked={autoFitHeader}
                          onChange={(e) => setAutoFitHeader(e.target.checked)}
                          className="w-3.5 h-3.5 accent-white rounded cursor-pointer"
                        />
                        <label
                          htmlFor="autoFitCheck"
                          className="text-neutral-300 font-medium cursor-pointer"
                        >
                          Ajuste automático inteligente a 1 sola línea
                          (garantiza que quepan todos)
                        </label>
                      </div>

                      {!autoFitHeader && (
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400 font-mono">
                            {headerSize}px
                          </span>
                          <input
                            type="range"
                            min={12}
                            max={26}
                            value={headerSize}
                            onChange={(e) =>
                              setHeaderSize(Number(e.target.value))
                            }
                            className="w-20 accent-white h-1 bg-neutral-800 rounded-lg cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CollapseSection>
              )}

              {/* Selected Countries Badges */}
              {selectedCountries.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-neutral-900/90 rounded-xl border border-white/10">
                  <span className="text-[11px] text-neutral-400 uppercase font-mono mr-1">
                    Activos:
                  </span>
                  {selectedCountries.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 text-white rounded-lg text-xs font-semibold border border-white/15"
                    >
                      <CountryFlag
                        code={c.code}
                        className="w-4 h-2.5 object-cover rounded-[1px] inline-block shadow-xs"
                        fallback="📍"
                      />
                      <span>{c.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCountry(c)}
                        className="hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                        title={`Quitar ${c.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedCountries([])}
                    className="text-[11px] text-neutral-500 hover:text-neutral-300 ml-auto underline cursor-pointer"
                  >
                    Limpiar todos
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-neutral-900/40 rounded-xl border border-dashed border-white/10 text-xs text-neutral-500 text-center">
                  Ningún país seleccionado actualmente. Haz clic en los botones
                  de abajo o escribe uno personalizado.
                </div>
              )}

              {/* Country Search & Quick Adder */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder={`Filtrar entre ${countryCatalog.length} países (Israel, Perú, Portugal...)`}
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
                />

                <form
                  onSubmit={handleAddCustomCountry}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={customCountryName}
                    onChange={(e) => setCustomCountryName(e.target.value)}
                    placeholder="Otro país..."
                    className="w-28 sm:w-36 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl cursor-pointer transition-colors"
                    title="Añadir país personalizado"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Popular Countries Grid Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-black/40 rounded-xl border border-white/5">
                {filteredCountries.map((c) => {
                  const isSelected = selectedCountries.some(
                    (item) => item.name.toLowerCase() === c.name.toLowerCase(),
                  );
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleToggleCountry(c)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white text-black font-bold shadow-sm"
                          : "bg-neutral-900 text-neutral-300 hover:bg-neutral-850 hover:text-white border border-white/5"
                      }`}
                    >
                      <CountryFlag
                        code={c.code}
                        className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block shadow-xs"
                        fallback="📍"
                      />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 3: Media Upload (Image, Video or Audio) */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-white" />
                <span>3. Imagen, Video o Audio (Arrastra o Selecciona)</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {mediaType === "audio"
                  ? postDesign === "podcast"
                    ? "🎙️ Modo Podcast"
                    : "🎙️ Audio · estilo noticia"
                  : mediaType === "video"
                    ? "🎬 Modo Video"
                    : "🖼️ Modo Imagen"}
              </span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? "border-white bg-white/10"
                  : "border-white/15 bg-neutral-900/60 hover:border-white/30 hover:bg-neutral-900"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-white/5 rounded-2xl text-white">
                  {mediaType === "audio" ? (
                    <Volume2 className="w-6 h-6" />
                  ) : mediaType === "video" ? (
                    <VideoIcon className="w-6 h-6" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-white">
                  Arrastra aquí tu imagen, video o audio, o haz clic para
                  explorar
                </p>
                <p className="text-[11px] text-neutral-400 font-light">
                  Soporta PNG, JPG, WebP, AVIF, MP4, WebM, MP3, M4A y WAV · El
                  audio abre el modo podcast · También puedes pegar con Ctrl+V
                </p>
              </div>
            </div>

            {/* Current loaded media bar */}
            <div className="flex items-center justify-between bg-neutral-900/80 px-4 py-2.5 rounded-xl border border-white/5 text-xs">
              <span className="text-neutral-400 truncate max-w-xs font-mono">
                Archivo actual:{" "}
                <strong className="text-white">{mediaName}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMediaType("image");
                    setMediaSrc(
                      "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80",
                    );
                    setMediaName("Imagen de muestra");
                    // Salida del modo podcast: vuelve a la estética clásica y
                    // se queda sin fondo propio (la onda se apaga sola al no
                    // haber audio).
                    setPostDesign("news");
                    setPodcastBgSrc("");
                    setPodcastBgName("");
                    peaksSrcRef.current = "";
                    setAudioPeaks([]);
                  }}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-[11px] underline"
                >
                  Restablecer muestra
                </button>
              </div>
            </div>

            {/* Pie de foto / Personaje o Crédito */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Pie de Foto / Personaje o Crédito (Opcional)</span>
                </label>
                {photoCaption && (
                  <button
                    type="button"
                    onClick={() => setPhotoCaption("")}
                    className="text-[11px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                  >
                    Borrar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 font-light">
                Aparece en la base de la foto a la misma altura del logo
                BlackNews (a la izquierda), compacto y alineado a la derecha.
                Dejar vacío si no hay personaje.
              </p>
              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Ej: Benjamin Netanyahu · Primer Ministro (o dejar en blanco)"
                className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-['Lexend']"
              />
            </div>
          </div>

          {/* Card 3b: Post podcast — variante AMOLED para notas en audio */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-white" />
                <span>3b. Diseño del post</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {postDesign === "podcast" ? "🎙️ Podcast" : "📰 Noticias"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { key: "news", label: "📰 Estilo noticia" },
                  { key: "podcast", label: "🎙️ Estilo podcast" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setPostDesign(opt.key);
                    if (opt.key === "podcast") setIsMuted(false);
                  }}
                  className={`py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                    postDesign === opt.key
                      ? "bg-white text-black border-white"
                      : "bg-neutral-900 text-neutral-400 border-white/10 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {postDesign === "podcast" && (
              <div className="space-y-4 pt-3 border-t border-white/5">
                <p className="text-[11px] text-neutral-400 font-light">
                  Variante minimalista para las notas habladas: fondo negro
                  absoluto, sección y países arriba (como en la noticia), onda
                  de audio con reloj y la marca con el episodio abajo. El
                  archivo se exporta siempre como VÍDEO, porque las redes no
                  aceptan audio suelto.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px] gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 uppercase tracking-wider">
                      Serie (opcional)
                    </label>
                    <input
                      type="text"
                      value={podcastSeries}
                      onChange={(e) => setPodcastSeries(e.target.value)}
                      placeholder="P. ej. Noticias en 1 minuto"
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-['Lexend']"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 uppercase tracking-wider">
                      EP (opcional)
                    </label>
                    <input
                      type="text"
                      value={podcastEpisode}
                      onChange={(e) => setPodcastEpisode(e.target.value)}
                      placeholder="Vacío"
                      maxLength={6}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono"
                    />
                  </div>
                </div>

                {/* Cómo se muestrean las banderas (países) en la tarjeta */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-neutral-400 uppercase tracking-wider">
                    Banderas (países)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PODCAST_FLAG_STYLES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPodcastFlagStyle(opt.value)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                          podcastFlagStyle === opt.value
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                            : "bg-neutral-900 border-white/10 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-400 font-light">
                    {podcastFlagStyle === "auto" ? (
                      <>
                        Con {selectedCountries.length}{" "}
                        {selectedCountries.length === 1 ? "país" : "países"}{" "}
                        pinta{" "}
                        <strong className="text-white">
                          {PODCAST_FLAG_MODE_LABEL[podcastFlagMode]}
                        </strong>
                        : hasta 3 bandera y nombre, de 4 a 6 bandera y código,
                        7 o más solo banderas (máx. 2 filas y +N si no caben).
                      </>
                    ) : (
                      <>
                        Estilo fijo:{" "}
                        <strong className="text-white">
                          {PODCAST_FLAG_MODE_LABEL[podcastFlagMode]}
                        </strong>
                        . Con «Auto» se adapta solo al número de países.
                      </>
                    )}
                  </p>
                </div>

                {/* Titular automático con la fecha */}
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setPodcastAutoTitle(!podcastAutoTitle)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      podcastAutoTitle
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-neutral-900 border-white/10 text-neutral-400 hover:text-white"
                    }`}
                  >
                    <span>📅 Titular automático con la fecha</span>
                    <span className="font-mono">
                      {podcastAutoTitle ? "ON" : "OFF"}
                    </span>
                  </button>
                  <p className="text-[11px] text-neutral-400 font-light">
                    {podcastAutoTitle ? (
                      <>
                        Ahora se pinta la serie{" "}
                        <strong className="text-white">
                          {podcastSeries.trim() || "Noticias en 1 minuto"}
                        </strong>{" "}
                        en grande y en una línea separada{" "}
                        <strong className="text-white">{podcastFecha}</strong>{" "}
                        en tamaño más pequeño. La fecha se calcula el día que
                        exportas: nada que cambiar a mano.
                      </>
                    ) : (
                      <>
                        Manda el titular que escribas en la tarjeta 1 (útil si
                        ya tienes un gancho o usas la barra de IA).
                      </>
                    )}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] text-neutral-400 uppercase tracking-wider">
                      Fondo (opcional · negro puro por defecto)
                    </label>
                    {podcastBgSrc && (
                      <button
                        type="button"
                        onClick={() => {
                          setPodcastBgSrc("");
                          setPodcastBgName("");
                        }}
                        className="text-[11px] text-neutral-500 hover:text-white underline cursor-pointer"
                      >
                        Quitar fondo
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => podcastBgInputRef.current?.click()}
                    className="w-full py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer border bg-neutral-900 text-neutral-300 border-white/10 hover:border-white/30 hover:text-white"
                  >
                    {podcastBgName
                      ? `🖼️ ${podcastBgName}`
                      : "Elegir imagen de fondo"}
                  </button>
                  <input
                    ref={podcastBgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePodcastBgFile(file);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-[11px] text-neutral-400 font-light">
                    Se atenúa sola para que el titular y la onda se lean
                    siempre. Sin imagen, el fondo es negro puro.
                  </p>
                </div>

                {/* Cama musical de BlackNews */}
                <div className="space-y-1.5 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setPodcastMusicOn(!podcastMusicOn)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                        podcastMusicOn
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-neutral-900 border-white/10 text-neutral-400 hover:text-white"
                      }`}
                    >
                      🎵 Música de fondo
                    </button>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {podcastMusicOn
                        ? `${Math.round(podcastMusicVol * 100)} %`
                        : "OFF"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    disabled={!podcastMusicOn}
                    value={Math.round(podcastMusicVol * 100)}
                    onChange={(e) =>
                      setPodcastMusicVol(Number(e.target.value) / 100)
                    }
                    className="w-full accent-emerald-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer disabled:opacity-40"
                  />
                  <p className="text-[11px] text-neutral-400 font-light">
                    Cama de BlackNews siempre por debajo de la voz (12 % por
                    defecto, tope 40 %). Se mezcla igual en la vista previa que
                    en el vídeo exportado.
                  </p>
                </div>

                <p className="text-[11px] font-light flex items-center gap-1.5">
                  {audioAnalyzing ? (
                    <span className="text-neutral-400">
                      ⏳ Analizando el audio para dibujar la onda…
                    </span>
                  ) : audioPeaks.length > 0 ? (
                    <span className="text-emerald-400">
                      ✓ Onda lista · {audioPeaks.length} barras
                    </span>
                  ) : mediaType === "audio" ? (
                    <span className="text-amber-400/90">
                      ⚠️ No se pudo decodificar este audio: la onda saldrá plana
                      (el vídeo y el sonido salen igual).
                    </span>
                  ) : (
                    <span className="text-neutral-500">
                      Sube un audio (o un vídeo) para que la onda cobre vida.
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Card 4: Filtros & Ajustes */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-white" />
              <span>4. Filtros Fotográficos & Control de Audio</span>
            </h3>

            {/* Filter buttons */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                Filtro Editorial (Sin Color / B&N)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("bw-high")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === "bw-high"
                      ? "bg-white text-black font-bold shadow-md"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10"
                  }`}
                >
                  <span>B&N Contraste</span>
                  <span className="text-[10px] opacity-70">(Ref.)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("bw-smooth")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === "bw-smooth"
                      ? "bg-white text-black font-bold shadow-md"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10"
                  }`}
                >
                  <span>Sin Color Suave</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("noir")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === "noir"
                      ? "bg-white text-black font-bold shadow-md"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10"
                  }`}
                >
                  <span>Noir Profundo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("color")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === "color"
                      ? "bg-white text-black font-bold shadow-md"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10"
                  }`}
                >
                  <span>Color Original</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("muted-color")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer col-span-2 sm:col-span-1 ${
                    filter === "muted-color"
                      ? "bg-white text-black font-bold shadow-md"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10"
                  }`}
                >
                  <span>Color Desaturado</span>
                </button>
              </div>
            </div>

            {/* Video Audio Control & Social Networks Optimization */}
            {exportsVideo && (
              <div className="space-y-3.5 p-4 bg-neutral-900/90 border border-white/15 rounded-xl">
                {/* Audio row */}
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl text-white">
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-amber-400" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Audio del Video
                      </h4>
                      <p className="text-[11px] text-neutral-400 font-light">
                        {isMuted
                          ? "El video se exportará sin audio (silenciado)."
                          : "El video conservará su pista de audio original."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMuted(!isMuted);
                      const el = activeMediaEl();
                      if (el) el.muted = !isMuted;
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isMuted
                        ? "bg-neutral-900 text-neutral-400 border border-white/15 hover:text-white"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    }`}
                  >
                    {isMuted ? "🔇 Silenciado" : "🔊 Con Audio (Activo)"}
                  </button>
                </div>

                {/* Formato, peso y velocidad de entrega · plegado: son valores
                    de salida que se ajustan una vez y rara vez se tocan. */}
                <CollapseSection
                  title="Formato, peso y velocidad"
                  open={openSections.formato}
                  onToggle={() => toggleSection("formato")}
                  icon={<Film className="h-3.5 w-3.5 text-cyan-400" />}
                  value={`${videoFormat.toUpperCase()} · ${videoSpeed}x · ${
                    videoQuality === "social"
                      ? "3 Mbps"
                      : videoQuality === "compact"
                        ? "1.5 Mbps"
                        : "6 Mbps"
                  }`}
                >
                  <div className="space-y-1.5 pt-0.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setVideoFormat("mp4")}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          videoFormat === "mp4"
                            ? "bg-white text-black border-white shadow-md"
                            : "bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>MP4 (.mp4)</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-extrabold tracking-normal">
                            PARA X / TWITTER
                          </span>
                        </div>
                        <div
                          className={`text-[10px] mt-1 ${videoFormat === "mp4" ? "text-neutral-700 font-medium" : "text-neutral-500"}`}
                        >
                          Compatible con X, Instagram, Facebook y WhatsApp sin
                          errores de formato
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVideoFormat("webm")}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          videoFormat === "webm"
                            ? "bg-white text-black border-white shadow-md"
                            : "bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider">
                          WebM (.webm)
                        </div>
                        <div
                          className={`text-[10px] mt-1 ${videoFormat === "webm" ? "text-neutral-700 font-medium" : "text-neutral-500"}`}
                        >
                          Formato web abierto para Chrome o navegadores de
                          escritorio
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Optimización de peso para redes sociales */}
                  <div className="space-y-2 pt-0.5">
                    <p className="font-mono text-[11px] text-neutral-500">
                      {videoQuality === "social"
                        ? "3 Mbps · ~4 MB por cada 10 s"
                        : videoQuality === "compact"
                          ? "1.5 Mbps · ~2 MB por cada 10 s"
                          : "6 Mbps · ~7.5 MB por cada 10 s"}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setVideoQuality("social")}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          videoQuality === "social"
                            ? "bg-white text-black border-white shadow-md"
                            : "bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider">
                          Redes Sociales
                        </div>
                        <div
                          className={`text-[10px] ${videoQuality === "social" ? "text-neutral-700 font-medium" : "text-neutral-500"}`}
                        >
                          Equilibrado (X / Insta)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVideoQuality("compact")}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          videoQuality === "compact"
                            ? "bg-white text-black border-white shadow-md"
                            : "bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider">
                          Ultra Ligero
                        </div>
                        <div
                          className={`text-[10px] ${videoQuality === "compact" ? "text-neutral-700 font-medium" : "text-neutral-500"}`}
                        >
                          WhatsApp / Web rápida
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVideoQuality("hq")}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          videoQuality === "hq"
                            ? "bg-white text-black border-white shadow-md"
                            : "bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider">
                          Master HQ
                        </div>
                        <div
                          className={`text-[10px] ${videoQuality === "hq" ? "text-neutral-700 font-medium" : "text-neutral-500"}`}
                        >
                          Bitrate alto (6M)
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Velocidad de reproducción y exportación */}
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                      {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => {
                            setVideoSpeed(speed);
                            const el = activeMediaEl();
                            if (el) el.playbackRate = speed;
                            showToast(`Velocidad ajustada a ${speed}x`);
                          }}
                          className={`py-1.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer border text-center ${
                            videoSpeed === speed
                              ? "bg-white text-black font-bold border-white shadow-sm"
                              : "bg-neutral-950 text-neutral-400 border-white/10 hover:text-white"
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                </CollapseSection>

                {/* Video Trimmer (Start & End) */}
                <div className="space-y-2.5 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-amber-400" />
                      <span>Recorte del Video (Rango de Reproducción)</span>
                    </label>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                      {videoDuration > 0
                        ? `Total: ${videoDuration}s`
                        : "Video cargado"}
                    </span>
                  </div>

                  {/* Dual Sliders / Range Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                    {/* Trim Start */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400">
                          Punto de Inicio:
                        </span>
                        <span className="font-mono text-white font-bold">
                          {trimStart.toFixed(1)}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(
                          0.1,
                          trimEnd > 0 ? trimEnd - 0.5 : videoDuration || 30,
                        )}
                        step={0.1}
                        value={trimStart}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTrimStart(val);
                          const el = activeMediaEl();
                          if (el) el.currentTime = val;
                        }}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = activeMediaEl();
                          if (el) {
                            const cur = Math.round(el.currentTime * 10) / 10;
                            if (cur < (trimEnd > 0 ? trimEnd : 999)) {
                              setTrimStart(cur);
                              showToast(`Inicio fijado en ${cur}s`);
                            }
                          }
                        }}
                        className="text-[10px] text-amber-400/90 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        ⏱️ Fijar inicio en segundo actual
                      </button>
                    </div>

                    {/* Trim End */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400">Punto de Fin:</span>
                        <span className="font-mono text-white font-bold">
                          {trimEnd > 0
                            ? trimEnd.toFixed(1)
                            : (videoDuration || 10).toFixed(1)}
                          s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={Math.max(0.5, trimStart + 0.5)}
                        max={videoDuration > 0 ? videoDuration : 60}
                        step={0.1}
                        value={trimEnd > 0 ? trimEnd : videoDuration || 10}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTrimEnd(val);
                          const el = activeMediaEl();
                          if (el) el.currentTime = val;
                        }}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = activeMediaEl();
                          if (el) {
                            const cur = Math.round(el.currentTime * 10) / 10;
                            if (cur > trimStart) {
                              setTrimEnd(cur);
                              showToast(`Fin fijado en ${cur}s`);
                            }
                          }
                        }}
                        className="text-[10px] text-amber-400/90 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        ⏱️ Fijar fin en segundo actual
                      </button>
                    </div>
                  </div>

                  {/* Duración efectiva del clip, tras recorte y velocidad */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                    <span className="text-neutral-300 font-medium">
                      ✂️ Clip:{" "}
                      <strong className="text-white">
                        {Math.max(
                          0,
                          (trimEnd > 0 ? trimEnd : videoDuration || 10) -
                            trimStart,
                        ).toFixed(1)}
                        s
                      </strong>{" "}
                      {videoSpeed !== 1.0 && (
                        <span className="text-neutral-400 font-normal">
                          (con {videoSpeed}x dura{" "}
                          {(
                            Math.max(
                              0,
                              (trimEnd > 0 ? trimEnd : videoDuration || 10) -
                                trimStart,
                            ) / videoSpeed
                          ).toFixed(1)}
                          s)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Presets de recorte · plegados: son atajos de los propios
                      sliders, no una función aparte. */}
                  <CollapseSection
                    title="Recortes rápidos"
                    open={openSections.recortes}
                    onToggle={() => toggleSection("recortes")}
                    icon={<Scissors className="h-3.5 w-3.5 text-neutral-400" />}
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(videoDuration || 10, 5));
                          const el = activeMediaEl();
                          if (el) el.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        5s
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(videoDuration || 10, 10));
                          const el = activeMediaEl();
                          if (el) el.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        10s
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(videoDuration || 30, 30));
                          const el = activeMediaEl();
                          if (el) el.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        30s
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(videoDuration || 15);
                          const el = activeMediaEl();
                          if (el) el.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        Completo
                      </button>
                    </div>
                  </CollapseSection>
                </div>

                {/* Duración máxima del clip · plegada: se ajusta una vez y
                    rara vez se vuelve a tocar. */}
                <CollapseSection
                  title="Duración máxima del clip"
                  open={openSections.duracion}
                  onToggle={() => toggleSection("duracion")}
                  icon={<Gauge className="h-3.5 w-3.5 text-neutral-400" />}
                  value={
                    maxVideoDuration > 0 ? `${maxVideoDuration}s` : "Completo"
                  }
                >
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[5, 10, 15, 30, 60, 0].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setMaxVideoDuration(dur)}
                        className={`py-1.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer border ${
                          maxVideoDuration === dur
                            ? "bg-white text-black font-bold border-white"
                            : "bg-neutral-950 text-neutral-400 border-white/10 hover:text-white"
                        }`}
                      >
                        {dur === 0 ? "Completo" : `${dur}s`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10.5px] text-neutral-400 font-light pt-0.5">
                    💡 <strong>Tip para X e Instagram:</strong> Los clips de 10
                    segundos en bucle consiguen alta retención y evitan que el
                    algoritmo de compresión de Meta destruya la calidad del
                    video.
                  </p>
                </CollapseSection>

                {/* Cierre de marca opcional: Blacknews.mp4 al final.
                    La fila entera es el interruptor: en táctil el blanco tiene
                    que ser toda la zona, no la píldora minúscula del final. */}
                <div className="pt-3 border-t border-white/5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={videoOutro}
                    aria-label="Cierre BlackNews (sello final)"
                    onClick={() => setVideoOutro((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 py-2.5 rounded-lg text-left cursor-pointer transition-colors hover:bg-white/5"
                    title="Reproduce Blacknews.mp4 al finalizar el clip"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-neutral-200 block">
                        Cierre BlackNews (sello final)
                      </span>
                      <span className="text-[11px] text-neutral-400 font-light">
                        Añade {outroDuration.toFixed(1)} s de sello de marca al
                        final del vídeo exportado y de la vista previa, con su
                        audio (salvo que exportes en silencio). Desactivado por
                        defecto.
                      </span>
                    </span>
                    <span className="shrink-0 flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                          videoOutro
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/50"
                            : "bg-neutral-950 text-neutral-400 border-white/10"
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        {videoOutro ? "Activado" : "Apagado"}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`relative inline-block w-9 h-5 rounded-full border transition-colors ${
                          videoOutro
                            ? "bg-emerald-500/80 border-emerald-400"
                            : "bg-neutral-950 border-white/20"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                            videoOutro ? "translate-x-4" : ""
                          }`}
                        />
                      </span>
                    </span>
                  </button>
                </div>

                {/* Aviso de contenido sensible (opcional): frame previo + cartel
                    Blacknews-Advertencia.mp4 antes del clip. Con él activado,
                    las redes toman como miniatura el primer frame (portada con
                    titular), así que el cartel de advertencia nunca se ve en
                    el preview de subida. Sólo disponible con vídeo. */}
                {exportsVideo && (
                  <div className="pt-3 border-t border-white/5">
                    {/* Fila entera clicable: el toque en el texto (el área que
                        ve y pega el dedo el usuario) también conmuta, y el
                        track grande da feedback visual del estado. */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={contentWarning}
                      aria-label="Aviso de contenido sensible"
                      onClick={() => setContentWarning((v) => !v)}
                      className="w-full flex items-center justify-between gap-3 py-2.5 rounded-lg text-left cursor-pointer transition-colors hover:bg-white/5"
                      title="Inserta un frame de portada y el cartel de advertencia antes del clip"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-neutral-200 block">
                          Aviso de contenido sensible
                        </span>
                        <span className="text-[11px] text-neutral-400 font-light">
                          {warningFrameDur} s de portada +{" "}
                          {(warningDuration > 0
                            ? warningDuration
                            : warningDurFallback
                          ).toFixed(1)}{" "}
                          s de cartel antes del clip. Se reproduce en la vista
                          previa al arrancar desde el principio; el frame
                          opcional es además la miniatura que ven las redes.
                        </span>
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            contentWarning
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/50"
                              : "bg-neutral-950 text-neutral-400 border-white/10"
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {contentWarning ? "Activado" : "Apagado"}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`relative inline-block w-9 h-5 rounded-full border transition-colors ${
                            contentWarning
                              ? "bg-amber-500/80 border-amber-400"
                              : "bg-neutral-950 border-white/20"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                              contentWarning ? "translate-x-4" : ""
                            }`}
                          />
                        </span>
                      </span>
                    </button>
                  </div>
                )}
                {contentWarning && (
                  <div className="mt-2 space-y-2">
                    <div className="text-[11px] text-neutral-400 font-light">
                      Frame opcional que se muestra antes del cartel:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ["cover", "Portada con titular"],
                          ["first", "Primer fotograma"],
                          ["last", "Último fotograma"],
                        ] as const
                      ).map(([v, label]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setWarningFrameOrigin(v)}
                          className={`min-h-[36px] px-3 py-2 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                            warningFrameOrigin === v
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/50"
                              : "bg-neutral-950 text-neutral-400 border-white/10 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-neutral-500 font-light">
                      Con «Portada con titular» se reutiliza la composición de la
                      portada (fondo, categoría y titular). Con «Primer/Último
                      fotograma» se coge un frame real del clip en trimStart o
                      trimEnd. Es el frame que las redes toman como miniatura,
                      así que elige el que mejor refleje el post.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Exposición y fundido · plegados: ajuste fino de imagen que casi
                siempre se deja en los valores por defecto. */}
            <CollapseSection
              title="Exposición y fundido"
              open={openSections.exposicion}
              onToggle={() => toggleSection("exposicion")}
              icon={<Palette className="h-3.5 w-3.5 text-neutral-400" />}
              value={`${contrast}% · ${brightness}%`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Contraste</span>
                    <span className="font-mono text-white">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={180}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Brillo</span>
                    <span className="font-mono text-white">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={140}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Fade toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  <span className="text-xs font-semibold text-neutral-200 block">
                    Desvanecimiento superior hacia negro (Gradient Mask)
                  </span>
                  <span className="text-[11px] text-neutral-400 font-light">
                    Difumina sutilmente el horizonte de la imagen contra el
                    fondo negro superior.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={blendFade}
                  onChange={(e) => setBlendFade(e.target.checked)}
                  className="w-4 h-4 accent-white rounded cursor-pointer"
                />
              </div>
            </CollapseSection>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Preview (5 cols).
            En móvil es lo PRIMERO que se ve (order-1). Sin sticky: la columna
            (tarjeta + transporte + exportación) es más alta que el viewport y,
            al pegarse, dejaría los botones de exportar fuera de pantalla. */}
        <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-white" />
              <span>Vista Previa en Vivo {postFormat}</span>
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              Titular: {fontSizeTitle}px · Bajada: {fontSizeDesc}px
            </span>
          </div>

          {/* Selector de formato: el mismo post en 4:5, 9:16 o 16:9 (TV) */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label
              className="flex items-center gap-1.5 cursor-pointer select-none"
              title="Intro: mientras dure se muestran los primeros segundos del vídeo en silencio (en 16:9, además en B&N con la señal de TV) y, al terminar, el vídeo vuelve a empezar desde el principio para no perderse nada"
            >
              <input
                type="checkbox"
                checked={tvIntro}
                onChange={(e) => setTvIntro(e.target.checked)}
                className="w-3.5 h-3.5 accent-white cursor-pointer"
              />
              <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                Intro
              </span>
            </label>
            {tvIntro && (
              <select
                value={tvIntroDur}
                onChange={(e) => setTvIntroDur(Number(e.target.value))}
                className="bg-neutral-950 border border-white/10 text-[11px] text-neutral-300 rounded-lg px-1.5 py-1 cursor-pointer"
                title="Duración de la intro en segundos: pasado ese tiempo el vídeo reinicia desde el principio en color y con sonido"
              >
                <option value={3}>Intro 3 s</option>
                <option value={5}>Intro 5 s</option>
                <option value={8}>Intro 8 s</option>
              </select>
            )}
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Marca de agua opcional">
              <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} className="w-3.5 h-3.5 accent-white cursor-pointer" />
              <span className="text-[11px] uppercase tracking-wider text-neutral-500">Marca agua</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Tema de fondo (BlackNewsPress-Background.mp3) solo en video">
              <input type="checkbox" checked={bgAudio} onChange={(e) => setBgAudio(e.target.checked)} className="w-3.5 h-3.5 accent-white cursor-pointer" />
              <span className="text-[11px] uppercase tracking-wider text-neutral-500">Tema fondo</span>
            </label>
            {/* Tweet pegado (texto o URL) sin API */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Pega un tweet (texto o URL de Twitter/X) para mostrarlo en el post">
              <span className="text-[11px] text-neutral-500 whitespace-nowrap">Tweet</span>
              <input
                type="text"
                value={tweetText}
                onChange={(e) => setTweetText(e.target.value)}
                placeholder="Pega tweet o URL..."
                className="bg-neutral-950 border border-white/10 text-[11px] text-neutral-200 rounded-md px-1.5 py-0.5 w-36 focus:outline-none focus:border-white/30 transition-colors"
              />
            </label>
            {/* Campos de la tarjeta «tweet embebido»: sólo al haber contenido. */}
            {tweetText && (
              <div className="w-full flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 pt-1.5 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-wider text-neutral-600">Tarjeta tweet</span>
                <label
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  title="Muestra el cuerpo del tweet traducido al español (Google Translate, sin API key)"
                >
                  <input
                    type="checkbox"
                    checked={tweetTranslate}
                    onChange={(e) => setTweetTranslate(e.target.checked)}
                    className="w-3.5 h-3.5 accent-white cursor-pointer"
                  />
                  <span className="text-[11px] text-neutral-500 whitespace-nowrap">Traducir ES</span>
                </label>
                <input
                  type="text"
                  value={tweetName}
                  onChange={(e) => setTweetName(e.target.value)}
                  placeholder="Nombre"
                  title="Nombre que aparece en la tarjeta"
                  className="bg-neutral-950 border border-white/10 text-[11px] text-neutral-200 rounded-md px-1.5 py-0.5 w-28 focus:outline-none focus:border-white/30 transition-colors"
                />
                <input
                  type="text"
                  value={tweetHandle}
                  onChange={(e) => setTweetHandle(e.target.value.replace(/^@?/, "@"))}
                  placeholder="@usuario"
                  title="Usuario (@handle)"
                  className="bg-neutral-950 border border-white/10 text-[11px] text-neutral-200 rounded-md px-1.5 py-0.5 w-24 focus:outline-none focus:border-white/30 transition-colors"
                />
                <input
                  type="text"
                  value={tweetDate}
                  onChange={(e) => setTweetDate(e.target.value)}
                  placeholder="Fecha"
                  title="Fecha visible del tweet"
                  className="bg-neutral-950 border border-white/10 text-[11px] text-neutral-200 rounded-md px-1.5 py-0.5 w-24 focus:outline-none focus:border-white/30 transition-colors"
                />
                <label
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  title="Sube la tarjeta del tweet por encima del sello (0 = justo encima)"
                >
                  <span className="text-[11px] text-neutral-500">Altura</span>
                  <input
                    type="range"
                    min={0}
                    max={240}
                    step={4}
                    value={tweetLift}
                    onChange={(e) => setTweetLift(Number(e.target.value))}
                    className="w-16 h-1 accent-white"
                  />
                </label>
                {/* Cuándo se ve en vídeo: todo el clip o sólo unos segundos.
                    En el PNG la tarjeta sale siempre. */}
                {mediaType === "video" && (
                  <>
                    <label
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                      title="Cuándo se muestra la tarjeta en el vídeo (en el PNG sale siempre)"
                    >
                      <span className="text-[11px] text-neutral-500">Ver</span>
                      <select
                        value={tweetShowMode}
                        onChange={(e) =>
                          setTweetShowMode(
                            e.target.value as "always" | "start" | "end",
                          )
                        }
                        className="bg-neutral-950 border border-white/10 text-[11px] text-neutral-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                      >
                        <option value="always">Todo el video</option>
                        <option value="start">Primeros segundos</option>
                        <option value="end">Últimos segundos</option>
                      </select>
                    </label>
                    {tweetShowMode !== "always" && (
                      <label
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                        title={
                          tweetShowMode === "start"
                            ? "Segundos desde el inicio en los que se ve la tarjeta"
                            : "Segundos antes del final en los que se ve la tarjeta"
                        }
                      >
                        <span className="text-[11px] text-neutral-500">
                          {tweetShowMode === "start" ? "Primeros" : "Últimos"}
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={30}
                          step={1}
                          value={tweetShowSecs}
                          onChange={(e) => setTweetShowSecs(Number(e.target.value))}
                          className="w-16 h-1 accent-white"
                        />
                        <span className="text-[10px] font-mono text-neutral-400 tabular-nums w-6">
                          {tweetShowSecs}s
                        </span>
                      </label>
                    )}
                  </>
                )}
                <label
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  title="Foto de perfil de la tarjeta (se descarga del @usuario si no subes una)"
                >
                  <span className="text-[11px] text-neutral-500">Avatar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      tweetAvatarManualRef.current = true;
                      setTweetAvatar(URL.createObjectURL(f));
                    }}
                    className="text-[10px] text-neutral-500 file:mr-1 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:bg-white/10 file:text-neutral-300 file:cursor-pointer file:text-[10px]"
                  />
                </label>
                {tweetAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      tweetAvatarManualRef.current = false;
                      setTweetAvatar("");
                    }}
                    className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                    title="Quitar avatar propio y volver al del @usuario"
                  >
                    Quitar
                  </button>
                )}
                {tweetLoading && (
                  <span className="text-[10px] text-amber-400 animate-pulse">Cargando…</span>
                )}
                {tweetTranslating && !tweetLoading && (
                  <span className="text-[10px] text-sky-400 animate-pulse">Traduciendo…</span>
                )}
              </div>
            )}
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Escala del video (reposición)">
              <span className="text-[11px] text-neutral-500">Escala</span>
              <input type="range" min={0.6} max={1.4} step={0.05} value={mediaZoom} onChange={(e) => setMediaZoom(Number(e.target.value))} className="w-16 h-1 accent-white" />
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Reposición horizontal del video (izquierda/derecha)">
              <span className="text-[11px] text-neutral-500">X</span>
              <input type="range" min={-150} max={150} step={2} value={mediaOffsetX} onChange={(e) => setMediaOffsetX(Number(e.target.value))} className="w-16 h-1 accent-white" />
              <span className="text-[10px] font-mono text-neutral-500 tabular-nums w-7 text-right">{mediaOffsetX}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Reposición vertical del video (arriba/abajo)">
              <span className="text-[11px] text-neutral-500">Y</span>
              <input type="range" min={-150} max={150} step={2} value={mediaOffsetY} onChange={(e) => setMediaOffsetY(Number(e.target.value))} className="w-16 h-1 accent-white" />
              <span className="text-[10px] font-mono text-neutral-500 tabular-nums w-7 text-right">{mediaOffsetY}</span>
            </label>
            {(mediaOffsetX !== 0 || mediaOffsetY !== 0 || mediaZoom !== 1) && (
              <button
                type="button"
                onClick={() => {
                  setMediaZoom(1);
                  setMediaOffsetX(0);
                  setMediaOffsetY(0);
                }}
                className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                title="Volver a la posición y escala originales"
              >
                Reset
              </button>
            )}
            {(postFormat === "4:5" || postFormat === "9:16") &&
              mediaType === "video" && (
              <label
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title="Pasados unos segundos el texto (categoría, titular y bajada) se oculta para mostrar el vídeo de fondo a sangre; el sello BlackNews de abajo a la izquierda se mantiene siempre"
              >
                <input
                  type="checkbox"
                  checked={textFadeOut}
                  onChange={(e) => setTextFadeOut(e.target.checked)}
                  className="w-3.5 h-3.5 accent-white cursor-pointer"
                />
                <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Texto → vídeo
                </span>
              </label>
            )}
            {(postFormat === "4:5" || postFormat === "9:16") &&
              mediaType === "video" &&
              textFadeOut && (
              <select
                value={textFadeOutDur}
                onChange={(e) => setTextFadeOutDur(Number(e.target.value))}
                className="bg-neutral-950 border border-white/10 text-[11px] text-neutral-300 rounded-lg px-1.5 py-1 cursor-pointer"
                title="Segundos que el texto permanece visible antes de desvanecerse"
              >
                <option value={3}>Oculta a 3 s</option>
                <option value={4}>Oculta a 4 s</option>
                <option value={5}>Oculta a 5 s</option>
                <option value={8}>Oculta a 8 s</option>
              </select>
            )}
            {/* Atajo del cierre de marca: el mismo interruptor de la tarjeta 4,
                aquí junto a la intro para poder probarlo sin salir de la
                preview. Aplica en todos los formatos, no sólo en TV. */}
            {exportsVideo && (
              <label
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title={`Cierre BlackNews: añade ${outroDuration.toFixed(1)} s de sello de marca al final del vídeo exportado y de la vista previa, con su audio (salvo que exportes en silencio)`}
              >
                <input
                  type="checkbox"
                  checked={videoOutro}
                  onChange={(e) => setVideoOutro(e.target.checked)}
                  className="w-3.5 h-3.5 accent-white cursor-pointer"
                />
                <span
                  className={`text-[11px] uppercase tracking-wider ${
                    videoOutro ? "text-emerald-400" : "text-neutral-500"
                  }`}
                >
                  Outro{videoOutro ? ` · ${outroDuration.toFixed(1)} s` : ""}
                </span>
              </label>
            )}
            {postFormat === "16:9" && (
              <label
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title="Mostrar la hora de emisión junto al bug de canal"
              >
                <input
                  type="checkbox"
                  checked={tvShowClock}
                  onChange={(e) => setTvShowClock(e.target.checked)}
                  className="w-3.5 h-3.5 accent-white cursor-pointer"
                />
                <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Hora
                </span>
              </label>
            )}
            {postFormat === "16:9" && (
              <label
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title="Mostrar la cápsula «● EN DIRECTO» junto a la hora"
              >
                <input
                  type="checkbox"
                  checked={tvShowLive}
                  onChange={(e) => setTvShowLive(e.target.checked)}
                  className="w-3.5 h-3.5 accent-white cursor-pointer"
                />
                <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                  En directo
                </span>
              </label>
            )}
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Formato
            </span>
            <div className="flex items-center gap-1 bg-neutral-950 border border-white/10 p-1 rounded-xl">
              {(["4:5", "9:16", "16:9"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPostFormat(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    postFormat === f
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                  title={
                    f === "4:5"
                      ? "1080×1350 · Instagram, LinkedIn, X y estados"
                      : f === "9:16"
                        ? "1080×1920 · TikTok, YouTube Shorts y Reels"
                        : "1920×1080 · Señal de TV, YouTube y pantallas"
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* THE POST CARD CONTAINER */}
          <div
            ref={previewContainerRef}
            className={`w-full mx-auto ${
              postFormat === "9:16"
                ? "aspect-[9/16]"
                : postFormat === "16:9"
                  ? "aspect-[16/9]"
                  : "aspect-[4/5]"
            } bg-black rounded-2xl overflow-hidden relative border border-white/20 shadow-2xl flex flex-col justify-between select-none`}
            style={{ backgroundColor: "#000000", maxWidth: previewCardWidth }}
          >
            {postDesign === "podcast" ? (
              /* Vista previa podcast: el lienzo real (formato activo) escalado
                 a tamaño de tarjeta y pintado por drawPodcastFrame — el mismo
                 dibujo que sale en el archivo, onda y reloj incluidos. */
              <div className="absolute inset-0 overflow-hidden">
                <canvas
                  ref={podcastCanvasRef}
                  width={POST_W}
                  height={POST_H}
                  style={{
                    width: POST_W,
                    height: POST_H,
                    transform: `scale(${previewCardElW / POST_W})`,
                    transformOrigin: "top left",
                  }}
                  className="block select-none"
                  aria-label="Vista previa del post podcast"
                />
              </div>
            ) : postFormat === "16:9" ? (
              <>
                {/* Vista previa TV: el lienzo real de 1920×1080 escalado a
                    tamaño de tarjeta, así todas las medidas de elementos son
                    píxeles de lienzo y calcan el export carácter a carácter. */}
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    style={{
                      width: TV_W,
                      height: TV_H,
                      transform: `scale(${previewCardElW / TV_W})`,
                      transformOrigin: "top left",
                    }}
                    className="relative select-none font-['Lexend',sans-serif]"
                  >
                    {/* Media a sangre + velos de legibilidad. El inferior
                        sólo existe con el chyron (intro): al terminar la
                        intro queda vídeo limpio, igual que en el lienzo. */}
                    <div
                      className="absolute inset-0 overflow-hidden bg-black"
                      style={{
                        // Portada cruda del aviso: la capa de media sube por
                        // encima de bug, chyron, ticker y pie, que quedan
                        // tapados por el frame a sangre.
                        zIndex: warningCoverClean ? 45 : undefined,
                      }}
                    >
                      {/* «Escala»/«Reposición»: mismo transform que el lienzo
                          (origen en el centro, offsets en px de tarjeta
                          nominal ×4 para pasar de 480 a los 1920 del lienzo). */}
                      <div
                        className="absolute inset-0"
                        style={{
                          // Portada cruda del aviso: sin escala/reposición
                          // (el archivo encaja el frame tal cual) y z-1 para
                          // quedar por encima de los velos, sus hermanos.
                          transform: warningCoverClean
                            ? "none"
                            : `scale(${mediaZoom}) translate(${mediaOffsetX * (TV_W / previewCardWidthFor("16:9"))}px, ${mediaOffsetY * (TV_W / previewCardWidthFor("16:9"))}px)`,
                          transformOrigin: "center center",
                          zIndex: warningCoverClean ? 1 : undefined,
                        }}
                      >
                        {previewMediaEl}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] bg-gradient-to-b from-black/95 via-black/60 to-transparent" />
                      {tvShowChyron && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[640px] bg-gradient-to-t from-black/95 via-black/70 to-transparent" />
                      )}
                      {blendFade && (
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-black via-black/55 to-transparent" />
                      )}
                    </div>

                    {/* Bug de canal: cuño + marca */}
                    <div
                      className="absolute flex items-center"
                      style={{ left: TV_PAD, top: 50, gap: TV_BUG_GAP }}
                    >
                      <div
                        className="shrink-0 bg-white"
                        style={{ width: TV_BUG_SQ, height: TV_BUG_SQ }}
                      />
                      <span
                        className="font-bold text-white"
                        style={{
                          fontSize: TV_BUG_FS,
                          letterSpacing: "-0.5px",
                          lineHeight: `${TV_BUG_FS}px`,
                        }}
                      >
                        BLACKNEWS.
                      </span>
                    </div>

                    {/* Enlace en directo + hora de emisión */}
                    <div
                      className="absolute flex items-center"
                      style={{ right: TV_PAD, top: 46, gap: TV_LIVE_GAP }}
                    >
                      {tvShowLive && (
                        <span
                          className="flex items-center rounded-full border border-white/25 bg-black/60"
                          style={{
                            height: TV_LIVE_H,
                            padding: `0 ${TV_LIVE_PAD_R}px 0 ${TV_LIVE_PAD_L}px`,
                            gap: TV_LIVE_DOT,
                          }}
                        >
                          <span
                            className="shrink-0 rounded-full bg-red-500"
                            style={{ width: TV_LIVE_DOT, height: TV_LIVE_DOT }}
                          />
                          <span
                            className="font-bold text-white"
                            style={{
                              fontSize: TV_LIVE_FS,
                              letterSpacing: "3px",
                              lineHeight: `${TV_LIVE_FS}px`,
                            }}
                          >
                            EN DIRECTO
                          </span>
                        </span>
                      )}
                      {tvShowClock && (
                        <span
                          className="font-bold text-white"
                          style={{
                            fontSize: TV_CLOCK_FS,
                            letterSpacing: "1px",
                            lineHeight: `${TV_CLOCK_FS}px`,
                          }}
                        >
                          {tvClockLabel}
                        </span>
                      )}
                    </div>

                    {/* Chyron: etiqueta de sección + titular + bajada.
                        Con la intro activa sólo existe durante la intro
                        (entrada animada y salida al final); después el
                        vídeo queda limpio y el titular sigue en el ticker. */}
                    {tvShowChyron && (
                      <div
                        className="absolute flex overflow-hidden border-t border-white/15 bg-black/90"
                        style={{
                          left: TV_PAD,
                          bottom: TV_TICKER_H,
                          width: TV_STACK_W * tvBoxIn,
                          opacity: 1 - tvExitQ * tvExitQ,
                          transform: `translateY(${tvExitQ * tvExitQ * TV_EXIT_DY}px)`,
                        }}
                      >
                        <div
                          className="shrink-0 bg-emerald-500"
                          style={{ width: TV_ACCENT_W * tvBoxIn }}
                        />
                        <div style={{ padding: TV_STACK_PAD }}>
                          <div
                            className="flex items-center overflow-hidden"
                            style={{
                              height: TV_TAG_H,
                              gap: TV_CTRY_GAP,
                              opacity: tvTagP,
                              transform: `translateY(${(1 - tvTagP) * TV_TAG_DY}px)`,
                            }}
                          >
                            <span
                              className="flex shrink-0 items-center bg-emerald-500 font-bold uppercase text-black"
                              style={{
                                height: TV_TAG_H,
                                padding: `0 ${TV_TAG_PADX}px`,
                                fontSize: TV_TAG_FS,
                                letterSpacing: "2.5px",
                              }}
                            >
                              {(category || "GEOPOLÍTICA").trim()}
                            </span>
                            {selectedCountries.length > 0 && (
                              <span
                                className="flex min-w-0 items-center overflow-hidden font-semibold uppercase"
                                style={{
                                  gap: TV_CTRY_ITEM_GAP,
                                  fontSize: TV_CTRY_FS,
                                  letterSpacing: "1.5px",
                                  color: "#94A3B8",
                                }}
                              >
                                {selectedCountries.map((c, i) => (
                                  <span
                                    key={c.name}
                                    className="flex shrink-0 items-center"
                                    style={{ gap: TV_CTRY_SEP_GAP }}
                                  >
                                    {i > 0 &&
                                      countryFormat !== "flags-only" && (
                                        <span style={{ color: "#64748B" }}>
                                          ·
                                        </span>
                                      )}
                                    {countryFormat !== "names" && (
                                      <CountryFlag
                                        code={c.code}
                                        className="inline-block rounded-[1px] object-cover"
                                        style={{
                                          height: TV_FLAG_H,
                                          width: TV_FLAG_W,
                                        }}
                                      />
                                    )}
                                    {countryFormat !== "flags-only" && (
                                      <span>
                                        {countryFormat === "flags-codes"
                                          ? c.code
                                          : c.name.toUpperCase()}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                          <h1
                            style={{
                              marginTop: TV_GAP_TAG_TITLE,
                              fontSize: tvTitleFs,
                              lineHeight: `${tvTitleLineH}px`,
                              letterSpacing: 0,
                            }}
                            className="font-bold text-white"
                          >
                            {tvTitleLines.map((line, i) => {
                              const p =
                                tvInIntro && tvPhaseT !== null
                                  ? tvIntroLineIn(tvPhaseT, i)
                                  : 1;
                              return (
                                <span
                                  key={i}
                                  className="block whitespace-nowrap"
                                  style={{
                                    opacity: p,
                                    transform: `translateY(${(1 - p) * TV_LINE_DY}px)`,
                                  }}
                                >
                                  {line || "\u00A0"}
                                </span>
                              );
                            })}
                          </h1>
                          {tvDescLines.length > 0 && (
                            <p
                              style={{
                                marginTop: TV_GAP_TITLE_DESC,
                                fontSize: tvDescFs,
                                lineHeight: `${tvDescLineH}px`,
                                letterSpacing: 0,
                                color: "#CBD5E1",
                              }}
                            >
                              {tvDescLines.map((line, j) => {
                                const p =
                                  tvInIntro && tvPhaseT !== null
                                    ? tvIntroLineIn(
                                        tvPhaseT,
                                        tvTitleLines.length + j,
                                      )
                                    : 1;
                                return (
                                  <span
                                    key={j}
                                    className="block whitespace-nowrap"
                                    style={{
                                      opacity: p,
                                      transform: `translateY(${(1 - p) * TV_LINE_DY}px)`,
                                    }}
                                  >
                                    {line || "\u00A0"}
                                  </span>
                                );
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Marquee inferior: cuño fijo + celda (marca, titular y
                        países) en bucle infinito mientras se reproduce. */}
                    <style>{`@keyframes bn-ticker-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
                    <div
                      className="absolute inset-x-0 bottom-0 flex items-center overflow-hidden border-t border-white/15 bg-black"
                      style={{
                        height: TV_TICKER_H,
                        paddingLeft: TV_PAD,
                        gap: TV_TICKER_GAP,
                      }}
                    >
                      <span
                        className="shrink-0 bg-emerald-500"
                        style={{ width: TV_TICKER_SQ, height: TV_TICKER_SQ }}
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                          style={{
                            display: "flex",
                            width: "max-content",
                            /* Propiedades largas: el shorthand `animation`
                               reinicia la cinta desde 0 cada vez que se
                               reescribe (p. ej. al cambiar la duración medida)
                               y pisa animation-play-state (React lo avisa). */
                            animationName: "bn-ticker-marquee",
                            animationDuration: `${tickerMarqueeDur}s`,
                            animationTimingFunction: "linear",
                            animationIterationCount: "infinite",
                            animationPlayState:
                              mediaType === "video" && isVideoPlaying
                                ? "running"
                                : "paused",
                          }}
                        >
                          {[0, 1].map((copy) => (
                            <div
                              key={copy}
                              ref={copy === 0 ? tickerCellRef : undefined}
                              aria-hidden={copy === 1}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                flexShrink: 0,
                                /* Sin gap: el aire de la cinta vive en el
                                   separador "   ·   ", idéntico al del lienzo.
                                   Un gap aquí dejaba 0 px al unir la copia 0
                                   con la 1 (punto pegado una vez por vuelta). */
                              }}
                            >
                              {tvTickerItems.map((item, i) => (
                                <span
                                  key={i}
                                  className="flex shrink-0 items-center"
                                >
                                  {typeof item === "string" ? (
                                    <span
                                      className="font-semibold uppercase"
                                      style={{
                                        fontSize: TV_TICKER_FS,
                                        letterSpacing: "1.6px",
                                        color: i === 0 ? "#FFFFFF" : "#E2E8F0",
                                      }}
                                    >
                                      {item}
                                    </span>
                                  ) : (
                                    /* País: bandera por imagen (los emoji de
                                       bandera salen como letras en Windows). */
                                    <span className="flex shrink-0 items-center">
                                      {item.map((seg, j) => (
                                        <span
                                          key={j}
                                          className="flex shrink-0 items-center"
                                          style={{ gap: TV_TICKER_FLAG_GAP }}
                                        >
                                          {seg.code && (
                                            <CountryFlag
                                              code={seg.code}
                                              fallback={
                                                seg.emoji &&
                                                !isRegionalFlagEmoji(seg.emoji)
                                                  ? seg.emoji
                                                  : undefined
                                              }
                                              className="inline-block shrink-0 object-cover rounded-[1px]"
                                              style={{
                                                width: TV_TICKER_FLAG_W,
                                                height: TV_TICKER_FLAG_H,
                                              }}
                                            />
                                          )}
                                          {seg.text && (
                                            <span
                                              className="font-semibold uppercase"
                                              style={{
                                                fontSize: TV_TICKER_FS,
                                                letterSpacing: "1.6px",
                                                /* El lienzo mide " · " con sus
                                                   espacios: `pre` evita que el
                                                   flex se los coma. */
                                                whiteSpace: "pre",
                                                color:
                                                  i === 0
                                                    ? "#FFFFFF"
                                                    : "#E2E8F0",
                                              }}
                                            >
                                              {seg.text}
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                  {/* Separador = el mismo string que mide y
                                      pinta el lienzo exportado ("   ·   "): el
                                      aire va dentro, así la unión copia 0 →
                                      copia 1 queda igual que entre items
                                      (antes: 0 px y el punto salía pegado). */}
                                  <span
                                    className="shrink-0 font-semibold uppercase"
                                    style={{
                                      fontSize: TV_TICKER_FS,
                                      letterSpacing: "1.6px",
                                      color: "#475569",
                                      whiteSpace: "pre",
                                    }}
                                  >
                                    {"   ·   "}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Crédito de foto (derecha, sobre el ticker). Sombra
                        suave: en el vídeo limpio no hay velo detrás. */}
                    {photoCaption && photoCaption.trim() && (
                      <div
                        className="absolute overflow-hidden text-right font-medium"
                        style={{
                          right: TV_PAD,
                          bottom: TV_TICKER_H + 24,
                          fontSize: TV_CAP_FS,
                          lineHeight: "28px",
                          color: "#E2E8F0",
                          textShadow: "0 0 6px rgba(0, 0, 0, 0.85)",
                          maxWidth: TV_W - TV_PAD * 2 - TV_STACK_W - tvUi(40),
                        }}
                      >
                        {photoCaption.trim()}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Top Text Content Area (1:1 with canvas metrics) */}
                <div
                  style={{
                    paddingTop: `${previewPadTop}px`,
                    paddingLeft: `${previewPadX}px`,
                    paddingRight: `${previewPadRight}px`,
                    // Transición «texto → vídeo» (4:5): el bloque entero se
                    // desvanece; el sello de abajo nunca se toca.
                    opacity: 1 - textFadeP,
                  }}
                  className="z-20 relative select-none"
                >
                  {/* Category + Country Single-line Bar */}
                  <div className="flex items-center gap-2 w-full overflow-hidden whitespace-nowrap min-w-0">
                    <span
                      style={{
                        fontSize: `${previewHeaderSize}px`,
                        letterSpacing: previewHeaderTracking,
                      }}
                      className="font-semibold uppercase text-white font-['Lexend'] shrink-0 select-none"
                    >
                      {category || "GEOPOLÍTICA"}
                    </span>

                    {countryPlacement === "line" &&
                      selectedCountries.length > 0 &&
                      (() => {
                        // Límite dinámico de países visibles: con categorías cortas
                        // se pueden mostrar más; con categorías largas menos.
                        const catLen = (category || "GEOPOLÍTICA").length;
                        const maxVisible =
                          catLen > 20 ? 3 : catLen > 12 ? 4 : 5;
                        const visible = selectedCountries.slice(0, maxVisible);
                        const hiddenN =
                          selectedCountries.length - visible.length;
                        return (
                          <>
                            <span
                              style={{ fontSize: `${previewHeaderSize}px` }}
                              className="text-neutral-500 shrink-0 font-mono px-0.5"
                            >
                              ·
                            </span>
                            <div
                              style={{
                                fontSize: `${previewHeaderSize}px`,
                                letterSpacing: previewHeaderTracking,
                              }}
                              className="inline-flex items-center gap-1 font-semibold uppercase text-neutral-300 font-['Lexend'] shrink-0 select-none"
                            >
                              {visible.map((c, idx) => (
                                <React.Fragment key={c.name}>
                                  {idx > 0 &&
                                    countryFormat !== "flags-only" && (
                                      <span className="text-neutral-500 text-[10px] mx-0.5">
                                        ·
                                      </span>
                                    )}
                                  <span className="inline-flex items-center gap-0.5">
                                    {countryFormat !== "names" && (
                                      <CountryFlag
                                        code={c.code}
                                        className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block shadow-xs"
                                      />
                                    )}
                                    {countryFormat !== "flags-only" && (
                                      <span>
                                        {countryFormat === "flags-codes"
                                          ? c.code
                                          : c.name.toUpperCase()}
                                      </span>
                                    )}
                                  </span>
                                </React.Fragment>
                              ))}
                              {hiddenN > 0 && (
                                <span className="text-neutral-500 font-mono ml-0.5">
                                  +{hiddenN}
                                </span>
                              )}
                            </div>
                          </>
                        );
                      })()}

                    <span className="flex-1 max-w-[50px] min-w-[16px] h-[1.5px] bg-white inline-block shrink-0"></span>
                  </div>

                  {/* Country Badge (if badge placement is selected) */}
                  {/* ≤4: bandera + nombre | 5-8: solo banderas 1 fila | >8: 2 filas */}
                  {countryPlacement === "badge" &&
                    selectedCountries.length > 0 &&
                    (() => {
                      const n = selectedCountries.length;
                      const showNames =
                        n <= 4 && countryFormat !== "flags-only";
                      const twoRows = n > 8;
                      const perRow = twoRows
                        ? Math.min(10, Math.ceil(n / 2))
                        : n;
                      const rows = twoRows
                        ? [
                            selectedCountries.slice(0, perRow),
                            selectedCountries.slice(perRow),
                          ]
                        : [selectedCountries];
                      return (
                        <div
                          style={{
                            marginTop: `${Math.round(14 * previewScale)}px`,
                          }}
                          className="flex flex-col gap-1"
                        >
                          {showNames ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {selectedCountries.map((c) => (
                                <span
                                  key={c.name}
                                  className="inline-flex items-center gap-1.5 text-neutral-200 text-[10px] font-semibold tracking-wide"
                                >
                                  <CountryFlag
                                    code={c.code}
                                    className="w-3.5 h-2.5 object-cover rounded-[1px]"
                                  />
                                  <span>{c.name.toUpperCase()}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            rows.map((rowItems, ri) => (
                              <div
                                key={ri}
                                className="flex items-center gap-1.5"
                              >
                                {rowItems.map((c) => (
                                  <span
                                    key={c.name}
                                    title={c.name}
                                    className="inline-block"
                                  >
                                    <CountryFlag
                                      code={c.code}
                                      className="w-5 h-3.5 object-cover rounded-xs shadow-sm"
                                    />
                                  </span>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })()}

                  {/* Title with dynamic Real-time Font Size and Spacing */}
                  <h1
                    style={{
                      marginTop: `${previewGapCatTitle}px`,
                      fontSize: `${previewTitleSize}px`,
                      lineHeight: `${previewTitleLineH}px`,
                      // El lienzo exporta sin tracking (el global de la app hereda
                      // −0.015em): aquí se anula para render igual que el archivo.
                      letterSpacing: 0,
                    }}
                    className="font-bold text-white font-['Lexend'] drop-shadow-sm transition-[font-size,margin]"
                  >
                    {previewTitleLines.map((line, i) => (
                      <span key={i} className="block whitespace-nowrap">
                        {line || "\u00A0"}
                      </span>
                    ))}
                  </h1>

                  {/* Description with dynamic Real-time Font Size and Spacing */}
                  {previewDescLines.length > 0 && (
                    <p
                      style={{
                        marginTop: `${previewGapTitleDesc}px`,
                        fontSize: `${previewDescSize}px`,
                        lineHeight: `${previewDescLineH}px`,
                        letterSpacing: 0,
                      }}
                      className="text-neutral-300 font-normal font-['Lexend'] transition-[font-size,margin]"
                    >
                      {previewDescLines.map((line, i) => (
                        <span key={i} className="block whitespace-nowrap">
                          {line || "\u00A0"}
                        </span>
                      ))}
                    </p>
                  )}
                </div>

                {/* Media Container (inicio dinámico en 9:16, 40 % fijo en 4:5;
                    con el texto en salida sube hasta sangrar la tarjeta) */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    // Portada cruda del aviso: a sangre sobre la tarjeta
                    // entera, sin escala y por encima de texto, tweet y sello
                    // (z-45 < z-50 del cartel, que llega después).
                    top: warningCoverClean
                      ? "0%"
                      : `${previewMediaTopPct * (1 - textFadeP)}%`,
                    zIndex: warningCoverClean ? 45 : textFadeP > 0 ? 30 : 0,
                    transform: warningCoverClean
                      ? "none"
                      : `scale(${mediaZoom}) translate(${mediaOffsetX}px, ${mediaOffsetY}px)`,
                    transformOrigin: 'center center',
                  }}
                >
                  {previewMediaEl}

                  {/* Tema de fondo musical (solo video, opcional) */}
                  {mediaType === "video" && bgAudio && (
                    <audio
                      ref={bgAudioElementRef}
                      src="/assets/audio/BlackNewsPress-Background.mp3"
                      loop
                      style={{ display: "none" }}
                    />
                  )}

                  {/* Soft Gradient Fade from black on top of media */}
                  {blendFade && (
                    <div
                      className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none"
                      style={{ opacity: 1 - textFadeP }}
                    />
                  )}

                  {/* Subtle bottom vignette */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                </div>

                {/* Tarjeta «tweet embebido»: simula el embed de X sin API key.
                    Se apoya sobre el sello inferior (medido) y admite subida
                    extra con «Altura», para que nunca quede «muy abajo».
                    `tweetOn` la limita a los segundos elegidos en vídeo. */}
                {tweetOn && (tweetText || tweetHtml) && (
                  <div
                    className="absolute inset-x-0 px-3 pb-3 pt-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent"
                    style={{
                      pointerEvents: "none",
                      // Por encima del video (z-30 durante el fundido texto->video) y por
                      // debajo del cierre z-40: la tarjeta manda sobre el clip, no al reves.
                      zIndex: textFadeP > 0 ? 35 : 25,
                      bottom: previewFooterH + tweetLift,
                    }}
                  >
                    <div className="rounded-2xl border border-white/15 bg-neutral-950/85 backdrop-blur-md px-3 py-2.5 shadow-2xl">
                      <div className="flex items-start gap-2.5">
                        {/* Avatar (foto de perfil) */}
                        <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-white/10 ring-1 ring-white/20 grid place-items-center">
                          {tweetAvatar ? (
                            <img
                              src={tweetAvatar}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-[13px] font-bold text-neutral-400">
                              {(tweetName || tweetHandle || "B").replace(/^@/, "").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Nombre + check + @usuario + fecha */}
                          <div className="flex items-center gap-1 flex-wrap leading-none">
                            <span className="text-[11.5px] font-semibold text-white truncate max-w-[45%]">
                              {tweetName || "Usuario"}
                            </span>
                            <svg viewBox="0 0 22 22" aria-label="Verificado" className="w-3 h-3 shrink-0">
                              <path
                                fill="#1d9bf0"
                                d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.445 1.054.75 1.687.882.635.13 1.294.083 1.902-.143.272.587.702 1.086 1.24 1.44.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
                              />
                            </svg>
                            <span className="text-[10.5px] text-neutral-400 truncate">
                              {tweetHandle || ""}
                            </span>
                          </div>

                          {/* Cuerpo del tweet: en español si la traducción está
                              activa; el original queda en el tooltip. */}
                          <p
                            className="mt-1 text-[11.5px] leading-[1.35] text-neutral-100 whitespace-pre-wrap break-words line-clamp-5"
                            title={tweetBodyEs ? tweetBody : undefined}
                          >
                            {tweetBodyEs || tweetBody || tweetText}
                          </p>

                          {/* Fecha + iconos sociales */}
                          <div className="mt-1.5 flex items-center justify-between text-neutral-500">
                            <span className="flex items-center gap-1.5 text-[9.5px]">
                              <span>{tweetDate}</span>
                              {tweetBodyEs && (
                                <span
                                  className="text-[8.5px] font-semibold uppercase tracking-wider text-sky-400 border border-sky-400/40 rounded px-1 leading-[1.6]"
                                  title="Tweet traducido al español (el texto original: pasa el cursor por encima)"
                                >
                                  ES
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-2.5 text-[9.5px]">
                              <span className="flex items-center gap-0.5" title="Respuestas">
                                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/></svg>
                                12
                              </span>
                              <span className="flex items-center gap-0.5" title="Retweets">
                                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
                                34
                              </span>
                              <span className="flex items-center gap-0.5" title="Me gusta">
                                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg>
                                567
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Logotipo X */}
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-white/70" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {watermark && (
                  <div
                    className="absolute pointer-events-none select-none text-white font-['Lexend'] font-bold tracking-tight drop-shadow-lg"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '24px', opacity: watermarkOpacity, zIndex: 40, letterSpacing: '0.05em' }}
                  >
                    ■ BlackNews
                  </div>
                )}
                {/* Bottom Watermark Logo: "■ BlackNews" & Right-Aligned Caption.
                    Con el vídeo a sangre (z-30 durante el fundido) el sello
                    sube a z-30: mismo nivel, pero va después en el DOM, así
                    que siempre pinta por encima — nunca se oculta. */}
                <div
                  ref={previewFooterRef}
                  className="p-6 sm:p-7 flex items-center justify-between gap-3 relative mt-auto border-t border-white/5 bg-gradient-to-t from-black via-black/80 to-transparent"
                  style={{ zIndex: textFadeP > 0 ? 30 : 20 }}
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-4 h-4 bg-white rounded-none"></div>
                    <span className="text-sm sm:text-base font-bold text-white tracking-tight font-['Lexend']">
                      BlackNews
                    </span>
                  </div>

                  {/* Right-aligned compact photo caption / character text (Only if present, at same height) */}
                  <div className="flex items-center gap-2.5 justify-end flex-1 min-w-0 pl-3">
                    {photoCaption && photoCaption.trim() ? (
                      <span
                        className="text-[10px] sm:text-[11.5px] font-normal text-neutral-300 font-['Lexend'] tracking-wide truncate block text-right drop-shadow-md select-none max-w-[280px] sm:max-w-[400px]"
                        title={photoCaption.trim()}
                      >
                        {photoCaption.trim()}
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            {/* Cierre de marca opcional (APAGADO por defecto): tapa la
                tarjeta mientras suena el sello. Es el mismo <video> que usa
                la fase de cierre de la exportación, así que la vista previa y
                el archivo salen idénticos. Se oculta con `opacity` (nunca
                `display:none`): si no, el navegador deja de decodificar
                fotogramas y rVFC deja de disparar. Encuadre «contain» sobre
                negro, igual que paintOutroFrame en la exportación. */}
            {exportsVideo && videoOutro && (
              <video
                ref={outroRef}
                src={outroVideoSrc}
                className="absolute inset-0 w-full h-full object-contain bg-black pointer-events-none select-none"
                style={{
                  zIndex: 40,
                  opacity: outroActive ? 1 : 0,
                  transition: "opacity 150ms linear",
                }}
                playsInline
                preload="auto"
                muted={isMuted}
                onLoadedMetadata={(e) => {
                  const dur =
                    Math.round((e.currentTarget.duration || 0) * 10) / 10;
                  if (dur > 0) setOutroDuration(dur);
                }}
                onEnded={endPreviewOutro}
                onError={endPreviewOutro}
              />
            )}

            {/* Aviso de contenido sensible antes del clip */}
            {exportsVideo && contentWarning && (
              <video
                ref={warningRef}
                src={warningVideoSrcValue}
                className="absolute inset-0 w-full h-full object-contain bg-black pointer-events-none select-none"
                style={{
                  zIndex: 50,
                  opacity: warningActive ? 1 : 0,
                  transition: "opacity 150ms linear",
                }}
                playsInline
                preload="auto"
                muted={isMuted}
                onLoadedMetadata={(e) => {
                  const dur = Math.round((e.currentTarget.duration || 0) * 10) / 10;
                  if (dur > 0) setWarningDuration(dur);
                }}
                onEnded={() => endPreviewWarning()}
                onError={() => {
                  // Si se rompe mientras suena, se salta al clip; si falló al
                  // cargar, la portada llega a showWarningCard y decide ahí.
                  if (warningActiveRef.current) endPreviewWarning();
                }}
              />
            )}

            {/* Indicador de fase: avisa de que está corriendo la portada o el
                cartel (también mientras exporta, para ver qué se graba). */}
            {(warningActive || warningFrameActive) && (
              <div className="absolute left-2 top-2 z-[60] flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-400/95 text-black text-[10px] font-bold shadow-lg pointer-events-none select-none">
                <AlertTriangle className="w-3 h-3" />
                {warningFrameActive
                  ? `Portada (miniatura) · ${warningFrameDur} s → cartel`
                  : "Aviso de contenido sensible"}
              </div>
            )}
          </div>

          {/* Transporte de la vista previa: mover el clip hacia adelante y
              hacia atrás. La barra recorre todo el archivo —si el destino
              queda fuera del rango de recorte el vídeo se queda en pausa
              sobre ese fotograma para inspeccionarlo, y play vuelve al rango
              exportado— y los botones saltan 1 s o 10 s. Sólo en vídeo y
              desactivado mientras exporta (allí manda el grabador). */}
          {exportsVideo && (
            <div className="flex items-center gap-1.5 sm:gap-2 pt-0.5">
              <button
                type="button"
                onClick={togglePreviewPlay}
                disabled={isRecordingVideo}
                title="Reproducir / pausar la vista previa"
                aria-label="Reproducir o pausar la vista previa"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isVideoPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => nudgePreview(-10)}
                disabled={isRecordingVideo || videoDuration <= 0}
                title="Retroceder 10 segundos"
                aria-label="Retroceder 10 segundos"
                className={seekBtnCls}
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => nudgePreview(-1)}
                disabled={isRecordingVideo || videoDuration <= 0}
                title="Retroceder 1 segundo"
                aria-label="Retroceder 1 segundo"
                className={seekBtnCls}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                ref={previewPosRef}
                type="range"
                min={0}
                step={0.1}
                disabled={isRecordingVideo || videoDuration <= 0}
                aria-label="Posición del video en la vista previa"
                className="flex-1 min-w-0 accent-emerald-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer disabled:opacity-40"
                onPointerDown={startScrub}
                onPointerUp={endScrub}
                onPointerCancel={endScrub}
                onInput={(e) => seekPreview(Number(e.currentTarget.value))}
              />

              <button
                type="button"
                onClick={() => nudgePreview(1)}
                disabled={isRecordingVideo || videoDuration <= 0}
                title="Avanzar 1 segundo"
                aria-label="Avanzar 1 segundo"
                className={seekBtnCls}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => nudgePreview(10)}
                disabled={isRecordingVideo || videoDuration <= 0}
                title="Avanzar 10 segundos"
                aria-label="Avanzar 10 segundos"
                className={seekBtnCls}
              >
                <ChevronsRight className="w-4 h-4" />
              </button>

              <span
                ref={previewTimeRef}
                className="font-mono text-[10px] text-neutral-400 tabular-nums shrink-0 w-[94px] text-right"
              >
                00:00.0 / 00:00.0
              </span>
            </div>
          )}

          {/* Miniatura de portada: la misma composición que se descarga,
              pintada en vivo. El botón queda debajo, a un clic de la vista
              previa que lo muestra. */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Miniatura · Portada 16:9
              </span>
              <span className="text-[10px] font-mono text-neutral-500">
                1920×1080
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/15 bg-black shadow-lg">
              <canvas
                ref={portadaCanvasRef}
                width={1920}
                height={1080}
                className="block w-full h-auto"
                aria-label="Vista previa de la portada 16:9"
              />
            </div>

            <button
              type="button"
              disabled={isExporting || isRecordingVideo}
              onClick={handleExportPortada}
              className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider rounded-xl border border-emerald-500/40 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title="Descarga una portada 1920×1080 con el fotograma actual del video, el titular y el logo. Pausa el video en el instante que quieras antes de descargar."
            >
              <ImageIcon className="w-4 h-4" />
              <span>Descargar Portada · 1920×1080</span>
            </button>
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {/* Primary: Export Video or Export PNG depending on mediaType */}
            {exportsVideo ? (
              // La exportación se compone íntegramente en el navegador (MediaRecorder
              // sobre el canvas compositor): sin servidor, sin subir el archivo.
              <button
                type="button"
                disabled={isRecordingVideo}
                onClick={handleExportVideo}
                className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50"
                title="Se procesa en tu navegador: el video no se sube a ningún servidor"
              >
                <Film className="w-4 h-4" />
                <span>
                  {isRecordingVideo
                    ? `Exportando video… ${recordingProgress}%`
                    : `Exportar Video ${postFormat} (en tu navegador)`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportPng}
                className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isExporting
                    ? `Procesando imagen ${postFormat}...`
                    : `Descargar Imagen PNG (${POST_W}×${POST_H})`}
                </span>
              </button>
            )}

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-2">
              {exportsVideo ? (
                <>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleExportPng}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-300" />
                    <span>Capturar PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copySuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copySuccess ? "¡Copiado!" : "Copiar PNG"}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copySuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copySuccess ? "¡Copiado!" : "Copiar PNG"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(
                        "Oriente Medio,\nen una nueva fase\nde incertidumbre",
                      );
                      setDescription(
                        "La escalada de tensiones entre Israel e Irán reconfigura el tablero regional y pone a prueba la estabilidad global.",
                      );
                      setCategory("GEOPOLÍTICA");
                      setSelectedCountries([
                        { name: "Israel", code: "IL", flag: "🇮🇱" },
                        { name: "Irán", code: "IR", flag: "🇮🇷" },
                      ]);
                      setFilter("bw-high");
                      setFontSizeTitle(62);
                      setFontSizeDesc(30);
                      showToast(
                        "Diseño restablecido al ejemplo oficial de referencia",
                      );
                    }}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Plantilla Ref.</span>
                  </button>
                </>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 text-center font-light pt-1">
              {exportsVideo && exportClipSeconds !== null && (
                <>
                  Se exportarán{" "}
                  <strong className="text-white font-semibold">
                    {exportTotalSeconds} s
                  </strong>{" "}
                  de video
                  {videoOutro
                    ? ` (clip + ${outroDuration.toFixed(1)} s de cierre BlackNews)`
                    : ""}
                  {maxVideoDuration > 0
                    ? ` (duración máxima: ${maxVideoDuration} s en «Duración máxima del clip»)`
                    : ""}
                  .
                  <br />
                </>
              )}
              {postFormat === "16:9"
                ? "Formato 16:9 (1920×1080) con estética de señal de TV: bug de canal con enlace, hora y «EN DIRECTO» opcionales, chyron de titular y marquee inferior en bucle infinito (con la intro activa, el vídeo arranca en B/N sin sonido y, al terminar la intro, reinicia en color con sonido mientras el titular viaja por el marquee). Óptimo para YouTube, pantallas y barras de noticias."
                : postFormat === "9:16"
                  ? "Formato óptimo para TikTok, YouTube Shorts, Reels y estados verticales (9:16)."
                  : "Formato óptimo para Instagram (4:5 vertical), LinkedIn, Twitter / X y estados de WhatsApp."}
              {exportsVideo &&
                " El video se compone en tu navegador: no se sube a ningún servidor."}
            </p>
          </div>
        </div>
      </div>

      {/* Video Export in Progress Dialog */}
      {isRecordingVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Film className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Exportando Video BlackNews {postFormat}
              </h3>
              <p className="text-xs text-neutral-400">
                {recordingPaused ? (
                  "⏸ Pausada: vuelve a la pestaña de BlackNews para continuar."
                ) : (
                  <>
                    {recordingProgress < 30 &&
                      `Preparando overlay tipográfico ${POST_W}×${POST_H}...`}
                    {recordingProgress >= 30 &&
                      recordingProgress < 65 &&
                      (fastExport
                        ? "Codificando con aceleración de hardware…"
                        : "Componiendo fotogramas en tu navegador...")}
                    {recordingProgress >= 65 &&
                      recordingProgress < 90 &&
                      (fastExport
                        ? "Codificando audio y empaquetando el MP4…"
                        : "Grabando video y audio en tiempo real...")}
                    {recordingProgress >= 90 &&
                      "Finalizando archivo y descargando..."}
                  </>
                )}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-white/10">
                <div
                  ref={recBarRef}
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, recordingProgress)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
                <span>
                  {POST_W} × {POST_H} px
                  {exportTotalSeconds !== null
                    ? ` · ${exportTotalSeconds} s`
                    : ""}{" "}
                  · grabación local
                </span>
                <span ref={recPctRef} className="font-bold text-white">
                  {recordingProgress}%
                </span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 leading-snug">
              Puedes minimizar el navegador o cambiar de pestaña: la exportación
              continúa procesándose en segundo plano sin detenerse.
            </p>

            <button
              type="button"
              onClick={handleCancelVideoExport}
              className="w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-red-500/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              <span>Cancelar Exportación</span>
            </button>
          </div>
        </div>
      )}

      {/* Export Success Modal with Direct Download & Preview */}
      {(exportedImageUrl || exportedVideoUrl) && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {exportedVideoUrl
                      ? `¡Video ${postFormat} Optimizado!`
                      : exportedPortada
                        ? "¡Portada 16:9 Exportada!"
                        : `¡Post ${postFormat} Exportado!`}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {exportedPortada
                        ? "1920 × 1080"
                        : `${POST_W} × ${POST_H}`}{" "}
                      px
                    </span>
                    {exportedVideoSize && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                        Peso: {exportedVideoSize}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExportedImageUrl(null);
                  setExportedVideoUrl(null);
                  setExportedVideoSize(null);
                  setExportedPortada(false);
                }}
                className="text-neutral-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Generated media preview */}
            <div
              className={`${
                exportedPortada
                  ? "aspect-[16/9]"
                  : postFormat === "9:16"
                    ? "aspect-[9/16]"
                    : postFormat === "16:9"
                      ? "aspect-[16/9]"
                      : "aspect-[4/5]"
              } max-h-[50vh] mx-auto rounded-xl overflow-hidden border border-white/15 bg-black shadow-lg`}
            >
              {exportedVideoUrl ? (
                <video
                  src={exportedVideoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={exportedImageUrl!}
                  alt={exportedPortada ? "Portada Exportada" : "Post Exportado"}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={exportedVideoUrl || exportedImageUrl!}
                download={
                  exportedVideoUrl ? exportVideoFileName : exportFileName
                }
                onClick={() =>
                  showToast(
                    `Descargando ${exportedVideoUrl ? "video" : exportedPortada ? "portada" : "imagen"}...`,
                  )
                }
                className="py-2.5 px-4 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-xl text-center hover:bg-neutral-200 transition-colors shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exportedVideoUrl
                    ? "Descargar Video"
                    : exportedPortada
                      ? "Descargar Portada"
                      : "Descargar PNG"}
                </span>
              </a>

              {exportedVideoUrl ? (
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="py-2.5 px-4 bg-neutral-900 border border-white/15 text-white text-xs font-semibold uppercase tracking-wider rounded-xl text-center hover:bg-neutral-850 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-neutral-300" />
                  <span>Capturar PNG</span>
                </button>
              ) : exportedPortada ? (
                <button
                  type="button"
                  onClick={handleCopyPortada}
                  className="py-2.5 px-4 bg-neutral-900 border border-white/15 text-white text-xs font-semibold uppercase tracking-wider rounded-xl text-center hover:bg-neutral-850 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copySuccess ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copySuccess ? "Copiado" : "Copiar Portada"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="py-2.5 px-4 bg-neutral-900 border border-white/15 text-white text-xs font-semibold uppercase tracking-wider rounded-xl text-center hover:bg-neutral-850 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copySuccess ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copySuccess ? "Copiado" : "Copiar Imagen"}</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 text-center font-light leading-snug">
              Tu navegador ya inició la descarga automática. Si tu navegador
              bloquea descargas en ventanas emergentes, pulsa el botón blanco de
              arriba o haz clic derecho sobre el archivo y selecciona{" "}
              <strong>
                "Guardar{" "}
                {exportedVideoUrl
                  ? "video"
                  : exportedPortada
                    ? "portada"
                    : "imagen"}{" "}
                como..."
              </strong>
              .
            </p>
          </div>
        </div>
      )}

      {/* JSON Import / Export Modal */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Copia de Seguridad & Restauración JSON
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Guarda o restaura todo el diseño y textos del post
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsJsonModalOpen(false);
                  setJsonError(null);
                  setJsonInputText("");
                }}
                className="text-neutral-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 font-light leading-relaxed">
              Pega aquí el código JSON de un post previamente copiado, o sube un
              archivo <code className="text-cyan-400 font-mono">.json</code>{" "}
              para restaurar al instante todos los campos, textos, selecciones
              geográficas, filtros y configuraciones.
            </p>

            {jsonError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
                {jsonError}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Código JSON del Post:</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        setJsonInputText(text);
                        setJsonError(null);
                        showToast("✓ Texto pegado desde el portapapeles");
                      }
                    } catch {
                      showToast("Usa Ctrl+V para pegar en el cuadro");
                    }
                  }}
                  className="text-cyan-400 hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                >
                  <Copy className="w-3 h-3" />
                  <span>Pegar desde Portapapeles</span>
                </button>
              </div>

              <textarea
                rows={8}
                value={jsonInputText}
                onChange={(e) => {
                  setJsonInputText(e.target.value);
                  setJsonError(null);
                }}
                placeholder='{\n  "version": 1,\n  "content": {\n    "title": "...",\n    "description": "..."\n  }\n}'
                className="w-full bg-neutral-900 border border-white/15 rounded-xl p-3 font-mono text-xs text-neutral-200 focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={jsonFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadJsonFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => jsonFileInputRef.current?.click()}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Subir .json</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJsonFile}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Descargar .json</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleApplyJson(jsonInputText)}
                className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Restaurar Post</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


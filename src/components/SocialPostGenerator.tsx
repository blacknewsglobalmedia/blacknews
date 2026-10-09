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
} from "lucide-react";
import { Report } from "../types/news";
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
import {
  CountryFlag,
  loadFlagImage,
  isRegionalFlagEmoji,
} from "./CountryFlag";
// Cierre de marca (opcional, apagado por defecto): se añade al final de los
// vídeos exportados y de la vista previa. Vite lo sirve como asset estático.
import outroVideoSrc from "../assets/videos/Blacknews.mp4";

// Las banderas viven en CountryFlag.tsx (compartido con la barra de relojes):
// se reexportan aquí por compatibilidad con los importers existentes.
export { CountryFlag, loadFlagImage };

interface SocialPostGeneratorProps {
  reports?: Report[];
  categories?: string[];
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
    ctx.drawImage(source, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
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
    if (src && typeof src === "object") return Uint8Array.from(Object.values(src));
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
  const m: ArrayLike<number> | undefined = (
    mp4.getTrackById(vTrack.id) as any
  )?.tkhd?.matrix;
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

type MediaFilter = "bw-high" | "bw-smooth" | "noir" | "color" | "muted-color";

export const SocialPostGenerator: React.FC<SocialPostGeneratorProps> = ({
  reports = [],
  categories: propCategories = [],
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
  const enabledCategories = liveCategories.length > 0 ? liveCategories : EXPANDED_CATEGORIES;

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

  // Countries / Regional attribution
  const [selectedCountries, setSelectedCountries] = useState<CountryItem[]>([
    { name: "Israel", code: "IL", flag: "🇮🇱" },
    { name: "Irán", code: "IR", flag: "🇮🇷" },
  ]);
  const [customCountryName, setCustomCountryName] = useState("");
  const [countryPlacement, setCountryPlacement] = useState<
    "line" | "badge" | "none"
  >("line");
  const [countryFormat, setCountryFormat] = useState<
    "names" | "flags-names" | "flags-codes"
  >("names");
  const [countrySearch, setCountrySearch] = useState("");
  // Catálogo reactivo (destacados + personalizados + resto + Internacional)
  const countryCatalog = useCountryCatalog();
  const [autoFitHeader, setAutoFitHeader] = useState(true);
  const [headerSize, setHeaderSize] = useState(20);

  // Media state
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaSrc, setMediaSrc] = useState<string>(DEFAULT_MEDIA_SRC);
  const [mediaName, setMediaName] = useState<string>("Imagen predeterminada");
  const [isDragOver, setIsDragOver] = useState(false);

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
  // Intro animada del formato TV: es una pasada propia en la que el vídeo
  // arranca desde su principio en B&N y sin sonido; al terminar la intro el
  // vídeo vuelve a empezar en color y con sonido. El chyron desaparece tras
  // la intro y el titular pasa al ticker inferior.
  const [tvIntro, setTvIntro] = useState(true);
  const [tvIntroDur, setTvIntroDur] = useState(5); // segundos de intro
  // Cierre de marca opcional (Blacknews.mp4): APAGADO por defecto. Cuando está
  // activo, la vista previa y el archivo exportado terminan reproduciendo el
  // sello de cierre — a sangre del lienzo, sin chyron ni ticker — y con su
  // audio (salvo que se exporte en silencio). Todos los formatos: 4:5, 9:16 y
  // 16:9.
  const [videoOutro, setVideoOutro] = useState(false);
  const [outroDuration, setOutroDuration] = useState(OUTRO_DUR_FALLBACK);
  // true mientras el cierre ocupa la vista previa (y durante su fase en la
  // ruta clásica de exportación, donde el mismo <video> alimenta el lienzo).
  const [outroActive, setOutroActive] = useState(false);
  const outroActiveRef = useRef(false);

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
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
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
  const [aiSources, setAiSources] = useState<{ title: string; url: string }[]>([]);
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

  // El tema sobrevive a un refresco. Va fuera del borrador para que el JSON
  // que la redacción comparte no arrastre el texto de partida.
  useEffect(() => {
    try {
      localStorage.setItem("blacknews_ai_topic", aiTopic);
    } catch {}
  }, [aiTopic]);

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
    if (mediaType !== "video" || !(videoDuration > 0)) return null;
    const duration = videoDuration;
    const s = Math.max(0, Math.min(trimStart, Math.max(duration - 0.1, 0)));
    let e =
      trimEnd > s && duration > 0 ? Math.min(trimEnd, duration) : duration;
    if (maxVideoDuration > 0)
      e = Math.min(e, s + maxVideoDuration * videoSpeed);
    if (!(e > s)) return null;
    return Math.round(((e - s) / videoSpeed) * 10) / 10;
  })();
  // Total con el cierre BlackNews encendido: lo que de verdad durará el
  // archivo. La intro TV16:9 no se suma aquí porque sólo alarga la salida.
  const exportTotalSeconds =
    exportClipSeconds === null
      ? null
      : Math.round(
          (exportClipSeconds + (videoOutro ? outroDuration : 0)) * 10,
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

    if (!selectedCountries.some((c) => c.name.toLowerCase() === target.name.toLowerCase())) {
      setSelectedCountries([...selectedCountries, target]);
    }
    setCustomCountryName("");
    showToast(`País/Región "${target.name}" añadido al post`);
  };

  // Remove country — por nombre (identidad única entre seleccionados)
  const handleRemoveCountry = (country: CountryItem) => {
    const name = country.name.toLowerCase();
    setSelectedCountries((prev) => prev.filter((c) => c.name.toLowerCase() !== name));
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

    if (!isImage && !isVideo) {
      showToast("Por favor sube un archivo de imagen o video válido.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setMediaSrc(objectUrl);
    setMediaType(isVideo ? "video" : "image");
    setMediaName(file.name);

    if (isVideo) {
      uploadedVideoFileRef.current = file;
      setIsVideoPlaying(true);
      const tempVideo = document.createElement("video");
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        const dur = Math.round((tempVideo.duration || 0) * 10) / 10;
        if (dur > 0) {
          setVideoDuration(dur);
          setTrimStart(0);
          setTrimEnd(dur);
        }
      };
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
        mediaUrl: mediaSrc.startsWith("blob:") ? null : mediaSrc,
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
          const validCountries = data.content.selectedCountries.filter(
            (c: unknown): c is CountryItem => {
              if (!c || typeof c !== "object") return false;
              const cand = c as Partial<CountryItem>;
              return (
                typeof cand.name === "string" &&
                cand.name.trim() !== "" &&
                typeof cand.code === "string" &&
                typeof cand.flag === "string"
              );
            },
          );
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
      if (typeof data.tvShowClock === "boolean") setTvShowClock(data.tvShowClock);
      if (typeof data.tvIntro === "boolean") setTvIntro(data.tvIntro);
      if (typeof data.tvIntroDur === "number" && data.tvIntroDur > 0) {
        setTvIntroDur(data.tvIntroDur);
      }
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
        const videoFallback =
          data.mediaSettings.mediaType === "video" && !isVideoMedia;
        if (data.mediaSettings.mediaType)
          setMediaType(isVideoMedia ? "video" : "image");
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
    return (space > max * 0.6 ? head.slice(0, space) : head.slice(0, max)).trim();
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
    const oneLine = body.replace(/\s+/g, " ").trim();
    const prefix = flags ? `[${flags}] » ` : "";
    const budget = Math.max(40, AI_TWEET_LIMIT - prefix.length - AI_TWEET_FOOTER.length);
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
      const code = typeof cand.code === "string" ? cand.code.trim().toUpperCase() : "";
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

  const applyAiResult = (payload: unknown) => {
    const root =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const raw =
      root.content && typeof root.content === "object"
        ? (root.content as Record<string, unknown>)
        : {};
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

    const rawCategory = typeof raw.category === "string" ? raw.category.trim() : "";
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
              title: typeof item.title === "string" ? item.title : String(item.url),
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
      notes.push("ningún país propuesto existía en el catálogo, se mantienen los actuales");
    }
    const tweetLength = nextTweet.tweet.length;
    if (nextTweet.trimmed) {
      notes.push(
        `el cuerpo del tweet se recortó para no pasar de ${AI_TWEET_LIMIT} caracteres; amplíalo a mano en la caja si falta algo`,
      );
    } else if (tweetLength > AI_TWEET_LIMIT) {
      notes.push(`el tweet tiene ${tweetLength} caracteres, tope ${AI_TWEET_LIMIT}`);
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
            text: "✓ JSON y tweet listos: revísalos, aplica el JSON al post y sube la foto o el vídeo.",
          },
    );
  };

  const handleGenerateAi = async () => {
    if (aiBusy) return;
    const topic = aiTopic.trim();
    if (!topic) {
      setAiNotice({
        kind: "warn",
        text: "Escribe primero el tema o el texto de partida en el cuadro de arriba.",
      });
      return;
    }
    setAiBusy(true);
    setAiNotice(null);
    setAiSources([]);
    setAiSearch(null);
    try {
      // Sólo el texto de partida: la IA parte de lo que escribe la persona y
      // de lo que encuentre en la web, sin pisar nada de lo que ya haya en el
      // generador hasta que se pulse «Aplicar».
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: topic,
          categories: enabledCategories,
          countries: countryCatalog.map((c) => ({ code: c.code, name: c.name })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setAiNotice({
          kind: "error",
          text: data?.error || `El servidor no respondió (HTTP ${response.status}).`,
        });
        return;
      }
      applyAiResult(data.data);
    } catch {
      setAiNotice({
        kind: "error",
        text: "Sin respuesta del servidor: comprueba que el Worker expone /api/ai/generate.",
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
    tvShowLive,
    tvShowClock,
    tvIntro,
    tvIntroDur,
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
    } catch {} finally {
      draftRestoredRef.current = true;
    }
  }, []);

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

  // Sync video speed with preview video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = videoSpeed;
    }
  }, [videoSpeed]);

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
    if (forceColor) return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)})`;
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
    fmt: "names" | "flags-names" | "flags-codes" = countryFormat,
  ) => {
    if (selectedCountries.length === 0) return "";
    switch (fmt) {
      case "flags-codes":
        return selectedCountries.map((c) => `${c.flag} ${c.code}`).join(" · ");
      case "flags-names":
        return selectedCountries
          .map((c) => `${c.flag} ${c.name.toUpperCase()}`)
          .join(" · ");
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
    selectedCountries.forEach((c, i) => {
      if (i > 0) tvTickerCountries.push({ text: " · " });
      tvTickerCountries.push({
        code: c.code,
        emoji: c.flag,
        text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
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
      ? [tvTickerTitle.length > 110 ? `${tvTickerTitle.slice(0, 110)}…` : tvTickerTitle]
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

    // 2) Velos de legibilidad (barra de canal y chyron)
    ctx.save();
    const topScrim = ctx.createLinearGradient(0, 0, 0, 260);
    topScrim.addColorStop(0, "rgba(0,0,0,0.92)");
    topScrim.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, W, 260);
    const botScrim = ctx.createLinearGradient(0, H - 640, 0, H);
    botScrim.addColorStop(0, "rgba(0,0,0,0)");
    botScrim.addColorStop(1, "rgba(0,0,0,0.94)");
    ctx.fillStyle = botScrim;
    ctx.fillRect(0, H - 640, W, 640);
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
          ctx.fillStyle = "#94A3B8";
          ctx.fillText(item.text, cx, rowMidY - TV_CTRY_DY);
          cx += ctx.measureText(item.text).width;
          if (i < flagsData.length - 1) {
            ctx.fillStyle = "#64748B";
            ctx.fillText("  ·  ", cx, rowMidY - TV_CTRY_DY);
            cx += ctx.measureText("  ·  ").width;
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
    const tickerCellW = tickerItemWs.reduce((sum, w) => sum + w + tickerSepW, 0);
    if (Number.isFinite(tickerCellW) && tickerCellW > 0) {
      const tickerCycle =
        (((typeof outTime === "number" ? outTime : 0) * TV_TICKER_SPEED) %
          tickerCellW +
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

    // 7) Crédito de foto (derecha, sobre el ticker)
    if (photoCaption && photoCaption.trim()) {
      ctx.save();
      ctx.font = `500 ${TV_CAP_FS}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "0px";
      ctx.fillStyle = "#E2E8F0";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      const maxCapW = W - TV_PAD - (TV_PAD + TV_STACK_W + tvUi(40));
      let cap = photoCaption.trim();
      if (maxCapW > 80 && ctx.measureText(cap).width > maxCapW) {
        while (
          ctx.measureText(cap + "…").width > maxCapW &&
          cap.length > 3
        ) {
          cap = cap.slice(0, -1);
        }
        cap += "…";
      }
      ctx.fillText(cap, W - TV_PAD, H - TV_TICKER_H - 44);
      ctx.restore();
    }
  };

  // Render high-res canvas (1080×1350 en 4:5, 1080×1920 en 9:16, 1920×1080 en 16:9)
  const renderToCanvas = async (
    targetCanvas: HTMLCanvasElement,
    mediaElement?: HTMLImageElement | HTMLVideoElement,
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
  ): Promise<void> => {
    const W = POST_W;
    const H = POST_H;

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
            countryFormat !== "names" ? await loadFlagImage(c.code) : null;
          const text =
            countryFormat === "flags-codes" ? c.code : c.name.toUpperCase();
          return { code: c.code, img, text };
        }),
      ));

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

    // Formato TV 16:9: composición propia de señal de televisión.
    if (postFormat === "16:9") {
      drawTvFrame(
        ctx,
        mediaElement,
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

    // 2. Category & Country Header Line (Guaranteed Single Line with Vector Flags)
    ctx.save();
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
      if (countryPlacement === "line" && flagsData.length > 0) {
        totalW += ctx.measureText("  ·  ").width;
        const flagW = Math.round(fSize * 1.3);
        for (let i = 0; i < flagsData.length; i++) {
          if (countryFormat !== "names" && flagsData[i].img) {
            totalW += flagW + 6;
          }
          totalW += ctx.measureText(flagsData[i].text).width;
          if (i < flagsData.length - 1) {
            totalW += ctx.measureText(" · ").width;
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

    ctx.font = `600 ${curHeaderSize}px 'Lexend', sans-serif`;
    ctx.letterSpacing = `${curLetterSpacing}px`;
    ctx.fillStyle = "#FFFFFF";

    let curX = padX;
    ctx.fillText(catUpper, curX, curY);
    curX += ctx.measureText(catUpper).width;

    if (countryPlacement === "line" && flagsData.length > 0) {
      ctx.fillStyle = "#64748B";
      const sepStr = "  ·  ";
      ctx.fillText(sepStr, curX, curY);
      curX += ctx.measureText(sepStr).width;

      const flagW = Math.round(curHeaderSize * 1.3);
      const flagH = Math.round(flagW * 0.68);
      const flagOffsetY = Math.round((curHeaderSize - flagH) / 2);

      for (let i = 0; i < flagsData.length; i++) {
        const item = flagsData[i];
        if (countryFormat !== "names" && item.img) {
          ctx.drawImage(item.img, curX, curY + flagOffsetY, flagW, flagH);
          curX += flagW + 6;
        }
        ctx.fillStyle = "#E2E8F0";
        ctx.fillText(item.text, curX, curY);
        curX += ctx.measureText(item.text).width;

        if (i < flagsData.length - 1) {
          ctx.fillStyle = "#64748B";
          const midSep = " · ";
          ctx.fillText(midSep, curX, curY);
          curX += ctx.measureText(midSep).width;
        }
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
    if (countryPlacement === "badge" && flagsData.length > 0) {
      ctx.save();
      const badgeFontSize = 18;
      ctx.font = `600 ${badgeFontSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = "1.5px";
      ctx.textBaseline = "top";

      const bFlagW = Math.round(badgeFontSize * 1.3);
      const bFlagH = Math.round(bFlagW * 0.68);
      const bFlagOffsetY = Math.round((badgeFontSize - bFlagH) / 2);
      let bX = padX;

      for (let i = 0; i < flagsData.length; i++) {
        const item = flagsData[i];
        if (item.img) {
          ctx.drawImage(item.img, bX, curY + bFlagOffsetY, bFlagW, bFlagH);
          bX += bFlagW + 7;
        }
        ctx.fillStyle = "#CBD5E1";
        ctx.fillText(item.text, bX, curY);
        bX += ctx.measureText(item.text).width;
        if (i < flagsData.length - 1) {
          ctx.fillStyle = "#64748B";
          const sep = "   ·   ";
          ctx.fillText(sep, bX, curY);
          bX += ctx.measureText(sep).width;
        }
      }
      ctx.restore();
      curY += badgeFontSize + gapCategoryToTitle;
    }

    // 3. Title (Lexend Bold)
    ctx.save();
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
      ctx.font = `400 ${fontSizeDesc}px 'Lexend', sans-serif`;
      ctx.fillStyle = "#E2E8F0";
      ctx.textBaseline = "top";
      const descLineHeight = Math.round(fontSizeDesc * descLineHeightRatio);
      // Mismo tope que la vista previa (5 líneas con "…" de corte): lo que no
      // cabe en pantalla tampoco se dibuja en el archivo exportado.
      const descLines = capDescLines(
        wrapText(ctx, description, contentWidth),
      );
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
    const mediaTopY = Math.round(Math.max(curY, textZoneFloor));
    const mediaHeight = H - mediaTopY;

    if ((mediaElement || frameOverride) && !isOverlayOnly) {
      ctx.save();
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
    if (blendFade) {
      ctx.save();
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

    // Subtle bottom shadow vignette behind logo and caption
    ctx.save();
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

  // Export High-Res PNG
  const handleExportPng = async () => {
    try {
      setIsExporting(true);
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      if (mediaType === "video" && videoRef.current) {
        // Con la intro activa el PNG sale en el estado "HOLD" de la intro
        // (titular visible sobre la imagen en B&N): es la cara del clip.
        await renderToCanvas(
          canvas,
          videoRef.current,
          undefined,
          false,
          undefined,
          tvIntro ? tvIntroDur * 0.5 : 0,
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
              showToast(`¡Post ${postFormat} exportado en PNG con éxito (${POST_W}×${POST_H})!`);
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
          showToast(`¡Post ${postFormat} exportado en PNG con éxito (${POST_W}×${POST_H})!`);
          setIsExporting(false);
        }, "image/png");
      } catch (toBlobErr) {
        console.error(toBlobErr);
        try {
          const dataUrl = canvas.toDataURL("image/png");
          triggerDownload(dataUrl, filename);
          setExportedImageUrl(dataUrl);
          showToast(`¡Post ${postFormat} exportado en PNG con éxito (${POST_W}×${POST_H})!`);
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
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
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
    const fit = fitPortadaHeadline(ctx, headlineText, contentWidth, headlineMaxH);
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

      for (const f of flagsData || []) {
        // Corta antes del margen derecho: con muchos países el badge no
        // puede pasar del ancho de contenido.
        if (x > W - PORTADA_PAD_X) break;
        // Separador «·» entre bloques, con el mismo tracking del resto.
        if (drawnSomething) {
          ctx.font = "700 27px 'Lexend', sans-serif";
          ctx.letterSpacing = "3.5px";
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fillText("·", x, badgeY);
          x += ctx.measureText("·").width + 22;
        }
        if (f.img && f.img.naturalWidth > 0) {
          ctx.drawImage(f.img, x, badgeY - 14, 40, 28);
          x += 40 + 12;
        }
        ctx.font = "600 27px 'Lexend', sans-serif";
        ctx.letterSpacing = "3px";
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillText(f.text, x, badgeY);
        x += ctx.measureText(f.text).width + 24;
        drawnSomething = true;
      }
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
          img: countryFormat === "names" ? null : await loadFlagImage(c.code),
          text:
            countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
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

      let mediaEl: HTMLImageElement | HTMLVideoElement | undefined = undefined;
      if (mediaType === "video" && videoRef.current) {
        mediaEl = videoRef.current;
      } else {
        const img = await loadImageSafely(mediaSrc);
        if (img && img.complete && img.naturalWidth > 0) mediaEl = img;
      }

      await renderToCanvas(
        canvas,
        mediaEl,
        undefined,
        false,
        undefined,
        tvIntro ? tvIntroDur * 0.5 : 0,
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
          img: countryFormat === "names" ? null : await loadFlagImage(c.code),
          text:
            countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
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
        img: countryFormat === "names" ? null : await loadFlagImage(c.code),
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
    // Solo MP4/MOV (primer átomo "ftyp"). WebM y demás → ruta clásica.
    try {
      if (new TextDecoder().decode(new Uint8Array(raw, 4, 4)) !== "ftyp")
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
      const clip = await demuxAvcClip(raw);
      snap("demux");
      if (!clip) return "unsupported";
      const { samples, description, rot, codec } = clip;

      // ── 2. Ventana de exportación (mismo criterio que la ruta clásica) ──
      const ts = clip.ts;
      const srcDur = clip.srcDur;
      // En MP4 fragmentados (p. ej. los que graba MediaRecorder) el moov
      // inicial sólo declara el primer segmento y la pista "dura" 0,2 s
      // aunque el archivo tenga el clip entero: el <video> sí ve la duración
      // real, así que nos quedamos con el mayor de los dos.
      const elemDur = Number(videoRef.current?.duration ?? videoDuration);
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
      const introPad = tvIntro ? tvIntroDur : 0;

      const inRange = samples.filter((s) => {
        const t = s.cts / ts;
        return t >= start - 0.05 && t <= end + 0.05;
      });
      if (inRange.length < 2)
        throw new Error("No hay fotogramas en el rango seleccionado.");
      const outUs = (s: (typeof inRange)[number]) =>
        Math.max(0, Math.round((s.cts / ts - start) * (1 / speed) * 1e6));
      // Con B-frames el orden de llegada no es el de presentación: se reordena
      // por timestamp para que el archivo final no salga con fotogramas trocados.
      const sortedPts = inRange.map(outUs).sort((a, b) => a - b);
      const syncPts = new Set<number>();
      for (const s of inRange) if (s.is_sync) syncPts.add(outUs(s));
      syncPts.add(sortedPts[0]);
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
      let renderedAudio: AudioBuffer | null = null;
      if (!isMuted) {
        try {
          const decoderCtx = new OfflineAudioContext(1, 1, 44100);
          const fullAudio = await decoderCtx.decodeAudioData(raw.slice(0));
          const outRate = 48000;
          const oac = new OfflineAudioContext(
            2,
            Math.max(1, Math.ceil(outDur * outRate)),
            outRate,
          );
          const srcNode = oac.createBufferSource();
          srcNode.buffer = fullAudio;
          srcNode.playbackRate.value = speed;
          srcNode.connect(oac.destination);
          srcNode.start(0, start);
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
            if (outroClip && !isMuted) {
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
      // En silencio (isMuted) no se genera pista de audio: mudo es mudo.
      const outroAudioLen =
        isMuted || !outroClip
          ? 0
          : outroAudio
            ? outroAudio.length
            : Math.round(outroDurSec * 48000);

      const hasAudio =
        (!!renderedAudio && renderedAudio.length > 0) ||
        outroAudioLen > 0;
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
        Math.max(45000, (introPad + outDur + outroDurSec) * 1000 + 45000);
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
          img: countryFormat !== "names" ? await loadFlagImage(c.code) : null,
          text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
        })),
      );
      // Fuentes y overlay base (marquee en su posición 0 / arranque de intro).
      await renderToCanvas(
        canvas,
        undefined,
        cachedFlags,
        false,
        undefined,
        0,
      );
      setRecordingProgress(10);
      snap("warmup");

      // ── 6. Bucle decodificar → componer → codificar con cola FIFO sin bloqueos ──
      let draining = false;
      // Cada fotograma lleva su bandera: `outro` se pinta a sangre con
      // paintOutroFrame (sin chyron/ticker), el resto pasa por renderToCanvas.
      const decodedQueue: Array<{ frame: VideoFrame; outro: boolean }> = [];
      const targetFps = 30;
      const targetFrameDurationUs = Math.round(1_000_000 / targetFps);

      // ── Rejilla de salida: la línea de tiempo la marcan estas ranuras ──
      // El audio ya se coloca por muestras exactas (intro en silencio +
      // outDur + cierre), así que el vídeo debe emitir EXACTAMENTE esos
      // fotogramas. Emitir «un fotograma por fotograma de la fuente» —lo que
      // hacía el contador de emisiones— desincroniza el cierre con cualquier
      // fuente que no sea de 30 fps: un clip de 32 fps alargaba el tramo
      // principal un 6,7 % y el sello entraba con el audio ya sonando.
      const introSlots = Math.round(introPad * targetFps);
      const mainSlots = Math.max(2, Math.round(outDur * targetFps));
      const outroBaseSlot = introSlots + mainSlots;
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
          await waitWhile(
            () => (encoder as VideoEncoder).encodeQueueSize > 10,
          );
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
            const slot = item.outro
              ? outroBaseSlot + Math.max(0, rawSlot)
              : frame.timestamp < introPad * 1e6
                ? Math.min(rawSlot, Math.max(0, introSlots - 1))
                : Math.min(rawSlot, outroBaseSlot - 1);
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
            if (item.outro) {
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
                (slot * targetFrameDurationUs) / 1e6,
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

      decoder = new VideoDecoder({
        output: (frame) => {
          decodedQueue.push({ frame, outro: false });
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

      // ── 6b. Cierre opcional: se decodifica DESPUÉS de drenar el clip
      //      principal, para que sus fotogramas entren en orden al mismo
      //      codificador. La línea de tiempo la marca el contador de
      //      fotogramas emitidos, así que el sello sigue la secuencia sin
      //      más.
      const oc = outroClip;
      if (oc && oc.samples.length > 0) {
        const od = new VideoDecoder({
          output: (frame) => {
            decodedQueue.push({ frame, outro: true });
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
              duration: Math.max(
                1,
                Math.round((s.duration / oc.ts) * 1e6),
              ),
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
        // Intro TV: la salida arranca con introPad s de silencio y el audio
        // completo entra cuando el vídeo reinicia (color y con sonido). Si hay
        // cierre, su audio (o silencio si el sello va mudo) cierra la pista y
        // la iguala a la duración del vídeo.
        const introSamples = introPad > 0 ? Math.round(introPad * 48000) : 0;
        const mainLen = ra
          ? ra.length
          : outroAudioLen > 0
            ? Math.round(outDur * 48000)
            : 0;
        const segs: Array<{ buf: AudioBuffer | null; start: number; len: number }> =
          [
            { buf: ra, start: introSamples, len: mainLen },
            { buf: oa, start: introSamples + mainLen, len: outroAudioLen },
          ];
        const outLen = introSamples + mainLen + outroAudioLen;
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
      showToast(
        `¡Video ${postFormat} exportado en tu navegador (${sizeFormatted}) — exportación acelerada!`,
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
    if (mediaType !== "video") return;
    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas) {
      showToast("Carga un video antes de exportar.");
      return;
    }

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
          img: countryFormat !== "names" ? await loadFlagImage(c.code) : null,
          text: countryFormat === "flags-codes" ? c.code : c.name.toUpperCase(),
        })),
      );
      await renderToCanvas(
        canvas,
        video,
        cachedFlags,
        false,
        undefined,
        0,
      );
      setRecordingProgress(10);

      video.pause();
      video.loop = false;
      video.playbackRate = videoSpeed;
      // Con intro, la salida arranca en silencio; `step()` abre el audio al
      // terminar la intro, cuando el vídeo reinicia en color con sonido.
      video.muted = isMuted || tvIntro;

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

      let audioTrack: MediaStreamTrack | null = null;
      if (!isMuted) {
        try {
          let graph = audioGraphRef.current;
          if (!graph) {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(video);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioCtx.destination);
            graph = { ctx: audioCtx, dest };
            audioGraphRef.current = graph;
          }
          if (graph.ctx.state === "suspended") await graph.ctx.resume();
          audioTrack = graph.dest.stream.getAudioTracks()[0] ?? null;
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
      // Reloj de la intro (TV16:9): los primeros tvIntroDur s de salida son
      // una pasada propia — el clip desde su principio, en B/N y sin sonido —
      // y al terminar el vídeo vuelve a empezar en color y con sonido. La
      // salida total suma ese desfase (introPad) a la duración del clip.
      const introPad = tvIntro ? tvIntroDur : 0;
      // Duración del tramo de vídeo (sin la intro) y del cierre de marca.
      const clipOutDur = (end - start) / Math.max(videoSpeed, 0.01);
      const outroSec = videoOutro ? outroDuration : 0;
      let introPhase2 = false;
      let introWall0 = 0;
      // Fase de cierre (Blacknews.mp4): se activa al terminar el clip y la
      // dirige la misma máquina de estados (enterOutro/stepOutro/finish).
      let outroPhase = false;
      let outroEl: HTMLVideoElement | null = null;
      let outroOnEnded: (() => void) | null = null;
      const outTNow = () => {
        if (outroPhase) {
          return introPad + clipOutDur + (outroEl?.currentTime ?? 0);
        }
        const mediaT = Math.max(
          0,
          (video.currentTime - start) / Math.max(videoSpeed, 0.01),
        );
        if (!tvIntro) return mediaT;
        if (!introPhase2) {
          return Math.min(
            introWall0 > 0 ? (performance.now() - introWall0) / 1000 : 0,
            tvIntroDur,
          );
        }
        return introPad + mediaT;
      };
      let hardDeadline =
        performance.now() +
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
        outroPhase = false;
        outroActiveRef.current = false;
        setOutroActive(false);
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
        const totalOut = introPad + dur + outroSec;
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
          outroPhase = false;
          outroActiveRef.current = false;
          setOutroActive(false);
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
        const enterOutro = (): boolean => {
          if (outroPhase || !videoOutro) return false;
          const el = outroRef.current;
          if (!el) return false;
          outroPhase = true;
          outroEl = el;
          outroActiveRef.current = true;
          setOutroActive(true);
          try {
            video.pause();
          } catch {}
          el.muted = isMuted;
          try {
            el.currentTime = 0;
          } catch {}
          // El sello entra en la misma pista de audio que el clip: el nodo
          // MediaElementSource de un elemento sólo se crea una vez, por eso
          // queda cacheado en outroAudioNodeRef.
          if (!isMuted && audioGraphRef.current) {
            try {
              const graph = audioGraphRef.current;
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
          outroOnEnded = () => finish("fin-del-cierre");
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
        const onEnded = () => {
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
          // En la fase de cierre el reloj lo marca el <video> del sello.
          const el = (outroPhase && outroEl) || video;
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
          if (el.ended || (dur > 0 && el.currentTime >= dur - 0.03)) {
            return finish("fin-del-cierre");
          }
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
          // Segundo de salida (intro TV16:9): manda el render y el audio.
          const outT = outTNow();
          if (tvIntro) {
            const wantMuted = isMuted || outT < tvIntroDur;
            if (video.muted !== wantMuted) video.muted = wantMuted;
          }
          const tRender = performance.now();
          await renderToCanvas(
            canvas,
            video,
            cachedFlags,
            false,
            undefined,
            outT,
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
          (introPad + (end - start) / Math.max(videoSpeed, 0.01) + outroSec) *
            1000 +
            6000,
        );
        introWall0 = performance.now();
        video
          .play()
          .then(() => schedule())
          .catch((playErr) => finish(`play-error ${playErr}`));
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
      showToast(
        `¡Video ${postFormat} exportado en tu navegador (${sizeFormatted})!${formatNote}`,
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
  const previewCardWidth =
    postFormat === "16:9" ? 480 : postFormat === "9:16" ? 340 : 420;
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
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const updateIntroClock = (v: HTMLVideoElement) => {
    if (isRecordingRef.current) return;
    if (postFormat !== "16:9" || !tvIntro || mediaType !== "video") return;
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
      v.currentTime = trimStart;
      v.muted = isMutedRef.current;
      setTvIntroT(tvIntroDur);
      return;
    }
    v.muted = true;
    setTvIntroT((prev) => (Math.abs(prev - acc) >= 0.02 ? acc : prev));
  };

  useEffect(() => {
    if (postFormat !== "16:9" || !tvIntro || mediaType !== "video") return;
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
  }, [postFormat, tvIntro, mediaType, trimStart, tvIntroDur]);

  // Arranque de la intro: el vídeo parte desde su principio y en silencio;
  // al terminar, el reloj de arriba lo reinicia en color y con sonido. Se
  // rearma al activar la intro, volver al formato 16:9, cambiar la duración
  // o cargar otro vídeo: cada activación repite la pasada completa.
  useEffect(() => {
    if (postFormat !== "16:9" || !tvIntro || mediaType !== "video") return;
    if (isRecordingRef.current) return;
    tvIntroDoneRef.current = false;
    tvIntroAccumRef.current = 0;
    tvIntroWallRef.current = 0;
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
  }, [tvIntro, postFormat, mediaType, mediaSrc, tvIntroDur]);

  // Fase de la intro para la vista previa: con vídeo se sigue el tiempo real;
  // con imagen se pinta el estado "HOLD" (el mismo que exporta el PNG).
  const tvPhaseT =
    postFormat === "16:9" && tvIntro
      ? mediaType === "video"
        ? tvIntroT
        : tvIntroDur * 0.5
      : null;
  const tvInIntro = tvPhaseT !== null && tvPhaseT < tvIntroDur;
  const tvExitQ = tvInIntro ? tvIntroExit(tvPhaseT as number, tvIntroDur) : 0;
  const tvBoxIn = tvInIntro ? tvIntroBoxIn(tvPhaseT as number) : 1;
  const tvTagP = tvInIntro ? tvIntroTagIn(tvPhaseT as number) : 1;
  // El chyron sólo existe durante la intro: al terminar queda vídeo limpio.
  const tvShowChyron = !tvIntro || tvInIntro;
  // Filtro del media: intro = sin color; tras la intro = color original
  // (sólo ajuste tonal), como pidió el usuario.
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
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    return () => ro?.disconnect();
  }, [tvTickerKey, postFormat]);
  const tickerMarqueeDur =
    tickerCellW > 0 ? tickerCellW / TV_TICKER_SPEED : 20;

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
    previewTitleLines.length * Math.round(fontSizeTitle * titleLineHeightRatio) +
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
    if (videoOutro && mediaType === "video") return;
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
      const main = videoRef.current;
      if (main && !isRecordingRef.current) main.play().catch(() => {});
    }
  }, [videoOutro, mediaType]);

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
    const main = videoRef.current;
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
    videoRef.current?.pause();
    setIsVideoPlaying(true);
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
    const v = videoRef.current;
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
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - previewPosLastRef.current) < 0.02) return;
    writePreviewPos(v.currentTime, true);
  };

  const seekPreview = (target: number) => {
    const v = videoRef.current;
    if (!v || isRecordingRef.current) return;
    const dur = videoDuration || v.duration || 0;
    if (!(dur > 0)) return;
    const t = Math.min(Math.max(target, 0), Math.max(0, dur - 0.05));
    const lo = trimEnd > trimStart ? trimStart : 0;
    const hi = trimEnd > trimStart ? trimEnd : dur;
    const inRange = t >= lo && t < hi;
    const wasOutro = outroActiveRef.current;
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
    } else if (wasOutro) {
      v.play().catch(() => {});
      setIsVideoPlaying(true);
    }
  };

  const nudgePreview = (delta: number) => {
    const v = videoRef.current;
    if (v) seekPreview(v.currentTime + delta);
  };

  // Arranque y suelte de la barra: se pausa mientras se arrastra (la
  // posición no se escapa de las manos) y, al soltar, sólo se retoma si el
  // destino cae dentro del recorte.
  const startScrub = () => {
    const v = videoRef.current;
    if (!v || isRecordingRef.current) return;
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
    const v = videoRef.current;
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
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
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
        style={{ filter: mediaFilterCss }}
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
              // intro TV16:9 todavía no: la primera pasada es muda y en B/N.
              const introLooming =
                postFormat === "16:9" && tvIntro && !tvIntroDoneRef.current;
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

  return (
    <div className="font-['Lexend',sans-serif] space-y-8 pb-16">
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

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold mb-1">
            <Smartphone className="w-3.5 h-3.5 text-white" />
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-[calc(var(--bn-nav-h)_+_2.75rem)] lg:bottom-6 right-6 z-50 bg-white text-black px-4 py-2.5 text-xs font-sans font-medium rounded-xl border border-neutral-200 shadow-2xl flex items-center gap-2 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-black inline-block"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid: Controls (Left) vs Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Controls & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
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
              <span className="text-[11px] text-neutral-500 font-light block">
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

              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle o contexto clave que complementa el titular..."
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-xs sm:text-sm font-normal text-neutral-200 leading-relaxed focus:outline-none focus:border-white/40 resize-none font-['Lexend']"
              />
            </div>

            {/* Spacing & Interlineado Sub-section */}
            <div className="pt-3 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Espaciado entre Textos (1:1 con la exportación)</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Sep: {gapTitleToDesc}px · Interl: {titleLineHeightRatio}x
                </span>
              </div>

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
            </div>
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

              {/* Quick Category Chips */}
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

                {/* Country Display Placement */}
                <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-white/10 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCountryPlacement("line")}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      countryPlacement === "line"
                        ? "bg-white text-black font-bold"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Mostrar en la barra superior junto a la categoría"
                  >
                    En Línea
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountryPlacement("badge")}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      countryPlacement === "badge"
                        ? "bg-white text-black font-bold"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Mostrar como etiqueta destacada sobre el titular"
                  >
                    Insignia
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountryPlacement("none")}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      countryPlacement === "none"
                        ? "bg-white text-black font-bold"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Ocultar mención de países"
                  >
                    Ocultar
                  </button>
                </div>
              </div>

              {/* Single-line Format & Sizing Controls (When 'line' placement is active) */}
              {countryPlacement === "line" && selectedCountries.length > 0 && (
                <div className="p-3 bg-neutral-900/90 rounded-xl border border-white/10 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-300 font-semibold uppercase tracking-wider text-[11px]">
                      Estilo de países en línea
                    </span>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
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
                    </div>
                  </div>

                  {/* Header Auto-Fit vs Manual Size */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
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
                        Ajuste automático inteligente a 1 sola línea (garantiza
                        que quepan todos)
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

          {/* Card 2b: IA Editorial — JSON del post + tweet */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>IA Editorial · JSON + Tweet</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {enabledCategories.length} secciones · {countryCatalog.length} países
              </span>
            </div>

            {/* Aviso: éxito, salvaguarda del catálogo o fallo de la llamada */}
            {aiNotice && (
              <div
                className={`p-3 rounded-xl text-xs font-medium leading-relaxed border ${
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

            {/* Tema o texto de partida: el único input que necesita la IA */}
            <div className="space-y-2">
              <label
                htmlFor="ai-topic"
                className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Type className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tema o texto de partida</span>
              </label>

              <textarea
                id="ai-topic"
                rows={4}
                value={aiTopic}
                onChange={(e) => {
                  setAiTopic(e.target.value);
                  setAiNotice(null);
                }}
                placeholder="Escribe o pega el tema, la noticia o el contexto del que partir. La IA busca información relacionada en la web y redacta de ahí el JSON del post y el cuerpo del tweet."
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-sm text-neutral-100 leading-relaxed placeholder-neutral-600 focus:outline-none focus:border-emerald-400 resize-y min-h-[5.5rem]"
              />

              <p className="text-[11px] text-neutral-500 font-light leading-relaxed">
                Se guarda en este navegador. Lo que ya tengas en el generador no
                se toca hasta que pulses «Aplicar».
              </p>
            </div>

            {/* Acción principal + atajo a la configuración actual */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={aiBusy}
                title="Busca información relacionada en la web y devuelve el JSON del post y el cuerpo del tweet"
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:text-emerald-100/70 text-black font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiBusy ? "Buscando y redactando…" : "Generar con IA"}</span>
              </button>
              <button
                type="button"
                onClick={handleLoadCurrentJson}
                className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-white/10 shrink-0"
                title="Copia la configuración actual del generador a la caja de JSON"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cargar JSON actual</span>
              </button>
              <span className="text-[11px] text-neutral-500 font-light leading-relaxed">
                Investiga, redacta el JSON del post y el cuerpo del tweet (máx.{" "}
                {AI_TWEET_LIMIT} caracteres). Después subes la foto o el vídeo.
              </span>
            </div>

            {/* Qué ha buscado la IA: aviso si no hubo búsqueda y lista de fuentes */}
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
                      Fuentes consultadas
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
                            title={source.url}
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

            {/* JSON del post: ver, editar, copiar, pegar y aplicar */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>JSON del Post</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!aiJsonText) {
                        setAiNotice({
                          kind: "warn",
                          text: "No hay JSON que copiar todavía.",
                        });
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(aiJsonText);
                        showToast("✓ JSON copiado al portapapeles");
                      } catch {
                        showToast("No se pudo copiar directamente al portapapeles.");
                      }
                    }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copiar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePasteAiJson}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5"
                  >
                    <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Pegar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyAiJson}
                    className="px-3 py-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aplicar</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={10}
                value={aiJsonText}
                onChange={(e) => {
                  setAiJsonText(e.target.value);
                  setAiNotice(null);
                }}
                spellCheck={false}
                placeholder='{\n  "version": 2,\n  "content": {\n    "title": "...",\n    "description": "...",\n    "category": "..."\n  }\n}'
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 font-mono text-[11px] text-neutral-200 leading-relaxed focus:outline-none focus:border-emerald-400 resize-y min-h-[13rem]"
              />
            </div>

            {/* Tweet: ver, editar, copiar, con contador de 250 */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tweet (X)</span>
                </label>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                      aiTweet.length > AI_TWEET_LIMIT
                        ? "bg-red-500/10 border-red-500/40 text-red-400"
                        : "bg-neutral-900 border-white/10 text-neutral-300"
                    }`}
                    title={
                      aiTweet.length > AI_TWEET_LIMIT
                        ? "El tweet supera el límite: acorta el cuerpo"
                        : "Límite de 250 caracteres"
                    }
                  >
                    {aiTweet.length}/{AI_TWEET_LIMIT}
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyAiTweet}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copiar</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                value={aiTweet}
                onChange={(e) => {
                  setAiTweet(e.target.value);
                  setAiNotice(null);
                }}
                placeholder={
                  "[🇨🇳🇮🇷] » Cuerpo del tweet en una sola línea.\n\n■ #BlackNews"
                }
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-sm text-neutral-100 leading-relaxed focus:outline-none focus:border-emerald-400 resize-y"
              />
            </div>
          </div>

          {/* Card 3: Media Upload (Image or Video) */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-white" />
                <span>3. Imagen o Video (Arrastra o Selecciona)</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {mediaType === "video" ? "🎬 Modo Video" : "🖼️ Modo Imagen"}
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
                accept="image/*,video/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-white/5 rounded-2xl text-white">
                  {mediaType === "video" ? (
                    <VideoIcon className="w-6 h-6" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-white">
                  Arrastra aquí tu imagen o video, o haz clic para explorar
                </p>
                <p className="text-[11px] text-neutral-400 font-light">
                  Soporta PNG, JPG, WebP, AVIF, MP4 y WebM · También puedes
                  pegar con Ctrl+V
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
            {mediaType === "video" && (
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
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                      }
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

                {/* Video Format Selector (MP4 for X/Twitter vs WebM) */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Formato de Video</span>
                    </label>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                      {videoFormat === "mp4"
                        ? "MP4 (H.264 / AAC) · 100% X (Twitter) & Meta"
                        : "WebM (VP9) · Web abierta"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
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

                {/* Social Media Bitrate & Weight Optimization */}
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Optimización para X, Instagram & Meta</span>
                    </label>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                      {videoQuality === "social"
                        ? "3 Mbps · ~4 MB / 10 s"
                        : videoQuality === "compact"
                          ? "1.5 Mbps · ~2 MB / 10 s"
                          : "6 Mbps · ~7.5 MB / 10 s"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
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

                {/* Video Playback & Export Speed */}
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Velocidad de Video</span>
                    </label>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                      {videoSpeed === 1.0
                        ? "1.0x (Normal)"
                        : videoSpeed < 1.0
                          ? `${videoSpeed}x (Lento)`
                          : `${videoSpeed}x (Rápido)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => {
                          setVideoSpeed(speed);
                          if (videoRef.current) {
                            videoRef.current.playbackRate = speed;
                          }
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
                          if (videoRef.current) {
                            videoRef.current.currentTime = val;
                          }
                        }}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            const cur =
                              Math.round(videoRef.current.currentTime * 10) /
                              10;
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
                          if (videoRef.current) {
                            videoRef.current.currentTime = val;
                          }
                        }}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            const cur =
                              Math.round(videoRef.current.currentTime * 10) /
                              10;
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

                  {/* Summary badge & presets */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
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

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(videoDuration || 10, 5));
                          if (videoRef.current)
                            videoRef.current.currentTime = 0;
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
                          if (videoRef.current)
                            videoRef.current.currentTime = 0;
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
                          if (videoRef.current)
                            videoRef.current.currentTime = 0;
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
                          if (videoRef.current)
                            videoRef.current.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        Completo
                      </button>
                    </div>
                  </div>
                </div>

                {/* Duration Limiter */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 font-medium">
                      Duración máxima del clip de noticia:
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {maxVideoDuration > 0
                        ? `${maxVideoDuration} segundos`
                        : "Video completo"}
                    </span>
                  </div>
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
                </div>

                {/* Cierre de marca opcional: Blacknews.mp4 al final */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-neutral-200 block">
                      Cierre BlackNews (sello final)
                    </span>
                    <span className="text-[11px] text-neutral-400 font-light">
                      Añade {outroDuration.toFixed(1)} s de sello de marca al
                      final del vídeo exportado y de la vista previa, con su
                      audio (salvo que exportes en silencio). Desactivado por
                      defecto.
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={videoOutro}
                    onClick={() => setVideoOutro((v) => !v)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      videoOutro
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/50"
                        : "bg-neutral-950 text-neutral-400 border-white/10 hover:text-white"
                    }`}
                    title="Reproduce Blacknews.mp4 al finalizar el clip"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {videoOutro ? "Activado" : "Apagado"}
                  </button>
                </div>
              </div>
            )}

            {/* Sliders for exposure & blend fade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                  Difumina sutilmente el horizonte de la imagen contra el fondo
                  negro superior.
                </span>
              </div>
              <input
                type="checkbox"
                checked={blendFade}
                onChange={(e) => setBlendFade(e.target.checked)}
                className="w-4 h-4 accent-white rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-8 space-y-4">
          <div className="flex items-center justify-between">
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
            {postFormat === "16:9" && (
              <label
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title="Intro animada: el vídeo arranca desde su principio en B&N y sin sonido y, al terminar la intro, vuelve a empezar en color y con sonido"
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
            )}
            {postFormat === "16:9" && tvIntro && (
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
            {/* Atajo del cierre de marca: el mismo interruptor de la tarjeta 4,
                aquí junto a la intro para poder probarlo sin salir de la
                preview. Aplica en todos los formatos, no sólo en TV. */}
            {mediaType === "video" && (
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
            {postFormat === "16:9" ? (
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
                    {/* Media a sangre + velos de legibilidad */}
                    <div className="absolute inset-0 overflow-hidden bg-black">
                      {previewMediaEl}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] bg-gradient-to-b from-black/95 via-black/60 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[640px] bg-gradient-to-t from-black/95 via-black/70 to-transparent" />
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
                                    {i > 0 && (
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
                                    <span>
                                      {countryFormat === "flags-codes"
                                        ? c.code
                                        : c.name.toUpperCase()}
                                    </span>
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

                    {/* Crédito de foto (derecha, sobre el ticker) */}
                    {photoCaption && photoCaption.trim() && (
                      <div
                        className="absolute overflow-hidden text-right font-medium"
                        style={{
                          right: TV_PAD,
                          bottom: TV_TICKER_H + 24,
                          fontSize: TV_CAP_FS,
                          lineHeight: "28px",
                          color: "#E2E8F0",
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
                  selectedCountries.length > 0 && (
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
                        className="inline-flex items-center gap-1.5 font-semibold uppercase text-neutral-300 font-['Lexend'] truncate shrink min-w-0 select-none"
                      >
                        {selectedCountries.map((c, idx) => (
                          <React.Fragment key={c.name}>
                            {idx > 0 && (
                              <span className="text-neutral-500 text-[10px]">
                                ·
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 shrink-0">
                              {countryFormat !== "names" && (
                                <CountryFlag
                                  code={c.code}
                                  className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block shadow-xs"
                                />
                              )}
                              <span>
                                {countryFormat === "flags-codes"
                                  ? c.code
                                  : c.name.toUpperCase()}
                              </span>
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </>
                  )}

                <span className="flex-1 max-w-[50px] min-w-[16px] h-[1.5px] bg-white inline-block shrink-0"></span>
              </div>

              {/* Country Badge (if badge placement is selected) */}
              {countryPlacement === "badge" && selectedCountries.length > 0 && (
                <div
                  style={{ marginTop: `${Math.round(14 * previewScale)}px` }}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {selectedCountries.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 text-neutral-200 rounded text-[10px] font-semibold tracking-wide border border-white/15"
                    >
                      <CountryFlag
                        code={c.code}
                        className="w-3.5 h-2.5 object-cover rounded-[1px]"
                      />
                      <span>{c.name.toUpperCase()}</span>
                    </span>
                  ))}
                </div>
              )}

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

            {/* Media Container (inicio dinámico en 9:16, 40 % fijo en 4:5) */}
            <div
              className="absolute inset-0 overflow-hidden z-0"
              style={{ top: `${previewMediaTopPct}%` }}
            >
              {previewMediaEl}

              {/* Soft Gradient Fade from black on top of media */}
              {blendFade && (
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none" />
              )}

              {/* Subtle bottom vignette */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            </div>

            {/* Bottom Watermark Logo: "■ BlackNews" & Right-Aligned Caption */}
            <div className="p-6 sm:p-7 z-20 flex items-center justify-between gap-3 relative mt-auto border-t border-white/5 bg-gradient-to-t from-black via-black/80 to-transparent">
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
            {mediaType === "video" && videoOutro && (
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
          </div>

          {/* Transporte de la vista previa: mover el clip hacia adelante y
              hacia atrás. La barra recorre todo el archivo —si el destino
              queda fuera del rango de recorte el vídeo se queda en pausa
              sobre ese fotograma para inspeccionarlo, y play vuelve al rango
              exportado— y los botones saltan 1 s o 10 s. Sólo en vídeo y
              desactivado mientras exporta (allí manda el grabador). */}
          {mediaType === "video" && (
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
            {mediaType === "video" ? (
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
              {mediaType === "video" ? (
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
              {mediaType === "video" && exportClipSeconds !== null && (
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
              {mediaType === "video" &&
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
                      {exportedPortada ? "1920 × 1080" : `${POST_W} × ${POST_H}`}{" "}
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
                  alt={
                    exportedPortada ? "Portada Exportada" : "Post Exportado"
                  }
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

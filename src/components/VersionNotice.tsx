import React, {useEffect, useRef, useState} from "react";
import {RefreshCw, X} from "lucide-react";

/** Identidad del build: sello de build + bundles de entrada. */
interface BuildFingerprint {
  stamp: string;
  js: string;
  css: string;
}

// Cadencia de la comprobación. La primera es pronto (un despliegue hecho
// mientras el visitante leía debe notificarse sin esperar); después, cada
// pocos minutos + al volver a la pestaña, al recuperar la red y cuando el
// service worker toma el control.
const FIRST_CHECK_MS = 12_000;
const CHECK_INTERVAL_MS = 5 * 60_000;
// Máximo de espera a que el service worker termine de instalar/activarse.
const SW_SETTLE_TIMEOUT_MS = 5_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function toPath(url: string): string {
  if (!url) return "";
  try {
    return new URL(url, window.location.href).pathname;
  } catch {
    return url;
  }
}

/** Build que se está ejecutando ahora mismo, leído del documento vivo. */
function readRunningBuild(): BuildFingerprint | null {
  const stamp =
    document.querySelector<HTMLMetaElement>('meta[name="build-stamp"]')?.content ?? "";
  // En dev no se inyecta la meta y no hay service worker: el aviso queda
  // desactivado (nunca se molesta en local).
  if (!stamp) return null;
  const js =
    document.querySelector<HTMLScriptElement>('script[type="module"]')?.src ?? "";
  const css =
    document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href^="/assets/"]')
      ?.href ?? "";
  return {stamp, js: toPath(js), css: toPath(css)};
}

/** Build desplegado en el servidor, parseado del HTML que responde la raíz. */
function parseDeployedBuild(html: string): BuildFingerprint | null {
  const stamp = /name="build-stamp"\s+content="([^"]*)"/.exec(html)?.[1] ?? "";
  const scriptTag =
    (html.match(/<script\b[^>]*>/gi) ?? []).find((tag) => /\btype="module"/i.test(tag)) ??
    "";
  const js = /\bsrc="([^"]+)"/i.exec(scriptTag)?.[1] ?? "";
  const linkTag =
    (html.match(/<link\b[^>]*>/gi) ?? []).find(
      (tag) => /rel="stylesheet"/i.test(tag) && /\/assets\//.test(tag),
    ) ?? "";
  const css = /\bhref="([^"]+)"/i.exec(linkTag)?.[1] ?? "";
  if (!stamp && !js && !css) return null;
  return {stamp, js: toPath(js), css: toPath(css)};
}

/**
 * ¿Hay código nuevo desplegado? Manda la identidad de los bundles: un
 * re-despliegue sin cambios (sólo avanza el sello) no merece molestar.
 * Si no se pueden leer los bundles, se compara el sello.
 */
function differsFromRunning(running: BuildFingerprint, deployed: BuildFingerprint): boolean {
  if (running.js && deployed.js) return running.js !== deployed.js || running.css !== deployed.css;
  return running.stamp !== deployed.stamp;
}

/**
 * Deja el service worker al día antes de recargar.
 *
 * El navegador sólo comprueba `sw.js` en la navegación y como máximo cada
 * 24 h, así que se fuerza con `update()`. Sin este paso la recarga serviría
 * el `index.html` precacheado anterior y el visitante seguiría con la versión
 * vieja (y el aviso reaparecería en bucle).
 */
async function settleServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    await registration.update().catch(() => undefined);
    registration.waiting?.postMessage({type: "SKIP_WAITING"});
    const startedAt = Date.now();
    while (
      (registration.installing || registration.waiting) &&
      Date.now() - startedAt < SW_SETTLE_TIMEOUT_MS
    ) {
      await sleep(150);
    }
  } catch {
    // Sin red o sin SW: se recarga igual y el navegador hace lo que toque.
  }
}

/** HTML de la raíz desde la red (fuera de la caché del navegador). */
async function fetchDeployedBuild(): Promise<BuildFingerprint | null> {
  try {
    const response = await fetch(`/?bn-check=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return null;
    return parseDeployedBuild(await response.text());
  } catch {
    return null;
  }
}

/**
 * Aviso elegante de versión nueva: «hay un despliegue más reciente que esta
 * sesión» → toast discreto con botón para actualizar.
 *
 * Al pulsar se asienta el service worker (para que el precache tenga el HTML
 * nuevo) y se recarga. Si el visitante descarta, no vuelve a molestar con la
 * misma versión; si más tarde se despliega otra, sí se avisa de nuevo.
 */
export const VersionNotice: React.FC = () => {
  const runningRef = useRef<BuildFingerprint | null>(null);
  const dismissedRef = useRef<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const running = readRunningBuild();
    runningRef.current = running;
    if (!running) return;

    let disposed = false;
    // Con controller en el momento del montaje: si llega `controllerchange`
    // es que un SW nuevo tomó el control de una sesión ya abierta.
    const hadController = Boolean(navigator.serviceWorker?.controller);

    const check = async () => {
      if (disposed) return;
      await settleServiceWorker();
      if (disposed) return;
      const deployed = await fetchDeployedBuild();
      if (disposed || !deployed) return;
      const current = runningRef.current;
      if (!current) return;
      if (!differsFromRunning(current, deployed)) {
        setPending(null);
        return;
      }
      const key = `${deployed.stamp}|${deployed.js}|${deployed.css}`;
      if (dismissedRef.current === key) return;
      setPending(key);
    };

    const initialTimer = window.setTimeout(check, FIRST_CHECK_MS);
    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onOnline = () => void check();
    const onControllerChange = () => {
      if (hadController) void check();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    navigator.serviceWorker?.addEventListener?.("controllerchange", onControllerChange);

    return () => {
      disposed = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener?.("controllerchange", onControllerChange);
    };
  }, []);

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    await settleServiceWorker();
    window.location.reload();
  };

  const handleDismiss = () => {
    dismissedRef.current = pending;
    setPending(null);
  };

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-4 right-4 sm:left-auto sm:right-6 bottom-[calc(var(--bn-nav-h)_+_93px)] sm:bottom-[calc(var(--bn-nav-h)_+_81px)] lg:bottom-6 z-50 bg-white text-black px-3.5 py-2.5 text-xs font-sans font-medium tracking-normal rounded-lg border border-neutral-200 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="min-w-0">
        <span className="sm:hidden">Versión nueva</span>
        <span className="hidden sm:inline">Nueva versión disponible</span>
      </span>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={updating}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70 cursor-pointer"
      >
        <RefreshCw className={`h-3 w-3 ${updating ? "animate-spin" : ""}`} />
        {updating ? "Actualizando…" : "Actualizar"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Descartar aviso de versión nueva"
        className="-mr-1 shrink-0 p-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

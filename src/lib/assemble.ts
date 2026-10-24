import { useSyncExternalStore } from "react";

const KEY = "blacknews_assemble";
const MAX_FULL_PER_LIST = 6;

type Root = HTMLElement & { _t?: number[] };

let pref = true; // preferencia del usuario
const listeners = new Set<() => void>();
const counts = new WeakMap<Element, number>();
const seen = new WeakSet<Element>();
let io: IntersectionObserver | undefined;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const effective = () => pref && !reduced();

/* ── Estado + hook ── */
export const useAssemble = () =>
  useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => pref,
    () => true,
  );

export function setAssembleEnabled(on: boolean) {
  pref = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
  applyHtmlClass();
  if (!effective()) {
    // Apagado: todo visible al instante y se cancelan timers/contornos
    document.querySelectorAll<Root>("[data-assemble]").forEach(showNow);
  }
  listeners.forEach((l) => l());
}

function applyHtmlClass() {
  document.documentElement.classList.toggle("bn-assemble-on", effective());
}

/* ── Animación ── */
function clear(root: Root) {
  root._t?.forEach(clearTimeout);
  root._t = [];
  root.querySelectorAll(":scope > .asm-layer").forEach((n) => n.remove());
  root.classList.remove("asm-run");
  root.querySelectorAll(".asm-anim").forEach((p) => p.classList.remove("asm-anim"));
}

/**
 * Cierre del bloque: se limpia el estado de animación, nada queda oculto y
 * `asm-done` marca que el bloque ya se armó — las piezas que React monte
 * después (p. ej. el botón de cuenta al iniciar sesión) se muestran solas.
 */
function finish(root: Root) {
  clear(root);
  root.classList.add("asm-done");
  root
    .querySelectorAll("[data-piece]:not(.in)")
    .forEach((p) => p.classList.add("in"));
}

function showNow(root: Root) {
  finish(root);
  root.classList.add("in");
}

function run(root: Root) {
  clear(root);
  const step = Number(root.dataset.step) || (root.dataset.assemble === "card" ? 90 : 150);
  const pieces = [...root.querySelectorAll<HTMLElement>("[data-piece]")]
    .filter((p) => p.closest("[data-assemble]") === root);

  // 1) Medir ANTES de transformar
  pieces.forEach((p) => p.classList.add("asm-measure"));
  const rb = root.getBoundingClientRect();
  const rects = [root, ...pieces].map((el) => el.getBoundingClientRect());
  pieces.forEach((p) => p.classList.remove("asm-measure"));

  const layer = document.createElement("div");
  layer.className = "asm-layer";
  root.appendChild(layer);

  root.classList.add("asm-run");
  pieces.forEach((p) => p.classList.add("asm-anim"));
  const T = (fn: () => void, ms: number) => root._t!.push(window.setTimeout(fn, ms));

  let last = 0;
  [root, ...pieces].forEach((el, i) => {
    const r = rects[i];
    const t = i * step;
    const fill = t + step * 1.8;
    last = Math.max(last, fill + 800);

    if (r.width >= 1 && r.height >= 1) {
      const g = document.createElement("div");
      g.className = "ghost";
      g.style.cssText =
        `left:${r.left - rb.left - root.clientLeft}px;top:${r.top - rb.top - root.clientTop}px;` +
        `width:${r.width}px;height:${r.height}px;border-radius:${i && r.height <= 40 ? "999px" : "8px"}`;
      g.innerHTML = `<i></i><i></i><i></i><i></i><span>[${Math.round(r.width)}×${Math.round(r.height)}]</span>`;
      layer.appendChild(g);
      T(() => g.classList.add("on"), t);
      T(() => g.classList.add("off"), fill + 250);
      T(() => g.remove(), fill + 800);
    }
    T(() => el.classList.add("in"), fill);
  });

  T(() => finish(root), last + 300); // limpia asm-run / asm-anim / capa
}

function handle(root: Root) {
  if (!effective()) return showNow(root);

  if (root.dataset.assemble === "card") {
    const parent = root.parentElement!;
    const n = (counts.get(parent) ?? 0) + 1;
    counts.set(parent, n);
    if (n > MAX_FULL_PER_LIST) {
      root.classList.add("asm-fade");
      void root.offsetWidth;
      root.classList.add("in");
      root.querySelectorAll("[data-piece]").forEach((p) => p.classList.add("in"));
      root.classList.add("asm-done");
      return;
    }
  }
  run(root);
}

/* ── Registro (incluye contenido que React monta después) ── */
function watch(el: HTMLElement) {
  if (seen.has(el)) return;
  seen.add(el);
  if (getComputedStyle(el).position === "static") el.classList.add("asm-rel");
  io!.observe(el);
}

/**
 * Pieza montada tras el armado de su bloque: sin este pase quedaría oculta
 * (la CSS la esconde hasta que recibe `.in`). Si el bloque todavía no se
 * armó, se queda oculta — `run()` la medirá y animará con el resto.
 */
function showPieceIfDone(p: HTMLElement) {
  const root = p.closest<Root>("[data-assemble]");
  if (root?.classList.contains("asm-done")) p.classList.add("in");
}

function register(n: Node) {
  if (!(n instanceof HTMLElement)) return;
  if (n.matches("[data-assemble]")) watch(n);
  n.querySelectorAll<HTMLElement>("[data-assemble]").forEach(watch);
  if (n.matches("[data-piece]")) showPieceIfDone(n);
  n.querySelectorAll<HTMLElement>("[data-piece]").forEach(showPieceIfDone);
}

export function initAssemble() {
  if (io) return; // idempotente: HMR o doble montaje no duplican observers
  try { pref = localStorage.getItem(KEY) !== "0"; } catch {}
  applyHtmlClass(); // antes del primer render: sin parpadeo

  const ob = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        ob.unobserve(e.target);
        handle(e.target as Root);
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  io = ob;

  new MutationObserver((muts) =>
    muts.forEach((m) => m.addedNodes.forEach(register)),
  ).observe(document.body, { childList: true, subtree: true });

  register(document.body);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", applyHtmlClass);
}

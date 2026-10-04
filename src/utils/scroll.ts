/**
 * Desplaza la ventana hasta la sección indicada (por id de ancla).
 *
 * Usa scroll suave cuando el entorno lo permite y, si en unos milisegundos no
 * se ha movido (hay navegadores/entornos que deshabilitan el scroll suave),
 * repite con salto directo para que el índice nunca se quede sin respuesta.
 */
export function scrollToSectionId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const before = el.getBoundingClientRect().top;
  el.scrollIntoView({ behavior: "smooth", block: "start" });

  window.setTimeout(() => {
    const after = el.getBoundingClientRect().top;
    if (Math.abs(after - before) < 8) {
      el.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, 400);
}

/**
 * Lleva el scroll al inicio de la página (botón «volver arriba»).
 * Mismo criterio que scrollToSectionId: scroll suave y, si en unos
 * milisegundos no se ha movido, salto directo.
 */
export function scrollToTop(): void {
  const before = window.scrollY;
  if (before <= 0) return;
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.setTimeout(() => {
    if (window.scrollY >= before - 8) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, 400);
}

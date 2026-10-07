import React, { useState } from "react";

/**
 * Banderas por imagen (flagcdn) en lugar de emoji de texto.
 *
 * Windows no incluye glifos de bandera en su fuente de emoji: los pares de
 * indicadores regionales (🇮🇱) se pintan como dos letras («IL») tanto en
 * DOM como en `canvas.fillText`. Aquí se centralizan la carga de la imagen,
 * el componente de vista y los helpers para detectar/sustituir esos emoji.
 */

// In-memory cache for loaded flag images for canvas rendering
const flagImageCache = new Map<string, HTMLImageElement>();

export const loadFlagImage = (
  code: string,
): Promise<HTMLImageElement | null> => {
  // Solo códigos ISO alfa-2 (flagcdn); los códigos sintéticos de los
  // países personalizados no existen y se resuelven como sin bandera.
  if (!code || code === "GLOBAL" || code.length !== 2) {
    return Promise.resolve(null);
  }
  const lower = code.toLowerCase();
  if (flagImageCache.has(lower)) {
    return Promise.resolve(flagImageCache.get(lower)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      flagImageCache.set(lower, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = `https://flagcdn.com/w40/${lower}.png`;
  });
};

/** `true` si el texto es un emoji de bandera (par de indicadores regionales),
 *  que Windows dibuja como letras en vez de bandera. */
export const isRegionalFlagEmoji = (s?: string | null): boolean =>
  !!s && /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(s);

/** 🇺🇾 → "uy": los emoji de bandera son dos indicadores regionales (A = U+1F1E6).
 *  Devuelve `null` para el resto (🌐, 📍…), que no representan un país ISO. */
export const codeFromFlagEmoji = (emoji?: string | null): string | null => {
  if (!isRegionalFlagEmoji(emoji)) return null;
  return Array.from(emoji!)
    .map((ch) =>
      String.fromCharCode((ch.codePointAt(0)! - 0x1f1e6) + 97),
    )
    .join("");
};

export const CountryFlag: React.FC<{
  code: string;
  className?: string;
  fallback?: string;
  style?: React.CSSProperties;
}> = ({
  code,
  className = "w-4 h-2.5 object-cover rounded-[1px] inline-block shadow-xs",
  fallback = "🌐",
  style,
}) => {
  const [failed, setFailed] = useState(false);
  // GLOBAL, vacío o código sintético (país personalizado sin ISO) → emoji.
  if (!code || code === "GLOBAL" || failed || !/^[A-Za-z]{2}$/.test(code)) {
    return (
      <span className="inline-block text-[11px] leading-none">{fallback}</span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={code}
      onError={() => setFailed(true)}
      className={className}
      style={style}
    />
  );
};

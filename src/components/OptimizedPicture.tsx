import React, { useEffect, useState } from 'react';
import { OptimizedImageSet } from '../types/news';
import { TerminalBar, useTerminalGate } from './TerminalBar';

// Precomputed mapping for stock news images if available
let stockImagesMap: Record<string, OptimizedImageSet> = {};
try {
  // Dynamically import or reference if pre-generated
  const modules = import.meta.glob('../data/optimizedStockImages.json', { eager: true });
  const key = Object.keys(modules)[0];
  if (key && (modules[key] as any).default) {
    stockImagesMap = (modules[key] as any).default;
  }
} catch {
  // Fallback if not yet created
}

export interface OptimizedPictureProps {
  image: string | OptimizedImageSet;
  alt: string;
  priority?: boolean; // If true: loading="eager", fetchpriority="high" (for above-the-fold hero images)
  sizes?: string;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g. '16/9'
  onClick?: () => void;
}

export const OptimizedPicture: React.FC<OptimizedPictureProps> = ({
  image,
  alt,
  priority = false,
  sizes = '(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px',
  className = '',
  imgClassName = '',
  width = 800,
  height = 450,
  aspectRatio = '16/9',
  onClick
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  /* Barra de carga tipo terminal sobre la imagen mientras carga:
     - solo con el EFECTO activo (useTerminalGate);
     - espera 250 ms: si la imagen está en caché, ni se llega a pintar;
     - si la imagen nunca llega, la barra se retira igual (fail-open). */
  const gateOn = useTerminalGate();
  const [showBar, setShowBar] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  // La malla LED se enciende en cuanto la imagen llega (o nos rendimos).
  const lit = isLoaded || gaveUp;

  useEffect(() => {
    if (!fading || gone) return;
    const id = window.setTimeout(() => setGone(true), 340);
    return () => window.clearTimeout(id);
  }, [fading, gone]);

  useEffect(() => {
    if (!gateOn || isLoaded) return;
    const id = window.setTimeout(() => setShowBar(true), 250);
    return () => window.clearTimeout(id);
  }, [gateOn, isLoaded]);

  useEffect(() => {
    if (!showBar || isLoaded || gaveUp) return;
    const id = window.setTimeout(() => setGaveUp(true), 12000);
    return () => window.clearTimeout(id);
  }, [showBar, isLoaded, gaveUp]);

  // Resolve whether image is an OptimizedImageSet or a string lookup
  let optimizedData: OptimizedImageSet | null = null;
  let fallbackSrc = '';

  if (typeof image === 'object' && image !== null && 'srcsetAvif' in image) {
    optimizedData = image;
    fallbackSrc = image.fallbackUrl;
  } else if (typeof image === 'string') {
    fallbackSrc = image;
    // Look up in pre-generated stock images mapping
    const matched = stockImagesMap[image] || 
      stockImagesMap[image.split('/').pop() || ''] ||
      Object.values(stockImagesMap).find(v => v.originalName === image.split('/').pop());
    if (matched) {
      optimizedData = matched;
      fallbackSrc = matched.fallbackUrl;
    }
  }

  const blurDataUrl = optimizedData?.blurDataUrl;
  const targetWidth = optimizedData?.width ? Math.min(optimizedData.width, width) : width;
  const targetHeight = optimizedData?.height 
    ? Math.round(targetWidth / (optimizedData.aspectRatio || (width / height)))
    : height;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-neutral-950 select-none bn-media ${className}`}
      style={{ aspectRatio }}
    >
      {/* 20px Tiny Blur Placeholder (Instant visual feedback & zero CLS) */}
      {blurDataUrl && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover filter blur-lg scale-110 pointer-events-none transition-opacity duration-500 ease-out ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* Picture Element with AVIF, WebP, and JPEG Fallback */}
      <picture className="w-full h-full block">
        {optimizedData?.srcsetAvif && (
          <source
            type="image/avif"
            srcSet={optimizedData.srcsetAvif}
            sizes={sizes}
          />
        )}
        {optimizedData?.srcsetWebp && (
          <source
            type="image/webp"
            srcSet={optimizedData.srcsetWebp}
            sizes={sizes}
          />
        )}
        {optimizedData?.srcsetJpeg && (
          <source
            type="image/jpeg"
            srcSet={optimizedData.srcsetJpeg}
            sizes={sizes}
          />
        )}
        <img
          src={fallbackSrc}
          alt={alt}
          width={targetWidth}
          height={targetHeight}
          loading={priority ? 'eager' : 'lazy'}
          // fetchpriority in React 19 / DOM
          {...(priority ? { fetchPriority: 'high' } : {})}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setGone(true)}
          className={`w-full h-full object-cover transition-all duration-500 ease-out ${
            isLoaded ? 'opacity-100 filter-none' : blurDataUrl ? 'opacity-0' : 'opacity-100'
          } ${imgClassName}`}
        />
      </picture>

      {/* Loader terminal [░▒▓…] + malla LED: apagada mientras carga, se
          enciende con la imagen y ambos se retiran tras COMPLETE */}
      {gateOn && showBar && !gone && (
        <div
          className={`absolute inset-0 z-10 bg-black/55 pointer-events-none transition-opacity duration-300 ${
            fading ? 'opacity-0' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className={`bn-led absolute inset-0 [--led-step:9px]${lit ? ' lit' : ''}`}
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <TerminalBar
              ready={isLoaded || gaveUp}
              onSettled={() => setFading(true)}
              className="text-[11px]"
            />
          </span>
        </div>
      )}
    </div>
  );
};

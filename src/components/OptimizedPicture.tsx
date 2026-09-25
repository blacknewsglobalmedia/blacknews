import React, { useState } from 'react';
import { OptimizedImageSet } from '../types/news';

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
      className={`relative overflow-hidden bg-neutral-950 select-none ${className}`}
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
          className={`w-full h-full object-cover transition-all duration-500 ease-out ${
            isLoaded ? 'opacity-100 filter-none' : blurDataUrl ? 'opacity-0' : 'opacity-100'
          } ${imgClassName}`}
        />
      </picture>
    </div>
  );
};

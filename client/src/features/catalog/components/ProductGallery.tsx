import { useState } from 'react';
import type { ProductImageDto } from '@ncg/shared';
import { cn } from '@/lib/utils';
import { ProductImage } from './ProductImage';

/** Main image + thumbnail buttons. Falls back to a placeholder when there are no images. */
export function ProductGallery({ images, name }: { images: ProductImageDto[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, images.length - 1)];

  return (
    <div className="space-y-3">
      <ProductImage
        src={current?.url}
        alt={images.length > 1 ? `${name}, image ${index + 1} of ${images.length}` : name}
        eager
        className="aspect-square w-full rounded-xl border"
      />
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
          {images.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={cn(
                  'block overflow-hidden rounded-lg border-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  i === index
                    ? 'border-primary'
                    : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <ProductImage src={image.url} alt="" className="size-16 sm:size-20" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Product photo with lazy loading and a neutral placeholder when missing or broken. */
export function ProductImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const broken = !src || failedSrc === src;

  if (broken) {
    return (
      <div
        role="img"
        aria-label={`${alt} (image unavailable)`}
        className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}
      >
        <ImageOff aria-hidden className="size-10 opacity-60" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn('bg-muted object-cover', className)}
    />
  );
}

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ACCEPTED_IMAGE_TYPES, imageFileProblem, uploadImage } from '../api';

/** Upload (with previews), remove and reorder product images. The first image is the main one. */
export function ImagesField({
  value,
  onChange,
  max,
  error,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max: number;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  // Keep the latest list while several uploads finish one after another.
  const latest = useRef(value);
  latest.current = value;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = max - latest.current.length;
    const selected = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > selected.length) toast.warning(`At most ${max} images per product`);

    for (const file of selected) {
      const problem = imageFileProblem(file);
      if (problem) {
        toast.error('Image not added', { description: problem });
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const { url } = await uploadImage(file);
        onChange([...latest.current, url]);
      } catch (err) {
        toast.error('Upload failed', { description: `${file.name}: ${errorMessage(err)}` });
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const move = (from: number, to: number) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <ul
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        aria-label="Product images"
      >
        {value.map((url, index) => (
          <li key={url} className="relative overflow-hidden rounded-lg border bg-card">
            <ProductImage src={url} alt={`Image ${index + 1}`} className="aspect-square w-full" />
            {index === 0 && (
              <span className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                Main
              </span>
            )}
            <div className="flex items-center justify-between gap-1 border-t p-1">
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label={`Move image ${index + 1} earlier`}
                >
                  <ArrowLeft aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === value.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`Move image ${index + 1} later`}
                >
                  <ArrowRight aria-hidden />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(value.filter((u) => u !== url))}
                aria-label={`Remove image ${index + 1}`}
                className="hover:text-destructive"
              >
                <X aria-hidden />
              </Button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li
            key={`uploading-${i}`}
            className="flex aspect-square items-center justify-center rounded-lg border bg-muted text-muted-foreground"
            role="status"
            aria-label="Uploading image"
          >
            <Loader2 aria-hidden className="size-6 animate-spin" />
          </li>
        ))}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void handleFiles(e.target.files)}
        data-testid="image-input"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={value.length + uploading >= max}
        className={cn(error && 'border-destructive')}
      >
        <ImagePlus aria-hidden />
        Add images
      </Button>
      <p
        className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
        role={error ? 'alert' : undefined}
      >
        {error ??
          `JPEG, PNG, WebP or GIF, up to 3 MB each. The first image is shown in the shop. Max ${max}.`}
      </p>
    </div>
  );
}

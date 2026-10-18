'use client';

import * as React from 'react';
import { Replace, Star, Trash2 } from 'lucide-react';
import { APP } from '@/config/app';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import type { CompositionImage } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { Dropzone } from '@/components/ui/Dropzone';
import { IconButton, Spinner } from '@/components/ui/primitives';

/**
 * Fotografias da publicação.
 *
 * A miniatura usa `object-contain`: as proporções das fotografias são sempre
 * preservadas, aqui e na arte. A aplicação não redesenha produtos nem
 * embalagens — substituir uma imagem é sempre uma acção explícita.
 */
export function ImagesPanel({
  images,
  mainImageIndex,
  assets,
  uploading,
  onAdd,
  onRemove,
  onSetMain,
  onReplace,
}: {
  images: CompositionImage[];
  mainImageIndex: number;
  assets: Record<string, ResolvedAsset | undefined>;
  uploading: number;
  onAdd: (files: File[]) => void;
  onRemove: (assetId: string) => void;
  onSetMain: (index: number) => void;
  onReplace: (assetId: string, file: File) => void;
}) {
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = React.useState<string | null>(null);
  const full = images.length >= APP.uploads.maxImagesPerProject;

  return (
    <div className="flex flex-col gap-2.5">
      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((image, index) => {
            const asset = assets[image.assetId];
            const isMain = index === mainImageIndex;
            return (
              <li
                key={image.assetId}
                className={cn(
                  'group relative overflow-hidden rounded-[10px] border bg-checker',
                  isMain ? 'border-neon/70' : 'border-line',
                )}
              >
                <div className="aspect-square">
                  {asset?.url ? (
                    <img
                      src={asset.url}
                      alt={`Fotografia ${index + 1}`}
                      className="size-full object-contain"
                    />
                  ) : (
                    <div className="grid size-full place-items-center">
                      <Spinner />
                    </div>
                  )}
                </div>

                {isMain ? (
                  <span className="absolute left-1 top-1 rounded-full bg-neon px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-950">
                    Principal
                  </span>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-ink-950/85 p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  {!isMain ? (
                    <IconButton
                      label={`Definir fotografia ${index + 1} como principal`}
                      size="sm"
                      onClick={() => onSetMain(index)}
                    >
                      <Star className="size-3.5" aria-hidden />
                    </IconButton>
                  ) : null}
                  <IconButton
                    label={`Substituir fotografia ${index + 1}`}
                    size="sm"
                    onClick={() => {
                      setReplacingId(image.assetId);
                      replaceInputRef.current?.click();
                    }}
                  >
                    <Replace className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Remover fotografia ${index + 1}`}
                    size="sm"
                    tone="danger"
                    onClick={() => onRemove(image.assetId)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dropzone
        compact
        multiple
        disabled={full || uploading > 0}
        accept={APP.uploads.acceptedImageMimes.join(',')}
        onFiles={onAdd}
        title={
          full
            ? `Limite de ${APP.uploads.maxImagesPerProject} fotografias`
            : images.length === 0
              ? 'Carregar fotografias'
              : 'Adicionar mais'
        }
        hint={
          full
            ? 'Remove uma para carregar outra.'
            : 'Arrasta para aqui ou toca para escolher · PNG, JPG, WEBP'
        }
      />

      {uploading > 0 ? (
        <Spinner label={`A carregar ${uploading} ficheiro${uploading === 1 ? '' : 's'}…`} />
      ) : null}

      <input
        ref={replaceInputRef}
        type="file"
        accept={APP.uploads.acceptedImageMimes.join(',')}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && replacingId) onReplace(replacingId, file);
          event.target.value = '';
          setReplacingId(null);
        }}
      />
    </div>
  );
}

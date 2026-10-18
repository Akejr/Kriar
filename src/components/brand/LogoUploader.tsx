'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { APP } from '@/config/app';
import { getBackend } from '@/lib/data';
import { registerAsset, resolveAsset } from '@/lib/data/assetCache';
import type { AssetKind } from '@/lib/domain/types';
import { checkImageFile, readImageSize } from '@/lib/utils/files';
import { Dropzone } from '@/components/ui/Dropzone';
import { IconButton, Spinner } from '@/components/ui/primitives';

/**
 * Carregamento de um logótipo.
 *
 * O ficheiro é guardado tal e qual. A aplicação nunca redesenha nem recolore
 * o logótipo: nas artes é desenhado com `contain`, ou seja, sem esticar nem
 * cortar.
 */
export function LogoUploader({
  accountId,
  assetId,
  kind,
  onChange,
  title,
  hint,
  /** Fundo da pré-visualização, para se perceber o contraste. */
  preview = 'checker',
  onFileSelected,
}: {
  accountId: string;
  assetId: string | null;
  kind: AssetKind;
  onChange: (assetId: string | null) => void;
  title: string;
  hint?: React.ReactNode;
  preview?: 'checker' | 'light' | 'dark';
  /** Chamado com o ficheiro original, para análise de cores. */
  onFileSelected?: (file: File) => void;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setUrl(null);
      return;
    }
    resolveAsset(assetId)
      .then((asset) => {
        if (!cancelled) setUrl(asset?.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    const check = checkImageFile(file, 'logo');
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const size = await readImageSize(file).catch(() => null);
      const asset = await getBackend().uploadAsset({
        accountId,
        kind,
        file,
        name: file.name,
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
      const resolved = await getBackend().resolveAssetUrl(asset);
      registerAsset(asset, resolved);
      setUrl(resolved);
      onChange(asset.id);
      onFileSelected?.(file);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível carregar o ficheiro.',
      );
    } finally {
      setBusy(false);
    }
  }

  const previewClass =
    preview === 'light' ? 'bg-[#F4F2EE]' : preview === 'dark' ? 'bg-[#141414]' : 'bg-checker';

  if (url) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3 rounded-[12px] border border-line bg-ink-950 p-2.5">
          <div
            className={cn(
              'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[9px]',
              previewClass,
            )}
          >
            <img src={url} alt="" className="max-h-14 max-w-14 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-fg">{title}</p>
            <p className="mt-0.5 text-[11.5px] text-fg-muted">
              Guardado como enviaste. Nunca é redesenhado.
            </p>
          </div>
          <IconButton
            label={`Remover ${title}`}
            tone="danger"
            size="sm"
            onClick={() => {
              onChange(null);
              setUrl(null);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </IconButton>
        </div>
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Dropzone
        compact
        accept={APP.uploads.acceptedLogoMimes.join(',')}
        onFiles={handleFiles}
        disabled={busy}
        title={busy ? 'A carregar…' : title}
        hint={hint ?? 'PNG, SVG, WEBP ou JPG · até 8 MB'}
      />
      {busy ? <Spinner label="A carregar o ficheiro…" /> : null}
      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

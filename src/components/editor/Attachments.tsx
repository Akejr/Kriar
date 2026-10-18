'use client';

import * as React from 'react';
import { ImagePlus, Repeat2, Star, Trash2, X } from 'lucide-react';
import { APP } from '@/config/app';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import type { AttachmentKind, Composition } from '@/lib/domain/types';
import { checkImageFile } from '@/lib/utils/files';
import { cn } from '@/lib/utils/cn';

/**
 * Para que serve cada anexo, como o cliente o lê.
 *
 * "Arte para recriar" é o caso novo: o cliente viu uma publicação de que
 * gostou — muitas vezes de outra empresa — e quer uma assim, mas da marca
 * dele. Sem este tipo, a arte era tratada como material a pôr DENTRO da
 * publicação, e saía colada como se fosse uma fotografia do produto.
 */
const KINDS: Array<{ value: AttachmentKind; label: string; placeholder: string }> = [
  {
    value: 'produto',
    label: 'Foto ou produto',
    placeholder: 'O que queres com esta foto? (opcional)',
  },
  {
    value: 'captura',
    label: 'Captura de ecrã',
    placeholder: 'O que mostra este ecrã? (opcional)',
  },
  {
    value: 'recriar',
    label: 'Arte para recriar',
    placeholder: 'O que manter desta arte? (opcional)',
  },
];

/**
 * Anexos do pedido.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Fotografias de produtos, capturas do site, o espaço da loja — tudo o que o
 * cliente queira ver na arte.
 *
 * ESTE BLOCO ESTAVA ESCONDIDO. A condição era
 * `template.imageSlots.length > 0`, e o único modelo da biblioteca tem a
 * lista vazia porque as imagens entravam nas superfícies das peças. O
 * resultado: não havia forma nenhuma de anexar uma fotografia. A condição
 * fazia sentido quando a aplicação desenhava compartimentos; com a arte
 * gerada por inteiro, uma fotografia é uma REFERÊNCIA e não precisa de
 * compartimento.
 *
 * A NOTA POR FOTOGRAFIA é o que torna o anexo utilizável. A mesma imagem
 * pode querer dizer "este é o produto principal", "usa só o fundo desta" ou
 * "copia o tipo de letra deste site", e o gerador não adivinha qual. É
 * opcional de propósito: a maioria das fotografias é o produto, e exigir uma
 * nota por cada uma era atrito sem ganho.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function Attachments({
  images,
  mainImageIndex,
  assets,
  uploading,
  onAdd,
  onRemove,
  onSetMain,
  onNoteChange,
  onKindChange,
}: {
  images: Composition['images'];
  mainImageIndex: number;
  assets: Record<string, ResolvedAsset | undefined>;
  uploading: number;
  onAdd: (files: File[]) => void;
  onRemove: (assetId: string) => void;
  onSetMain: (index: number) => void;
  onNoteChange: (assetId: string, note: string) => void;
  onKindChange: (assetId: string, kind: AttachmentKind) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const depth = React.useRef(0);

  const full = images.length >= APP.uploads.maxImagesPerProject;

  function pick(files: File[]) {
    if (files.length === 0) return;
    const room = APP.uploads.maxImagesPerProject - images.length;
    const accepted: File[] = [];

    for (const file of files.slice(0, room)) {
      const check = checkImageFile(file);
      if (check.ok) accepted.push(file);
      else setError(check.reason);
    }

    if (accepted.length > 0) {
      setError(null);
      onAdd(accepted);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          depth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          depth.current -= 1;
          if (depth.current <= 0) {
            depth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          depth.current = 0;
          setDragging(false);
          pick(Array.from(event.dataTransfer.files));
        }}
        className="flex flex-col gap-2"
      >
        {/*
          Uma linha por anexo, não uma grelha de quadrados.

          A grelha mostrava mais fotografias no mesmo espaço, mas não tinha
          onde pôr a explicação de cada uma. Em linha, a miniatura fica à
          esquerda e a nota ocupa a largura toda — que é onde se escreve.
        */}
        {images.map((image, index) => {
          const asset = assets[image.assetId];
          const kind = KINDS.find((entry) => entry.value === image.kind) ?? KINDS[0];
          const recreate = image.kind === 'recriar';
          // Uma arte a recriar não é "a fotografia principal": é o modelo.
          const isMain = index === mainImageIndex && !recreate;

          return (
            <div
              key={image.assetId}
              className={cn(
                'group relative rounded-[11px] border bg-ink-950/60 p-2 transition-colors',
                isMain
                  ? 'border-neon/40'
                  : recreate
                    ? 'border-line-strong'
                    : 'border-line hover:border-line-strong',
              )}
            >
              <div className="flex gap-2.5">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-[8px] bg-checker ring-1 ring-line">
                  {asset?.url ? (
                    <img
                      src={asset.url}
                      alt={`Anexo ${index + 1}`}
                      className="size-full object-cover"
                    />
                  ) : null}
                  {recreate ? (
                    <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-ink-950/80 py-0.5 text-neon">
                      <Repeat2 className="size-3" aria-hidden />
                    </span>
                  ) : null}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {/*
                      Para que serve o anexo, num selector compacto.

                      Um selector e não três botões: o painel tem 272 px no
                      mínimo, e três rótulos lado a lado não cabiam.
                    */}
                    <div className="relative min-w-0 flex-1">
                      <select
                        value={image.kind}
                        aria-label={`Para que serve o anexo ${index + 1}`}
                        onChange={(event) =>
                          onKindChange(image.assetId, event.target.value as AttachmentKind)
                        }
                        className={cn(
                          'h-6 w-full appearance-none truncate rounded-[7px] bg-ink-900/70 pl-2 pr-6 text-[11px] font-medium outline-none ring-1 transition-shadow focus:ring-neon/35',
                          recreate ? 'text-fg ring-neon/30' : 'text-fg-muted ring-line',
                        )}
                      >
                        {KINDS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        aria-hidden
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint"
                      >
                        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/*
                      "Principal" é uma etiqueta clicável, não um botão
                      escondido no hover.

                      Estava num botão que só aparecia ao passar o rato —
                      invisível em telemóvel, onde não há rato.
                    */}
                    {/*
                      Só a estrela, com o nome no rótulo acessível: com a
                      palavra "Principal" ao lado, o selector do tipo ficava
                      com 70 px e lia-se "Foto ...". A moldura verde da linha
                      já diz qual é a principal.
                    */}
                    {!recreate ? (
                      <button
                        type="button"
                        onClick={() => onSetMain(index)}
                        aria-pressed={isMain}
                        aria-label={isMain ? 'Fotografia principal' : 'Tornar principal'}
                        title={isMain ? 'Fotografia principal' : 'Tornar principal'}
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-full transition-colors',
                          isMain
                            ? 'bg-neon/15 text-neon ring-1 ring-neon/40'
                            : 'bg-ink-800 text-fg-faint hover:text-fg',
                        )}
                      >
                        <Star className={cn('size-3', isMain && 'fill-current')} aria-hidden />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-label={`Remover anexo ${index + 1}`}
                      onClick={() => onRemove(image.assetId)}
                      className="grid size-6 shrink-0 place-items-center rounded-[7px] text-fg-faint transition-colors hover:bg-ink-800 hover:text-danger"
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </div>

                  <input
                    value={image.note}
                    maxLength={160}
                    aria-label={`O que fazer com o anexo ${index + 1}`}
                    placeholder={kind.placeholder}
                    onChange={(event) => onNoteChange(image.assetId, event.target.value)}
                    className="h-7 w-full rounded-[7px] bg-ink-900/70 px-2 text-[11.5px] text-fg outline-none ring-1 ring-transparent transition-shadow placeholder:text-fg-faint focus:ring-neon/35"
                  />
                </div>
              </div>

              {recreate ? (
                <p className="mt-1.5 px-0.5 text-[10.5px] leading-relaxed text-fg-faint">
                  Fazemos uma assim, para a tua marca. Não copiamos o logótipo, o nome, as
                  pessoas nem as fotografias da outra empresa.
                </p>
              ) : null}
            </div>
          );
        })}

        {uploading > 0
          ? Array.from({ length: uploading }).map((_, index) => (
              <div
                key={`carregar-${index}`}
                className="h-[4.75rem] animate-[kriar-pulse-soft_1.2s_ease-in-out_infinite] rounded-[11px] bg-ink-800 ring-1 ring-line"
              />
            ))
          : null}

        {!full ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex items-center justify-center gap-2 rounded-[11px] border border-dashed py-3 text-[11.5px] font-medium transition-colors',
              dragging
                ? 'border-neon/60 bg-neon/6 text-neon'
                : 'border-line-strong text-fg-muted hover:border-neon/40 hover:text-neon',
            )}
          >
            <ImagePlus className="size-3.5" aria-hidden />
            {images.length === 0 ? 'Anexar fotografias' : 'Anexar mais'}
          </button>
        ) : null}
      </div>

      <p className="text-[10.5px] leading-relaxed text-fg-faint">
        {full
          ? `Limite de ${APP.uploads.maxImagesPerProject} anexos.`
          : 'Produtos, capturas do site, o teu espaço, ou uma arte que queres recriar com a tua marca. Arrasta para aqui ou clica.'}
      </p>

      {error ? (
        <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-danger" role="alert">
          <X className="mt-px size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={APP.uploads.acceptedImageMimes.join(',')}
        className="hidden"
        onChange={(event) => {
          pick(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}

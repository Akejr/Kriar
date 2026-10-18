'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Zona de carregamento com arrastar e largar.
 *
 * Acessível por teclado: é um botão, abre o selector de ficheiros com Enter
 * ou Espaço. O `input` fica escondido mas continua ligado ao `label`.
 */
export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  disabled,
  title,
  hint,
  compact,
  className,
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  title: string;
  hint?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled) return;
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
        if (disabled) return;
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        'rounded-[12px] border border-dashed transition-colors duration-150',
        dragging ? 'border-neon/70 bg-neon/8' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-1.5 text-center',
          compact ? 'px-3 py-4' : 'px-4 py-7',
          disabled && 'cursor-not-allowed',
        )}
      >
        <Upload className={cn('text-fg-faint', compact ? 'size-4' : 'size-5')} aria-hidden />
        <span className="text-[13px] font-medium text-fg">{title}</span>
        {hint ? (
          <span className="text-[11.5px] leading-relaxed text-fg-muted">{hint}</span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}

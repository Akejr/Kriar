import { APP } from '@/config/app';

export type FileCheck = { ok: true } | { ok: false; reason: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validação de uploads no cliente.
 * O servidor revalida em `src/lib/server/validateUpload.ts` — nunca confiamos
 * apenas nesta verificação.
 */
export function checkImageFile(file: File, kind: 'product' | 'logo' = 'product'): FileCheck {
  const accepted: readonly string[] =
    kind === 'logo' ? APP.uploads.acceptedLogoMimes : APP.uploads.acceptedImageMimes;

  if (!accepted.includes(file.type)) {
    const names = accepted
      .map((m) => m.replace('image/', '').replace('svg+xml', 'svg').toUpperCase())
      .join(', ');
    return { ok: false, reason: `Ficheiro inválido. Formatos aceites: ${names}.` };
  }
  if (file.size > APP.uploads.maxImageBytes) {
    return {
      ok: false,
      reason: `O ficheiro tem ${formatBytes(file.size)}. O limite é ${formatBytes(APP.uploads.maxImageBytes)}.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, reason: 'O ficheiro está vazio.' };
  }
  return { ok: true };
}

export function checkDocumentFile(file: File): FileCheck {
  if (!(APP.uploads.acceptedDocumentMimes as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'Ficheiro inválido. O manual de marca tem de ser um PDF.' };
  }
  if (file.size > APP.uploads.maxDocumentBytes) {
    return {
      ok: false,
      reason: `O ficheiro tem ${formatBytes(file.size)}. O limite é ${formatBytes(APP.uploads.maxDocumentBytes)}.`,
    };
  }
  return { ok: true };
}

export { formatBytes };

/** Lê as dimensões reais de uma imagem sem a desenhar. */
export function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

/**
 * Reduz uma imagem a uma largura máxima, preservando a proporção.
 *
 * Os geradores de imagem devolvem ficheiros muito maiores do que a arte: o
 * fundo chega com 1856 px de largura quando a publicação tem 1080. Guardar o
 * original multiplicaria por quatro o espaço ocupado sem ganho nenhum de
 * qualidade visível.
 *
 * Se algo falhar, devolve o ficheiro original — nunca perdemos o recurso por
 * causa de uma optimização.
 *
 * `reencode` força a passagem pelo canvas mesmo quando a imagem já cabe na
 * largura pedida. Existe para os visuais da identidade: chegam como PNG de
 * 1024 px e 2,7 MB cada, e quatro desses por proposta — com o cliente a
 * pedir várias — enchem o armazenamento do browser sem ganho visível. Em
 * JPEG o mesmo visual fica abaixo de 300 KB.
 *
 * `mime: 'image/png'` é OBRIGATÓRIO para logótipos. O JPEG não tem canal
 * alfa: a transparência de um PNG reduzido sai PRETA. Um logótipo
 * azul-marinho de 2000 px chegava à IA como azul-marinho sobre preto —
 * invisível para o gerador, que o reconstruía de memória, e para o modelo
 * que lê a identidade.
 */
export async function downscaleImageBlob(
  blob: Blob,
  maxWidth: number,
  quality = 0.92,
  options: { reencode?: boolean; mime?: 'image/jpeg' | 'image/png' } = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const original = await readImageSize(blob).catch(() => null);
  if (!original) return { blob, width: 0, height: 0 };
  if (original.width <= maxWidth && !options.reencode) {
    return { blob, width: original.width, height: original.height };
  }

  const width = Math.min(original.width, maxWidth);
  const height = Math.round((original.height * width) / original.width);

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sem contexto 2D');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // A qualidade só se aplica ao JPEG; o PNG é sempre sem perdas.
    const reduced = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, options.mime ?? 'image/jpeg', quality),
    );
    if (!reduced) throw new Error('toBlob devolveu vazio');
    return { blob: reduced, width, height };
  } catch {
    return { blob, width: original.width, height: original.height };
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/** Dispara a descarga de um blob com o nome indicado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Dar tempo ao browser para iniciar a descarga antes de libertar o URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

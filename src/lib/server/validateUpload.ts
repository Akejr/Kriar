import { APP } from '@/config/app';

export type UploadCheck = { ok: true } | { ok: false; reason: string };

/**
 * Assinaturas de ficheiro (magic numbers).
 *
 * O `type` declarado pelo browser é apenas uma sugestão. Validamos os
 * primeiros bytes para recusar ficheiros que mentem sobre o formato.
 */
const SIGNATURES: Array<{ mime: string; test: (bytes: Uint8Array) => boolean }> = [
  { mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/webp',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    mime: 'application/pdf',
    test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
];

export function detectMime(bytes: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    if (signature.test(bytes)) return signature.mime;
  }
  // SVG e AVIF: verificação textual simples.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 400)).trim();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'image/svg+xml';
  if (
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
    bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66
  ) {
    return 'image/avif';
  }
  return null;
}

export function validateUploadBytes(
  bytes: Uint8Array,
  kind: 'image' | 'logo' | 'document',
): UploadCheck {
  if (bytes.length === 0) return { ok: false, reason: 'O ficheiro está vazio.' };

  const limit =
    kind === 'document' ? APP.uploads.maxDocumentBytes : APP.uploads.maxImageBytes;
  if (bytes.length > limit) {
    return {
      ok: false,
      reason: `O ficheiro excede o limite de ${Math.round(limit / (1024 * 1024))} MB.`,
    };
  }

  const detected = detectMime(bytes);
  if (!detected) {
    return { ok: false, reason: 'Ficheiro inválido: o formato não foi reconhecido.' };
  }

  const accepted: readonly string[] =
    kind === 'document'
      ? APP.uploads.acceptedDocumentMimes
      : kind === 'logo'
        ? APP.uploads.acceptedLogoMimes
        : APP.uploads.acceptedImageMimes;

  if (!accepted.includes(detected)) {
    return { ok: false, reason: `Ficheiro inválido: ${detected} não é aceite aqui.` };
  }

  return { ok: true };
}

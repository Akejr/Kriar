/** Identificador aleatório curto, estável entre servidor e browser. */
export function newId(prefix = ''): string {
  const bytes = new Uint8Array(12);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (const b of bytes) out += b.toString(36).padStart(2, '0');
  const id = out.slice(0, 18);
  return prefix ? `${prefix}_${id}` : id;
}

/** Hash determinístico (FNV-1a 32 bits). Usado para escolher modelos sem IA. */
export function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Converte um texto num fragmento utilizável em nomes de ficheiro. */
export function slugify(input: string, fallback = 'publicacao'): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

/**
 * Fundos procedimentais locais.
 *
 * Usados quando não existe fornecedor de imagem configurado. NÃO são
 * apresentados como geração por IA: a interface identifica-os sempre como
 * "fundo local (modo de demonstração)".
 *
 * São construídos a partir das cores da publicação, com uma semente
 * determinística — o mesmo pedido dá sempre o mesmo fundo, e "Outra
 * composição" muda a semente.
 */
import type { BrandColors, StyleId } from '@/lib/domain/types';
import { darken, lighten, mix, safeHex, withAlpha } from '@/lib/utils/color';
import { stableHash } from '@/lib/utils/id';

export type BackgroundKind =
  | 'luz-suave'
  | 'textura-papel'
  | 'blocos'
  | 'brilho-radial'
  | 'malha-fina';

export type BackgroundRecipe = {
  kind: BackgroundKind;
  base: string;
  accent: string;
  seed: number;
};

const KIND_BY_STYLE: Record<StyleId, BackgroundKind[]> = {
  auto: ['luz-suave', 'malha-fina'],
  clean: ['textura-papel', 'malha-fina'],
  elegante: ['luz-suave', 'brilho-radial'],
  vibrante: ['blocos', 'brilho-radial'],
  tecnologico: ['malha-fina', 'luz-suave'],
  cinematografico: ['brilho-radial', 'luz-suave'],
};

/** Escolhe a receita a partir do estilo, das cores e de uma semente. */
export function recipeFor(
  style: StyleId,
  colors: BrandColors,
  seedText: string,
  attempt = 0,
): BackgroundRecipe {
  const options = KIND_BY_STYLE[style] ?? KIND_BY_STYLE.auto;
  const hash = stableHash(`${seedText}|${attempt}`);
  return {
    kind: options[(hash + attempt) % options.length],
    base: safeHex(colors.primary, '#16324F'),
    accent: safeHex(colors.accent ?? colors.secondary, '#D9C7A3'),
    seed: hash,
  };
}

export function describeRecipe(recipe: BackgroundRecipe): string {
  switch (recipe.kind) {
    case 'luz-suave':
      return 'iluminação suave em dois focos, com cantos mais escuros';
    case 'textura-papel':
      return 'textura fina de papel, com grão discreto';
    case 'blocos':
      return 'blocos de cor arredondados e sobrepostos';
    case 'brilho-radial':
      return 'brilho radial descentrado que abre do meio para as bordas';
    case 'malha-fina':
      return 'malha de linhas finas com um ponto de luz ao centro';
  }
}

// --- Aleatoriedade determinística -------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Grão -------------------------------------------------------------------

let grainTile: HTMLCanvasElement | null = null;

function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const data = ctx.createImageData(size, size);
  const random = mulberry32(0x9e3779b9);
  for (let i = 0; i < data.data.length; i += 4) {
    const value = 128 + (random() - 0.5) * 255;
    data.data[i] = value;
    data.data[i + 1] = value;
    data.data[i + 2] = value;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  grainTile = canvas;
  return canvas;
}

function applyGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha: number,
): void {
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.22,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, withAlpha('#000000', strength));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// --- Desenho ----------------------------------------------------------------

export function paintBackground(
  recipe: BackgroundRecipe,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O browser não disponibilizou um contexto 2D.');

  const random = mulberry32(recipe.seed);
  const base = recipe.base;
  const accent = recipe.accent;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  switch (recipe.kind) {
    case 'luz-suave': {
      for (let i = 0; i < 3; i += 1) {
        const cx = width * (0.2 + random() * 0.6);
        const cy = height * (0.15 + random() * 0.5);
        const radius = Math.max(width, height) * (0.35 + random() * 0.35);
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const tint = i === 0 ? lighten(base, 0.3) : i === 1 ? accent : lighten(accent, 0.2);
        gradient.addColorStop(0, withAlpha(tint, 0.42));
        gradient.addColorStop(1, withAlpha(tint, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      vignette(ctx, width, height, 0.3);
      applyGrain(ctx, width, height, 0.045);
      break;
    }

    case 'textura-papel': {
      const gradient = ctx.createLinearGradient(0, 0, width * 0.4, height);
      gradient.addColorStop(0, withAlpha(lighten(base, 0.12), 0.9));
      gradient.addColorStop(1, withAlpha(darken(base, 0.08), 0.9));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = lighten(base, 0.6);
      ctx.lineWidth = Math.max(1, width * 0.0012);
      for (let i = 0; i < 26; i += 1) {
        const offset = random() * height * 1.4 - height * 0.2;
        ctx.beginPath();
        ctx.moveTo(-width * 0.1, offset);
        ctx.lineTo(width * 1.1, offset + height * 0.14);
        ctx.stroke();
      }
      ctx.restore();
      applyGrain(ctx, width, height, 0.09);
      vignette(ctx, width, height, 0.16);
      break;
    }

    case 'blocos': {
      const palette = [accent, lighten(base, 0.22), mix(base, accent, 0.5), darken(base, 0.18)];
      for (let i = 0; i < 5; i += 1) {
        const w = width * (0.3 + random() * 0.6);
        const h = height * (0.14 + random() * 0.3);
        const x = width * (random() * 1.1 - 0.15);
        const y = height * (random() * 1.05 - 0.1);
        ctx.save();
        ctx.globalAlpha = 0.16 + random() * 0.14;
        ctx.fillStyle = palette[i % palette.length];
        roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.3);
        ctx.fill();
        ctx.restore();
      }
      vignette(ctx, width, height, 0.22);
      applyGrain(ctx, width, height, 0.04);
      break;
    }

    case 'brilho-radial': {
      const cx = width * (0.3 + random() * 0.4);
      const cy = height * (0.28 + random() * 0.3);
      const gradient = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        Math.max(width, height) * 0.82,
      );
      gradient.addColorStop(0, withAlpha(lighten(accent, 0.18), 0.6));
      gradient.addColorStop(0.45, withAlpha(mix(base, accent, 0.3), 0.3));
      gradient.addColorStop(1, withAlpha(darken(base, 0.3), 0.6));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      applyGrain(ctx, width, height, 0.05);
      break;
    }

    case 'malha-fina': {
      const step = width * 0.062;
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = lighten(base, 0.65);
      ctx.lineWidth = Math.max(1, width * 0.001);
      for (let x = step; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = step; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
      const cx = width * 0.5;
      const cy = height * (0.3 + random() * 0.2);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.6);
      glow.addColorStop(0, withAlpha(accent, 0.34));
      glow.addColorStop(1, withAlpha(accent, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      vignette(ctx, width, height, 0.26);
      applyGrain(ctx, width, height, 0.035);
      break;
    }
  }

  return canvas;
}

export function backgroundToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível criar o fundo.'))),
      'image/jpeg',
      0.9,
    );
  });
}

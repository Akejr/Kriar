import type { ColorToken } from '@/lib/composition/palette';
import type { TemplateStackItem, TemplateTextSlot } from './types';

export const text = (slot: TemplateTextSlot): TemplateStackItem => ({ kind: 'text', slot });

export const rule = (
  color: ColorToken,
  thickness = 0.005,
  width = 0.12,
): TemplateStackItem => ({ kind: 'rule', color, thickness, width });

export const space = (size: number): TemplateStackItem => ({ kind: 'space', size });

type Patch = Partial<TemplateTextSlot>;

/**
 * Bases tipográficas. Cada modelo ajusta o que precisa.
 * Os tamanhos são fracções da largura (1080 px em todos os formatos), logo
 * `0.068` equivale a ≈73 px.
 */
export const headline = (patch: Patch = {}): TemplateTextSlot => ({
  role: 'headline',
  font: 'display',
  weight: 700,
  size: 0.068,
  minSize: 0.042,
  maxLines: 3,
  lineHeight: 1.07,
  color: 'onBg',
  maxChars: 64,
  ...patch,
});

export const subheadline = (patch: Patch = {}): TemplateTextSlot => ({
  role: 'subheadline',
  font: 'body',
  weight: 400,
  size: 0.026,
  minSize: 0.021,
  maxLines: 2,
  lineHeight: 1.38,
  color: 'muted',
  maxChars: 120,
  optional: true,
  ...patch,
});

export const price = (patch: Patch = {}): TemplateTextSlot => ({
  role: 'price',
  font: 'display',
  weight: 700,
  size: 0.046,
  minSize: 0.03,
  maxLines: 1,
  lineHeight: 1.12,
  color: 'onHighlight',
  maxChars: 18,
  optional: true,
  pill: { color: 'highlight', radius: 0.5, padX: 0.03, padY: 0.022 },
  ...patch,
});

export const cta = (patch: Patch = {}): TemplateTextSlot => ({
  role: 'cta',
  font: 'body',
  weight: 600,
  size: 0.024,
  minSize: 0.019,
  maxLines: 2,
  lineHeight: 1.3,
  uppercase: true,
  tracking: 0.07,
  color: 'onBg',
  maxChars: 46,
  optional: true,
  ...patch,
});

export const contacts = (patch: Patch = {}): TemplateTextSlot => ({
  role: 'contacts',
  font: 'body',
  weight: 400,
  size: 0.0195,
  minSize: 0.016,
  maxLines: 4,
  lineHeight: 1.5,
  color: 'muted',
  maxChars: 110,
  optional: true,
  ...patch,
});

export const badge = (patch: Patch = {}): TemplateTextSlot => ({
  role: 'badge',
  font: 'body',
  weight: 600,
  size: 0.019,
  minSize: 0.016,
  maxLines: 1,
  lineHeight: 1.2,
  uppercase: true,
  tracking: 0.12,
  color: 'onBg',
  maxChars: 28,
  optional: true,
  ...patch,
});

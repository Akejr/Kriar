/**
 * O estilo aprendido com as artes da empresa, nos formatos que cada prompt
 * precisa.
 *
 * Funções puras: servem o browser (que monta os pedidos) e o servidor (que
 * monta os prompts). O perfil é guardado uma vez, na marca; cada pedido
 * leva a parte que lhe interessa.
 */
import type { BrandStyleLearning, BrandStyleProfile } from '@/lib/domain/types';

/**
 * Artes lidas de uma vez, no máximo.
 *
 * Doze chegam para ver o que se repete; mais do que isso alonga a leitura
 * e o custo sem mudar o perfil.
 */
export const LEARN_IMAGE_LIMIT = 12;

/** O estilo só manda quando existe, tem conteúdo e o cliente o deixou ligado. */
export function activeStyle(
  learning: BrandStyleLearning | null | undefined,
): BrandStyleLearning | null {
  if (!learning || !learning.enabled) return null;
  if (!learning.profile.summary.trim()) return null;
  return learning;
}

/**
 * O estilo em texto corrido, para os prompts de TEXTO — o conceito da
 * publicação e a proposta de identidade.
 *
 * Esses modelos não recebem as imagens: recebem o resumo, que é o que
 * decide se uma ideia cabe ou não na linguagem da marca.
 */
export function styleSummaryText(
  learning: BrandStyleLearning | null | undefined,
  max = 900,
): string {
  const style = activeStyle(learning);
  if (!style) return '';
  return profileText(style.profile, max);
}

/**
 * O perfil em texto corrido, ligado ou não.
 *
 * Serve a releitura da biblioteca: o perfil anterior vai como contexto
 * mesmo que o cliente tenha desligado o estilo nas publicações.
 */
export function profileText(p: BrandStyleProfile, max = 900): string {
  const parts = [
    p.summary,
    p.composition && `Composição: ${p.composition}`,
    p.typography && `Tipografia: ${p.typography}`,
    p.color && `Cor: ${p.color}`,
    p.imagery && `Imagem: ${p.imagery}`,
    p.graphics && `Grafismos: ${p.graphics}`,
    p.copy && `Texto: ${p.copy}`,
    p.recurring.length > 0 && `Elementos que se repetem: ${p.recurring.join('; ')}`,
  ].filter(Boolean) as string[];
  return clipText(parts.join(' '), max);
}

/** O que segue para o prompt da IMAGEM: o perfil inteiro e quantas artes o deram. */
export function styleForArtwork(
  learning: BrandStyleLearning | null | undefined,
): (BrandStyleProfile & { analysedCount: number }) | null {
  const style = activeStyle(learning);
  if (!style) return null;
  return { ...style.profile, analysedCount: style.analysedCount };
}

/** Corta no fim de uma frase ou de uma palavra, nunca a meio de uma. */
export function clipText(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  const word = cut.lastIndexOf(' ');
  return (word > 0 ? cut.slice(0, word) : cut).trim();
}

import { normalizeHex } from '@/lib/utils/color';
import type { Brand } from './types';

/**
 * A marca no essencial, para uma arte feita na hora.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O cadastro completo tem quatro etapas e acaba num design system aprovado:
 * cores com escalas tonais, tipografia justificada, regras de composição,
 * quatro imagens de referência. É o que faz as publicações de uma empresa
 * parecerem da mesma empresa ao longo do tempo, e leva tempo a fazer.
 *
 * Quem chega para fazer UMA arte não tem esse tempo, e exigir-lho é perder
 * o cliente antes de ele ver o produto a funcionar. Daí este modo: quatro
 * campos — nome, logótipo, duas cores — e gera.
 *
 * O que se perde está declarado e é recuperável. Sem `spec` aprovada,
 * `guidelinesFrom` devolve `null` e a arte é gerada sem regras de
 * identidade: sai boa, mas a próxima não tem como ser coerente com esta. A
 * área Marca completa a identidade depois, e as publicações seguintes
 * passam a herdá-la.
 *
 * `colorsConfirmed: true` é a parte que importa aqui. As cores de arranque
 * de `createBrand` são valores de reserva e não têm autoridade sobre a arte
 * justamente porque ninguém as escolheu; estas foram escolhidas, e por isso
 * mandam.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type InstantBrandInput = {
  name: string;
  colors: { primary: string; secondary: string; accent: string | null };
  logoAssetId: string | null;
  /** Opcional: entra na arte como contacto (ver `defaultContactsForComposition`). */
  website: string;
};

/** Os essenciais de uma marca, para o ecrã instantâneo pré-encher. */
export function instantInputFrom(brand: Brand): InstantBrandInput {
  return {
    name: brand.company.name,
    colors: {
      primary: brand.identity.colors.primary,
      secondary: brand.identity.colors.secondary,
      accent: brand.identity.colors.accent ?? null,
    },
    logoAssetId: brand.identity.logoAssetId,
    website: brand.company.website?.trim() ?? '',
  };
}

/** O que falta para poder gerar. Vazio quando está tudo. */
export function instantProblems(input: InstantBrandInput): string[] {
  const problems: string[] = [];
  if (!input.name.trim()) problems.push('Falta o nome da empresa.');
  if (!normalizeHex(input.colors.primary) || !normalizeHex(input.colors.secondary)) {
    problems.push('As duas cores principais têm de ser códigos válidos.');
  }
  return problems;
}

export function isInstantReady(input: InstantBrandInput): boolean {
  return instantProblems(input).length === 0;
}

/**
 * Os essenciais aplicados a uma marca, pronta a gerar.
 *
 * Só toca no que o ecrã instantâneo recolhe. Uma marca que já tenha
 * identidade aprovada, biblioteca ou memória sai daqui com tudo isso
 * intacto — é o que permite a um cliente de sempre usar este ecrã para uma
 * arte rápida sem perder o que construiu.
 *
 * O website vai para os dados da empresa e não para os contactos:
 * `brandWebsite` lê os dois, e o contacto é território do cliente (ele pode
 * tê-lo tirado de propósito).
 */
export function applyInstantInput(base: Brand, input: InstantBrandInput): Brand {
  const primary = normalizeHex(input.colors.primary) ?? base.identity.colors.primary;
  const secondary = normalizeHex(input.colors.secondary) ?? base.identity.colors.secondary;
  const accent = input.colors.accent ? normalizeHex(input.colors.accent) : null;

  return {
    ...base,
    company: {
      ...base.company,
      name: input.name.trim(),
      website: input.website.trim(),
    },
    identity: {
      ...base.identity,
      colors: { primary, secondary, accent },
      colorsConfirmed: true,
      logoAssetId: input.logoAssetId,
    },
    /*
      A marca passa a contar como pronta (`isBrandReady`), e com isso o
      painel inteiro abre. É a afirmação honesta do que aconteceu: há nome
      e há cores escolhidas, que é o mínimo para criar.
    */
    onboardingComplete: true,
    updatedAt: new Date().toISOString(),
  };
}

import type { LogoColorAnalysis } from '@/lib/brand/extractColors';
import { complementFor } from '@/lib/brand/extractColors';
import { normalizeHex } from '@/lib/utils/color';
import { createBrand } from './factories';
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
 * o cliente antes de ele ver o produto a funcionar. Daí este modo: nome,
 * logótipo, duas cores, o pedido — e gera.
 *
 * O que se perde está declarado e é recuperável. Sem `spec` aprovada,
 * `guidelinesFrom` devolve `null` e a arte é gerada sem regras de
 * identidade: sai boa, mas a próxima não tem como ser coerente com esta. A
 * área Marca completa a identidade depois.
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

/**
 * A conta de quem não tem conta.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O ecrã instantâneo não pede cadastro: o visitante chega, preenche e gera.
 * Mas um projecto e um ficheiro precisam de um `accountId` — é uma coluna
 * obrigatória no `UploadInput` e no `Project` —, e o armazenamento local
 * nunca o valida: filtra por igualdade de texto e mais nada.
 *
 * Um identificador fixo, e não um por visita: assim o trabalho anónimo deste
 * browser fica todo no mesmo sítio, em vez de deixar uma conta órfã no
 * IndexedDB a cada vez que alguém abre a página.
 *
 * Isto NÃO é uma conta: não tem sessão, não tem palavra-passe, não aparece
 * em lado nenhum da aplicação e não sobrevive a outro browser. É só o nome
 * da gaveta onde o trabalho anónimo assenta.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const ANON_ACCOUNT_ID = 'anonimo';

/** Uma marca de trabalho para quem não tem conta. Vive só em memória. */
export function anonymousBrand(): Brand {
  return createBrand(ANON_ACCOUNT_ID);
}

/**
 * Os essenciais de uma marca, para o ecrã instantâneo pré-encher.
 *
 * A terceira cor começa SEMPRE vazia, mesmo que a marca tenha uma. É uma
 * decisão do cliente: a maior parte das marcas tem duas cores, e aparecer
 * uma terceira já preenchida era a aplicação a decidir por ele — depois
 * entrava na arte como realce sem ninguém a ter escolhido.
 */
export function instantInputFrom(brand: Brand): InstantBrandInput {
  return {
    name: brand.company.name,
    colors: {
      primary: brand.identity.colors.primary,
      secondary: brand.identity.colors.secondary,
      accent: null,
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
 * As duas cores da marca, lidas do logótipo.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Devolve `null` quando o ficheiro não se leu — aí os campos ficam como
 * estavam, que é melhor do que escrever um palpite por cima do que o
 * cliente possa ter posto.
 *
 * Três casos, porque um logótipo não dá sempre o mesmo:
 *
 *  · DUAS cores ou mais → são as duas da marca, pela ordem de frequência.
 *    É o caso do logótipo com uma gota azul e uma onda âmbar;
 *  · UMA cor → ela é a principal, e a segunda deriva-se do tom
 *    (`complementFor`): um logótipo escuro pede branco, um claro pede um
 *    preto suave. Não se inventa uma segunda cor que não está no ficheiro;
 *  · NENHUMA cor, mas legível → o logótipo é monocromático. A cor dele é o
 *    preto (ou o branco) que lá está, e dizer "não conseguimos ler" sobre
 *    isso seria falso.
 *
 * A terceira cor nunca sai daqui. Quem a quer, escolhe-a.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function colorsFromLogo(
  analysis: LogoColorAnalysis,
): { primary: string; secondary: string } | null {
  if (analysis.unreadable) return null;

  const read = analysis.colors.map((color) => normalizeHex(color.hex)).filter(Boolean) as string[];

  if (read.length >= 2) return { primary: read[0], secondary: read[1] };
  if (read.length === 1) {
    return { primary: read[0], secondary: complementFor(read[0], analysis.tone) };
  }

  const dominant = normalizeHex(analysis.dominant);
  if (!dominant) return null;
  return { primary: dominant, secondary: complementFor(dominant, analysis.tone) };
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
      painel inteiro abre a quem tiver conta. É a afirmação honesta do que
      aconteceu: há nome e há cores escolhidas, que é o mínimo para criar.
    */
    onboardingComplete: true,
    updatedAt: new Date().toISOString(),
  };
}

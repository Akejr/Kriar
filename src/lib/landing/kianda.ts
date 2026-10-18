import type { StaticImageData } from 'next/image';
import arte from '@/kianda/arte-lancamento.webp';
import difusor from '@/kianda/difusor.webp';
import logotipoFundoEscuro from '@/kianda/logotipo-fundo-escuro.png';
import logotipo from '@/kianda/logotipo.png';
import perfume from '@/kianda/perfume.webp';
import simbolo from '@/kianda/simbolo.png';
import type { DemoProductId } from './content';

/**
 * A identidade da Perfumaria Kianda, a marca fictícia das demonstrações.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Os ficheiros estão em `src/kianda/` e saem de `scripts/gerar-kianda.mjs`
 * (os originais e o registo de cada geração ficam em `src/kianda/origem/`).
 * Importados, e não servidos de `public/`, pela mesma razão das artes da
 * primeira dobra: o `next/image` sabe as medidas e gera as versões
 * reduzidas, e um ficheiro em falta parte a compilação.
 *
 *  · O logótipo, as duas fotografias e a versão para fundo escuro foram
 *    pedidos ao modelo de imagem: são o MATERIAL da empresa — o que um
 *    cliente carrega na Kriar —, com a paleta de `DEMO_BRAND`.
 *  · A arte da revisão interactiva é o contrário: um RESULTADO, feito pelas
 *    rotas da Kriar com estes ficheiros (`/api/ai/plan`, `/api/ai/artwork`,
 *    `/api/ai/review-art`). A conta de demonstração usa os mesmos ficheiros
 *    (`src/lib/data/seed.ts`).
 * ──────────────────────────────────────────────────────────────────────────
 */

type Picture = { src: StaticImageData; alt: string };

export const KIANDA_LOGO: Picture = {
  src: logotipo,
  alt: 'Logótipo da Perfumaria Kianda: uma gota azul-marinho com uma onda âmbar e o nome KIANDA, com PERFUMARIA por baixo.',
};

/** A versão para fundos escuros: o azul-marinho passa a creme. */
export const KIANDA_LOGO_ON_DARK: Picture = {
  src: logotipoFundoEscuro,
  alt: KIANDA_LOGO.alt,
};

/** Só a gota, para os sítios onde o nome não cabe. */
export const KIANDA_SYMBOL: Picture = {
  src: simbolo,
  alt: 'Símbolo da Perfumaria Kianda: uma gota azul-marinho com uma onda âmbar.',
};

/** As fotografias dos produtos, as que o cliente anexa ao pedido. */
export const KIANDA_PHOTOS: Record<DemoProductId, Picture> = {
  perfume: {
    src: perfume,
    alt: 'Fotografia do perfume Noite de Luanda: um frasco azul-marinho com tampa dourada e o rótulo da Kianda, sobre creme, ao lado de seda azul.',
  },
  difusor: {
    src: difusor,
    alt: 'Fotografia do difusor de ambiente da Kianda: um frasco âmbar com varetas, gargalo azul-marinho e o rótulo da marca, sobre creme, ao lado de seda azul.',
  },
};

/**
 * A arte que a revisão interactiva mostra ao carregar em "Gerar arte".
 *
 * Os dados são os que a secção mostra por omissão: o título proposto, o
 * perfume em destaque, o logótipo em cima à esquerda, o website e o estilo
 * automático. O texto de apoio e o botão foram propostos pela Kriar.
 */
export const KIANDA_ART: Picture & { headline: string } = {
  src: arte,
  headline: 'Chegou o novo perfume Kianda',
  alt: 'Arte gerada pela Kriar para a Perfumaria Kianda: o frasco do Noite de Luanda sobre um espelho escuro, entre seda creme e as luzes da baía de Luanda à noite, com o título «Chegou o novo perfume Kianda», o texto «Noite de Luanda, uma fragrância de autor.», o botão «Descobre já», o website www.kianda.ao e o logótipo em cima, à esquerda.',
};

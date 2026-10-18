import type { StaticImageData } from 'next/image';
import arte1 from '@/hero arts/arte1.webp';
import arte2 from '@/hero arts/arte2.webp';
import arte3 from '@/hero arts/arte3.webp';
import arte4 from '@/hero arts/arte4.webp';
import arte5 from '@/hero arts/arte5.webp';
import arte6 from '@/hero arts/arte6.webp';
import arte7 from '@/hero arts/arte7.webp';
import arte8 from '@/hero arts/arte8.webp';

/**
 * As artes das faixas da primeira dobra.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Ficam em `src/hero arts/`, em WebP. Importadas aqui, e não servidas de
 * `public/`: o `next/image` fica a saber a largura e a altura de cada uma
 * (nada salta enquanto carregam), gera as versões reduzidas e o desfoque de
 * espera, e um ficheiro que falte parte a compilação em vez de partir a
 * página.
 *
 * Para acrescentar artes: põe os PNG ou JPG na pasta, corre
 * `node scripts/converter-hero.mjs` e acrescenta uma entrada aqui, com o
 * texto alternativo a dizer o que a arte mostra.
 *
 * A ORDEM decide as faixas: as de índice par vão para a de cima, as
 * ímpares para a de baixo. Está escolhida para as claras e as escuras se
 * alternarem — em cima clara, escura, clara, escura; no arranque, as duas
 * faixas alinhadas fazem um xadrez. Com menos de quatro por faixa, as
 * faixas completam-se com plantas (`HeroMarquee`).
 * ──────────────────────────────────────────────────────────────────────────
 */
/** `id`: o nome do ficheiro, para outras secções escolherem artes desta lista. */
export type HeroArt = { id: string; src: StaticImageData; alt: string };

export const HERO_ARTS: HeroArt[] = [
  {
    id: 'arte1',
    src: arte1,
    alt: 'Arte feita com a Kriar: «Qual é a tua próxima criação?», com peças de um jogo do galo — imagem, ideia, texto, design e cor.',
  },
  {
    id: 'arte6',
    src: arte6,
    alt: 'Arte feita com a Kriar: «Boas ideias merecem grandes artes.», com a ilustração a preto e verde de duas pessoas a passear um cão.',
  },
  {
    id: 'arte4',
    src: arte4,
    alt: 'Arte feita com a Kriar: «Um mundo de ideias. A tua identidade.», em três faixas — Sabores, Estilo e Essência — com um bife, uma mulher de fato claro ao lado de um ténis e um perfume.',
  },
  {
    id: 'arte2',
    src: arte2,
    alt: 'Arte feita com a Kriar: «A tua marca. Outro nível.», com três artes de exemplo — um ténis, um prato de marisco e um perfume — à frente de um portátil com a Kriar aberta.',
  },
  {
    id: 'arte5',
    src: arte5,
    alt: 'Arte feita com a Kriar: «Uma ideia. Infinitas possibilidades.», com um telemóvel a mostrar a Kriar e seis artes de exemplo ao lado — carne, perfume, ténis, livros, café e um creme.',
  },
  {
    id: 'arte7',
    src: arte7,
    alt: 'Arte feita com a Kriar: «Todas as tuas ideias. Um só lugar.», com cinco artes de exemplo a flutuar — Estilo, Essência, Sabores, Inspira e Pausa.',
  },
  {
    id: 'arte8',
    src: arte8,
    alt: 'Arte feita com a Kriar para o Dia do Herói Nacional, a 17 de Setembro: homenagem a Agostinho Neto dentro do mapa de Angola, com o Memorial e a marginal de Luanda.',
  },
  {
    id: 'arte3',
    src: arte3,
    alt: 'Arte feita com a Kriar: «A tua próxima arte, servida com criatividade.», com mãos de luvas brancas a destapar uma bandeja com quatro artes — perfume, massa, moda e um creme.',
  },
];

/** Uma arte desta lista pelo nome do ficheiro. Um nome que não exista parte a compilação da página. */
export function heroArt(id: string): HeroArt {
  const art = HERO_ARTS.find((entry) => entry.id === id);
  if (!art) throw new Error(`Arte desconhecida em heroArts.ts: ${id}`);
  return art;
}

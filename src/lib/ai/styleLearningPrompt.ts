/**
 * Leitura do estilo de uma marca a partir das artes que ela já publicou.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A distinção que tudo isto protege: ESTILO contra CONTEÚDO.
 *
 * O estilo é o que se repete de arte para arte — a tipografia, o uso da
 * cor, a forma de compor, o tratamento da fotografia, os grafismos. É o
 * que faz um perfil de Instagram parecer de uma só empresa.
 *
 * O conteúdo é o que cada arte diz — os produtos, os preços, a promoção da
 * semana, as pessoas. Esse nunca se aproveita: uma arte nova com a
 * promoção de uma antiga é um erro, não coerência.
 *
 * Por isso a leitura pede as duas coisas em campos separados, e para cada
 * arte guardada como referência pede o conteúdo dela por extenso — é essa
 * lista que o prompt de geração usa para dizer o que não passa.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { z } from 'zod';
import { LEARN_IMAGE_LIMIT } from '@/lib/brand/styleLearning';
import { SEGMENTS } from '@/lib/domain/catalog';

export { LEARN_IMAGE_LIMIT };

export function buildStyleLearningSystemPrompt(): string {
  return [
    'És director de arte sénior. Recebes artes que uma empresa já publicou nas redes sociais e extrais o ESTILO VISUAL que se repete nelas, para outra equipa criar publicações novas que pareçam da mesma marca.',
    'Respondes em português europeu. Devolves EXCLUSIVAMENTE um objecto JSON válido, sem texto antes ou depois.',
    '',
    'Descreves o que VÊS e se REPETE. Não inventas, não elogias, não sugeres melhorias. Um traço que só aparece numa arte não é estilo da marca: é dessa arte.',
    'Separas sempre ESTILO de CONTEÚDO. Estilo: tipografia, cor, composição, tratamento da imagem, grafismos, tom do texto. Conteúdo: os produtos, os preços, as promoções, as pessoas, as datas, os textos concretos. O estilo é o que se aproveita; o conteúdo nunca.',
    'Cores sempre por palavras ("azul-marinho profundo", "creme quente"), nunca por códigos.',
  ].join('\n');
}

export function buildStyleLearningUserPrompt(input: {
  company: { name: string; segment: string; description: string };
  imageCount: number;
  /** Quantas das primeiras imagens podem ser escolhidas. Por omissão, todas. */
  pickable?: number;
  /** O perfil anterior, em texto. Vazio na primeira leitura. */
  previous?: string;
}): string {
  const segment =
    SEGMENTS.find((entry) => entry.id === input.company.segment)?.label ?? input.company.segment;
  const pickable = Math.min(input.pickable ?? input.imageCount, input.imageCount);
  /*
    TODAS as novas, ordenadas. Escolhiam-se só as duas melhores, e só essas
    ficavam guardadas: o cliente enviava doze artes e via duas na
    biblioteca. Agora ficam todas; a ordem diz quais representam melhor o
    estilo, e o conteúdo de cada uma é o que protege as artes novas de a
    copiarem.
  */
  const picks = pickable;
  const inLibrary = input.imageCount - pickable;

  /*
    A biblioteca da marca cresce: as artes aprovadas na Kriar e as que o
    cliente envia depois. A leitura vê-as todas (até doze) e escreve o perfil
    de novo — o perfil anterior entra como contexto, porque foi lido também
    de artes que podem já não estar guardadas.
  */
  const library =
    inLibrary > 0
      ? pickable > 0
        ? `As imagens ${pickable + 1} a ${input.imageCount} já estão na biblioteca da marca: lê-as para o perfil, mas não as escolhas como referência.`
        : 'Todas estas imagens já estão na biblioteca da marca, e as mais recentes são publicações aprovadas pelo cliente: são a direcção que ele quer agora.'
      : '';

  return [
    '## Empresa',
    `Nome: ${input.company.name || '(não indicado)'}`,
    `Actividade: ${segment}`,
    `Descrição: ${input.company.description || '(não indicada)'}`,
    '',
    '## Artes',
    input.imageCount === 1
      ? 'Recebes 1 imagem: a imagem 1.'
      : `Recebes ${input.imageCount} imagens, numeradas pela ordem em que chegam: da imagem 1 à imagem ${input.imageCount}.`,
    library,
    '',
    ...(input.previous?.trim()
      ? [
          '## Perfil anterior',
          'Foi lido de artes que podem já não estar entre estas. Usa-o como contexto: mantém o que as imagens confirmam e corrige o que elas contrariam. O que manda são as imagens.',
          input.previous.trim(),
          '',
        ]
      : []),
    '## O que extrair — cada campo em 1 a 3 frases concretas, com o que vês',
    '"summary": a linguagem visual da marca, numa ou duas frases que alguém possa seguir.',
    '"composition": como as artes se organizam — onde fica o título, o produto, o logótipo e os contactos; margens; quanto espaço vazio; densidade de elementos.',
    '"typography": o tipo de letra (serifada, sem serifa, manuscrita, geométrica, condensada), o peso, maiúsculas ou minúsculas, tamanhos relativos, alinhamento.',
    '"color": como as cores são usadas — a cor de fundo dominante, a cor dos títulos, a cor de destaque, o contraste.',
    '"imagery": o tratamento da imagem — fotografia de produto, de pessoas, de espaço, ilustração, 3D; a luz; os fundos; o recorte.',
    '"graphics": formas, faixas, selos de preço, ícones, molduras e texturas que se repetem. Vazio se não houver.',
    '"copy": o tom e a densidade do texto — frases curtas ou longas, como aparece o preço, como é a chamada para acção.',
    '"logo": como o logótipo costuma ser aplicado — posição, tamanho relativo, versão clara ou escura. Vazio se não aparecer.',
    '"recurring": até 6 elementos que aparecem em várias artes e definem a marca, em poucas palavras cada.',
    '"consistency": uma frase — as artes são coerentes entre si? Se variam muito, diz o que é comum a todas.',
    '',
    ...(picks === 0
      ? ['## Referências', '"picks": lista vazia — estas artes já estão guardadas.', '']
      : [
          '## As artes novas, por ordem',
          picks === 1
            ? '"picks": uma entrada, para a imagem 1.'
            : `"picks": UMA entrada para CADA imagem da 1 à ${pickable} — ${pickable} entradas, nenhuma repetida —, ordenadas da que melhor representa o estilo e tem melhor acabamento para a que menos o representa.`,
          'Para cada uma: "index" (o número da imagem), "why" (o que ela mostra do estilo, numa frase), "content" (o que esta arte MOSTRA e não pode ser copiado para uma arte nova — os produtos, os textos, os preços, a promoção, as pessoas — em poucas palavras) e "topics" (2 a 5 palavras do tema: o produto ou serviço, a campanha, a ocasião).',
          '',
        ]),
    '## Formato da resposta',
    '{',
    '  "summary": "string", "composition": "string", "typography": "string", "color": "string",',
    '  "imagery": "string", "graphics": "string", "copy": "string", "logo": "string",',
    '  "recurring": ["string"], "consistency": "string",',
    picks === 0
      ? '  "picks": []'
      : '  "picks": [{ "index": 1, "why": "string", "content": "string", "topics": ["string"] }]',
    '}',
  ].join('\n');
}

/*
  Leitura TOLERANTE: aparar, nunca rejeitar.

  A mesma lição da transcrição do logótipo: com `max()`, uma descrição um
  pouco mais longa chumbava a resposta inteira — e aqui a resposta custa
  doze imagens de leitura.
*/
const clipped = (max: number) =>
  z
    .string()
    .default('')
    .transform((value) => {
      const flat = value.replace(/\s+/g, ' ').trim();
      if (flat.length <= max) return flat;
      const cut = flat.slice(0, max);
      const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
      if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
      const word = cut.lastIndexOf(' ');
      return (word > 0 ? cut.slice(0, word) : cut).trim();
    });

export const styleLearningResponseSchema = z.object({
  summary: clipped(600),
  composition: clipped(420),
  typography: clipped(420),
  color: clipped(420),
  imagery: clipped(420),
  graphics: clipped(420),
  copy: clipped(420),
  logo: clipped(320),
  recurring: z
    .array(clipped(160))
    .default([])
    .transform((items) => items.filter(Boolean).slice(0, 6)),
  consistency: clipped(300),
  picks: z
    .array(
      z.object({
        index: z.coerce.number().int(),
        why: clipped(240),
        content: clipped(240),
        topics: z
          .array(clipped(40))
          .default([])
          .transform((topics) => topics.filter(Boolean).slice(0, 5)),
      }),
    )
    .default([]),
});

export type StyleLearningResponse = z.infer<typeof styleLearningResponseSchema>;

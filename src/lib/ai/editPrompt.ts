/**
 * Instrução para EDITAR uma arte já gerada, zona a zona.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * É o oposto do prompt de geração. Ali a instrução constrói uma publicação
 * nova; aqui tem de PRESERVAR uma que o cliente já aprovou e mudar só o que
 * ele marcou.
 *
 * Três fontes apontam cada zona, de propósito:
 *
 *  1. o MAPA (imagem 2) — a arte com a zona pintada a uma cor e numerada;
 *  2. a POSIÇÃO em palavras — "no canto superior direito, cerca de 20% da
 *     largura";
 *  3. a COR nomeada — "a mancha magenta com o número 1".
 *
 * Com uma só fonte, o gerador escolhia às vezes a zona errada. Com três a
 * dizerem o mesmo, não há interpretação a fazer.
 *
 * O resto do prompt é sobre o que NÃO muda, porque é aí que um gerador
 * falha: redesenha a imagem inteira e muda um título, um tom, um logótipo
 * que ninguém pediu para mudar. O servidor protege o que está fora das
 * zonas na composição final (`composeEdit`); o prompt protege o que está
 * dentro delas e não foi pedido.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { describeColor } from '@/lib/composition/palette';

export type EditPromptZone = {
  number: number;
  request: string;
  /** "no canto superior direito (cerca de 20% da largura…)". */
  position: string;
  /** Nome da cor da zona no mapa. */
  colorName: string;
  /** Imagem anexada (número, a partir de 1) com material para a zona. */
  imageIndex: number | null;
};

export function buildEditPrompt(input: {
  company: string;
  zones: EditPromptZone[];
  /** `false` quando o cliente deixou a IA ajustar à volta das zonas. */
  preserveOutside: boolean;
  /** O logótipo, quando a arte o leva e o ficheiro vai anexado. */
  logo: { index: number; text: string; letters: string[]; symbols: string } | null;
  colors: { primary: string; secondary: string; accent?: string | null };
  /** Textos que estão na arte e têm de ficar exactos. */
  texts: string[];
  contacts: string[];
  /** Defeitos da tentativa anterior, quando esta é uma correcção. */
  correction: string[];
}): string {
  const lines: string[] = [];
  const who = input.company.trim() ? ` de ${input.company.trim()}` : '';

  lines.push(
    'EDIÇÃO DE UMA PUBLICAÇÃO JÁ APROVADA.',
    '',
    `A imagem 1 é a publicação actual${who}. O resultado é ESTA MESMA publicação, com as alterações pedidas abaixo e mais nenhuma. Mesma proporção, mesmo enquadramento, mesma cena, mesma luz, mesmos textos e mesmo logótipo — tudo na mesma posição e no mesmo tamanho.`,
    '',
    'A imagem 2 é um MAPA das zonas a alterar: a imagem 1 com cada zona pintada de uma cor e marcada com um número. Serve só para localizar as zonas. As manchas de cor, os contornos e os números do mapa não fazem parte da publicação e NUNCA aparecem no resultado.',
    '',
  );

  /*
    A correcção vem logo a seguir à identificação das imagens, antes dos
    pedidos: é o que esta tentativa tem de fazer diferente da anterior.
  */
  if (input.correction.length > 0) {
    lines.push(
      'CORRECÇÃO OBRIGATÓRIA — a tentativa anterior desta edição falhou nestes pontos:',
      ...input.correction.map((issue) => `· ${issue}`),
      'Resolve-os nesta tentativa, sem mexer em mais nada.',
      '',
    );
  }

  lines.push('ALTERAÇÕES PEDIDAS');
  for (const zone of input.zones) {
    lines.push(
      `Zona ${zone.number} — a mancha ${zone.colorName} com o número ${zone.number} no mapa, ${zone.position}:`,
      zone.request.trim(),
    );
    if (zone.imageIndex) {
      lines.push(
        `Usa a imagem ${zone.imageIndex} como material para esta zona: reproduz com fidelidade o que lá está, integrado na luz e na perspectiva da arte.`,
      );
    }
    lines.push('');
  }

  lines.push(
    'COMO APLICAR CADA ALTERAÇÃO',
    input.preserveOutside
      ? '· Cada alteração fica dentro da sua zona. Fora das zonas não muda nada — nem um traço, nem um tom.'
      : '· Cada alteração fica na sua zona. À volta dela só podes ajustar o mínimo necessário para a alteração encaixar com naturalidade.',
    '· A alteração integra-se na arte: a mesma luz, a mesma perspectiva, o mesmo grão, a mesma nitidez e o mesmo acabamento do resto. Nada com aspecto colado.',
    '· Um elemento removido dá lugar ao que estaria por trás dele, contínuo com o que o rodeia.',
    '· Um texto novo ou alterado usa a mesma família tipográfica, o mesmo peso e a mesma cor dos textos da arte, salvo se o pedido disser outra coisa. Escreve-se exactamente como foi pedido, letra a letra, com os acentos.',
    '',
  );

  lines.push('O QUE NÃO MUDA');
  const texts = input.texts.map((text) => text.trim()).filter(Boolean);
  if (texts.length > 0) {
    lines.push(
      `· Os textos que nenhuma zona pede para mudar mantêm-se letra a letra: ${texts
        .map((text) => `«${text}»`)
        .join(', ')}.`,
    );
  }
  const contacts = input.contacts.map((contact) => contact.trim()).filter(Boolean);
  if (contacts.length > 0) {
    lines.push(
      `· Os contactos mantêm-se carácter a carácter: ${contacts.map((value) => `«${value}»`).join(', ')}.`,
    );
  }

  if (input.logo) {
    const spelled =
      input.logo.letters.length > 0 ? input.logo.letters.join(' · ') : input.logo.text;
    const reading = input.logo.text
      ? ` O texto do logótipo é «${input.logo.text}» e lê-se ${spelled}, da esquerda para a direita.`
      : '';
    lines.push(
      `· O logótipo fica exactamente como está na imagem 1. Se uma alteração lhe tocar, a referência fiel é a imagem ${input.logo.index}.${reading} Nunca espelhado, nunca redesenhado, nunca com outra cor.`,
    );
  }

  const palette = [
    `dominante ${describeColor(input.colors.primary)}`,
    `apoio ${describeColor(input.colors.secondary)}`,
    input.colors.accent ? `realce ${describeColor(input.colors.accent)}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  lines.push(
    `· As cores da marca — ${palette} — continuam a mandar nas superfícies e nos textos. Só entra uma cor nova se um pedido a nomear.`,
    '· Nenhum elemento novo além do que foi pedido.',
    '',
  );

  lines.push(
    `Não incluir: ${[
      'manchas de cor do mapa',
      'contornos coloridos à volta das zonas',
      'números de zona',
      'círculos numerados',
      'setas ou marcas de anotação',
      'texto inventado',
      'palavras sem sentido',
      'letras deformadas',
      'marcas de água',
      'molduras',
      ...(input.logo ? ['logótipo espelhado, redesenhado ou com outra cor'] : []),
    ].join(', ')}.`,
  );

  return lines.join('\n');
}

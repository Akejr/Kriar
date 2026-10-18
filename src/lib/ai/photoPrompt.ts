/**
 * Instrução para editar por zonas uma FOTOGRAFIA do cliente.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O irmão de `buildEditPrompt`, com a mesma mecânica de três fontes a
 * apontar cada zona — o mapa, a posição em palavras e a cor nomeada — e
 * sem nada do que é de uma publicação: não há cores de marca a respeitar,
 * nem textos exactos, nem logótipo, nem contactos.
 *
 * Em troca, leva duas defesas que uma publicação não precisa:
 *
 *  1. É UMA FOTOGRAFIA, não uma ilustração. Um gerador a quem se pede
 *     "melhora esta luz" devolve com frequência uma versão mais bonita e
 *     mais falsa — pele de plástico, reflexos de render, contornos
 *     perfeitos. O resultado tem de continuar a parecer tirado pela mesma
 *     câmara.
 *
 *  2. NADA DE TEXTO NOVO. A fotografia editada vai servir uma publicação,
 *     onde os textos são compostos por quem sabe o que a arte vai dizer. O
 *     texto que JÁ ESTÁ na fotografia é outra coisa: faz parte do objecto
 *     (a etiqueta de um frasco, o nome de uma fachada) e fica carácter a
 *     carácter, salvo se um pedido de zona falar dele.
 *
 * Como na edição de artes, as máscaras não vão ao gerador: são do servidor,
 * e é com elas que `composeEdit` garante que fora das zonas a fotografia
 * fica igual ao píxel.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type PhotoZone = {
  number: number;
  request: string;
  /** "no canto superior direito (cerca de 20% da largura…)". */
  position: string;
  /** Nome da cor da zona no mapa. */
  colorName: string;
  /** Imagem anexada (número, a partir de 1) com material para a zona. */
  imageIndex: number | null;
};

export function buildPhotoEditPrompt(input: {
  zones: PhotoZone[];
  /** `false` quando o cliente deixou a IA ajustar à volta das zonas. */
  preserveOutside: boolean;
  /** Defeitos da tentativa anterior, quando esta é uma correcção. */
  correction: string[];
}): string {
  const lines: string[] = [];

  lines.push(
    'EDIÇÃO POR ZONAS DE UMA FOTOGRAFIA.',
    '',
    'A imagem 1 é uma fotografia real de um cliente. O resultado é ESTA MESMA fotografia, com as alterações pedidas abaixo e mais nenhuma. Mesma proporção, mesmo enquadramento, mesma cena, mesma luz e mesmos objectos — tudo na mesma posição e no mesmo tamanho.',
    '',
    'A imagem 2 é um MAPA das zonas a alterar: a imagem 1 com cada zona pintada de uma cor e marcada com um número. Serve só para localizar as zonas. As manchas de cor, os contornos e os números do mapa NUNCA aparecem no resultado.',
    '',
  );

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
        `Usa a imagem ${zone.imageIndex} como material para esta zona: reproduz com fidelidade o que lá está, integrado na luz e na perspectiva da fotografia.`,
      );
    }
    lines.push('');
  }

  lines.push(
    'COMO APLICAR CADA ALTERAÇÃO',
    input.preserveOutside
      ? '· Cada alteração fica dentro da sua zona. Fora das zonas não muda nada — nem um traço, nem um tom.'
      : '· Cada alteração fica na sua zona. À volta dela só podes ajustar o mínimo necessário para a alteração encaixar com naturalidade.',
    '· A alteração integra-se na fotografia: a mesma luz e direcção de sombras, a mesma perspectiva, a mesma profundidade de campo, o mesmo grão e a mesma nitidez. Nada com aspecto colado.',
    '· Um elemento removido dá lugar ao que estaria por trás dele, contínuo com o que o rodeia — sem manchas lisas nem borrões.',
    '· Um elemento acrescentado assenta na superfície onde devia assentar, com a sombra de contacto que lhe corresponde.',
    '',
  );

  lines.push(
    'CONTINUA A SER UMA FOTOGRAFIA',
    '· O resultado tem de parecer tirado pela mesma câmara, no mesmo momento: fotografia real, não ilustração, não render, não pintura digital.',
    '· Sem reparos cosméticos que ninguém pediu: as texturas, os poros, as imperfeições, os riscos e o desgaste que a fotografia tem ficam como estão.',
    '· Sem aumentar contraste, saturação ou nitidez fora das zonas, e sem mudar o balanço de brancos da fotografia.',
    '',
  );

  lines.push(
    'O QUE NÃO MUDA, E O QUE NÃO ENTRA',
    '· Os objectos, as pessoas e o fundo que nenhuma zona nomeia ficam exactamente como estão, com a mesma forma, as mesmas cores e os mesmos pormenores.',
    '· O texto, os símbolos e os desenhos que já estão na fotografia — numa etiqueta, numa embalagem, numa fachada — mantêm-se carácter a carácter, com os mesmos acentos e a mesma tipografia. Não os traduzas, não os corrijas e não os redesenhes.',
    '· Texto nenhum que a fotografia não tenha: sem títulos, sem legendas, sem preços, sem nomes de marca inventados.',
    '· Sem logótipos, marcas de água, assinaturas, selos, molduras, bordas ou faixas de cor nas arestas.',
    '· Uma fotografia só: sem colagens, sem painéis e sem antes-e-depois lado a lado.',
    '',
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
      'aspecto de ilustração ou de render',
    ].join(', ')}.`,
  );

  return lines.join('\n');
}

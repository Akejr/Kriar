/**
 * A moldura da publicação e o que ela corta da imagem gerada.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O gerador não devolve a proporção da publicação. Os modelos da OpenAI não
 * aceitam 4:5: a publicação de Instagram (1080 × 1350) é pedida em 3:4
 * (1152 × 1536) e assenta na moldura em `cover`. A diferença sai em cima e
 * em baixo — cerca de 4% de cada lado, somado ao recorte de margem.
 *
 * Isto tinha um efeito concreto. O prompt pedia "margem de 8% da largura" e
 * os contactos "pequenos e discretos no rodapé"; o gerador punha o endereço
 * colado à aresta de baixo da imagem dele, e a moldura cortava-o. O cliente
 * via meia linha de texto por baixo do botão e nenhum website.
 *
 * Módulo puro de propósito: serve o servidor, que escreve as margens no
 * prompt, e o browser, que desenha a moldura e a envia ao verificador.
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Recorte de margem aplicado à imagem gerada, em fracção de cada lado.
 *
 * Os modelos de imagem deixam com frequência uma tira de um ou dois píxeis
 * de cor diferente junto às bordas. Perder 1,2% de cada lado é invisível
 * numa publicação e elimina o artefacto.
 */
export const EDGE_CROP = 0.012;

/**
 * Margem do conteúdo dentro da moldura final, em fracção do LADO MENOR.
 *
 * É a regra que o prompt sempre teve — oito por cento —, agora medida na
 * publicação que o cliente vê e não na imagem que o gerador desenha. Pelo
 * lado menor e não pela largura: num formato deitado, 8% da largura são 15%
 * da altura, e o texto ficava espremido ao centro.
 */
export const CONTENT_MARGIN = 0.08;

/** "3:4" → 0,75. Devolve 1 para um valor que não se lê. */
export function ratioOf(aspect: string): number {
  const [w, h] = aspect.split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}

/**
 * Quanto da imagem gerada fica FORA da moldura, em fracção de cada lado.
 *
 * `x` é a fracção da largura perdida à esquerda (e outra igual à direita);
 * `y` é a fracção da altura perdida em cima (e outra igual em baixo). Já
 * inclui o recorte de margem.
 */
export function hiddenFractions(
  sourceRatio: number,
  frameRatio: number,
): { x: number; y: number } {
  const usable = 1 - EDGE_CROP * 2;
  let x = EDGE_CROP;
  let y = EDGE_CROP;
  if (sourceRatio < frameRatio) {
    // Mais alta do que a moldura: a sobra sai em cima e em baixo.
    y += (usable * (1 - sourceRatio / frameRatio)) / 2;
  } else if (sourceRatio > frameRatio) {
    // Mais larga: a sobra sai dos lados.
    x += (usable * (1 - frameRatio / sourceRatio)) / 2;
  }
  return { x, y };
}

/**
 * As margens que o GERADOR tem de respeitar, em percentagem da imagem dele.
 *
 * Soma o que a moldura corta à margem do conteúdo. Para a publicação de
 * Instagram gerada em 3:4: cerca de 11% da altura em cima e em baixo e 9%
 * da largura dos lados. Arredondado para cima: uma margem a mais é
 * invisível, uma a menos é um contacto cortado.
 */
export function safeMargins(
  sourceRatio: number,
  frameRatio: number,
): { topBottom: number; sides: number } {
  const hidden = hiddenFractions(sourceRatio, frameRatio);
  // A margem é o mesmo número de píxeis nos quatro lados da moldura: em
  // fracção da altura e da largura, conforme o lado menor.
  const ofHeight = CONTENT_MARGIN * Math.min(frameRatio, 1);
  const ofWidth = CONTENT_MARGIN * Math.min(1, 1 / frameRatio);
  const sides = hidden.x + ofWidth * (1 - hidden.x * 2);
  const topBottom = hidden.y + ofHeight * (1 - hidden.y * 2);
  return {
    topBottom: Math.ceil(topBottom * 100),
    sides: Math.ceil(sides * 100),
  };
}

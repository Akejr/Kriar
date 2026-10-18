/**
 * Transcrição do logótipo, feita por um modelo de visão.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Um gerador de imagem que recebe só a imagem do logótipo tem de a
 * reinterpretar. Um que recebe também "o logótipo lê-se D · O · T, da
 * esquerda para a direita, com um raio branco dentro do O" tem duas fontes
 * que se confirmam uma à outra — e é muito mais difícil espelhar uma palavra
 * que foi soletrada.
 *
 * A transcrição é feita UMA vez por ficheiro e guardada pela impressão
 * digital do ficheiro: um logótipo novo tem identificador novo, por isso a
 * cache nunca fica desactualizada. Numa instância que reinicia perde-se, e o
 * custo é uma chamada de visão a mais — não um resultado errado.
 *
 * Falhar aqui não impede nada. Sem transcrição, o gerador continua a receber
 * a imagem e as regras.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { z } from 'zod';
import { extractJsonObject, resolveIdentityProvider } from '@/lib/ai/providers/text';
import type { PreparedLogo } from './logoReference';

export type LogoReading = {
  /** O texto do logótipo, exactamente como está. Vazio quando é só símbolo. */
  text: string;
  /** Cada carácter pela ordem de leitura. */
  letters: string[];
  /** Elementos gráficos e onde estão. */
  symbols: string;
  /** Forma, peso, orientação e cores, numa ou duas frases. */
  description: string;
};

/*
  Leitura TOLERANTE: aparar, nunca rejeitar.

  Com limites `max()`, uma descrição um pouco mais longa — o modelo escreve
  duas frases cheias, perto dos 300 caracteres — chumbava a resposta
  inteira, e a transcrição perdia-se por um adjectivo a mais. Numa de três
  leituras do mesmo logótipo, a leitura voltou vazia.
*/
const clipped = (max: number) =>
  z
    .string()
    .default('')
    .transform((value) => clip(value, max));

const schema = z.object({
  text: clipped(120),
  letters: z
    .union([
      z.array(z.string()),
      // "K r i a r" numa só string, em vez de uma lista.
      z.string().transform((value) => value.split(/[\s·,]+/)),
    ])
    .default([])
    .transform((letters) =>
      letters
        .map((letter) => letter.trim())
        .filter((letter) => letter.length > 0 && letter.length <= 4)
        .slice(0, 40),
    ),
  symbols: clipped(240),
  description: clipped(320),
});

/** Corta no fim de uma frase ou de uma palavra, nunca a meio de uma. */
function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  const word = cut.lastIndexOf(' ');
  return (word > 0 ? cut.slice(0, word) : cut).trim();
}

const cache = new Map<string, LogoReading>();

const SYSTEM = [
  'És um especialista em identidade visual. Recebes a imagem de um logótipo e transcreves EXACTAMENTE o que ele contém, para outra pessoa o conseguir reproduzir sem o ver.',
  'Respondes em português europeu. Devolves EXCLUSIVAMENTE um objecto JSON válido, sem texto antes ou depois.',
  'Não interpretas nem melhoras: descreves o que lá está. Se não tiveres a certeza de uma letra, di-lo em "description" em vez de adivinhar.',
].join('\n');

const USER = [
  'Transcreve este logótipo.',
  /*
    O fundo é nosso, não do logótipo: `prepareLogoReference` assenta-o num
    liso que contrasta. Sem esta frase a descrição dizia "logótipo sobre
    fundo preto" — e essa frase seguia para o prompt do gerador, que podia
    desenhar uma caixa preta atrás da marca.
  */
  'O fundo liso à volta do logótipo foi acrescentado só para lhe dar contraste: não faz parte dele. Não o menciones em nenhum campo.',
  '',
  '"text": o texto do logótipo tal como está escrito — maiúsculas, minúsculas e símbolos como ® ou ™. Vazio se o logótipo não tiver texto.',
  '"letters": cada carácter visível, um por entrada, pela ordem em que se lê, da esquerda para a direita. Quando uma letra é desenhada como símbolo — por exemplo um O feito de um círculo com um raio dentro —, escreve a letra que ela representa.',
  '"symbols": os elementos gráficos e onde estão. Exemplo: "raio branco recortado dentro do O; símbolo ® no canto superior direito".',
  '"description": forma das letras, peso do traço, orientação do conjunto e cores do próprio logótipo, numa ou duas frases. Sem falar do fundo.',
  '',
  'Formato: { "text": "string", "letters": ["string"], "symbols": "string", "description": "string" }',
].join('\n');

export async function readLogo(logo: PreparedLogo): Promise<LogoReading | null> {
  const cached = cache.get(logo.hash);
  if (cached) return cached;

  const provider = resolveIdentityProvider();
  if (!provider?.supportsImages) return null;

  try {
    const raw = await provider.generateJson({
      system: SYSTEM,
      user: USER,
      images: [logo.dataUrl],
      temperature: 0,
    });
    const parsed = schema.safeParse(extractJsonObject(raw));
    if (!parsed.success) return null;

    const reading: LogoReading = {
      text: parsed.data.text.trim(),
      letters: parsed.data.letters.map((letter) => letter.trim()).filter(Boolean),
      symbols: parsed.data.symbols.trim(),
      description: parsed.data.description.trim(),
    };

    // Só guardamos leituras com conteúdo: uma resposta vazia pode ter sido
    // uma falha passageira, e não queremos fixá-la para sempre.
    if (reading.text || reading.symbols || reading.description) {
      cache.set(logo.hash, reading);
    }
    return reading;
  } catch {
    return null;
  }
}

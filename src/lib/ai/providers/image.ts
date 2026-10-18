/**
 * Fornecedor de IMAGEM.
 *
 * Responsabilidade única: produzir FUNDOS. O prompt é construído em
 * `prompt.ts` com instruções explícitas para não desenhar texto, logótipos
 * nem o produto — esses elementos ficam sempre em camadas controladas pela
 * aplicação, e é isso que permite corrigir um preço sem refazer o fundo.
 *
 * Interface independente do fornecedor de texto, mesmo quando é a mesma
 * empresa a servir os dois.
 */
import { ratioOf } from '@/lib/composition/frame';
import type { FormatId } from '@/lib/domain/types';
import {
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULTS,
  describeOpenRouterError,
  openrouterHeaders,
  openrouterKey,
} from './openrouter';

export type ImageProviderId = 'openrouter' | 'openai' | 'stability';

export type GeneratedImage = {
  base64: string;
  mime: string;
  width: number | null;
  height: number | null;
  /** Custo em USD, quando o fornecedor o devolve. Útil para registo. */
  costUsd?: number | null;
};

export type ImageRequest = {
  prompt: string;
  format: FormatId;
  /**
   * Referências de estilo, como data URL ou endereço https.
   *
   * Quem decide o que entra aqui é `generationReferences`, no servidor. Um
   * fornecedor que não suporte imagem-a-imagem ignora-as — nunca falha o
   * pedido por causa delas.
   */
  references?: string[];
  signal?: AbortSignal;
};

export type ImageProvider = {
  id: ImageProviderId;
  model: string;
  /** `true` quando o fornecedor aceita referências de imagem. */
  acceptsReferences: boolean;
  /**
   * Proporção (largura/altura) da imagem que este fornecedor devolve para o
   * formato. Nem sempre é a da publicação — ver `OPENAI_ASPECT`. O prompt
   * precisa dela para saber quanto a moldura vai cortar.
   */
  outputRatio(format: FormatId): number;
  generate(args: ImageRequest): Promise<GeneratedImage>;
};

export class ImageProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ImageProviderError';
  }
}

/**
 * Tempo-limite de uma geração.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Subiu de 90 para 180 segundos, e por pouco.
 *
 * `gpt-5.4-image-2` raciocina sobre a instrução antes de gerar, e numa
 * medição real levou 86 segundos — quatro de margem para o limite antigo.
 * Uma arte paga que aborta a 90 segundos não devolve nada e não devolve o
 * dinheiro: o fornecedor já fez o trabalho.
 *
 * Um limite tem de ter folga sobre o tempo observado, não encostar-lhe.
 * ──────────────────────────────────────────────────────────────────────────
 */
const TIMEOUT_MS = 180_000;

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/**
 * Proporção pedida a cada fornecedor.
 *
 * Se o modelo devolver uma proporção ligeiramente diferente, não há problema:
 * o motor de composição desenha o fundo com `cover`, preservando proporções e
 * recortando o excedente.
 */
/**
 * Proporções por família de modelo.
 *
 * A API rejeita qualquer valor que o modelo não declare, por isso isto não é
 * cosmética: enviar `4:5` a um modelo da OpenAI devolve 400. Os modelos da
 * Google aceitam `4:5`; os da OpenAI não, e para o formato vertical usamos
 * `3:4` — o acabamento desenha a imagem em `cover` e absorve a diferença.
 */
const GOOGLE_ASPECT: Record<FormatId, string> = {
  vertical: '4:5',
  quadrado: '1:1',
  story: '9:16',
  reels: '9:16',
  // 1.91:1 não existe no conjunto normalizado. 16:9 (1.78) é o deitado mais
  // próximo, e o acabamento desenha em `cover` — a diferença sai nas pontas.
  linkedin: '16:9',
  horizontal: '16:9',
};

/**
 * Proporções da família OpenAI.
 *
 * Confirmadas com gerações reais contra `gpt-image-2.5-sunburst`: `1:1`
 * devolve 1024×1024, `3:4` dá 1152×1536, `9:16` dá 864×1536, `3:2` dá
 * 1536×1024 e `16:9` dá 1536×864. O `4:5` continua a dar 400, apesar de
 * constar da lista normalizada da API — é a razão de este mapa existir
 * separado do da Google.
 *
 * O LinkedIn pede 1.91:1 e leva `16:9` (1.78) em vez de `3:2` (1.5): das
 * proporções aceites é a que corta menos.
 */
const OPENAI_ASPECT: Record<FormatId, string> = {
  vertical: '3:4',
  quadrado: '1:1',
  story: '9:16',
  reels: '9:16',
  linkedin: '16:9',
  horizontal: '16:9',
};

/**
 * Parâmetros extra aceites por cada família.
 *
 * `resolution` é da Google; `quality` é da OpenAI. Trocá-los dá 400. A
 * detecção é pelo prefixo do identificador, que é a única pista que a API
 * nos dá sem um pedido adicional ao catálogo.
 */
function openrouterImageParams(
  model: string,
  format: FormatId,
  resolution: string,
): Record<string, unknown> {
  if (model.startsWith('openai/')) {
    const quality = process.env.OPENROUTER_IMAGE_QUALITY?.trim() || 'high';
    return { aspect_ratio: OPENAI_ASPECT[format], quality };
  }
  return { aspect_ratio: GOOGLE_ASPECT[format], resolution };
}

/**
 * Medidas do ponto de entrada directo da OpenAI.
 *
 * Só aceita três: quadrado, retrato e paisagem. Os formatos deitados caem
 * todos em `1536x1024` e os em pé em `1024x1536` — o recorte final é feito
 * pelo acabamento, que conhece a medida verdadeira da publicação.
 */
const OPENAI_SIZE: Record<FormatId, string> = {
  vertical: '1024x1536',
  quadrado: '1024x1024',
  story: '1024x1536',
  reels: '1024x1536',
  linkedin: '1536x1024',
  horizontal: '1536x1024',
};

const STABILITY_RATIO: Record<FormatId, string> = {
  vertical: '4:5',
  quadrado: '1:1',
  story: '9:16',
  reels: '9:16',
  linkedin: '16:9',
  horizontal: '16:9',
};

// --- OpenRouter (fornecedor principal) --------------------------------------

type OpenRouterImageResponse = {
  created?: number;
  data?: Array<{ b64_json?: string; media_type?: string; url?: string }>;
  usage?: { cost?: number };
  error?: { message?: string };
};

function openrouterImageProvider(): ImageProvider | null {
  const key = openrouterKey();
  if (!key) return null;
  const model = process.env.OPENROUTER_IMAGE_MODEL?.trim() || OPENROUTER_DEFAULTS.image;
  const resolution =
    process.env.OPENROUTER_IMAGE_RESOLUTION?.trim() || OPENROUTER_DEFAULTS.imageResolution;

  return {
    id: 'openrouter',
    model,
    acceptsReferences: true,
    outputRatio: (format) =>
      ratioOf(model.startsWith('openai/') ? OPENAI_ASPECT[format] : GOOGLE_ASPECT[format]),
    async generate({ prompt, format, references, signal }) {
      const { signal: timed, done } = withTimeout(signal);
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
          method: 'POST',
          headers: openrouterHeaders(key),
          body: JSON.stringify({
            model,
            prompt,
            n: 1,
            ...openrouterImageParams(model, format, resolution),
            // A API rejeita campos que o modelo não declare, por isso o
            // `input_references` só vai quando há referências para enviar.
            ...(references && references.length > 0
              ? {
                  input_references: references.map((url) => ({
                    type: 'image_url',
                    image_url: { url },
                  })),
                }
              : {}),
          }),
          signal: timed,
        });

        if (!response.ok) {
          throw new ImageProviderError(
            await describeOpenRouterError(response, 'imagem'),
            response.status,
          );
        }

        const data = (await response.json()) as OpenRouterImageResponse;
        if (data.error?.message) {
          throw new ImageProviderError(`A geração de fundo falhou: ${data.error.message}`);
        }

        const entry = data.data?.[0];
        if (entry?.b64_json) {
          return {
            base64: entry.b64_json,
            mime: entry.media_type ?? 'image/png',
            width: null,
            height: null,
            costUsd: data.usage?.cost ?? null,
          };
        }
        // Alguns fornecedores devolvem um endereço em vez dos bytes.
        if (entry?.url) {
          const file = await fetch(entry.url, { signal: timed });
          if (!file.ok) {
            throw new ImageProviderError('Não foi possível descarregar o fundo gerado.');
          }
          const buffer = Buffer.from(await file.arrayBuffer());
          return {
            base64: buffer.toString('base64'),
            mime: file.headers.get('content-type') ?? 'image/png',
            width: null,
            height: null,
            costUsd: data.usage?.cost ?? null,
          };
        }

        throw new ImageProviderError('O fornecedor não devolveu nenhuma imagem.');
      } finally {
        done();
      }
    },
  };
}

// --- OpenAI directo ---------------------------------------------------------

function openaiImageProvider(): ImageProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

  return {
    id: 'openai',
    model,
    // O ponto de entrada usado aqui é `images/generations`, só de texto.
    acceptsReferences: false,
    outputRatio: (format) => ratioOf(OPENAI_SIZE[format].replace('x', ':')),
    async generate({ prompt, format, signal }) {
      const { signal: timed, done } = withTimeout(signal);
      try {
        const response = await fetch(`${baseUrl}/images/generations`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, prompt, n: 1, size: OPENAI_SIZE[format] }),
          signal: timed,
        });
        if (!response.ok) {
          throw new ImageProviderError(
            `O fornecedor de imagem respondeu ${response.status}.`,
            response.status,
          );
        }
        const data = (await response.json()) as {
          data?: Array<{ b64_json?: string; url?: string }>;
        };
        const entry = data.data?.[0];
        if (entry?.b64_json) {
          return { base64: entry.b64_json, mime: 'image/png', width: null, height: null };
        }
        if (entry?.url) {
          const file = await fetch(entry.url, { signal: timed });
          const buffer = Buffer.from(await file.arrayBuffer());
          return {
            base64: buffer.toString('base64'),
            mime: file.headers.get('content-type') ?? 'image/png',
            width: null,
            height: null,
          };
        }
        throw new ImageProviderError('O fornecedor de imagem não devolveu nenhuma imagem.');
      } finally {
        done();
      }
    },
  };
}

// --- Stability --------------------------------------------------------------

function stabilityImageProvider(): ImageProvider | null {
  const key = process.env.STABILITY_API_KEY;
  if (!key) return null;
  const model = process.env.STABILITY_IMAGE_MODEL || 'sd3.5-medium';

  return {
    id: 'stability',
    model,
    acceptsReferences: false,
    outputRatio: (format) => ratioOf(STABILITY_RATIO[format]),
    async generate({ prompt, format, signal }) {
      const { signal: timed, done } = withTimeout(signal);
      try {
        const form = new FormData();
        form.append('prompt', prompt);
        form.append('model', model);
        form.append('aspect_ratio', STABILITY_RATIO[format]);
        form.append('output_format', 'jpeg');
        form.append('mode', 'text-to-image');

        const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, accept: 'image/*' },
          body: form,
          signal: timed,
        });
        if (!response.ok) {
          throw new ImageProviderError(
            `O fornecedor de imagem respondeu ${response.status}.`,
            response.status,
          );
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return {
          base64: buffer.toString('base64'),
          mime: response.headers.get('content-type') ?? 'image/jpeg',
          width: null,
          height: null,
        };
      } finally {
        done();
      }
    },
  };
}

const BUILDERS: Record<ImageProviderId, () => ImageProvider | null> = {
  openrouter: openrouterImageProvider,
  openai: openaiImageProvider,
  stability: stabilityImageProvider,
};

const ORDER: ImageProviderId[] = ['openrouter', 'openai', 'stability'];

export function resolveImageProvider(): ImageProvider | null {
  const preferred = process.env.KRIAR_IMAGE_PROVIDER?.trim().toLowerCase();
  if (preferred && preferred in BUILDERS) {
    return BUILDERS[preferred as ImageProviderId]();
  }
  for (const id of ORDER) {
    const provider = BUILDERS[id]();
    if (provider) return provider;
  }
  return null;
}

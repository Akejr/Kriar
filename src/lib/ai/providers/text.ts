/**
 * Fornecedor de TEXTO.
 *
 * Responsabilidade única: devolver o plano da publicação em JSON.
 *
 * A interface é deliberadamente separada do fornecedor de imagem. O
 * OpenRouter serve os dois, mas por APIs diferentes e com modelos
 * diferentes — e queremos poder trocar um lado sem mexer no outro.
 *
 * Tudo corre no servidor. As chaves nunca são enviadas para o browser.
 */
import {
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULTS,
  describeOpenRouterError,
  openrouterHeaders,
  openrouterKey,
} from './openrouter';

export type TextProviderId = 'openrouter' | 'openai' | 'anthropic' | 'google';

export type TextRequest = {
  system: string;
  user: string;
  /**
   * Imagens a analisar, em data URL.
   *
   * Serve a análise do logótipo na etapa de identidade: o modelo olha para o
   * ficheiro e descreve estilo, cores e aplicação. Só os fornecedores com
   * capacidade multimodal as usam — `supportsImages` diz quais. Os restantes
   * ignoram-nas em vez de falhar, porque o pedido continua a fazer sentido
   * sem elas.
   */
  images?: string[];
  /**
   * Aleatoriedade da resposta. Por omissão 0.6.
   *
   * As tarefas de LEITURA — transcrever um logótipo, verificar uma arte —
   * pedem 0: a mesma imagem tem de dar a mesma resposta, senão a verificação
   * aprova numa chamada o que reprova na seguinte.
   */
  temperature?: number;
  signal?: AbortSignal;
  /**
   * Tempo-limite desta chamada. Por omissão 45 segundos.
   *
   * Ler o estilo de doze artes de uma vez leva mais do que propor um
   * conceito: com o limite fixo, a leitura abortava a meio e o cliente
   * perdia a espera inteira.
   */
  timeoutMs?: number;
  /**
   * Tecto de tokens da resposta. Por omissão 16 000.
   *
   * Sem tecto, o OpenRouter reserva o máximo do modelo (65 536 no GPT-5.4)
   * e recusa o pedido quando o saldo não cobre essa reserva — mesmo que a
   * resposta real gaste três mil. Com o saldo a acabar, TODAS as chamadas
   * de texto falhavam. Dezasseis mil cobrem com folga o maior JSON que
   * pedimos, raciocínio do modelo incluído.
   */
  maxTokens?: number;
};

export type TextProvider = {
  id: TextProviderId;
  model: string;
  /** `true` quando o fornecedor aceita imagens no pedido. */
  supportsImages: boolean;
  /** Devolve o texto cru da resposta, que deve ser JSON. */
  generateJson(args: TextRequest): Promise<string>;
};

/**
 * Conteúdo da mensagem do utilizador no formato multimodal da OpenAI, que o
 * OpenRouter também aceita. Sem imagens devolvemos uma string simples: há
 * modelos que rejeitam um array de partes quando só há texto.
 */
function userContent(user: string, images: string[] | undefined) {
  if (!images || images.length === 0) return user;
  return [
    { type: 'text' as const, text: user },
    ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
  ];
}

export class TextProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TextProviderError';
  }
}

const TIMEOUT_MS = 45_000;

function withTimeout(
  signal?: AbortSignal,
  timeoutMs: number = TIMEOUT_MS,
): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

// --- OpenRouter (fornecedor principal) --------------------------------------

function openrouterProvider(overrideModel?: string): TextProvider | null {
  const key = openrouterKey();
  if (!key) return null;
  const model =
    overrideModel || process.env.OPENROUTER_TEXT_MODEL?.trim() || OPENROUTER_DEFAULTS.text;

  return {
    id: 'openrouter',
    model,
    supportsImages: true,
    async generateJson({ system, user, images, temperature, signal, timeoutMs, maxTokens }) {
      const { signal: timed, done } = withTimeout(signal, timeoutMs);
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: openrouterHeaders(key),
          body: JSON.stringify({
            model,
            temperature: temperature ?? 0.6,
            max_tokens: maxTokens ?? 16_000,
            // Nem todos os modelos do catálogo honram isto. Quando é
            // ignorado, o `extractJsonObject` apanha o JSON entre cercas e,
            // se ainda assim falhar, a rota cai no planeador determinístico.
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userContent(user, images) },
            ],
          }),
          signal: timed,
        });

        if (!response.ok) {
          throw new TextProviderError(
            await describeOpenRouterError(response, 'texto'),
            response.status,
          );
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message?: string };
        };
        // O OpenRouter pode devolver 200 com um erro no corpo.
        if (data.error?.message) {
          throw new TextProviderError(`O modelo de texto falhou: ${data.error.message}`);
        }
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new TextProviderError('O modelo de texto devolveu uma resposta vazia.');
        return content;
      } finally {
        done();
      }
    },
  };
}

// --- OpenAI (e endpoints compatíveis) ---------------------------------------

function openaiProvider(): TextProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';

  return {
    id: 'openai',
    model,
    supportsImages: true,
    async generateJson({ system, user, images, signal, timeoutMs }) {
      const { signal: timed, done } = withTimeout(signal, timeoutMs);
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.6,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userContent(user, images) },
            ],
          }),
          signal: timed,
        });
        if (!response.ok) {
          throw new TextProviderError(
            `O fornecedor de texto respondeu ${response.status}.`,
            response.status,
          );
        }
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new TextProviderError('Resposta vazia do fornecedor de texto.');
        return content;
      } finally {
        done();
      }
    },
  };
}

// --- Anthropic --------------------------------------------------------------

function anthropicProvider(): TextProvider | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_TEXT_MODEL || 'claude-3-5-haiku-latest';

  return {
    id: 'anthropic',
    model,
    // O formato de imagem da Anthropic é diferente (`source.base64`). Não
    // está implementado: declaramos `false` em vez de falhar no pedido.
    supportsImages: false,
    async generateJson({ system, user, signal }) {
      const { signal: timed, done } = withTimeout(signal);
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1400,
            temperature: 0.6,
            system,
            messages: [
              { role: 'user', content: user },
              // Pré-preenchemos a resposta para forçar JSON desde o primeiro token.
              { role: 'assistant', content: '{' },
            ],
          }),
          signal: timed,
        });
        if (!response.ok) {
          throw new TextProviderError(
            `O fornecedor de texto respondeu ${response.status}.`,
            response.status,
          );
        }
        const data = (await response.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text = data.content?.find((part) => part.type === 'text')?.text;
        if (!text) throw new TextProviderError('Resposta vazia do fornecedor de texto.');
        return `{${text}`;
      } finally {
        done();
      }
    },
  };
}

// --- Google (Gemini) --------------------------------------------------------

function googleProvider(): TextProvider | null {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;
  const model = process.env.GOOGLE_TEXT_MODEL || 'gemini-2.0-flash';

  return {
    id: 'google',
    model,
    // O formato de imagem do Gemini é `inlineData`. Não está implementado.
    supportsImages: false,
    async generateJson({ system, user, signal }) {
      const { signal: timed, done } = withTimeout(signal);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: user }] }],
              generationConfig: { temperature: 0.6, responseMimeType: 'application/json' },
            }),
            signal: timed,
          },
        );
        if (!response.ok) {
          throw new TextProviderError(
            `O fornecedor de texto respondeu ${response.status}.`,
            response.status,
          );
        }
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
        if (!text) throw new TextProviderError('Resposta vazia do fornecedor de texto.');
        return text;
      } finally {
        done();
      }
    },
  };
}

const BUILDERS: Record<TextProviderId, () => TextProvider | null> = {
  openrouter: openrouterProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
};

/** Ordem de preferência quando `KRIAR_TEXT_PROVIDER` não está definido. */
const ORDER: TextProviderId[] = ['openrouter', 'openai', 'anthropic', 'google'];

/**
 * Fornecedor configurado, ou `null`.
 *
 * `KRIAR_TEXT_PROVIDER` escolhe explicitamente. Sem essa variável, usamos o
 * primeiro que tenha chave, começando pelo OpenRouter.
 */
export function resolveTextProvider(): TextProvider | null {
  const preferred = process.env.KRIAR_TEXT_PROVIDER?.trim().toLowerCase();
  if (preferred && preferred in BUILDERS) {
    return BUILDERS[preferred as TextProviderId]();
  }
  for (const id of ORDER) {
    const provider = BUILDERS[id]();
    if (provider) return provider;
  }
  return null;
}

/**
 * Fornecedor para a ANÁLISE DE IDENTIDADE.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Tarefa diferente, exigência diferente.
 *
 * O planeamento de uma publicação pede cinco campos de texto curto: um
 * modelo pequeno e barato resolve, e corre a cada "Actualizar proposta".
 * A identidade pede um sistema visual inteiro — paleta com funções, escala
 * tipográfica, regras de aplicação e quatro briefings de fotografia — a
 * partir de uma imagem. Com o `gpt-4o-mini`, `typeScale` e `logoRules`
 * vinham inválidos e a proposta caía sempre nas regras locais.
 *
 * Corre uma ou duas vezes por conta, em toda a vida da conta. É o sítio
 * certo para gastar num modelo melhor.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function resolveIdentityProvider(): TextProvider | null {
  const key = openrouterKey();
  if (key) {
    const model =
      process.env.OPENROUTER_IDENTITY_MODEL?.trim() || OPENROUTER_DEFAULTS.identity;
    return openrouterProvider(model);
  }
  // Sem OpenRouter, usamos o que estiver configurado. Se não aguentar o
  // esquema, a rota cai na proposta determinística e di-lo.
  return resolveTextProvider();
}

/**
 * Fornecedor da DIRECÇÃO CRIATIVA de cada publicação.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Era o modelo barato, pelo argumento de que "o planeamento pede cinco
 * campos de texto curto". O argumento estava errado: o planeamento decide a
 * IDEIA da arte, e o gerador faz exactamente o que a ideia diz. Com o
 * `gpt-4o-mini`, um pedido de pagamentos da Netflix em Angola saiu como
 * "fundo azul escuro com texto em amarelo muito claro" — e a arte foi um
 * cartaz de texto sobre fundo liso.
 *
 * Usa o modelo da identidade, que também vê as imagens que o cliente
 * anexou. Custa cêntimos por proposta; uma arte gerada a partir de uma
 * ideia fraca custa uma geração inteira e a confiança do cliente.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function resolveCreativeProvider(): TextProvider | null {
  const key = openrouterKey();
  if (key) {
    const model =
      process.env.OPENROUTER_CREATIVE_MODEL?.trim() ||
      process.env.OPENROUTER_IDENTITY_MODEL?.trim() ||
      OPENROUTER_DEFAULTS.identity;
    return openrouterProvider(model);
  }
  return resolveTextProvider();
}

/** Extrai o primeiro objecto JSON de uma resposta, tolerando ```json. */
export function extractJsonObject(raw: string): unknown {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new TextProviderError('A resposta do fornecedor de texto não é JSON válido.');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

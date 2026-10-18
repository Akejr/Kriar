/**
 * Configuração central do produto.
 *
 * O nome, o domínio e os ficheiros do logótipo vivem só aqui. Mudar `name`
 * muda a navegação, os títulos de página, os metadados, os nomes dos
 * ficheiros exportados e os textos do onboarding.
 *
 * Atenção ao `slug`: dá nome à base de dados local (IndexedDB) e à chave da
 * sessão no browser. Alterá-lo deixa os dados anteriores inacessíveis, o que
 * numa demonstração significa criar a conta de novo.
 */
export const APP = {
  name: 'Kriar',
  /** Domínio público. Usado em metadados e na atribuição ao OpenRouter. */
  domain: 'kriar.ai',
  /** Usado no <title> e em metadados. */
  description:
    'Cria publicações profissionais para redes sociais com a identidade da tua empresa preservada.',
  /** Prefixo de ficheiros exportados e de chaves de armazenamento local. */
  slug: 'kriar',
  /**
   * Ficheiros do logótipo, servidos a partir de `public/`.
   * `mark` é só o "K", para espaços estreitos; `wordmark` é a assinatura.
   */
  logo: {
    mark: '/kriar-mark.png',
    wordmark: '/kriar-wordmark.png',
    /** Proporção da assinatura, para reservar espaço sem salto de layout. */
    wordmarkRatio: 1300 / 473,
  },
  /** Moeda apresentada nas artes e na interface. */
  currency: {
    code: 'AOA',
    symbol: 'Kz',
    locale: 'pt-AO',
  },
  /** Limites de upload aplicados no cliente e revalidados no servidor. */
  uploads: {
    maxImageBytes: 8 * 1024 * 1024,
    maxDocumentBytes: 12 * 1024 * 1024,
    maxImagesPerProject: 6,
    acceptedImageMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const,
    acceptedLogoMimes: ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'] as const,
    acceptedDocumentMimes: ['application/pdf'] as const,
  },
  /** Atraso da gravação automática, em milissegundos. */
  autosaveDelayMs: 900,
  /**
   * Quantos produtos uma publicação pode mostrar.
   *
   * Um limite de LEGIBILIDADE: acima de seis nenhuma arte de 1080 px mostra
   * nomes que se leiam. Era a contagem de peças do tabuleiro do modelo antigo
   * (cinco) no armazém e seis na revisão — o botão "Acrescentar opção" ficava
   * à vista e o clique não acrescentava nada. Um número, num sítio só.
   */
  itemCapacity: 6,
} as const;

export type AppConfig = typeof APP;

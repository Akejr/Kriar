import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Raiz do rastreio de ficheiros.
   *
   * Sem isto, o Next sobe na árvore de pastas à procura de um ficheiro de
   * bloqueio e pode escolher uma raiz errada — por exemplo a pasta pessoal do
   * utilizador, se existir lá um `package-lock.json`. O resultado seria um
   * rastreio de dependências errado no `next build`.
   */
  outputFileTracingRoot: path.resolve(process.cwd()),

  /**
   * Ficheiros de referência lidos em runtime pelo servidor.
   *
   * Os dos modelos vivem em `src/modelos/`; os da biblioteca de referências
   * visuais, em `src/referencias/`. Como nenhum módulo os importa, o
   * rastreio automático não os vê e ficariam de fora do pacote. Não podem ir
   * para `public/`: contêm identidade de demonstração e marcas de terceiros,
   * e não podem ser servidos ao browser.
   */
  outputFileTracingIncludes: {
    // O padrão pede só os `.webp`, que são os ficheiros que o servidor lê.
    // O rastreio do Next acaba por arrastar também os originais da pasta;
    // são alguns MB no pacote e não vale a pena contrariá-lo.
    // `scripts/converter-modelos.mjs` regenera os derivados a partir deles.
    '/api/ai/background': ['./src/modelos/*.webp'],
    // Só a versão reduzida viaja como exemplo de acabamento
    // (`src/lib/server/referenceFiles.ts`). Os derivados são gerados por
    // `scripts/converter-referencias.mjs`.
    '/api/ai/artwork': ['./src/referencias/*.ref.webp'],
  },

  // O lint não bloqueia o build: o `next build` continua a validar os tipos
  // (que é a verificação que interessa). Corre `npm run lint` à parte.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;

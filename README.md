# Kriar

Plataforma para empresas angolanas criarem publicações profissionais para redes
sociais, com apoio de IA e com a identidade da marca preservada.

O nome é provisório e está centralizado em `src/config/app.ts`. Muda `APP.name`
nesse ficheiro e muda em toda a aplicação: navegação, títulos, metadados, nomes
dos ficheiros exportados e textos do onboarding.

```
Cadastro → Perfil da marca → Criar publicação → Aprovar composição → Gerar arte → Exportar
```

---

## 1. Stack

| Camada | Escolha | Versão |
|---|---|---|
| Framework | Next.js, App Router | `^15.5` |
| UI | React + TypeScript | `^19.1` / `^5.6` |
| Estilo | Tailwind CSS (configuração em CSS) | `^4.1` |
| Estado do editor | Zustand | `^5.0` |
| Validação | Zod | `^3.23` |
| Ícones | lucide-react | `0.460.0` (fixo) |
| Persistência | Supabase (auth + base de dados + armazenamento) | `^2.45` |
| IA | OpenRouter (texto e imagem, APIs separadas) | — |
| Motor gráfico | próprio, sem dependências | — |

Não há Konva nem html2canvas. O porquê está em [`DECISOES.md`](./DECISOES.md).

Duas escolhas de versão que merecem explicação:

- **Next.js na linha 15.5, não na 16.** A 15.5 é a linha de manutenção de longo
  prazo e tem a superfície de API que este código usa. Subir para a 16 é
  possível, mas é uma migração a fazer com o build a correr.
- **`lucide-react` fixo em `0.460.0`.** A biblioteca já vai na versão 1.x, que
  renomeou e removeu aliases de ícones. Os nomes usados neste projecto
  (`HelpCircle`, `Image`, `Replace`, `AlertTriangle`...) correspondem à
  superfície da `0.460.0`, e a versão está fixa de propósito para a instalação
  ser determinística. Subir para a 1.x exige auditar os nomes dos ícones um a
  um, com o build a correr para confirmar.

---

## 2. Instalação

Requisitos: **Node 20.9 ou superior**.

```bash
npm install
cp .env.example .env.local
```

Depois preenche o `.env.local` conforme as duas secções seguintes e arranca:

```bash
npm run dev          # http://localhost:3000
```

Outros comandos:

```bash
npm run build        # compila e valida os tipos
npm run typecheck    # só os tipos, mais rápido
npm run lint
npm start            # serve o build de produção
```

> A aplicação arranca sem nenhuma variável de ambiente, em **modo de
> demonstração**. Serve para percorrer o fluxo completo de imediato, mas os
> dados ficam só no browser. Ver a secção 5.

---

## 3. Supabase

### 3.1 Criar o projecto

1. Cria um projecto em [supabase.com](https://supabase.com).
2. Vai a **Project Settings → Data API** e copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - chave `anon` / `public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Estas duas variáveis são públicas por design. O isolamento entre contas não
depende delas: é garantido por políticas RLS que correm no servidor do
Supabase.

### 3.2 Aplicar as migrações

Com a CLI:

```bash
supabase link --project-ref <ref-do-projecto>
supabase db push
```

Ou cola no editor SQL do painel, **nesta ordem**:

1. `supabase/migrations/0001_init.sql` — tabelas `brands`, `assets`,
   `projects`, gatilhos de `updated_at` e todas as políticas RLS.
2. `supabase/migrations/0002_storage.sql` — bucket privado `brand-assets`,
   limite de 12 MB, tipos de ficheiro aceites e políticas por pasta.
3. `supabase/migrations/0003_empresas.sql` — várias empresas por conta:
   retira o índice único de `brands.owner_id`, passa `brands.id` a texto (a
   aplicação gera `brd_…`) e apaga os projectos com a empresa.

### 3.3 Autenticação

Em **Authentication → Providers → Email**, a opção *Confirm email* funciona de
qualquer das formas:

- **Activa** (recomendado em produção): depois do registo a aplicação mostra
  "Confirma o e-mail" e o utilizador entra após clicar no link. Acrescenta a
  origem da aplicação em **Authentication → URL Configuration → Redirect URLs**
  (`http://localhost:3000/` em desenvolvimento).
- **Desactivada**: o registo entra directamente. Mais prático para demonstrar.

### 3.4 Como o isolamento funciona

- Cada linha tem `owner_id` ligado a `auth.users`, e as políticas só permitem
  `auth.uid() = owner_id`.
- Os caminhos no armazenamento são `<uuid-do-utilizador>/<tipo>/<id>.<ext>`, e
  as políticas do bucket comparam o primeiro segmento com `auth.uid()`.
- A política de inserção em `assets` exige que o caminho comece pela pasta da
  própria conta, o que impede registar metadados a apontar para ficheiros de
  outra conta.
- Os ficheiros são servidos por URL assinado válido por 1 hora.
- Uploads são validados duas vezes: no cliente (`src/lib/utils/files.ts`) e no
  servidor por assinatura de bytes (`src/lib/server/validateUpload.ts`), porque
  o tipo declarado pelo browser é apenas uma sugestão.

---

## 4. OpenRouter

Uma única chave serve os dois papéis, mas por **duas APIs diferentes**:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_TEXT_MODEL=openai/gpt-4o-mini
OPENROUTER_IMAGE_MODEL=google/gemini-3.1-flash-image
OPENROUTER_IMAGE_RESOLUTION=2K
```

Cria a chave em [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).

### 4.1 Escolher os modelos

Os identificadores de modelo mudam ao longo do tempo. **Confirma um
identificador actual** antes de arrancar:

- texto: [openrouter.ai/models](https://openrouter.ai/models) — prefere um
  modelo que suporte `response_format: json_object`
- imagem: [catálogo de modelos de imagem](https://openrouter.ai/collections/image-models)

Se o identificador estiver errado, a aplicação não falha em silêncio: a rota
devolve "Modelo de texto desconhecido. Escolhe um identificador actual em
openrouter.ai/models" e cai no planeador determinístico, mantendo o teu
trabalho.

### 4.2 Atribuição (opcional)

```bash
OPENROUTER_SITE_URL=https://a-tua-app.ao
OPENROUTER_APP_NAME=Kriar
```

Vão nos cabeçalhos `HTTP-Referer` e `X-Title` e servem para identificar a
aplicação no painel de consumo do OpenRouter.

### 4.3 Segurança

A chave do OpenRouter **nunca** chega ao browser. Todas as chamadas passam por
rotas de API no servidor:

| Rota | Papel |
|---|---|
| `POST /api/ai/plan` | Plano da publicação: textos, modelo, distribuição das imagens |
| `POST /api/ai/background` | Apenas o fundo. Nunca a publicação inteira |
| `POST /api/brand/import` | Análise do manual de marca em PDF (sem IA) |
| `GET /api/status` | Que integrações estão configuradas |
| `GET /api/assets/proxy` | Serve imagens do armazenamento no nosso domínio |

Se preferires outro fornecedor, `KRIAR_TEXT_PROVIDER` e `KRIAR_IMAGE_PROVIDER`
aceitam `openai`, `anthropic`, `google` e `stability`. Os adaptadores estão
implementados em `src/lib/ai/providers/`.

---

## 5. O que está integrado e o que funciona em demonstração

Tabela honesta, por configuração.

| Capacidade | Com Supabase + OpenRouter | Sem credenciais |
|---|---|---|
| Autenticação | Supabase Auth, verificação no servidor | Conta local no browser, palavra-passe derivada com PBKDF2 **no cliente**. Separa contas numa demonstração; não é segurança real |
| Dados e ficheiros | Base de dados e armazenamento privado, isolados por RLS | IndexedDB. Não sincroniza entre dispositivos |
| Planeamento de texto | Modelo via OpenRouter, resposta validada por esquema + guardrails | Planeador determinístico: reorganiza o teu pedido, nunca inventa |
| Fundo da arte | Gerado pelo modelo de imagem, só fundo | Fundo procedimental desenhado em canvas a partir das cores |
| Leitura de manual de marca em PDF | Inspecção directa do ficheiro, sem IA | Igual — não depende de credenciais |
| Cores a partir de imagens | Análise de píxeis no browser | Igual |
| Composição, edição directa, exportação PNG | Igual nos dois casos | Igual nos dois casos |

Pontos em que a interface é explícita sobre o modo:

- Etiqueta "Demonstração" na barra de navegação, com o que está em falta.
- Etiqueta no editor: "plano por IA" ou "plano por regras locais".
- Etiqueta na nota de direcção visual: "fundo gerado por IA" ou "fundo local,
  sem IA".
- Página **Definições → Integrações** mostra o fornecedor e o modelo em uso.

### Verificado e não verificado

**Verificado contra serviços reais:**

- `npm install`, `npx tsc --noEmit` e `npm run build` correm sem erros.
- **Supabase**: migrações aplicadas; as tabelas `brands`, `assets` e
  `projects` respondem com RLS activo; o bucket `brand-assets` é privado.
- **OpenRouter, texto** (`openai/gpt-4o-mini`): `/api/ai/plan` devolve
  `source: ia` com plano válido, incluindo as opções e a opção em destaque
  escolhidas a partir do pedido.
- **OpenRouter, imagem** (`google/gemini-3.1-flash-image`):
  `/api/ai/background` devolve uma imagem real, sem texto nem logótipos.
- **Guardrails**: uma opção inventada pela IA ("Massagem tailandesa" num
  pedido que listava corte, barba e coloração) foi removida e comunicada.
- **Motor de composição**: peças distribuídas sem duplicar conteúdo para
  encher espaços; a opção em destaque cai no compartimento principal; o modo
  `final` não emite marcadores de rascunho; as variações reposicionam as
  caixas.
- **Leitura de referências**: confinada a `src/modelos`; uma tentativa de fuga
  de caminho (`../../.env.local`) é recusada.

**Não verificado:**

- Comportamento em produção sob carga, e custo real por arte ao longo do
  tempo.
- Rendição em dispositivos e browsers concretos além do ambiente de
  desenvolvimento.
- A autenticação do modo local **não é autenticação** (ver secção das decisões):
  serve para separar contas numa demonstração.

---

## 6. Estrutura

```
src/
  app/
    page.tsx                  encaminhamento: entrar / onboarding / painel
    entrar/  criar-conta/     autenticação
    onboarding/               3 passos: empresa → identidade → resumo
    (painel)/
      inicio/                 painel interno: criar publicação + recentes
      projectos/              lista com miniaturas, estado e acções
      editor/[projectId]/     área principal de trabalho
      marca/                  dados e identidade visual
      definicoes/             conta, integrações, dados de exemplo
    api/                      rotas de servidor (ver 4.3)

  lib/
    composition/
      palette.ts              paleta das ARTES, isolada dos tokens da interface
      textLayout.ts           medição, quebra de linhas e ajuste de tipografia
      resolve.ts              modelo + composição → camadas absolutas
      renderCanvas.ts         as mesmas camadas desenhadas em canvas
      export.ts               PNG nas dimensões exactas do formato
      backgrounds.ts          fundos procedimentais locais
    templates/                biblioteca interna: referência + regras
    server/templateReference.ts  lê as referências de `src/modelos`
    ai/
      schema.ts               esquema Zod do plano
      guardrails.ts           remove o que não podemos afirmar
      deterministicPlanner.ts planeamento sem IA
      prompt.ts               instruções para texto e para imagem
      providers/              openrouter, openai, anthropic, google, stability
    data/
      backend.ts              contrato de persistência
      supabaseBackend.ts      implementação real
      localBackend.ts         implementação de demonstração
      seed.ts                 dados de exemplo fictícios
    server/
      pdfHints.ts             leitura de fontes e cores em PDF, sem dependências
      validateUpload.ts       validação por assinatura de bytes

  components/
    editor/Stage.tsx          prévia interactiva em DOM
    editor/LeftPanel.tsx      pedido, imagens, cores, formato, estilo
    editor/RightPanel.tsx     composição, acções, avisos
    brand/                    formulários da marca e importação
    ui/                       primitivas acessíveis
```

---

## 7. Como o motor de composição funciona

O ponto central do projecto: **a prévia e o ficheiro exportado são a mesma
coisa**.

1. `resolve.ts` recebe o modelo, a composição e os recursos, e produz uma lista
   plana de camadas com coordenadas absolutas em píxeis do formato escolhido.
2. As quebras de linha e o tamanho final da tipografia são decididos **uma vez**
   em `textLayout.ts`, medindo com o mesmo motor de tipografia do browser.
3. `Stage.tsx` desenha essa lista em DOM, com `white-space: pre` em cada linha —
   o browser não pode voltar a decidir onde quebra.
4. `renderCanvas.ts` desenha **a mesma lista** em canvas, replicando o
   `half-leading` do CSS para a linha de base cair no mesmo píxel.

Consequências práticas:

- Os modelos são dados estruturados em coordenadas normalizadas, não imagens.
  O mesmo modelo serve 1080×1350, 1080×1080 e 1080×1920.
- Texto longo nunca se sobrepõe: os elementos vivem em grupos de fluxo
  vertical que calculam a altura real, reduzem a tipografia até ao mínimo
  legível e só depois avisam.
- A exportação é resolvida de novo em modo `final`: marcadores de rascunho,
  selecções e a nota de direcção visual nunca entram no PNG.
- O fundo gerado é uma camada separada. Corrigir o preço depois de gerar
  redesenha só as camadas de texto.

### Biblioteca de modelos

Um modelo é **uma arte profissional de referência mais as regras que a
descrevem**: o conceito, os objectivos que serve, quando não deve ser
escolhido, o que a aplicação monta, o que é gerado e **o que ainda não sabe
fazer**.

A biblioteca é interna. Não há galeria nem entrada na navegação: o cliente
descreve o que quer e o sistema escolhe. As referências vivem em
`src/modelos/` e nunca em `public/` — são artes de demonstração com a
identidade Kriar aplicada, e não podem ser servidas ao browser nem chegar às
artes dos clientes.

As **peças** de um modelo (as opções apresentadas) são desenhadas pela
aplicação: forma, cor, imagem e nome. Ao gerador pedimos apenas o ambiente.
Assim os nomes saem com a ortografia do cliente e continuam editáveis depois
de a arte final existir.

Cada modelo declara as capacidades que lhe faltam em `assembly.missing`, com
uma explicação em `assembly.limitations`. O editor mostra-as antes de gerar,
no painel que abre a partir de "Composição editável". Nunca é apresentado como
editável um texto que esteja embutido numa imagem achatada.

### Cores da interface e cores das artes

São dois sistemas que não se tocam:

- A interface usa os tokens de `src/app/globals.css` (preto, verde neon).
- As artes usam `src/lib/composition/palette.ts`, que deriva tudo das cores da
  empresa e garante contraste mínimo. Esse ficheiro não importa nada da
  interface.

Alterar cores no editor afecta **apenas a publicação em curso**. O botão
"Repor cores da marca" volta atrás, e o perfil da empresa nunca é alterado em
silêncio.

---

## 8. Verificação dos fluxos críticos

Sequência a correr depois do `npm install`. Corresponde aos critérios de
aceitação do produto.

```bash
npm run typecheck    # tem de passar sem erros
npm run build        # tem de concluir
npm run dev
```

Depois, no browser:

| # | Passo | O que confirmar |
|---|---|---|
| 1 | Criar conta e preencher a empresa | O nome é obrigatório; os contactos não ficam todos activos por omissão |
| 2 | Carregar o logótipo e escolher cores | O logótipo aparece no resumo sem esticar; o exemplo usa as tuas cores |
| 3 | Criar publicação com uma fotografia e um preço no pedido | O preço é detectado a partir do texto que escreveste |
| 4 | "Preparar composição" | Aparece a estrutura real da publicação, não uma animação |
| 5 | Duplo clique no título e editar | O texto fica marcado como "protegido" |
| 6 | "Actualizar proposta" | O título editado **não** muda |
| 7 | "Gerar arte final" | Com OpenRouter: fundo gerado. Sem credenciais: fundo local, identificado como tal |
| 8 | Corrigir o preço | O fundo mantém-se; só o texto é redesenhado |
| 9 | "Descarregar PNG" | Ficheiro com exactamente 1080 × 1350 e igual à prévia |
| 10 | Fechar e reabrir o projecto | Textos, posições, cores e fundo preservados |

Verificações adicionais que o produto exige:

- **Logótipo preservado**: desenhado sempre com `contain`, sem esticar, cortar
  ou recolorir. Com versões para fundo claro e escuro, a escolha é automática
  pela luminosidade do fundo.
- **Cores do editor não contaminam a arte**: muda a cor da publicação e confirma
  que a área Marca continua intacta.
- **Conteúdo longo não se sobrepõe**: cola um título de 200 caracteres. A
  tipografia reduz-se e aparece um aviso em vez de sobreposição.
- **Exportação não bloqueada**: com Supabase, as imagens vêm por URL assinado.
  Se os cabeçalhos CORS falharem, `renderCanvas.ts` repete por
  `/api/assets/proxy`, que as serve do nosso domínio.

Caminho rápido para demonstrar: no ecrã de entrada em modo de demonstração há
**"Entrar com dados de exemplo"**. Com Supabase configurado, usa
**Definições → Dados de exemplo**. Em ambos os casos o logótipo e as
fotografias são desenhados pela aplicação — não há imagens nem marcas de
terceiros.

---

## 9. Limites desta versão

Fora de âmbito, por decisão: pagamentos e subscrições, publicação automática
nas redes sociais, agendamento, vídeo, colaboração em equipa, marketplace e
editor vectorial avançado.

Também não existe página institucional, landing page nem secções comerciais. A
rota `/` encaminha e nada mais.

Limites conhecidos da implementação:

- Várias empresas por conta, cada uma com a sua marca, projectos, biblioteca e
  memória. A empresa activa fica guardada por browser (`localStorage`), não na
  conta: noutro computador abre a mais recente.
- O encaminhamento por estado de sessão é feito no cliente, para haver um único
  caminho de decisão nos dois modos de persistência. Há um instante de
  carregamento antes do redireccionamento.
- A leitura de PDF encontra tipografias embebidas e códigos de cor escritos no
  documento. Não faz reconhecimento visual de design, e diz isso ao utilizador.
- O ajuste de tamanho de um elemento é por botões, não por alças de
  redimensionamento. Suficiente para ajustar uma composição; não é um editor
  vectorial.

---

## 10. Recursos e direitos

Modelos, formas, fundos procedimentais e imagens de exemplo são originais,
gerados por código neste repositório. Não há imagens, tipografias
proprietárias ou materiais de terceiros incluídos. As tipografias vêm do Google
Fonts, auto-alojadas pelo `next/font`, o que também evita problemas de origem
na exportação em canvas.

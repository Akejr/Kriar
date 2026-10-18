# Decisões técnicas

Registo das escolhas que moldaram o projecto, com o problema que cada uma
resolve e o que se perdeu em troca.

---

## 1. Motor gráfico próprio, em vez de Konva

**Problema.** O requisito é que o PNG exportado corresponda à composição
apresentada. Com uma biblioteca de canvas como o Konva, a prévia é canvas e a
exportação é canvas — parece resolver. Mas o ajuste automático de tipografia
(reduzir o tamanho e decidir quebras de linha para o texto caber) teria de ser
implementado de qualquer maneira, e seria depois replicado de forma
aproximada se alguma vez precisássemos de DOM para a edição em linha.

**Decisão.** Motor próprio com um único passo de resolução:

```
modelo + composição + recursos
        ↓  resolve.ts
   ResolvedLayer[]  (píxeis absolutos, linhas já quebradas)
        ↓                        ↓
   Stage.tsx (DOM)        renderCanvas.ts (canvas)
    prévia interactiva       PNG exportado
```

As quebras de linha e o tamanho final são decididos **uma vez**, em
`textLayout.ts`, medindo com o motor de tipografia do browser através de um
contexto 2D fora do ecrã. Os dois renderizadores recebem o mesmo resultado e
não tomam nenhuma decisão de layout.

**O que ganhámos.** Fidelidade por construção, interacção com DOM (selecção,
arrastar, edição em linha com um `textarea` real, acessibilidade por teclado),
zero dependências gráficas.

**O que custou.** Tivemos de replicar manualmente dois comportamentos do CSS
no canvas:

- *half-leading*: o CSS centra a caixa de texto dentro da caixa de linha usando
  as métricas de ascendente e descendente da fonte. O canvas é replicado com
  `fontBoundingBoxAscent`/`Descent` e `textBaseline = 'alphabetic'`.
- *letter-spacing*: o CSS acrescenta espaço depois de cada carácter, incluindo
  o último. Usamos `ctx.letterSpacing` quando existe, e desenho carácter a
  carácter como alternativa.

**Detalhe que custou tempo.** O recorte do canvas apagava a sombra das
imagens, porque `clip()` corta a sombra junto com o desenho. A camada resolvida
passou a ter um sinalizador `clip` explícito: em `contain` sem cantos
arredondados não há recorte, e a sombra segue o contorno com alfa da
fotografia — igual ao `drop-shadow` do CSS na prévia.

---

## 2. Grupos de fluxo vertical, em vez de caixas fixas para texto

**Problema.** A primeira versão dos modelos dava a cada bloco de texto uma
caixa fixa em coordenadas normalizadas. Funcionava com conteúdo curto no
formato vertical. Com um título de três linhas, ou ao passar para 1080×1080, o
bloco transbordava para cima do seguinte — exactamente o que o produto exige
que não aconteça.

A causa é simples: a altura real de um bloco de texto só é conhecida depois de
medir a fonte e decidir as quebras.

**Decisão.** Os modelos declaram grupos (`stacks`): uma coluna, uma âncora
vertical, um espaçamento e uma lista ordenada de itens. O motor mede, soma e
posiciona a partir da âncora.

Quando o grupo não cabe no espaço disponível, a altura é repartida entre os
blocos na proporção do que cada um pediria, e cada bloco é reajustado com esse
limite. É monótono: nunca provoca sobreposição. Se nem no tamanho mínimo
legível couber, o texto é cortado com reticências e aparece um aviso — em vez
de uma arte ilegível.

**Consequência.** Tipografia medida em fracções da **largura** (todos os
formatos têm 1080 px), caixas de imagem em fracções da largura e da altura. O
mesmo modelo dá tipografia do mesmo tamanho absoluto nos três formatos.

---

## 3. Duas paletas que não se tocam

**Problema.** O risco óbvio de uma interface preta com verde neon é esse preto
e esse verde aparecerem nas artes dos clientes.

**Decisão.** Dois sistemas separados por construção:

- interface: tokens em `src/app/globals.css`
- artes: `src/lib/composition/palette.ts`, que **não importa nada** da
  interface

A paleta das artes deriva tudo das cores da empresa e devolve pares
texto/fundo com contraste mínimo garantido (`ensureContrast`). Os modelos
referem papéis (`bg`, `onBg`, `highlight`, `onHighlight`, `panel`...), nunca
cores literais. Assim um modelo funciona com qualquer paleta de marca sem
produzir texto ilegível.

As únicas cores fixas na paleta das artes são branco, preto e véus
semi-transparentes, e mesmo os neutros são misturados com a cor da marca.

---

## 4. Planeamento separado do acabamento visual

**Problema.** Pedir a um gerador de imagens a publicação inteira, com textos e
logótipo embutidos, produz logótipos deformados, texto com erros e obriga a
refazer tudo para corrigir um preço.

**Decisão.** Duas responsabilidades, duas interfaces, dois modelos:

| | Planeamento | Acabamento |
|---|---|---|
| Papel | textos, modelo, distribuição das imagens | apenas o fundo |
| Interface | `TextProvider` | `ImageProvider` |
| Rota | `POST /api/ai/plan` | `POST /api/ai/background` |
| Sem credenciais | planeador determinístico | fundo procedimental |

O prompt de imagem é construído com instruções explícitas contra texto,
letras, números, logótipos e marcas de água, e `stripForbiddenBackgroundTerms`
remove essas instruções caso venham do modelo de texto.

**Consequência directa:** o fundo é uma camada de recurso independente.
Corrigir o preço depois de gerar redesenha só as camadas de texto — o recurso
de fundo mantém-se. É por isso que as duas vistas ("Rascunho" e "Arte final")
são ambas editáveis: a diferença entre elas é o fundo, não a interactividade.

---

## 5. OpenRouter para os dois papéis

**Alternativa considerada.** Replicate para imagem, por ter o melhor catálogo
de modelos de pesos abertos e preço por segundo.

**Decisão.** OpenRouter nos dois papéis, por três razões:

1. O texto funciona com uma API compatível com OpenAI, e a API de imagem é um
   único POST com `aspect_ratio` normalizado — encaixa quase 1:1 nas
   interfaces que já existiam.
2. Uma conta, uma chave, uma facturação. Para uma empresa em Angola, cada
   fricção de pagamento internacional conta.
3. Trocar de modelo é mudar uma variável de ambiente, sem redeploy. Vamos
   precisar de experimentar para encontrar um modelo que produza fundos
   limpos, sem texto parasita.

O Replicate continua a fazer sentido mais tarde para um modelo específico com
LoRA treinado num estilo de fundo da marca, ou para controlo fino de
`steps`/`guidance`. `resolveImageProvider()` é um registo: acrescentar um
fornecedor é aditivo e não toca no lado do texto.

**Ressalva assumida.** Os identificadores de modelo no OpenRouter mudam. Em vez
de fingir estabilidade, a aplicação distingue o erro 404 ("modelo
desconhecido") dos restantes e diz ao utilizador para escolher um
identificador actual, caindo no planeador determinístico para não perder
trabalho.

---

## 6. Guardrails no servidor, não no prompt

**Problema.** Instruir um modelo a não inventar preços reduz o problema; não o
elimina. E um preço inventado numa publicação comercial é um dano real para a
empresa.

**Decisão.** `src/lib/ai/guardrails.ts` corre sempre no servidor, depois da
validação de esquema e antes de a resposta sair da rota. Remove:

- preços que não apareçam no pedido do utilizador — o valor é extraído do
  texto original por `detectPrices` e, se divergir, substituído pelo do
  utilizador;
- percentagens e descontos não mencionados;
- números de telefone, endereços, perfis e sites que não estejam no perfil da
  empresa e escolhidos para aquela publicação;
- condições de venda ("válido até", "stock limitado", "entrega grátis").

Quando falta informação essencial, o plano devolve `missingFields` e a
interface mostra um campo a preencher em vez de um valor inventado. O que foi
removido é comunicado: "Removemos conteúdo que não podíamos confirmar: ...".

Os textos marcados como protegidos pelo utilizador são reimpostos no fim, pelo
servidor e pelo cliente. Duas barreiras para o mesmo requisito.

---

## 7. Planeador determinístico que não finge ser IA

**Problema.** "Modo de demonstração" costuma significar resultados simulados
apresentados como reais. O produto exige o contrário.

**Decisão.** `deterministicPlanner.ts` reorganiza o que o utilizador escreveu:

- separa frases de **conteúdo** ("estes perfumes") de frases de **instrução**
  ("usa um estilo elegante e destaca o WhatsApp") por análise do verbo inicial.
  Só as primeiras viram texto da arte;
- retira do título o fragmento do preço, que passa para o seu próprio bloco;
- constrói a chamada para acção a partir dos canais que a empresa tem
  realmente guardados — sem WhatsApp no perfil, não aparece "Encomenda pelo
  WhatsApp";
- escolhe o modelo por uma função estável do pedido, de modo que "Outra
  composição" percorra alternativas sem repetir.

A interface identifica sempre a origem: "plano por IA" ou "plano por regras
locais".

---

## 8. Adaptador de persistência com duas implementações

**Problema.** Sem credenciais de Supabase, nada funcionaria. Com um modo de
demonstração em memória, o fluxo "fechar e reabrir o projecto com as alterações
preservadas" não seria demonstrável.

**Decisão.** Um contrato (`DataBackend`) e duas implementações escolhidas por
variáveis de ambiente. Nenhum componente importa uma implementação
directamente.

- `supabaseBackend` — acesso directo do browser com a sessão do utilizador. Não
  há rota de API intermediária para dados porque as políticas RLS já fazem a
  verificação no servidor, e uma camada extra só acrescentaria latência e
  superfície de erro.
- `localBackend` — IndexedDB para dados e ficheiros, `localStorage` para a
  sessão.

**Assumido com clareza.** A palavra-passe no modo local é guardada como
derivação PBKDF2 com sal aleatório, mas a verificação é feita **no browser**.
Serve para separar contas numa demonstração e está rotulada como tal na
interface e neste documento. Não é autenticação.

---

## 9. Leitura de PDF sem dependências

**Problema.** "Importar identidade visual" costuma ser uma promessa vazia, ou
exige uma biblioteca grande de parsing de PDF.

**Decisão.** `src/lib/server/pdfHints.ts` usa apenas o `zlib` do Node:

- descomprime os fluxos `FlateDecode` e procura códigos hexadecimais
  **escritos** no documento — é assim que os manuais de marca listam cores;
- lê os nomes das tipografias **embebidas** (`/BaseFont`), removendo prefixos
  de subconjunto, e tenta casá-los com o catálogo suportado;
- conta as cores usadas nos operadores de pintura (`rg`, `k`) e descarta
  quase-brancos, quase-pretos e cinzas.

A distinção que o produto pede está no modelo de dados: `source: 'explicito'`
para o que está escrito no ficheiro, `'inferido'` para o que foi deduzido por
frequência ou análise de píxeis. Nunca é devolvido um nome de fonte que não
esteja no ficheiro, e a interface diz que não há reconhecimento visual de
design.

As cores de logótipos e imagens de referência são extraídas no browser por
análise de píxeis, com agrupamento por proximidade perceptual. Também marcadas
como inferidas.

---

## 10. Escolhas menores, registadas

- **Tailwind v4 com configuração em CSS.** Os tokens vivem num bloco `@theme`
  no `globals.css`, sem `tailwind.config.js`. Menos um ficheiro e menos uma
  fonte de verdade.
- **`next/font` com fontes auto-alojadas.** Além de evitar pedidos ao Google em
  runtime, dá ao canvas acesso directo às fontes sem problemas de origem na
  exportação. O nome real da família é lido em runtime da variável CSS, que é
  exactamente a string que o `ctx.font` precisa.
- **`ignoreDuringBuilds` no ESLint, tipos activos.** O `next build` continua a
  validar tipos, que é a verificação com valor. O lint corre à parte, para não
  transformar um aviso de estilo em build quebrado.
- **Histórico por instantâneos da composição.** Para um documento deste tamanho
  (um objecto JSON pequeno), guardar até 60 cópias é mais simples e mais
  robusto do que um sistema de comandos invertíveis.
- **Gravação automática com miniatura.** A cada 900 ms sem alterações, o
  projecto é gravado e a miniatura redesenhada a 320 px com o mesmo motor. A
  lista de projectos mostra o estado real, não um espaço vazio.
- **Posições manuais limpas ao trocar de modelo.** Um deslocamento manual é
  relativo ao modelo que o originou; mantê-lo noutro modelo produziria
  elementos fora do lugar. O utilizador é avisado.
- **Proxy de imagens restrito por lista de domínios.** `/api/assets/proxy` só
  aceita o domínio de armazenamento configurado. Sem isso seria um proxy
  aberto, com risco de SSRF.
- **Contactos sem activação automática.** Nenhum contacto entra nas artes por
  omissão até o utilizador o marcar, e no máximo três por publicação.

---

## 11. Modelos como referência profissional, não como geometria

**Problema.** A primeira biblioteca tinha dez modelos geométricos: blocos,
círculos e faixas colocados por coordenadas. Resolviam o problema técnico
(composições adaptáveis, texto que cabe) e falhavam o problema real — as artes
pareciam diagramas, não publicidade.

**Decisão.** Um modelo passou a ser **uma arte profissional de referência mais
as regras que a descrevem**. Duas metades, com propósitos distintos:

1. **Referência e regras** (`reference`, `concept`, `goals`, `avoidWhen`,
   `generation`, `assembly`) — orientam a escolha do modelo e a geração do
   ambiente.
2. **Esqueleto renderizável** (`stacks`, `itemSlots`, `imageSlots`, `logo`,
   `background`) — é o que o motor desenha na prévia editável, antes de
   existir qualquer imagem gerada.

A biblioteca é **interna**. Não há página "Modelos" nem entrada na navegação:
o cliente descreve o que quer e o sistema escolhe. Uma galeria obrigaria a
escolher por aparência um modelo cujas regras o cliente não conhece.

Os dez modelos geométricos foram removidos. A biblioteca ficou com um modelo
real em vez de dez aproximações.

---

## 12. Peças desenhadas pela aplicação, não pedidas ao gerador

O modelo 02 ("A próxima jogada") apresenta uma escolha: três a cinco opções
dispostas num suporte, uma delas em destaque.

**Alternativa considerada.** Pedir ao gerador de imagens a cena completa, com
os nomes dos produtos escritos nas peças.

**Rejeitada.** Produziria nomes com erros ortográficos, numa imagem achatada e
não editável. O produto existe para evitar exactamente isso.

**Decisão.** As peças são desenhadas pela aplicação — forma, cor de
superfície, imagem e nome. Ao gerador pedimos **apenas o ambiente**:
superfície de apoio, contexto, luz e sombras.

Consequências:

- os nomes saem com a ortografia que o cliente escreveu;
- continuam editáveis depois de a arte final ser gerada, sem refazer a imagem;
- ocupam exactamente a posição aprovada na prévia.

Isto obrigou a estender o motor com uma camada `polygon` (vértices em fracções
da própria caixa, para a forma sobreviver a escalas) e sombras declaradas em
píxeis do espaço de desenho, aplicadas com os mesmos números em DOM
(`drop-shadow`) e em canvas (`shadowBlur`).

**Detalhe que custou tempo.** Na ordem de composição do CSS, o `clip-path` é
aplicado *depois* do `filter`. Uma sombra no mesmo elemento do recorte era
recortada pela própria silhueta e desaparecia. A peça triangular passou a ser
dois elementos: recorte no filho, sombra no pai.

---

## 13. A mão da referência não está implementada, e isso é declarado

A referência do modelo 02 mostra uma mão a colocar uma peça. Reproduzi-la
exigiria duas capacidades que não existem:

- **mapeamento em perspectiva**, para aplicar conteúdo numa superfície
  inclinada;
- **máscara de oclusão**, para os dedos ficarem à frente do conteúdo aplicado.

**Decisão.** Não fingir. O modelo declara-o em `assembly.missing`
(`cena-com-mao`, `perspectiva-em-superficie`, `mascara-de-oclusao`) e
`assembly.limitations` explica cada limitação em linguagem comum. O editor
mostra-o antes de gerar, no painel que se abre a partir de "Composição
editável".

Em vez da mão, a peça em destaque é **elevada**: cresce, sobe o equivalente ao
que cresceu e projecta sombra mais longa. A leitura de "é esta a escolhida"
mantém-se, com meios que a aplicação controla ao píxel.

**Nunca apresentamos textos embutidos numa imagem achatada como se fossem
editáveis.** É a razão de ser de toda esta secção.

---

## 14. Referências com marca de demonstração não vão para o gerador

As referências vivem em `src/modelos/` e **não** em `public/`: são artes de
demonstração com a identidade Kriar aplicada. Servi-las pelo browser
entregaria-as a quem as pedisse.

O fornecedor de imagem aceita referências (`input_references` no OpenRouter,
até 14). Mas o gerador trabalha imagem-a-imagem: ao receber uma arte com
logótipo e texto aplicados, copia essas formas para o resultado. O fundo de um
cliente sairia com manchas a imitar a marca Kriar e letras sem sentido — e o
fundo é a única camada que a aplicação não consegue corrigir depois.

**Decisão.** `generationReferences()` recusa qualquer referência marcada com
`containsDemoBrand`. A referência continua a fazer o seu trabalho: foi dela
que saíram o `scenePrompt`, o `negative`, os compartimentos e as regras de
composição. O que não acontece é passar os píxeis ao gerador.

Quando houver uma referência limpa — só superfície, ambiente e luz, sem marca
nem texto — basta declarar `containsDemoBrand: false` e ela passa a ser
enviada, sem mais alterações. A leitura é confinada a `src/modelos`, pelo que
um `../` num ficheiro de modelo não se transforma em leitura arbitrária de
ficheiros do servidor.

---

## 15. Nomes das opções: o guardrail que faltava

Um preço inventado é um dano. Um **produto** inventado é o mesmo dano com
outro nome: a arte passa a afirmar que a empresa vende algo que nunca
mencionou.

**Decisão.** `scrubItems` aceita um nome de opção apenas quando a palavra que
o identifica aparece no pedido, na descrição da empresa ou no nome da
empresa. A comparação é por prefixo de cinco letras e sem acentos, para
"perfume" e "perfumes" contarem como a mesma palavra — o erro que importa
evitar é apagar o nome que o próprio utilizador escreveu.

Em teste com IA real, um pedido de barbearia com "corte, barba, coloração"
recebeu de volta uma quarta opção plausível ("Massagem tailandesa") que o
pedido não continha. Foi removida e comunicada.

Quando o pedido não indica opções suficientes, o plano devolve um
`missingFields` com a pergunta — não preenche por conta própria.

---

## 16. "Outra composição" percorre variações, não modelos

Com uma biblioteca de dez modelos, trocar de modelo era uma alternativa
razoável. Com uma biblioteca pequena de modelos bons, trocar significa
escolher um que serve pior o pedido.

**Decisão.** `nextArrangement` percorre primeiro as **variações de disposição**
do modelo actual (texto à esquerda, à direita, centrado — cada uma reposiciona
os grupos de texto, as peças e o logótipo) e só passa a outro modelo depois de
as esgotar.

A escolha é feita no cliente, de forma determinística, e o plano é pedido
depois com a disposição já fixada. Assim o texto é reajustado aos limites
dessa disposição em vez de ser substituído às escondidas.

---

## 17. Separação entre a mensagem e a lista

Com peças a desenhar os nomes das opções, títulos como "Corte, barba,
coloração e tratamento" fazem a arte dizer a mesma coisa duas vezes e roubam
espaço à mensagem.

**Decisão, em dois sítios:**

- **Planeador determinístico.** `splitBriefParts` reconhece a forma mais comum
  de pedido — "quero anunciar X: a, b e c" — e separa os lados: o esquerdo dá
  o título, o direito dá as peças.
- **Prompt da IA.** Uma regra explícita diz que os nomes de `items` são
  desenhados nas peças e não devem ser repetidos no título nem no subtítulo.

Em teste, o mesmo pedido passou de `"Escolhe o pacote ideal para ti: Básico,
Família, Turbo ou Empresa"` para `"Escolhe o teu pacote de internet"` com
subtítulo `"Na NetAngola, temos a solução ideal para ti. O pacote Turbo é o
mais procurado."`

**Nota relacionada.** O planeador local trata o cliente por "tu". A IA usava
"você" e pontos de exclamação, pelo que o mesmo projecto mudava de voz
conforme o caminho que o preparou. O prompt passou a fixar a forma de
tratamento.

---

## 18. Imagens entram nas peças, não numa lista solta

O modelo 02 não tem compartimentos de fotografia livres (`imageSlots: []`): as
imagens do cliente entram nas superfícies das peças.

O painel de ajustes só mostra "Produtos e imagens" nos modelos que têm esses
compartimentos. Oferecer um carregamento que o modelo não usa deixaria o
utilizador com fotografias por aplicar e um aviso permanente de "fotografias
não usadas".

A imagem de uma peça assenta numa zona interior e **não** é recortada pela
silhueta: recortar uma fotografia de produto num triângulo estragaria o
produto, que é precisamente o que o cliente quer mostrar.

---

## 19. A IA passa a gerar a arte inteira

**O que falhou.** As secções 12 a 18 descrevem peças desenhadas pela
aplicação. Funcionava tecnicamente e o resultado parecia um diagrama: formas
geométricas planas com nomes dentro, por cima de um fundo gerado que já tinha
objectos próprios. Duas camadas a competir, nenhuma profissional.

**Decisão.** O gerador produz a publicação completa — cena, produtos,
composição e texto. `POST /api/ai/artwork`, prompt em
`buildArtworkPrompt`. As fotografias do cliente vão como `input_references`,
o que mantém a fidelidade às embalagens reais.

**O que se perdeu, e está assumido:**

| | Antes | Agora |
|---|---|---|
| Acabamento | montagem de formas | fotográfico |
| Editar texto depois de gerar | sim, grátis | não, obriga a gerar outra vez |
| Logótipo | ficheiro original | redesenhado pelo gerador |
| Dígitos e @ | exactos | podem sair errados |
| Custo por arte | zero | ~0,068 USD |

As duas últimas linhas são mitigadas por `CompositionFinish`: com
`overlayLogo` e `overlayContacts` ligados — e estão por omissão — a aplicação
desenha o ficheiro do logótipo e a linha de contactos por cima da arte, em
`finishArtwork.ts`. A mesma função alimenta a prévia e a exportação, pelo que
o PNG é o que o cliente aprovou. O cliente pode desligar e deixar o gerador
fazer tudo; a troca está escrita na interface.

---

## 20. A revisão antes de gerar

Com a arte a custar dinheiro e a deixar de ser editável, mostrar uma prévia
de canvas deixou de fazer sentido. O passo intermédio passou a ser **"Rever
publicação"**: textos, produtos com fotografia e destaque, logótipo com
posição e tamanho, contactos com interruptor, e a ideia visual em texto
editável.

Duas razões:

1. **Económica.** Corrigir um nome mal escrito na revisão é grátis. Depois de
   gerar, custa outra geração.
2. **De produto.** O cliente vê exactamente o que vai ser pedido ao gerador,
   em palavras que entende, em vez de descobrir o erro no resultado.

As etapas (`WorkStage`) são `pedido` → `revisao` → `arte`. De `arte` pode-se
voltar a `revisao` com "Corrigir".

---

## 21. Progresso honesto nas operações longas

`StageLoader` marca os passos que a aplicação controla e mostra o tempo
decorrido no passo que não controla. Não há percentagem a avançar sozinha:
quando um pedido falha, o utilizador não deve ter visto progresso que nunca
existiu.

---

## 22. Quatro lições do prompt de imagem, pagas com gerações falhadas

Ficam registadas porque cada uma custou uma geração e todas são
contra-intuitivas.

**1. Códigos hexadecimais no prompt são texto a desenhar.**
`dominante azul escuro (#1B2A4A)` produziu uma tabela de amostras no topo da
imagem, com "Primary #1B2A4A / Secondary #E8DCC8 / Tertiary #C9A227"
escrito. Um modelo de imagem não lê hexadecimal: lê caracteres. As cores vão
só por palavras.

**2. Mencionar um elemento fá-lo aparecer.**
`Não desenhes nenhum logótipo; a aplicação aplica-o depois` produziu a
palavra **"Logo"** escrita na imagem. A instrução correcta é não falar do
logótipo.

**3. Pedir uma zona vazia produz uma moldura.**
`A faixa dos 15% superiores fica vazia` produziu barras de cor decorativas a
delimitar essa faixa. O que funciona é direcção fotográfica pura — "o terço
superior é a parte mais calma da fotografia" — sem dizer porquê. O véu suave
que `finishArtwork` desenha atrás do logótipo cobre o resto.

**4. A paleta da marca não se aplica aos produtos.**
`Cores da marca a usar nos objectos` pintou de azul-escuro os três perfumes
de um pedido cuja opção principal se chamava "Âmbar". A paleta manda no
fundo, nas superfícies, no texto e nos realces; os produtos mantêm as cores
próprias, coerentes com o nome que têm.

**Defesa adicional.** `finishArtwork` recorta 1,2% de cada bordo antes de
desenhar. Os modelos deixam com frequência uma tira de um ou dois píxeis de
cor diferente junto às margens, resto da tendência para molduras. Perder
1,2% é invisível e elimina o artefacto.

---

## 23. A referência passa a ser enviada — reversão da secção 14

**O erro.** A secção 14 decidiu não enviar a referência do modelo ao gerador,
por medo de a marca de demonstração passar para a arte do cliente. O efeito
dessa prudência foi o modelo deixar de influenciar o resultado: só o
`scenePrompt` chegava ao gerador, e mesmo esse era substituído pela ideia
visual do cliente.

O resultado foram artes compostas às cegas — um painel de cor achatado no
topo com o texto e a fotografia relegada para metade inferior. Tínhamos uma
biblioteca de modelos que não fazia nada.

**A correcção.** A referência vai, como primeira imagem anexada, e o prompt
declara-a como a instrução mais importante: enquadramento, encenação, escala
relativa, perspectiva, luz, hierarquia do texto. A marca de demonstração é
tratada por instrução — "ignora o texto e o logótipo da referência" — e
`containsDemoBrand` passou a activar essa frase em vez de bloquear o envio.

**O que isto mudou no resultado.** O conceito do modelo 02 passou a aparecer
de facto: o tabuleiro, a mão a colocar a peça em destaque, as alternativas
dispostas em volta. Enquadramento e encenação não se transmitem por palavras.

**Consequência nas capacidades declaradas.** As três limitações que o modelo
02 declarava — `cena-com-mao`, `perspectiva-em-superficie`,
`mascara-de-oclusao` — eram limitações da arquitectura em que a aplicação
desenhava as peças. Com a arte inteira gerada, deixaram de existir e foram
retiradas. Deixar limitações desactualizadas na interface é tão desonesto
como esconder as que existem. As limitações reais passaram a ser outras: o
texto não é editável depois de gerar, e duas gerações nunca são iguais.

---

## 24. Modelo de imagem: `openai/gpt-image-2.5-sunburst`

O Gemini 3 Flash Image produzia texto correcto mas composições fracas. O
modelo da OpenAI segue a referência de composição com muito mais fidelidade e
dá um acabamento de agência. Custo semelhante: ~0,060 USD contra ~0,068.

**Cuidado que isto obrigou a ter.** A API da OpenRouter rejeita qualquer
parâmetro que o modelo não declare, e as duas famílias não declaram os
mesmos:

| | Google | OpenAI |
|---|---|---|
| Vertical | `4:5` | `3:4` (não aceita 4:5) |
| Qualidade | `resolution` | `quality` |

`openrouterImageParams()` escolhe os parâmetros pelo prefixo do
identificador. Sem isso, trocar de modelo numa variável de ambiente devolvia
400. A diferença entre 4:5 e 3:4 é absorvida pelo `cover` do acabamento.

---

## 25. A regra que resume o prompt de imagem

**Nunca descrever o que não se quer ver; descrever só o que se quer.**

Quatro falhanços seguidos vieram de violar isto:

| Instrução | Resultado |
|---|---|
| `(#1B2A4A)` na paleta | tabela de amostras desenhada na arte |
| "não desenhes logótipo" | a palavra "Logo" escrita |
| "a faixa superior fica vazia" | barras de cor a delimitar a faixa |
| "o terço superior é o mais calmo" | um terço da arte esvaziado |

O que ficou: cores por palavras, nada dito sobre o logótipo quando é a
aplicação a aplicá-lo, e o enquadramento entregue à referência de
composição. O véu suave de `finishArtwork` resolve a legibilidade em
qualquer canto, o que torna desnecessário pedir espaço ao gerador.

---

## 26. Identidade da marca como etapa do cadastro

O cadastro passou a ter três etapas: dados da empresa, **identidade da
marca**, concluir. A etapa nova é a que faz o resto funcionar — é dela que
saem as cores com função definida, a tipografia e as regras que cada
publicação herda.

**O logótipo é o gatilho.** Carregá-lo dispara a cadeia completa: guardar o
ficheiro, ler as cores dos píxeis, enviar a imagem ao modelo, montar a
proposta. Não há um botão escondido para o cliente descobrir. O botão existe
mesmo assim, para quem não tem logótipo e escreve as cores à mão, e para
pedir outra proposta depois.

**Visão no fornecedor de texto.** `TextProvider.generateJson` ganhou
`images?: string[]` e um `supportsImages` declarado por fornecedor. O
OpenRouter e a OpenAI recebem o formato multimodal; a Anthropic e o Google
declaram `false` em vez de falhar o pedido, porque o formato de imagem deles
é diferente e não está implementado. Sem imagem a proposta continua a
sair — apenas sem análise do ficheiro, e a interface diz isso.

**A autoridade é do cliente.** O prompt declara a hierarquia (cliente →
manual de marca → sugestão nossa) e a rota reimpõe as cores declaradas
depois de validar a resposta. Um modelo que "afine" a cor principal está a
reescrever a identidade da empresa, e o prompt sozinho não é barreira
suficiente.

**Cada decisão traz origem.** `DecisionSource` é `cliente`, `manual` ou
`ia`, e aparece em cada amostra da paleta. Sem isto uma sugestão passa a
parecer um facto sobre a marca.

---

## 27. Secções fixadas: porque "actualizar" não pode apagar

`BrandIdentitySpec.lockedSections` guarda as secções que o cliente editou à
mão. Ajustar a paleta fixa a paleta; a actualização seguinte da proposta
traz ideias novas para tudo o resto e não lhe toca.

Sem isto, pedir outra ideia de fundos apagava a paleta que o cliente tinha
acabado de afinar — e a lição que ele tirava era não voltar a clicar no
botão.

Os exemplos já gerados com a paleta anterior não desaparecem: ficam marcados
como **desactualizados**, com o botão a propor a actualização. Quem decide é
o cliente, porque cada geração custa dinheiro.

**Versões.** Cada actualização incrementa `version`. Um projecto fica
associado à versão com que foi criado, e as regras só se aplicam quando
`status === 'aprovada'` — uma identidade em rascunho não manda nas artes,
porque o cliente ainda não a aprovou.

---

## 28. O que é componente e o que é imagem gerada

A proposta é feita de componentes reais: a paleta são elementos com cor de
fundo, a tipografia carrega a fonte verdadeira pela variável CSS do
`next/font`, as aplicações do logótipo usam o ficheiro do cliente. Nada
disto é uma imagem — tudo é editável e muda quando uma cor muda.

Só os três exemplos de publicação são arte gerada, porque esses representam
uma publicação. E são pedidos **um a um**, não todos de uma vez: a 0,06 USD
cada, gerar três automaticamente em cada proposta tornava o cadastro caro
sem o cliente ter escolhido.

Antes de existir imagem, o cartão do exemplo mostra o **texto** com a
tipografia e as cores propostas. Já diz muito sobre a identidade e não custa
nada.

---

## 29. O logótipo nunca é recolorido

Regra fixa, e das poucas que a aplicação garante tecnicamente: o ficheiro é
aplicado como está, com `contain`, sem esticar nem cortar.

Quando só existe uma versão e ela não contrasta com o fundo, desenhamos uma
**área de contraste** atrás — nunca trocamos as cores do logótipo. A
interface explica-o e convida a carregar a versão para fundos escuros.
`BrandLogoRules.needsBackdropOn` é o campo que transporta essa decisão até
às artes.

---

## 30. Completar a paleta em vez de rejeitar a resposta

Em teste com IA real, uma resposta válida trouxe quatro cores — `primary`,
`secondary`, `textOnLight`, `textOnDark` — e nenhum fundo nomeado. Faltavam
`bgLight` e `bgDark`, que são precisamente os papéis de que a criação de
artes precisa, e a proposta ficava impossível de aprovar: o botão "Aprovar e
continuar" não activava e o cliente não tinha como saber porquê.

Rejeitar a resposta inteira por causa de dois papéis era desperdiçar uma
proposta boa no resto. `completeSystem()` deriva o que falta com as mesmas
funções de contraste do motor de artes (`ensureContrast`, `bestTextOn`,
`mix`), e força os pares de texto a passar 4.5:1 mesmo quando foi o modelo a
propô-los.

A paleta passa a ter sempre os pares legíveis que promete. Um texto que não
se lê não é uma opção de design.

---

## 31. Três bugs que fizeram a identidade ignorar o logótipo

Um logótipo em azul-marinho sobre fundo branco produziu uma proposta com
azul, creme e laranja — nenhuma delas no ficheiro — e o aviso "não
conseguimos ler as cores". Três causas independentes, todas minhas.

**1. O filtro de luminância descartava logótipos escuros.**
`extractColors.ts` saltava qualquer píxel com luminância abaixo de 0.02 como
"quase preto". Um azul-marinho `#000A33` tem luminância 0.008: o logótipo
inteiro era descartado. O filtro era redundante — o preto e o branco
verdadeiros têm saturação zero e já saíam pelo filtro de saturação. Foi
removido.

**2. As cores de arranque eram tratadas como decisão do cliente.**
`createBrand` preenche `colors` com valores de reserva para o motor de artes
ter sempre hexadecimais válidos. O passo da identidade enviava-os ao modelo
como "cores declaradas pelo cliente", e o prompt manda respeitar essas
exactamente. A proposta ficava presa a cores que ninguém escolheu e o
logótipo real não tinha como entrar.

`BrandIdentity.colorsConfirmed` separa as duas coisas. Enquanto for `false`,
o passo envia `colors: {}` e o modelo tem autoridade para propor. Escrever
numa cor, ou aceitar a leitura do logótipo, põe-no a `true`.

**3. O resultado da proposta apagava o logótipo.**
O `LogoUploader` grava o `logoAssetId` e, no mesmo gesto, dispara a proposta.
A proposta corria com a cópia anterior da marca em mão e, ao terminar,
reconstruía a marca a partir dessa cópia — apagando o `logoAssetId` que
acabara de ser gravado. O ecrã voltava a "Carregar logótipo" com uma
proposta já feita ao lado.

Resolvido com uma referência ao estado mais recente (`latest.current`), lida
no fim do pedido em vez de no início.

---

## 32. Regras de cor que não precisam de IA

**Complemento por tom.** Sem cor secundária, deriva-se da luminância da
principal: logótipo escuro pede branco, logótipo claro pede `#10141A`. Preto
absoluto em publicidade fica duro e revela artefactos de compressão.

**Terceira cor fica vazia.** É a única cor opcional da paleta, e não é
completada por ninguém — nem pelo `completeSystem` do servidor, nem pelo
plano local. Uma marca com duas cores é o caso comum; mostrar uma terceira
derivada para encher a grelha é afirmar que a empresa tem uma cor que nunca
escolheu.

**Monocromático não é falha.** `analyseLogoColors` faz duas passagens: cores
com saturação primeiro; se não houver, o tom dominante dos píxeis da marca,
ignorando o branco do fundo. Um logótipo a preto tem uma cor — preto — e
dizer "não conseguimos ler" sobre isso estava errado. O aviso agora só
aparece quando o ficheiro realmente não se lê.

---

## 33. "O logótipo é intocável" tem de estar no prompt

O prompt da identidade ganhou um bloco próprio para isto, porque um modelo
que recebe um logótipo e a tarefa "propõe uma identidade" sugere, por
omissão, melhorias ao logótipo.

Está proibido explicitamente: alterar cores, redesenhar, simplificar,
"modernizar", remover elementos — incluindo o símbolo de marca registada —
ou mudar proporções. O que o modelo faz com o ficheiro é **ler**: cores,
tom, se funciona sobre fundos claros e escuros, que margem precisa.

E a instrução inversa, que faltava: quando o cliente não declarou cores, a
cor principal da identidade **é a cor dominante do logótipo**. Um logótipo
azul-marinho dá uma identidade azul-marinho, não uma paleta nova.

---

## 34. A etapa da identidade não rola a página

O ecrã tinha oito secções empilhadas e a página crescia até o rodapé com
"Aprovar e continuar" sair de vista — o cliente tinha de rolar para
encontrar o botão que conclui o cadastro.

Passou a ter altura fixa (`h-dvh`, sem transbordo) com as duas colunas a
rolar por dentro. Rolar dentro de um painel é diferente de perder de vista o
botão que termina a etapa.

A proposta também foi compactada: amostras de cor em quatro colunas em vez
de três, faixa de apresentação mais baixa, orientações em três colunas, e as
sugestões de cor numa fila única acima dos campos em vez de repetidas em
cada um dos três.

---

## 35. Um prompt por geração, não um pedido para tudo

A primeira versão do ecrã de identidade era uma chamada de texto a produzir
JSON e zero imagens. O resultado era o que o pedido dava: oito quadrados de
cor, um cartão de tipografia e dois rectângulos a fingir aplicações do
logótipo. Nada disto era gerado — era eu a desenhar divs.

Passou a haver **cinco gerações independentes**:

| Geração | Rota | Modelo |
|---|---|---|
| Sistema estruturado | `/api/brand/identity` | texto + visão |
| Folha de identidade | `/api/brand/visual` | imagem |
| Logótipo sobre claro | `/api/brand/visual` | imagem |
| Logótipo sobre escuro | `/api/brand/visual` | imagem |
| Textura de fundo | `/api/brand/visual` | imagem |

Cada visual tem o seu prompt, escrito pelo modelo de texto — que conhece a
empresa — e **editável pelo cliente**, porque quem conhece o negócio corrige
melhor do que nós adivinhamos. O logótipo vai como `input_references` em
todas, e é por isso que aparece o logótipo real e não um símbolo inventado.

As quatro gerações custam ~0,057 USD cada e são pedidas **uma a uma**. Gerar
automaticamente quatro imagens em cada proposta tornava o cadastro caro sem
o cliente ter escolhido.

---

## 36. Modelo próprio para a identidade

A análise de identidade falhava sempre e caía nas regras locais. O aviso
dizia `"typeScale" e as regras do logótipo vieram inválidos`.

A causa era o modelo: `openai/gpt-4o-mini` serve para planear uma publicação
— cinco campos de texto curto — e não para desenhar um sistema visual
inteiro a partir de uma imagem.

`resolveIdentityProvider()` usa `OPENROUTER_IDENTITY_MODEL`, por omissão
`openai/gpt-5.4`. O planeamento das publicações continua no modelo barato,
porque corre a cada "Actualizar proposta"; a identidade corre uma ou duas
vezes na vida de uma conta e é o sítio certo para gastar.

---

## 37. Validação resiliente: descartar a entrada, não a resposta

Mesmo com o modelo bom, a proposta caía — agora por `colors` inválido. Uma
entrada com um papel de cor fora da lista derrubava a paleta inteira, e com
ela a tipografia, os briefings e tudo o resto. O cliente via "derivada por
regras locais" sem saber porquê.

Três mudanças no esquema:

**Cores tolerantes.** `#RGB`, `RRGGBB` e `#RRGGBBAA` são normalizados em vez
de rejeitados. Rigor na forma não é robustez: o que importa validar é que a
cor existe e é legível, o formato em que o modelo a escreveu é problema
nosso.

**Listas entrada-a-entrada.** `tolerantList()` valida cada elemento por si e
descarta os que não passam. Falha só quando sobram menos entradas do que o
mínimo utilizável — uma cor para a paleta, três degraus para a escala.

**Pesos arredondados.** Um `weight: 650` passa a 700 em vez de invalidar o
degrau.

O princípio: validar o que a aplicação precisa de garantir, e normalizar
tudo o resto. `completeSystem` já preenchia os papéis de cor em falta; não
fazia sentido rejeitar a resposta antes de ele ter oportunidade de o fazer.

---

## 38. O que saiu do ecrã

Removidos: exemplos de publicações, organização das publicações, direcção de
imagem, regras fixas, preferências flexíveis.

As três últimas **continuam nos dados** e continuam a alimentar a geração das
publicações. Deixaram de aparecer porque são prompt, não design system — o
cliente abre este ecrã para ver o sistema visual da sua marca, não para ler
as instruções que damos ao gerador.

O que ficou, e porque cada uma justifica o espaço:

- **Identidade visual** — a folha gerada com o logótipo real aplicado em
  material da empresa. É o que prova que a identidade existe.
- **Paleta** — escalas tonais de dez degraus por cor de marca, derivadas em
  HSL com o degrau 500 a ser sempre a cor original. Uma cor não é um
  sistema; dez degraus da mesma família são.
- **Tipografia** — espécime "Aa" mais os degraus a tamanho proporcional, com
  a fonte real carregada. Não um cartão com uma frase de exemplo.
- **Aplicações do logótipo** — duas imagens geradas, sobre claro e sobre
  escuro, mais as regras de tamanho mínimo e margem.
- **Fundos e elementos** — a textura gerada mais os símbolos do sistema
  (botão, contorno, etiqueta, cartão) desenhados com os tokens propostos.

---

## 39. Fronteira do armazenamento

`Cannot read properties of undefined (reading 'length')` em
`isSpecReady`, com o cadastro num ecrã de erro e a marca já criada.

A causa: a identidade vive numa coluna `jsonb` (Supabase) ou em IndexedDB
(modo local), e nenhum dos dois valida a forma do que guarda. Uma
especificação gravada antes de `typeScale` existir voltou sem esse campo, e
`spec.typeScale.length` encontrou `undefined`.

Duas correcções, e a ordem importa.

**A fronteira.** `migrateBrand()` corre no único ponto onde a marca entra na
aplicação — `SessionProvider`, à leitura e depois de cada gravação, porque o
backend devolve o que leu da base de dados e não o que lhe enviámos. Uma
especificação de forma incompatível é **descartada**, não propagada: custa ao
cliente uma geração nova, mas deixá-la entrar meio-formada rebenta em sítios
imprevisíveis. As listas opcionais que possam vir ausentes são preenchidas,
para o resto da aplicação nunca ter de se defender contra `undefined`.

**A guarda.** `isSpecReady` passou a ser defensiva. É a função que decide se
o botão de aprovação activa — uma guarda que lança excepções é pior do que
guarda nenhuma. A migração já trata do caso; isto é a segunda barreira.

A lição é estrutural, não deste campo: **dados persistidos são entrada
externa.** Um `jsonb` ou um IndexedDB escrito por uma versão anterior do
código é tão pouco de confiar como um corpo de pedido HTTP, e merece a mesma
fronteira de validação.

## 40. O fundo é da página, não do cartão

O campo de pontos verdes faltava nas etapas 1 e 3 do cadastro. A primeira
correcção pô-lo dentro do `Card` do formulário, e o resultado foi um cartão
com textura animada em vez de um ecrã com fundo — "o efeito de fundo
colocaste no fundo do formulário e não no fundo do site".

Passou para a raiz da página como `fixed inset-0 -z-10`, com o cartão em
`bg-ink-900/70 backdrop-blur-sm` para os pontos se lerem através dele.
`fixed` e não `absolute`: nas etapas que rolam, o campo fica parado enquanto
o conteúdo passa por cima.

O detalhe que faz isto funcionar é o `isolate` no contentor. Um filho com
índice `z` negativo é pintado **depois do fundo do contexto de empilhamento a
que pertence** e antes do conteúdo em fluxo. Sem `isolate`, o contexto mais
próximo é a raiz do documento — e o `html`, o `body` e o próprio contentor
pintam `ink-950` opaco por cima, pelo que o campo desaparecia por completo.
`isolation: isolate` cria o contexto no contentor, e `-z-10` passa a
significar "atrás do conteúdo, à frente do fundo".

Verificado com duas capturas em Chrome sem interface da mesma estrutura, com
e sem `isolate`: sem ele, nem um ponto.

Só nas etapas 1 e 3. Na etapa 2 fica de fora — é a proposta da marca que tem
de prender o olhar, e um fundo animado por trás de uma paleta é ruído. Mesmo
critério do editor, onde o campo só existe no estado vazio.

## 41. Um progresso que cobre o painel, não o conteúdo

Três queixas, uma causa: "na geração tem um scroll que fica bugado",
"mostrou o resultado antes de gerar a identidade visual" e "as imagens não
aparecem".

O ecrã de progresso é `absolute inset-0`, e estava dentro da coluna que rola.
Um elemento assim posicionado num contentor com `overflow-y-auto` mede-se
pela **altura do conteúdo**, não pela do painel: cobria o primeiro ecrã da
proposta e deslizava com o resto ao primeiro gesto de rolagem, deixando o
design system nítido e legível por baixo. Quem olhava via um resultado
pronto com quatro molduras vazias.

A correcção é estrutural: moldura de fora que não rola (`relative
overflow-hidden`), rolagem numa camada de dentro, progresso irmão dessa
camada. Agora `inset-0` é o painel visível. Durante a geração a camada de
dentro fica em `overflow-hidden` — uma barra de rolagem atrás de vidro fosco
não levava a sítio nenhum. O conteúdo continua a ver-se através do desfoque,
que é o que o cliente queria manter: as peças a aparecerem em tempo real por
trás do carregamento.

Três decisões vieram atrás.

**A proposta só se aprova completa.** `isSpecReady` responde "o sistema dá
para criar artes?" e é verdadeira segundos depois do design system existir.
As quatro imagens levam minutos. Com essa guarda, o botão de aprovar acendia
a meio da geração e era possível concluir o cadastro com a identidade visual
aprovada antes de existir. `isSpecComplete` é a guarda do cadastro e exige as
quatro peças; `isSpecReady` manteve o significado que tinha. O rodapé também
fica trancado enquanto há trabalho a correr, incluindo o botão de voltar —
sair a meio atira fora imagens já pagas.

**Uma moldura vazia tem de dizer por que está vazia.** Mostrava sempre o
mesmo ícone a pulsar, e três situações distintas — à espera da vez, a ser
gerada agora, falhou — ficavam indistinguíveis. Daí a conclusão de que a
aplicação não gerava imagem nenhuma. Agora cada moldura mostra o seu estado,
e o que falhou aparece num aviso com "Tentar outra vez" que repete **apenas
as peças em falta**: cada imagem é um pedido pago de cerca de 50 segundos, e
refazer as quatro porque uma falhou é cobrar ao cliente o nosso erro.

**`updateSpec` escreve sobre a marca mais recente.** Fechava sobre o `brand`
do render em que o logótipo foi largado — de antes de haver logótipo, cores
lidas ou tipografia escolhida. É chamada de dentro do ciclo que gera os
visuais, que dura três a quatro minutos, pelo que cada imagem concluída
reescrevia a marca com essa cópia velha: o logótipo desaparecia do painel e
as cores voltavam às de arranque a meio da geração. Passou a partir de
`latest.current`, como o resto do ciclo já fazia.

Os visuais passam também a ser recodificados antes de guardados. O gerador
devolve PNG de 1024 px com cerca de 2,7 MB; quatro por proposta, e o cliente
pede mais do que uma. Sem recodificar, cada tentativa deixava onze megabytes
no armazenamento do browser para imagens que se vêem numa moldura de
trezentos píxeis.

## 42. Uma geração, não quatro

A identidade gerava quatro imagens: a folha de identidade, o logótipo sobre
claro, o logótipo sobre escuro e uma textura de fundo. Ficou uma.

As duas aplicações do logótipo saíram porque o gerador lhes dava o pior
resultado possível. O logótipo do cliente é azul-marinho escuro, e o pedido
voltou com esse logótipo impresso num envelope azul-marinho, numa caixa
azul-marinho e num ecrã de telemóvel azul-marinho: a marca a desaparecer na
peça feita para a mostrar, contra as regras da própria identidade que dizem
que aquele logótipo precisa de fundo claro.

Não é um problema de prompt — é a pergunta errada. O que estas duas caixas
respondem é "o meu logótipo lê-se sobre o fundo claro e sobre o fundo escuro
da minha paleta?", e isso a aplicação sabe sem pedir nada a ninguém: desenha
o ficheiro real sobre as duas cores que a paleta declara. Instantâneo, de
graça, e mostra o contraste verdadeiro. A versão gerada mostrava um contraste
inventado.

A textura saiu por outra razão, que é a mesma que o cliente formulou: **a
paleta está ligada à empresa e acompanha-a.** As cores são dados, não um
ficheiro. Cada publicação recebe-as em palavras no prompt de geração, e é de
lá que sai o fundo da arte. Guardar uma imagem de padrão era pagar uma quarta
geração para ilustrar o que a paleta já diz.

Fica a folha de identidade, que é a única peça que não se consegue montar sem
um fotógrafo.

Consequências na estrutura: `BrandVisualKind` passou a ter um só valor, o
esquema da proposta pede um só `visualPrompt`, e a migração **filtra** os
géneros que já não existem. Esse filtro não é higiene: uma especificação
gravada com quatro visuais voltava com três molduras mortas e fazia
`isSpecComplete` exigir imagens que nunca mais seriam pedidas — botão de
aprovar bloqueado para sempre.

## 43. O tom das peças contra o tom do logótipo

A regra que faltava no prompt da folha de identidade, e a razão do
azul-sobre-azul.

O gerador não deduz contraste. A paleta diz-lhe "dominante azul-marinho" e
ele pinta tudo de azul-marinho, incluindo o papel onde o logótipo assenta. A
instrução tem de separar explicitamente a cor das PEÇAS da cor da CENA:

> O logótipo é ESCURO e é aplicado sem mudar de cor. Todas as peças onde ele
> assenta são de tom CLARO. A cor da marca entra na SUPERFÍCIE debaixo das
> peças, nos detalhes e nas sombras — nunca no material onde o logótipo está
> impresso.

O tom vem da leitura de píxeis do ficheiro, e quando essa leitura não existe
nesta sessão deriva-se da luminância da cor principal — que é a cor dominante
do próprio logótipo. Verificado com uma geração real: quatro peças em papel
cru, logótipo legível em todas, e o azul da marca na superfície de betão e na
fita do cartão de identificação.

O briefing também mudou de exigência. Era um parágrafo de 600 caracteres e
dava material de banco de imagens. Agora o modelo de texto tem de decidir
quatro coisas e nenhuma pode ficar vaga: o material escolhido para ESTE
negócio (três a cinco peças, nunca mais), a superfície e a luz, o
enquadramento, e o detalhe que dá verdade — a peça entreaberta, o grão do
papel a apanhar luz. O limite subiu para 1100 caracteres porque um briefing
de fotografia não cabe em menos.

Proibições novas, cada uma paga com um resultado: ecrãs de telemóvel com
interface inventada, o nome da empresa escrito por baixo do logótipo,
maquetes planas, aspecto de renderização 3D.

"Gerar novo" varia o ENQUADRAMENTO por um contador de variantes, não o
briefing. O briefing é a proposta aprovada; reescrevê-lo a cada tentativa
tirava-lhe o sentido. Sem o contador, a segunda geração devolvia praticamente
a mesma imagem.

## 44. Ajustar e gerar não são a mesma acção

Todos os cartões do design system tinham "Ajustar". A paleta e a tipografia
ajustam-se de facto: o cliente escreve um código de cor ou escolhe uma fonte,
e essa decisão passa a ser dele e deixa de ser proposta. Uma fotografia não
se ajusta com campos — pede-se outra. O cartão da identidade visual passou a
dizer **"Gerar novo"**.

Saiu também o bloco que estava ao lado da fotografia: fundo creme com o
logótipo e o nome da empresa escrito por baixo. Não era uma peça da
identidade nem uma decisão do sistema — era uma amostra de um logótipo que já
se vê na própria fotografia, com o nome repetido duas linhas abaixo do
cabeçalho do cartão. Ocupava um terço do cartão principal para não dizer
nada.

Sem esse bloco, a folha de identidade quadrada numa largura de duas colunas
ficava altíssima e devolvia a rolagem que a grelha existe para evitar. Passou
a ocupar **uma coluna e duas linhas**: em pé encaixa na altura das outras
duas filas e a imagem aparece grande sem empurrar nada.

O cartão da tipografia tinha um terço de vazio por baixo, porque a grelha
alinha alturas por linha e ele tem menos conteúdo do que os vizinhos.
Encurtá-lo desalinhava a grelha; em vez disso o espécime **estica** e passa a
mostrar a escala toda. O espaço passou a dizer algo.

Medido num ensaio da grelha com a altura real do painel: conteúdo 560 px num
painel de 560 px. Zero rolagem.

## 45. A paleta aprovada chega inteira ao gerador

A paleta acompanha a empresa: `createComposition` copia
`brand.identity.colors` com `colorsFromBrand: true`, e `buildArtworkPrompt`
traduz essas cores para palavras em cada geração. Isso já funcionava — mas só
para três cores.

O design system declara mais: `bgLight`, `bgDark`, `textOnLight`,
`textOnDark`. Esses papéis nunca saíam do ecrã, e o gerador escolhia o tom do
fundo e do texto por sua conta a partir da cor dominante. Duas publicações da
mesma empresa saíam com fundos de famílias diferentes.

`guidelinesFrom` passou a incluí-los e o prompt a descrevê-los por palavras,
como o resto da paleta — `describeColor` pela mesma razão de sempre: um
gerador de imagem que vê `#F4F2EE` desenha "#F4F2EE".

O detalhe que quase passou: foi preciso declarar `surfaces` no esquema Zod da
rota. Um objecto Zod **descarta em silêncio** as chaves que não conhece, por
isso as cores saíam do cliente, passavam a fronteira e nunca chegavam ao
prompt. Nada estourava — é a pior categoria de falha, e a razão de a fronteira
de validação ter de ser alterada ao mesmo tempo que o que atravessa.

## 46. Seis formatos, e o enum que não era verificado

Eram três formatos: vertical 4:5, quadrado 1:1 e story 9:16. Entraram mais
três, pedidos pelo cliente — capa de Reels, LinkedIn e horizontal.

Cada entrada é uma **proporção que uma plataforma trata de forma diferente**,
não um nome comercial. `story` e `reels` partilham os mesmos 1080 × 1920 de
propósito: a medida é a mesma, mas a interface do Reels tapa mais a base e o
topo, e o que se pede ao gerador muda. Um story é uma peça para ler; uma capa
de reels é uma peça para parar o dedo. Está escrito no prompt de cada um.

As medidas são as recomendadas por cada plataforma — o LinkedIn leva 1200 ×
627, que é o formato deitado de imagem única no feed
([especificação](https://openrouter.ai/docs/client-sdks/typescript/models/supportedaspectratio)
para as proporções da API; as medidas das redes vêm das recomendações
publicadas de cada uma).

### O que o compilador apanhou, e o que não apanhou

Acrescentar um valor a `FormatId` deu cinco erros de compilação imediatos:
`FORMAT_WORDS` no prompt e os quatro mapas de proporção dos fornecedores de
imagem são `Record<FormatId, string>`, e um `Record` incompleto não compila.
Isso é desenho deliberado: um formato que o gerador não sabe pedir é um
formato que falha em produção.

O que não deu erro nenhum foram **quatro `z.enum(['vertical', 'quadrado',
'story'])` escritos à mão** nos esquemas das rotas. A interface passava a
oferecer seis formatos e três deles respondiam 400 — defeito invisível ao
compilador, porque uma lista de literais num `z.enum` não tem relação com o
tipo.

A correcção não foi acrescentar três strings a cada sítio: foi derivar o enum
do catálogo, uma vez.

```ts
const FORMAT_IDS = FORMATS.map((f) => f.id) as [FormatId, ...FormatId[]];
export const formatEnum = z.enum(FORMAT_IDS);
```

Lição, e é a mesma da secção 45 noutra roupagem: **uma fronteira de validação
escrita à mão é uma segunda fonte de verdade.** Quando o tipo e o validador
não partilham origem, mudar o tipo não muda o validador, e nada avisa.

### Proporções confirmadas, não assumidas

A lista normalizada da API inclui `4:5` — e `4:5` dá 400 nesta família de
modelos. Por isso as proporções dos formatos novos foram verificadas com
gerações reais contra `gpt-image-2.5-sunburst`, em vez de lidas na
documentação:

| pedido | devolvido   |
|--------|-------------|
| `1:1`  | 1024 × 1024 |
| `3:4`  | 1152 × 1536 |
| `9:16` | 864 × 1536  |
| `3:2`  | 1536 × 1024 |
| `16:9` | 1536 × 864  |

O resultado mudou uma decisão: o LinkedIn passou de `3:2` (1.5) para `16:9`
(1.78), porque `16:9` é aceite e está mais perto do 1.91:1 da plataforma —
corta menos nas pontas.

Depois os seis formatos foram passados pela rota de planeamento real, com IA
real: seis respostas 200, modelo escolhido em todas. É o ensaio que apanha um
esquema que não conhece o formato.

### Dois pormenores

O ícone do selector era o do Instagram. Deixou de fazer sentido com LinkedIn
e YouTube na lista.

O modelo de composição declara agora os seis formatos. Entra na geração como
referência de estrutura e descrição de cena — encenação, luz, hierarquia —, e
nada disso é próprio de uma proporção. Não declarar um formato não o tornava
mais seguro: deixava `allowedTemplatesFor` sem candidatos e o planeamento
falhava.

Fica um canto conhecido: a miniatura de um rascunho **sem arte gerada** usa o
motor de composição local, cujas caixas normalizadas foram desenhadas para
retrato, e num formato deitado estica. Com arte gerada — o caminho normal — a
miniatura é a própria arte e o cartão usa a proporção verdadeira do formato.

## 47. O "Exemplo" que prometia a coisa errada

O resumo da marca tinha, ao lado dos dados, uma publicação de amostra
desenhada ao vivo: um triângulo verde, dois círculos e as palavras
"Primeira", "Segunda" e "Terceira" por produtos. Aparecia na etapa 3 do
cadastro e na página **Marca**, porque é o mesmo componente.

Saiu, e não só por ser feio. Era uma promessa falsa em dois sentidos.

O desenho vinha do motor de formas geométricas, que deixou de ser o caminho
das publicações quando a arte passou a ser gerada por inteiro pela IA. O
cliente olhava para aquilo imediatamente antes de aprovar a identidade e não
se parecia com nada do que ia receber.

E o triângulo era **verde** numa identidade azul-marinho. Verde `#BFF839` é a
cor da interface da Kriar; numa peça que representa a marca do cliente só
podem estar as cores da empresa dele. A regra está no projecto desde o
primeiro dia e esta amostra violava-a sem ninguém notar, porque a palete de
demonstração vinha do tema e não da marca.

Com o bloco saiu tudo o que só existia para o alimentar: a composição falsa,
a resolução dos três ficheiros de logótipo e os imports do motor. O resumo
ficou numa coluna, em texto. O `CanvasPreview` perdeu o último consumidor —
servia também as miniaturas dos modelos, página já removida — e foi apagado;
`useArtFonts` e `renderArtwork` continuam em uso pelo editor e pela
exportação.

Quem quer ver a identidade aplicada tem a folha de identidade visual, que é
uma fotografia real com o logótipo real.

## 48. "Dados locais" descrevia a arquitectura, não a consequência

A pergunta foi: *"porque no início ainda aparece 'dados locais' se fiz o
cadastro já?"*

O aviso estava factualmente certo. Sem as variáveis do Supabase definidas, a
conta, a marca e os projectos vivem no IndexedDB do browser, e a etiqueta
dizia-o. Mas foi lida como "o teu cadastro não ficou guardado" — e é uma
leitura razoável, porque a etiqueta descrevia **onde** os dados estão em vez
de **o que isso significa para quem lê**.

Passou a dizer "guardado só neste browser", com a explicação completa no
`title`: não se perde, mas também não acompanha o cliente para outro
computador, e as Definições é onde se liga a base de dados. Os outros dois
avisos seguiram o mesmo critério — "texto local" e "fundos locais" passaram a
"textos sem IA" e "imagens sem IA", porque era isso que queriam dizer.

Um aviso técnico correcto que assusta sem informar é um aviso mal escrito.

## 49. A versão do logótipo que estava guardada e ignorada

As duas caixas de aplicação do logótipo — sobre claro e sobre escuro —
desenhavam ambas o logótipo PRINCIPAL. Só esse estava a ser resolvido.

O cliente tinha carregado uma versão própria para fundos escuros. Via o
ficheiro escuro sobre o fundo escuro, ilegível, com a versão correcta
guardada e ignorada a dois centímetros de distância no mesmo ecrã — e a
secção que existe para responder "o meu logótipo lê-se?" a dar a resposta
errada.

Cada superfície passou a receber o ficheiro feito para ela, com recurso ao
principal quando não existe versão própria. E a legenda diz **qual** ficheiro
está à vista: sem a etiqueta "versão própria", as duas caixas continuavam
indistinguíveis do caso defeituoso.

Pormenor da mesma secção: os dois cartões de upload diziam "Versão para fundo
claro" e "Versão para fundo escuro", e na largura daquela coluna ficavam os
dois cortados em "Versão para fund…" — dois cartões com texto idêntico,
impossíveis de distinguir sem abrir. A palavra que os separa tem de caber:
"Para fundo claro" e "Para fundo escuro".

## 50. Da biblioteca de modelos à biblioteca de referências

A mudança de arquitectura criativa. O sistema tinha **modelos** a reproduzir;
passou a ter **referências** que demonstram qualidade.

### O defeito, e porque não era um defeito de prompt

Havia uma referência activa: uma mão a colocar uma peça num tabuleiro de jogo
do galo, com logótipos da Netflix, Disney+, Paramount+ e Crunchyroll
aplicados nas peças. O sistema produzia jogos do galo.

Não era aleatório. Três mecanismos empurravam para lá, e cada um bastava:

1. **O prompt abria com a imposição.** O primeiro bloco de
   `buildArtworkPrompt` dizia *"REFERÊNCIA DE COMPOSIÇÃO (primeira imagem
   anexada). A primeira imagem anexada define a ESTRUTURA desta publicação.
   Segue-a de perto"*, seguido de cinco pontos — enquadramento, encenação,
   luz, hierarquia, acabamento.
2. **O `scenePrompt` descrevia a cena por palavras.** Mesmo sem a imagem, o
   modelo-02 injectava "superfície de apoio limpa vista em ligeiro ângulo,
   para apresentar objectos" com "zona superior esquerda calma reservada para
   texto" — a descrição literal daquela arte.
3. **O planeamento era uma escolha falsa.** `buildPlanUserPrompt` listava os
   modelos disponíveis com *"Escolhe obrigatoriamente um destes. Qualquer
   outro identificador é rejeitado."* Com um modelo na biblioteca, isso não é
   escolher.

Havia ainda `itemSlots` com coordenadas fixas e cinco peças — a contagem do
tabuleiro — que chegavam à interface como "este conceito mostra 3 a 5
opções".

### A inversão

Os conceitos passaram a estar separados no código, cada um no seu ficheiro:

| Conceito | Onde vive | O que decide |
|---|---|---|
| Identidade da marca | `identitySpec.ts` | linguagem da marca |
| Pedido | `PublicationBrief` | o que comunicar |
| Estilo | `catalog.ts` | forma de apresentar |
| Referências | `references.ts` + `references/catalog.ts` | qualidade e acabamento |
| Direcção criativa | `direction.ts` | a ideia desta publicação |
| Arte | `CompositionArtwork` | o resultado |

A ordem das etapas é a correcção. A direcção criativa é criada **antes** de
existir qualquer referência em jogo: o modelo recebe o pedido e a marca, e
propõe três ideias próprias sem lhe ser mostrada biblioteca nenhuma. Só
depois o servidor recupera referências, e filtra pelas técnicas que a própria
direcção declarou precisar.

No prompt da imagem, a secção das referências desceu do primeiro bloco para o
penúltimo, e mudou de conteúdo: duas listas por referência — o que aproveitar
e o que **nunca** transferir. A segunda vem do cadastro, escrita por quem
olhou para a imagem, e é repetida na lista negativa final, que é o bloco que
os geradores respeitam de forma mais literal.

### `directUse`: aprovada não é o mesmo que enviável

Cada referência declara se a própria imagem pode viajar numa geração. A do
tabuleiro está `nunca` — não por ser má, mas porque o valor dela (espaço
livre, hierarquia, coerência de luz) transmite-se por palavras sem arrastar o
tabuleiro, a mão e as marcas de terceiros. `completeUsage` força `descricao`
nessas, independentemente do que o modelo de texto peça, e `referenceImages`
verifica outra vez do lado do servidor.

### Resultado medido

Cinco pedidos de sectores diferentes — perfumaria, restaurante, escola, loja
de roupa, serviços:

- **zero contaminação** (nenhuma menção a tabuleiro, jogo, streaming, lupa,
  puzzle, bandeja ou à marca das referências);
- cinco ideias distintas, três abordagens distintas;
- `auto` escolheu vibrante para o restaurante e elegante para a
  contabilidade — não convergiu para tecnológico, apesar de oito das nove
  referências serem desse estilo.

Uma geração real de perfumaria devolveu o frasco em pedra travertina com flor
de baunilha e madeira de oud, nas cores da marca, com a abordagem
`fotografia-simples`. Nenhuma imagem de referência foi enviada: as três
escolhidas eram todas de modo `descricao`.

### "Promocional" não era um estilo

Saiu da lista. Promoção é um **objectivo** — uma promoção pode ser clean,
elegante ou vibrante, e tratá-la como estilo forçava preços gigantes e cores
berrantes em campanhas que pediam o contrário. Projectos antigos com
`promocional` são traduzidos para `vibrante` na leitura, e `minimalista` e
`moderno` para `clean`.

As descrições dos seis estilos dizem o que cada um **não** exige: clean não é
fundo branco, elegante não é preto e dourado, tecnológico não é azul com
circuitos. Eram essas associações que faziam todas as artes do mesmo estilo
sair iguais.

### Migração não destrutiva

`templateId`, `variantId` e `templateLocked` continuam na composição e nada
foi apagado. O que mudou é a **autoridade**: já não vão para a instrução do
gerador, já não escolhem a cena, já não impõem coordenadas. São geometria
para o motor local — que serve o recurso sem chave de IA e as miniaturas de
rascunho. `migrateProject` traduz o estilo e preenche os campos novos no
único ponto por onde um projecto entra no editor.

A referência do tabuleiro guarda `legacy.templateId` a apontar para o
modelo-02, como a especificação permite: coordenadas antigas podem continuar
como descrição, nunca como imposição.

### "Outra ideia" e o custo de uma instrução branda

O modelo propõe três direcções por chamada e as não escolhidas ficam em banco
— pedir outra ideia gasta primeiro essas, instantaneamente e sem custo. Isto
substituiu `nextArrangement`, que percorria as variações de disposição do
modelo: texto à esquerda, ao centro, à direita. Mudar o lado do texto não é
outra ideia.

Com o pedido escrito de forma branda — "propões 2 ou 3 direcções" — o modelo
devolvia **uma**, e a validação tolerante aceitava-a. O banco ficava vazio e
cada alternativa custava uma chamada nova. A correcção foi mostrar três
objectos na forma da resposta e exigir o número de forma explícita: passou a
devolver três em quatro de cada cinco pedidos.

## 51. Oito melhorias, e o que cada uma ensinou

### A barra de espaço não funcionava

Editar um título na revisão era impossível a partir da segunda palavra. A
causa estava no store:

```ts
setText(role, value) {
  const trimmed = value.trim();   // <- aqui
  texts[role] = { value: trimmed, locked: true };
}
```

O campo é controlado pelo valor guardado. Escrevias um espaço, o `trim`
apagava-o, o campo voltava sem ele. O `trim` passou a servir só para
**decidir se o campo está vazio**; o valor é guardado como foi escrito.

O mesmo defeito estava em `setItemName` e `setContactValue` — nomes de
produtos com mais de uma palavra e endereços eram igualmente impossíveis. Um
`trim` num setter de campo controlado é sempre este bug.

### O website estava guardado e invisível

"Cadastrei o website mas na revisão não aparece." Estava em
`company.website`, o campo dos dados da empresa, e a revisão só lia
`brand.contacts`. Dois campos para a mesma informação e o ecrã a ler um.

Não dupliquei o dado nem o migrei: a linha do website é preenchida a partir
dos dados da empresa quando não existe contacto de website. O cliente
escreveu-o uma vez e espera vê-lo, sem ter de saber que a aplicação tem dois
lugares para a mesma coisa.

### O logótipo passou a fazer parte da arte

Apareceu duas vezes em cima do texto. A causa é estrutural: com
`overlayLogo: true`, a aplicação colava o ficheiro no canto que o cliente
escolhera, e o gerador não sabia que aquele espaço estava reservado. Duas
camadas a disputar o mesmo canto.

O logótipo passou a ser gerado, com o ficheiro anexado como referência. E a
instrução é **repetida em três sítios** — bloco MARCA, identificação da
imagem anexada, lista negativa — porque um gerador redesenha logótipos:
simplifica formas, muda pesos, acrescenta o nome da empresa por baixo. Uma
única instrução não chega; a redundância foi a única coisa que mostrou
diferença. A lista negativa é o bloco que os geradores tratam de forma mais
literal, e por isso é lá que as proibições pesam mais.

A **posição saiu do ecrã de revisão**. Havia um selector com seis cantos, e
era uma escolha real que causava o problema: o cliente escolhia "superior
direito" sem saber o que o gerador ia pôr lá. Quem sabe onde ficou espaço
livre é quem compôs a imagem. Pedir uma decisão a quem não tem informação
para a tomar não é dar controlo — é transferir a culpa de um defeito nosso.

Os contactos passaram a ir **nomeados**, um por linha: `website: "…"`,
`WhatsApp: "…"`. Iam numa tira pré-montada e o gerador tratava-a como texto
decorativo. Um valor com significado é copiado com mais cuidado do que uma
sequência de caracteres.

### Os anexos estavam escondidos por uma condição morta

Não havia forma de anexar uma fotografia. O bloco estava atrás de
`template.imageSlots.length > 0`, e o único modelo da biblioteca tem a lista
vazia — as imagens entravam nas superfícies das peças. A condição fazia
sentido quando a aplicação desenhava compartimentos; com a arte gerada por
inteiro, uma fotografia é uma REFERÊNCIA e não precisa de compartimento.

Cada anexo ganhou uma **nota opcional**. A mesma imagem pode querer dizer
"este é o produto principal", "usa só o fundo desta" ou "copia o tipo de
letra deste site", e o gerador não adivinha qual. A nota vira o rótulo da
referência no prompt — sem isso o campo era decorativo: o cliente escrevia e
nada chegava a quem gera.

Em linha e não em grelha: a grelha de quadrados mostrava mais fotografias no
mesmo espaço, mas não tinha onde pôr a explicação. E o limite do rótulo no
esquema subiu de 60 para 180, senão uma nota longa fazia a geração responder
400 depois de o cliente ter escrito tudo.

### "Melhorar o pedido": quando o prompt não chega, muda o mecanismo

O botão reescreve o pedido num briefing claro. O problema não era escrever
melhor — era **não inventar**. O pedido melhorado é a base do conceito e dos
textos que vão impressos na arte.

Duas revisões do prompt falharam. De "mufete ao domingo" — dezassete
caracteres — saía um briefing de 427 com "experiência gastronómica única",
"pratos frescos e saborosos" e "local de referência para refeições de peixe".
Acrescentei proibições explícitas sobre público-alvo e ambiente; o resultado
piorou.

O modelo não estava a desobedecer: estava a preencher um espaço que lhe
dávamos. A correcção é aritmética, não retórica — **o orçamento de
caracteres é proporcional ao que o cliente escreveu**:

```ts
budget = min(500, max(120, original.length * 3))
```

Dezassete caracteres de informação não dão quatrocentos de briefing honesto.
Com o tecto a 120, o modelo tem de escolher o que é essencial em vez de
inventar o que falta. Passou a devolver 80 caracteres verdadeiros.

O orçamento vai no prompt — para ele escrever à medida, com frase completa —
**e** é aplicado no código, porque um limite pedido é uma sugestão e um
limite aplicado é uma garantia.

Verificado com três pedidos: "os melhores giftcards" perdeu o superlativo,
`15.000 Kz` ficou exacto e sem "a partir de", e a ortografia das marcas foi
corrigida.

### A revisão redesenhada

Era uma coluna de cinco cartões iguais, todos com o mesmo peso. O que o
cliente mais precisa de ler — a ideia proposta — estava no fim.

A ideia passou para o topo, com moldura de realce: é a única coisa na página
que ele ainda não viu, porque os textos e os produtos saíram do pedido dele.
O resto são duas colunas numeradas — a larga para o que se **edita** (textos,
produtos), a estreita para o que se **confirma num relance** (marca,
contactos). Os números dão ordem de leitura, que uma grelha de duas colunas
não tem sozinha.

### O fundo pertence à área de trabalho

O campo de pontos faltava em Projectos, Marca, Definições e na revisão. Pô-lo
na área de conteúdo do `AppShell` cobria tudo de uma vez — e ficava também
atrás do painel de controlo do editor, com o pedido, as cores e o formato.
Pontos animados por trás de uma coluna de comandos é ruído atrás de
ferramentas.

Ficou em `WorkspaceBackdrop`, usado só nas superfícies de trabalho. O
componente existe para a regra não depender de quem se lembra dela.

Nas três páginas foi preciso reestruturar a raiz: o fundo é `absolute
inset-0`, e num contentor que rola isso mede-se pela altura do **conteúdo** —
cobria o primeiro ecrã e deixava o resto nu. Moldura fixa por fora, rolagem
por dentro. É a terceira vez que esta correcção aparece no projecto, depois
do ecrã de progresso da identidade e da coluna da proposta.

## 52. Acabamento: margens, cor e o modelo que obedece

Seis defeitos numa só arte, e a lição é que quase todos eram instruções em
falta — não limitações do gerador.

### O que estava errado

**O website era colado, não gerado.** Aparecia numa etiqueta cinzenta sobre o
botão de acção, visivelmente aplicada por cima. `overlayContacts` ficara em
`true` com o argumento de que um dígito errado é um dano real. O resultado
desmentiu o argumento: uma linha exacta mas estranha à arte é pior do que uma
linha integrada que se confere antes de publicar. Passou a `false`, com o
interruptor a declarar o custo de cada lado.

**O logótipo saía cortado ao meio** pela aresta de cima, e nada separava o
conteúdo do limite da imagem. Faltava uma instrução, e "deixa margem" não
significa nada para um gerador. Agora é um bloco próprio com um número:
margem livre de 8% da largura nos quatro lados, nada cortado pela aresta, e
se um elemento não cabe reduz-se em vez de sair da moldura.

**A cor que ninguém escolheu.** O título e o botão saíram amarelo saturado; a
secundária da marca é um creme quente. O gerador leu "creme" como "amarelo".
Duas regras novas: só as cores da paleta no texto e nos realces, e respeito
pelo tom exacto — "um creme não é amarelo, um azul-marinho não é azul vivo".

O laranja, esse, era legítimo: é a cor do próprio cartão Crunchyroll. As
cores dos PRODUTOS mantêm-se, que é uma regra antiga desta aplicação — ver a
secção sobre os perfumes pintados de azul.

### O modelo: comprámos obediência, não estética

`openai/gpt-5.4-image-2` em vez de `gpt-image-2.5-sunburst`. Combina o
GPT-5.4 com o GPT Image 2 e raciocina sobre a instrução antes de gerar.

Medido no mesmo prompt, com as correcções de margem já incluídas: este
respeitou a margem nos quatro lados e devolveu o logótipo completo; o outro
cortou o cartão do Prime Video pela aresta esquerda. A diferença não foi de
gosto — foi de obediência a uma regra explícita.

O preço está declarado: **0,20 USD por arte contra 0,05, e 86 segundos contra
40.** Quatro vezes mais caro por uma arte que não precisa de ser refeita é
barato; uma arte com o logótipo cortado custa uma geração nova e a confiança
do cliente.

E trouxe um risco que quase passou: 86 segundos contra um `TIMEOUT_MS` de
90_000. Quatro segundos de folga. Uma geração paga que aborta não devolve
nada e não devolve o dinheiro — o fornecedor já fez o trabalho. Subiu para
180 segundos.

### O interruptor que transbordava

A secção de contactos tinha os rótulos "Mostrar WhatsApp na arte" a sair para
fora do cartão e a sobrepor-se uns aos outros. O `Switch` desenha sempre o
rótulo visível, e quando a revisão passou a ter uma coluna lateral de 20 rem
esse texto deixou de caber.

`Switch` ganhou `labelHidden`: o rótulo é **escondido, não removido**. Um
interruptor sem nome acessível é um interruptor que ninguém com leitor de ecrã
consegue usar. E os contactos passaram a uma coluna, uma linha por canal — a
linha já começa com o nome do canal, e repeti-lo ao lado era redundante mesmo
quando cabia.

### A chamada para acção é removível

Nem toda a publicação pede uma acção: um anúncio institucional, uma mensagem
de festa, uma apresentação de marca. O campo aceitava texto e esvaziá-lo já
funcionava, mas isso não estava escrito em sítio nenhum — uma funcionalidade
que o cliente descobre por acidente não existe. Ganhou um botão "Remover da
arte" e, quando vazio, a nota "não aparece na arte".

### O que fica em aberto, e é honesto dizê-lo

No ensaio final o logótipo saiu **espelhado** — ".ꓷOT" em vez de ".DOT".
Nesse ensaio não enviei o ficheiro do logótipo, pelo que o gerador inventou a
tipografia a partir do nome da empresa. No fluxo real `buildReferences`
anexa-o quando `drawLogo` é verdadeiro, e nos ensaios anteriores com o
ficheiro anexado a marca saiu correcta.

Mas o episódio mostra o risco de frente: três instruções no prompt reduzem a
probabilidade de o logótipo ser redesenhado e não a eliminam. É por isso que
"Colar o meu ficheiro por cima" continua no ecrã de revisão — e é por isso que
tem de continuar.

## 53. Sem colagens por cima: o logótipo certo à primeira, e verificado

A §52 acabava a dizer que "Colar o meu ficheiro por cima" tinha de continuar.
Saiu, a pedido do cliente: o resultado parecia colado, e o logótipo caía em
cima do texto que o gerador tinha posto naquele canto. Os contactos colados
saíram pela mesma razão. A segurança que o interruptor dava passou a vir de
técnicas antes de gerar e de uma verificação depois.

Projectos antigos: `migrateFinish` só desliga as camadas quando ainda não há
arte. As artes antigas foram geradas sem logótipo, à espera da camada, e
perdê-la deixava-as sem marca. Uma geração nova grava sempre
`finish: { overlayLogo: false, overlayContacts: false }`.

### Antes de gerar: o que o gerador vê

1. **O ficheiro certo para o fundo** (`pickLogo`): luminância da cor
   dominante abaixo de 0,18 pede a versão para fundos escuros, se existir.
2. **Em primeiro lugar**, fora do tecto de cinco fotografias.
3. **Preparado no servidor** (`prepareLogoReference`): sem margens vazias,
   sobre um fundo liso que contrasta com ele, 14% de margem, 1024 px.
4. **Transcrito** (`readLogo`): "lê-se K · r · i · a · r, da esquerda para a
   direita" no bloco MARCA. Uma palavra soletrada é mais difícil de espelhar
   do que uma forma vista de relance.

Medir a preparação apanhou dois erros. O sharp aplica sempre o `resize` antes
do `extend`, seja qual for a ordem das chamadas: a margem era somada depois
da redução, e a referência saía com 1370 px. E um SVG a densidade fixa de 300
ficava com mais de 8000 px de lado. Agora são dois passos, e a densidade
calcula-se para cerca de 2048 px.

O erro maior estava no browser. `downscaleImageBlob` reduzia sempre para
JPEG, e o JPEG não tem transparência: um logótipo acima de 1024 px chegava à
IA com fundo preto. Um logótipo azul-marinho ficava invisível, e o gerador
reconstruía-o de memória. É a explicação mais provável para o ".ꓷOT"
espelhado da §52. Os logótipos passam a ir em PNG, na geração e no cadastro
da identidade. As rotas `/api/brand/identity` e `/api/brand/visual` recebem
também o logótipo preparado.

Ficou de fora o `input_fidelity: "high"` da OpenAI, que seria a técnica
directa: não está nos parâmetros que este modelo aceita pelo OpenRouter, e
um parâmetro não declarado devolve 400.

### Depois de gerar: verificar e corrigir uma vez

`/api/ai/review-art` compara a arte com o logótipo preparado, respondendo a
perguntas fechadas. A decisão de repetir é calculada no servidor, não pedida
ao modelo. Há repetição quando o logótipo falta, sai espelhado, com letras
trocadas, redesenhado, cortado, por cima de texto ou com texto acrescentado;
quando há conteúdo cortado pela aresta; ou quando o título sai errado.
Problemas menores de texto só se reportam. Há uma correcção no máximo, e
fica a tentativa com menor gravidade. Na calibração, com um logótipo certo,
um espelhado e um cortado, acertou 3 em 3.

Dois erros mataram a correcção em silêncio e foram corrigidos:

- **O limite do `correction`.** Era de 220 caracteres. Uma frase com a nota
  do verificador passava disso, o pedido de correcção respondia 400, e a
  correcção morria exactamente no defeito mais grave. Agora o limite é 400 e
  as notas cortam-se nos 160.
- **As notas rejeitadas por tamanho.** Uma nota ou descrição longa chumbava a
  resposta inteira, na verificação e na transcrição. A transcrição falhou
  assim uma vez em três leituras do mesmo ficheiro. Agora o texto livre é
  aparado, nunca rejeitado.

A transcrição também já não descreve o fundo. Antes dizia "logótipo sobre
fundo preto", e essa frase seguia para o prompt do gerador.

### O prompt quando não há ficheiro

A rota passava o `drawLogo` tal e qual. Com o logótipo ligado e sem ficheiro,
o prompt dizia "a imagem 1 é o logótipo", e a imagem 1 era a fotografia de
um produto. Agora o logótipo só existe no prompt quando o ficheiro vai
anexado. Sem ele não há bloco MARCA nem proibições sobre o logótipo, e as
regras de margem não o mencionam.

Uma transcrição que falha deixou de ser lida como "logótipo sem letras":
essa frase fazia o gerador apagar as letras. O campo `read` distingue os dois
casos. Com o tom desconhecido, a instrução de contraste fica neutra.

### Custo e tempo medidos

Uma geração com logótipo levou 107 s e custou 0,227 USD. A verificação levou
10 s, e a transcrição 4 a 5 s, uma vez por ficheiro (fica em cache). Com uma
correcção, o pior caso fica perto de 0,45 USD e 210 s.

### Interface

- **Painel ajustável** (`PanelResizer`): de 272 a 560 px, com o palco nunca
  abaixo de 480. A largura fica guardada em `kriar.editor.painel`. Funciona
  com setas, Shift, Home, End e Enter, e o duplo clique repõe 304. A faixa
  tem 16 px; a linha verde e a pega aparecem ao passar o rato.
- **O nome edita-se no caminho do topo.** Com o nome por omissão, o campo
  abre vazio, com a sugestão por baixo. Um rascunho com nome passa a valer a
  pena gravar.
- **Renomear e eliminar fazem-se no próprio cartão**, e as Definições usam
  `InlineConfirm`. Os diálogos que restam, só no cadastro, apareciam no
  canto: a base do Tailwind v4 põe `margin: 0`, e o `<dialog>` depende de
  `margin: auto`. Agora usam `m-auto h-fit` e ficam centrados ao píxel.
- **Cartões maiores**, com 13,5 rem de largura mínima, e com moldura 4:5
  igual para todos. Com a proporção de cada publicação, a grelha esticava o
  cartão mais baixo e deixava um vazio por baixo. Saiu também o "duplo
  clique renomeia": o primeiro clique abria o projecto.
- **Na revisão, a miniatura do logótipo** mostra-o sobre a superfície onde
  vai assentar. Antes, um logótipo escuro numa marca escura aparecia como um
  quadrado vazio.
- **Conta de exemplo.** `reloadBrand` usava uma conta de antes do
  `signUp`, e, pela leitura do código, o painel mandava para o onboarding.
  Agora vai buscar a conta à sessão quando o estado ainda não a tem. A conta
  de exemplo aterra em `/inicio`.

### Em aberto

A verificação reduz o risco, não o elimina. Um defeito que sobreviva à
correcção fica num aviso persistente, e o cliente pode gerar outra vez. O
ensaio de ponta a ponta com logótipo saiu fiel, e o verificador aprovou-o:
é uma amostra, não uma estatística.

## 54. Editar por zonas, versões e o estilo das artes da marca

Três pedidos: a barra de rolagem do painel de criação a verde, editar uma
arte já gerada marcando zonas, e aprender o estilo com as artes que a
empresa já publica.

### A barra de rolagem

Fica verde (`.scroll-neon`), e afastou-se 8 px da aresta do painel. Estava
por baixo da faixa do ajustador de largura: quem agarrava a barra para rolar
redimensionava o painel.

### Editar por zonas

"Editar uma zona" abre o modo de marcação sobre a arte final:

- um marcador translúcido, com um contorno em movimento e um número em
  cada zona;
- um cartão por zona, com o pedido, sugestões rápidas e uma imagem
  opcional ("troca por este produto");
- três tamanhos de pincel e até quatro zonas;
- desfazer e refazer traço a traço, sem apagar o que o cliente escreveu;
- atalhos: [ e ] mudam o pincel, Ctrl+Z desfaz o traço, Esc sai.

**Duas molduras.** O cliente pinta sobre a moldura do formato (4:5, por
exemplo) e o gerador edita o ficheiro guardado, que tem outra proporção
(3:4). A conversão usa a mesma geometria que desenha a arte
(`coverGeometry`). Com duas contas diferentes, a zona editada ficava
desviada da zona pintada.

**Cada zona chega à IA por três caminhos que dizem o mesmo:**

- o mapa: a arte com cada zona pintada de uma cor (magenta, ciano,
  laranja, violeta) e numerada;
- a posição por palavras;
- a cor nomeada no pedido.

A arte é a imagem 1, a que o gerador preserva melhor. O logótipo segue
preparado e transcrito, como na geração. As máscaras não vão ao gerador:
ficam no servidor.

**O gerador não edita, redesenha.** Mesmo instruído a mudar só uma zona,
devolve a imagem inteira refeita. Por isso a imagem nova só entra dentro
das zonas (`composeEdit`):

1. Alinha a imagem nova com a antiga, comparando só o que fica fora das
   zonas.
2. Acerta a cor com um ganho e um desvio por canal, dentro de limites
   apertados.
3. Compõe com uma máscara alargada e suavizada.

A máscara também cresce com o que mudou e está ligado à zona, até 8% da
largura. No primeiro ensaio real, o copo pedido saiu mais alto do que a
marcação e ficou com o topo cortado. Fora das zonas, a arte fica igual à
anterior; nos ensaios, a única diferença foi a da compressão JPEG.

Se a imagem nova não encaixa, o gerador recompôs a arte toda: em vez de
colar um bocado de uma imagem noutra, a aplicação tenta outra vez com a
correcção explícita. Também mede o que mudou em cada zona. Uma zona que
ficou igual é um pedido não feito, e isso é um facto de píxeis, não uma
opinião do verificador.

**A verificação de uma edição** compara o antes e o depois. Pergunta se
cada pedido foi feito, se ficaram marcas do mapa, se o logótipo ficou pior
e se mudou algo que não foi pedido. Há uma correcção automática no máximo,
a mesma regra da geração.

**Medido:** uma edição real levou 124 s e custou 0,236 USD. Encaixou com
escala 0,95, e a verificação aprovou-a em 4 s. Essa escala estava no limite
da procura inicial (±4%), por isso o alcance passou a ±10% de escala e ±5%
de deslocamento. Seis casos sintéticos com resposta conhecida encaixaram com
erro abaixo de 0,1%.

### Versões

O histórico vive em `composition.artwork.history`, com até 12 versões.
"Gerar outra" e cada edição guardam a versão anterior, em vez de a
apagarem. Desfazer uma edição desfaz também a entrada no histórico, porque
as duas vivem no mesmo sítio.

A faixa de versões abre uma comparação antes/depois com divisória. Repor
troca a versão actual com a escolhida, por isso é reversível. Os números
seguem a data de criação: no teste, numerados pela posição, mudavam
depois de cada reposição.

### O estilo das artes da marca

É o passo 2 do cadastro, opcional, e existe também num cartão na área
Marca. Vem antes da identidade de propósito: o estilo lido entra na
proposta de identidade.

- O cliente envia até 12 artes, lidas de uma vez pelo modelo de visão a
  768 px.
- A leitura separa ESTILO de CONTEÚDO. O estilo é tipografia, cor,
  composição, imagem, grafismos e tom do texto. O conteúdo é produtos,
  preços, promoções e pessoas.
- Ficam guardadas só as duas artes que melhor representam o estilo, com o
  tipo `reference`, que a base de dados já aceita.
- O perfil vive em `brand.identity.styleLearning`. Um campo de topo na
  marca seria descartado pela gravação no Supabase.
- Há um interruptor para desligar o estilo sem o esquecer, e "Esquecer"
  apaga as duas referências.
- Na área Marca, o cartão grava-se sozinho, sem apagar as alterações por
  guardar dos outros cartões.

**Para onde vai o estilo:**

- a proposta de conceito, para as ideias nascerem na linguagem da marca;
- a proposta de identidade;
- o prompt da arte: um bloco "ESTILO DA MARCA" e as duas artes como imagens
  com o papel `estilo-marca`, com a frase "não é para fazer igual". O
  conteúdo de cada uma vai também na lista negativa, para o gerador não
  devolver a promoção de uma arte antiga.

**Medido:** uma leitura real de 4 artes levou 15 s.

### Defeitos encontrados pelo caminho

- **Ctrl+Z dentro de um campo de texto** desfazia a última alteração da
  publicação, e o campo nunca desfazia a letra.
- **Mudar de publicação durante uma geração** gravava a arte na publicação
  aberta. A geração e a edição confirmam agora o projecto antes de gravar.
- **Contactos:** há sete canais e o limite era seis. Com todos ligados, a
  geração respondia 400. O limite passou a oito.
- **`max_tokens`:** sem tecto, o OpenRouter reserva o máximo do modelo
  (65 536) e recusa o pedido quando o saldo não cobre essa reserva. A
  leitura de estilo falhou assim. Agora o tecto é 16 000 por omissão,
  24 000 na identidade e 20 000 na leitura de estilo.
- **A arte e o painel das zonas lado a lado** decidem-se pela largura do
  palco (`@container`), não do ecrã: o palco muda com o ajustador do
  painel.

### Em aberto

- O saldo de imagem do OpenRouter acabou a meio dos testes. Até a conta ser
  carregada, gerar e editar falham com "sem saldo suficiente".
- As melhorias da composição (alcance maior, crescimento da zona) foram
  validadas só com casos sintéticos. Falta uma segunda edição real.
- O estilo aprendido foi validado com uma leitura real, mas no browser a
  leitura e a geração foram simuladas. Falta medir uma geração real com as
  duas artes de estilo anexadas.
- O crescimento da zona pode trazer um elemento vizinho que o gerador
  também redesenhou, se lhe tocar.

## 55. O cartaz de texto: porque a arte saiu sem imagem

O pedido "anuncia a Netflix em Angola, pagamentos rápidos em kwanzas no
nosso website", com uma captura de ecrã da página do produto anexada, deu
um cartaz: "Paga a tua Netflix em kwanzas" em creme sobre azul-marinho liso,
sem uma única imagem. O registo do servidor confirma que foi uma geração
real (80,7 s), não a prévia local.

### As cinco causas, todas confirmadas

1. **A ideia veio do modelo barato.** Reproduzido com o mesmo pedido, o
   `gpt-4o-mini` escolheu a abordagem tipográfica com a cena "fundo azul
   escuro com texto em amarelo muito claro". O gerador fez exactamente isso.
2. **O prompt da ideia empurrava para lá.** Oferecia "tipográfica" como uma
   abordagem igual às outras e dizia que a maioria das publicações se
   resolve com o produto bem fotografado. Um serviço digital não tem
   produto físico, e o modelo caiu no texto.
3. **A biblioteca de referências nunca chegou ao gerador como imagem.** Só
   viajavam as referências `segura`, e nenhuma das nove o é. O gerador
   recebia "aproveita a profundidade" por palavras, sem nada que lhe
   mostrasse o nível.
4. **O prompt da arte não exigia nada visual.** Tinha margens, texto exacto
   e logótipo fiel, só restrições. A forma mais segura de as cumprir todas
   é um cartaz de texto.
5. **As imagens do cliente não entravam na ideia.** A proposta só sabia
   quantas havia, e o gerador recebia a captura de ecrã descrita como
   "embalagem".

### O que mudou

- **A ideia vem do modelo criativo** (`resolveCreativeProvider`: GPT-5.4,
  configurável em `OPENROUTER_CREATIVE_MODEL`). Vê as imagens anexadas com
  as notas. Se falhar, segue o modelo barato, e a queda fica registada no
  servidor.
- **O nível de qualidade está no prompt da ideia.** Cada direcção tem um
  protagonista fotográfico, profundidade e luz desenhada, e um serviço
  digital mostra-se em uso. A abordagem tipográfica fica só para quando o
  cliente a pedir. Do lado do servidor, uma direcção tipográfica não é
  escolhida se o pedido não falar disso.
- **A validação da ideia tolera em vez de rejeitar.** A primeira resposta
  do GPT-5.4 foi recusada inteira porque as três ideias traziam técnicas
  inventadas ("mockup-fotografico-de-dispositivo"), e a rota caiu em
  silêncio no modelo barato. Agora as técnicas desconhecidas são
  descartadas, os textos longos aparados e uma abordagem desconhecida passa
  a "produto-em-contexto". O prompt também passou a listar as técnicas
  aceites.
- **Regra 7: o serviço anunciado aparece nos textos.** O modelo criativo
  escreveu "Paga a tua subscrição em kwanzas", sem "Netflix".
- **As referências viajam como imagens**, todas menos as `nunca`, no
  máximo duas. Cada uma leva ao lado o que se aproveita e o que não se
  copia dela.
- **Na selecção, o estilo pesa como uma técnica** (+3 em vez de +6). Com
  +6, o estilo "vibrante" trazia o Dia da Mulher e o puzzle de bandeiras
  para um anúncio de pagamentos da Netflix.
- **O prompt da arte tem um nível mínimo.** O bloco "NÍVEL DE ACABAMENTO"
  pede uma imagem protagonista em pelo menos metade da arte, profundidade e
  luz desenhada, e proíbe o cartaz de texto sobre fundo liso, também na
  lista negativa. Não se aplica a uma direcção tipográfica.
- **As imagens do cliente têm o papel certo.** Um produto entra com a
  embalagem real; uma captura de ecrã entra no ecrã de um dispositivo da
  cena.

### Medido

O mesmo pedido, de ponta a ponta. O logótipo foi recortado de uma
referência e a captura de ecrã foi simulada, porque os ficheiros do cliente
estão no browser dele.

- A proposta levou 39 s com o GPT-5.4: uma mão a segurar o telemóvel com a
  página real, cidade desfocada ao fundo.
- A arte levou 97 s e custou 0,243 USD. Seguiram 4 imagens: logótipo,
  captura de ecrã, ref1 e ref9.
- O resultado é uma fotografia com profundidade, luz de recorte, a página
  no ecrã e o logótipo correcto.

### Em aberto

- Um projecto que já tem uma ideia antiga continua com ela. É preciso
  carregar em "Actualizar proposta" ou "Outra ideia" para a substituir.
- O preço lido na captura de ecrã é retirado pelos guardrails, que só
  confiam no texto do pedido.
- Não medi o custo exacto de uma proposta com o GPT-5.4.
- Com as referências a viajar como imagem, volta o risco de cópia. A lista
  do que não se copia vai ao lado de cada imagem, mas só foi confirmada
  neste ensaio.

## 56. Várias empresas, a biblioteca da marca, a memória e o website que faltava

Seis pedidos de uma vez, e uma ideia do cliente discutida antes de se
implementar.

### A ideia: enviar todas as artes em cada pedido

O objectivo ficou — as artes de uma empresa têm de comunicar entre si. O
meio não, por quatro razões:

- o gerador aceita um número fixo de imagens por pedido, e a Kriar já ocupa
  até dez (logótipo, anexos, referências);
- com muitas imagens, o gerador faz a média delas e a ideia do post perde
  força;
- cada imagem a mais é mais uma oportunidade de copiar conteúdo;
- reenviar artes geradas amplifica os defeitos delas.

O que foi feito em vez disso:

- **Biblioteca da marca** (`styleLearning.references`, até 24 artes): as do
  cadastro e as que o cliente aprova no editor em "Usar como referência da
  marca". Só pelo botão — uma arte descarregada não entra.
- **O perfil em texto é relido** sempre que a biblioteca muda
  (`readLibrary`), com o perfil anterior como contexto. É o perfil que leva
  a biblioteca inteira a todos os pedidos.
- **Como imagem seguem duas ou três** (`pickLibraryArts`): pelo formato,
  pelas palavras do tema e em rotação — a arte usada na geração anterior da
  marca perde pontos. As da própria publicação ficam de fora.
- **A arte aprovada guarda-se na moldura** em que foi vista, e o que ela
  mostra (título, produtos, preço, cena) vem da revisão: é a lista do que a
  próxima arte não pode copiar.

### Memória da empresa

O uso regista acontecimentos — o que se pede numa edição por zonas, a ideia
recusada com "Outra ideia", a arte descarregada, a arte aprovada, o texto
que o cliente reescreveu em relação ao que a IA propôs (`proposed`). A cada
quatro novos, um modelo de texto (`/api/brand/memory`) reescreve as regras
aprendidas, até oito, sem tocar nas do cliente nem repetir as que ele
apagou. As regras entram na ideia e na arte, e estão todas na área Marca:
corrigem-se, apagam-se e escrevem-se à mão.

### O website (5) e o que "gerou por baixo"

As duas coisas tinham a mesma origem.

1. **O website nunca entrava por omissão.** Só os contactos com a caixa
   marcada, e o website, na maior parte das marcas, nem é um contacto: é o
   campo dos dados da empresa. Agora entra sempre, em primeiro, e pode
   tirar-se numa publicação. As publicações antigas ganham-no uma vez
   (`websiteDefaulted`).
2. **O prompt pedia os contactos "pequenos e discretos no rodapé".** O
   gerador obedeceu: escreveu-os minúsculos, colados à aresta de baixo.
3. **A moldura cortava-os.** A publicação de Instagram (4:5) é pedida em 3:4
   aos modelos da OpenAI e assenta em `cover`: perdem-se cerca de 4% em cima
   e em baixo. A "margem de 8% da largura" valia na imagem do gerador, não na
   publicação. Era a meia linha por baixo do botão.
4. **O verificador não o via**, porque recebia a imagem inteira do gerador.

O que mudou:

- as margens são calculadas para a imagem do gerador já com o recorte
  (`safeMargins`): 11% da altura em cima e em baixo e 10% dos lados no
  formato de Instagram;
- os contactos são obrigatórios, legíveis num telemóvel, acima da margem de
  baixo, e o website "tem de se ler à primeira";
- o verificador recebe a arte NA MOLDURA (`framedArtDataUrl`) e responde
  contacto a contacto (aparece, está exacto, lê-se). Qualquer falha dá a
  correcção automática, que continua a ser uma só.

### Opções cortadas (6)

A barra da comparação vivia por baixo da arte, e a moldura era calculada com
`100dvh − 15,5rem` — uma estimativa. Um aviso no topo do editor, ou a barra
a partir em duas linhas, chegava para "Repor esta versão" sair do ecrã.
Agora "Fechar" e "Repor esta versão" estão na barra de baixo, e a moldura
cabe na altura MEDIDA do palco (`ResizeObserver`). Os avisos passaram para
cima, à direita: em baixo tapavam a barra de acções durante quatro segundos.

### Recriar uma arte existente (2)

Cada anexo tem um tipo: "Foto ou produto", "Captura de ecrã" ou "Arte para
recriar". A última não entra na arte — é o modelo: mantém-se a composição, a
hierarquia e o tipo de cena; troca-se o logótipo, o nome, as cores, os
textos, os produtos, as pessoas e as fotografias. Está nos dois prompts, na
lista negativa, e o verificador compara com a original para confirmar que
nada disso passou. Uma arte tipográfica a recriar pode sair tipográfica.

### Várias empresas (1)

Uma conta tem várias empresas, cada uma com a sua marca, projectos,
biblioteca e memória. O selector está no topo, ao lado da marca da Kriar,
com o nome sempre à vista; "Nova empresa" abre o cadastro, e sair dele sem
nome não deixa um registo vazio. Uma publicação aberta por ligação muda a
empresa activa para a dela. Na área Marca apaga-se uma empresa, com as
publicações, desde que fique outra.

Dois defeitos encontrados pelo caminho:

- "Carregar dados de exemplo" escrevia a Perfumaria Kianda por cima da
  marca do cliente (o mesmo identificador). Agora é mais uma empresa.
- No Supabase, `brands.id` era `uuid` e a aplicação gera `brd_…`: a primeira
  gravação de uma marca falhava. `0003_empresas.sql` passa-o a texto, retira
  o índice único e apaga os projectos com a empresa.

### Verificado

- `tsc`, `eslint` e `next build` sem erros.
- Ensaio no Chrome sem custo, com as rotas de IA simuladas na página: 24
  verificações, todas certas — selector, cadastro de empresa nova, projectos
  por empresa, website nas publicações antigas, anexo a recriar, arte na
  moldura 4:5 para o verificador, "Repor esta versão" dentro do ecrã em
  1440 × 900 e 1180 × 680, aprovação para a biblioteca, rotação, memória com
  quatro acontecimentos, área Marca.
- Uma geração real (93 s, 0,207 USD), pedido de streaming da DOT sem
  logótipo: o website e o WhatsApp saíram inteiros, legíveis, acima da
  margem de baixo, e a verificação na moldura não encontrou defeitos.

### Em aberto

- A migração `0003_empresas.sql` não foi aplicada a um Supabase real; a
  aplicação continua em IndexedDB neste ambiente.
- A leitura da memória e a releitura da biblioteca foram verificadas com
  respostas simuladas; as rotas reais não correram neste ensaio.
- Apagar uma empresa apaga as publicações, mas os ficheiros delas ficam no
  armazenamento, como já acontecia ao apagar uma publicação.

## 57. O esboço na revisão, as grelhas e as referências parecidas

O pedido: "logo junto das bordas sem espaço, site acima do logo, preço no
celular em dólares, imagem genérica" — e, na revisão, um esboço da arte com
um painel do que ela vai ter; "Outra ideia" sempre original; e, como
referência enviada com o pedido, as artes da biblioteca mais parecidas com a
ideia escolhida.

### O esboço

Seis grelhas (`layouts.ts`), tiradas das artes da biblioteca. A ideia escolhe
uma, as três ideias usam grelhas diferentes, e o cliente troca-a no selector
da revisão. `computeSketch` dá a geometria em píxeis da publicação, com as
fontes reais, e serve três leitores com a mesma geometria:

- o cliente: a prévia, com os textos, o logótipo e os contactos verdadeiros;
- o gerador: uma imagem cinzenta sem palavras (papel `esboco`), na proporção
  dele, com a moldura da publicação ao centro;
- o prompt: `describeSketch`, zona a zona, com as distâncias às arestas
  medidas na imagem que o gerador desenha.

Regras da geometria: a imagem fica com a região dela sem tocar no texto
(`clearOf`); o título encolhe primeiro, o resto até três quartos; o preço
nunca passa de quatro quintos do título; o logótipo nunca é mais alto do que
a margem. Rejeitado: caixas livres desenhadas pelo modelo de texto (geometria
pouco fiável) e só palavras (o gerador já ignorava as margens ditas por
extenso).

### Três gerações reais, e o que cada uma mudou

| | Grelha e logótipo | O que saiu | Custo |
|---|---|---|---|
| 1 | título em cima, logótipo em baixo | título e botão no sítio; logótipo e contactos descidos para a aresta. O verificador reprovou o título por «Kianda» e, na correcção, por «KIANDA» | 0,512 USD (2 imagens) |
| 2 | texto à direita, logótipo em cima | limpa, sem defeitos na verificação; inventou o rótulo «KIANDA EAU DE PARFUM» e um cartão com texto | 0,249 USD |
| 3 | título em cima (forçada), logótipo em baixo | logótipo cortado, os três contactos fora da moldura, arte partida em dois painéis; na correcção, «CLAUDE» no frasco — uma palavra da referência | 0,514 USD (2 imagens) |

1,27 USD em imagem, mais as leituras de texto e de verificação, que não foram
medidas. A partir daqui os ensaios de geração são do cliente; os meus correm
com as rotas de IA simuladas no browser.

O que mudou por causa delas:

- **Os contactos passaram para o bloco de texto, por baixo do botão.** O
  gerador segue o título, o botão e um logótipo em cima; tudo o que é rodapé
  desce para a aresta da imagem dele, que a moldura 4:5 ainda corta. Subir a
  linha do rodapé 5% no esboço (ensaio 3) não mudou nada.
- **Logótipo em cima por omissão**, em todas as grelhas. Em baixo fica como
  escolha do cliente, e o verificador corrige se sair cortado.
- **O protagonista do esboço é uma mancha de contornos suaves**, não uma caixa
  com uma cruz, que o gerador leu como um painel (ensaio 3). O prompt diz que
  a arte é uma fotografia contínua por trás do texto.
- **Com esboço, o prompt deixa de levar a "composição" e a "hierarquia" livres
  do modelo criativo**, que o contradiziam ("primeiro o preço", "contactos em
  cima à direita").
- **As proibições das referências vão presas aos exemplos.** Soltas, a lista
  negativa de uma ideia com uma mulher dizia "não incluir: a mulher". As de
  cor saem: "a cor azul" de uma arte da DOT ia para uma marca azul-escura.
- **As palavras escritas numa referência não são texto da arte** (o «CLAUDE»).
  Os objectos que a cena acrescenta ficam lisos; os produtos do cliente
  mantêm o rótulo real.
- **Textos**: o título não repete o nome da empresa, que o logótipo já mostra;
  o botão é uma acção, sem número nem site. Está no prompt e num guardrail do
  servidor ("Encomenda pelo WhatsApp: +244 923 000 000" passa a "Encomenda
  pelo WhatsApp").
- **Originalidade**: o produto sozinho num pedestal ou num balcão com uma loja
  desfocada atrás é cliché — foi a ideia do ensaio 1 —, e a ideia escolhida é
  a de ângulo mais forte que ainda se percebe, não a mais segura.

### Preços e ecrãs

Só kwanzas, também dentro de um ecrã (regra 8 das ideias). Um ecrã da cena
mostra os logótipos dos serviços, imagens do serviço ou a captura do cliente —
nunca preços nem texto inventado. `prices.invented` no verificador dá
correcção.

### O verificador mede, além de julgar

- `edgeGap`, `topGap` e `bottomGap`: no ensaio 3 o logótipo tocava na aresta e
  a resposta tinha sido "cutOff: false, tight: false"; com as medidas deu 0, e
  a correcção correu.
- O título decide-se pela transcrição (`headlineSeen`), sem contar maiúsculas.
- Os "problemas" que dizem que está tudo certo («sem diferenças relevantes»)
  deixam de aparecer ao cliente.
- Defeitos menores — texto encostado à aresta, texto a mais, uma cena copiada
  de um exemplo — dizem-se ao cliente, mas sozinhos não pagam outra geração.
- `sketch.visible` (restos do esboço na arte) e `prices.invented` dão
  correcção.

### Em aberto

- A mancha suave e os contactos no bloco de texto não passaram por nenhuma
  geração real.
- A arte partida em painéis apareceu numa geração em três.
- O formato de Instagram continua a ser pedido em 3:4: este modelo recusa 4:5
  (400, sem custo; aceita 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16 e 21:9).

## 58. Seis correcções e o segundo lote de referências

### "Conteúdo gerado por IA" (1)

O PNG que o gerador devolve traz um manifesto C2PA num bloco `caBX`
("trainedAlgorithmicMedia", "OpenAI"), visto num ficheiro real. É o que as
redes lêem. O "Descarregar PNG" já redesenhava a arte no canvas e saía sem
ele; a cópia guardada não, nos formatos em que o gerador devolve a largura
certa (quadrado, story, reels) — e é essa que a prévia mostra e que o botão
direito do rato guarda. Agora tudo o que vem do gerador (geração, edição e
fundo) é redesenhado ao entrar: guardam-se só os píxeis.

Limites: uma marca de água nos próprios píxeis (o SynthID dos modelos da
Google, se o modelo mudar) sobrevive a qualquer redesenho; e as regras de
cada plataforma sobre divulgar conteúdo gerado por IA continuam a valer.

### "Adicionar produto buga o site" (2)

`onClick={onAdd}` passava o evento do clique a `addItem`, que o gravava como
nome do produto. A revisão rebentava a seguir em `item.name.trim()`, e sem
nenhuma fronteira de erro a aplicação inteira desaparecia. Corrigido no botão
e no armazém (só um texto vira nome); `migrateProject` repõe os nomes que não
sejam texto; `(painel)/error.tsx` segura um erro de desenho na própria
página. Havia ainda dois limites: 6 produtos na revisão e 5 no armazém (o
tabuleiro do modelo antigo), e o botão aparecia sem o clique fazer nada.
Agora é `APP.itemCapacity`, um número só.

### "Criar" depois de apagar o projecto (3)

Quatro causas que se somavam:

- a página de criação redireccionava com os valores do desenho anterior — os
  do último projecto aberto. Agora só redirecciona para o rascunho que ela
  própria começou;
- apagar não tirava o projecto do editor. Agora `teardown`, também quando se
  apaga a empresa dele;
- uma gravação pendente voltava a gravar o projecto apagado, e uma gravação
  antiga a terminar marcava o rascunho novo como gravado;
- abrir um projecto que já não existe deixava o anterior na memória.

`startDraft` e `load` passaram a gravar a alteração pendente, em vez de a
deitarem fora.

### Marca (4)

Quatro separadores — Empresa, Identidade, Biblioteca, Memória —, com o
separador no endereço (`?separador=`). O cabeçalho fica preso ao topo, com o
logótipo, os factos, as cores, o estado e o Guardar. O cartão "Resumo", que
repetia os outros, saiu, e "Apagar esta empresa" passou para o fim de
Empresa. Um ponto verde diz onde há alterações por guardar; Biblioteca e
Memória gravam-se sozinhas e nunca o têm. Em 1440 × 900 a página rolava
3052 px; agora rola 1196 px em Empresa e nada nos outros três.

### "Enviei várias artes, só carregaram duas" (5)

Era assim por desenho: a leitura escolhia duas (`Math.min(2, …)` no
servidor, `picks.slice(0, 2)` no browser) e só essas se guardavam. Agora a
leitura ordena todas e descreve o conteúdo de cada uma, e ficam todas, até às
24 da biblioteca (com aviso das que ficarem de fora). As duas primeiras levam
`featured`, +0,75 na escolha das que seguem como exemplo. Se o modelo
devolver menos entradas do que artes, o servidor completa pela ordem — e
essas ficam sem a descrição do conteúdo.

### O menu do cartão (6)

Abre para cima, por cima da miniatura, e só abre para baixo quando o cartão
está quase no topo do ecrã.

### O segundo lote de referências

`ref10` a `ref30`, sem `ref17` nem `ref29`, de propósito. Entram por
`curated` (descritas pelo administrador, revisíveis mudando o `status`), com
dois campos novos: `cautions`, os cuidados, que vão no prompt ao lado da
referência; e `sectors`, informação para quem revê, nunca um filtro. Treze
seguem como imagem (`com-cuidado`) e seis só por palavras (`nunca`): as de
objecto-metáfora — foguetão, bússola, espiral de notas, diamante, calendário,
moeda —, que o gerador copiaria. O conversor aceita JPG e só converte o que
falta, e as versões reduzidas entram no pacote da rota de geração.

- Cada escolha grava o porquê (`ReferenceUsage.why`: os pontos, a grelha, o
  protagonista, as técnicas), além do que se aproveita (`take`). Nunca vai
  para o gerador.
- As regras de diversidade estão no catálogo e no prompt das ideias:
  crescimento não pede foguetões, planeamento não pede um calendário,
  estratégia não pede uma bússola, premium não pede diamantes, tecnológico não
  pede néon, profissional não pede um render 3D. Com mais de um exemplo, a
  arte segue uma linguagem só.
- O verificador recebe o que os exemplos mostravam e diz quando a arte lhes
  repete a cena (defeito menor).

### Verificado

- `tsc`, `eslint` e `next build` sem erros.
- Ensaio no Chrome com todas as rotas de IA respondidas no próprio browser —
  nenhuma chamada chegou ao servidor, custo zero —: 30 verificações, todas
  certas. Esboço nas duas grelhas (nada por cima da imagem, contactos por
  baixo do botão, logótipo com folga, tudo dentro da moldura); o porquê de
  cada referência; "Acrescentar opção"; nenhum C2PA na cópia guardada nem no
  PNG descarregado, com um manifesto falso posto na arte simulada; "Criar"
  depois de apagar o projecto aberto; o menu do cartão em 1440 × 900 e em
  1024 × 514; a biblioteca com cinco artes enviadas.

### Em aberto

- Nenhuma geração real correu com estas mudanças.
- A leitura real da biblioteca com doze artes não correu: o modelo pode
  devolver menos de uma entrada por arte.

## 59. A revisão em planta, o design das artes e a cor de base

Doze pedidos numa lista (com dois "9" e dois "10"). O fio que os junta: a
revisão mostrava demais e a arte desenhava de menos.

### A página de entrada (0)

`src/app/page.tsx` passou a ser a página de entrada animada, com as dez
secções pedidas (`src/components/landing/*`, textos em
`src/lib/landing/content.ts`, planos em `src/config/plans.ts`). A planta da
secção "A IA propõe. Tu decides." (`landing/Blueprint.tsx`) inaugurou a
linguagem que a revisão adoptou a seguir. Em desenvolvimento,
`/?vista=producao` aplica as regras de produção, para o dono ver o que um
visitante vê.

- As artes de demonstração estão a `null`: têm de ser geradas na própria
  Kriar, pelo dono, e registadas em `src/lib/landing/demos.ts` (os passos
  estão no topo do ficheiro). Até lá, em desenvolvimento, cada lugar mostra
  a planta com o carimbo "Arte por gerar" e o ficheiro que falta; em
  produção, só onde uma planta faz sentido, com "Demonstração". Nenhuma arte
  foi inventada.
- Planos e testemunhos estão vazios de propósito: preços e opiniões não se
  inventam.
- A confirmação de email do registo passou a levar a `/onboarding`.

### Avisos mais calmos (7)

Os avisos eram caixas cheias de amarelo e azul, a gritar coisas que não
pediam acção. `Callout` passou a ter uma marca pequena (`NoticeMark`) e uma
barra fina de tom (`NoticeBar`), com tamanho, papel e ícone; o `Badge`
neutro ganhou um ponto de tom e o tamanho `sm`; o `Toast` e a pílula do
`AppShell` seguem o mesmo desenho. Ficaram restilizadas as caixas do editor
(painéis, campos em falta, capacidades do modelo, nota de direcção, zonas).

### A identidade só a pedido (8)

Carregar o logótipo gerava logo a identidade, antes de o cliente acabar de
preencher. Saiu o disparo automático (`onLogoFile`); o cliente preenche tudo
e carrega em "Gerar a identidade da marca" (`IdentityGenerate.tsx`), depois
"Gerar de novo com estas alterações" ou "Gerar outra proposta".

### A revisão: uma planta, e menos para ler (1, 2)

"O preview da ideia é muito feio. Quero um preview técnico." O esboço com
as palavras e as cores verdadeiras tentava parecer uma arte e não
conseguia. Passou a PLANTA (`ReviewBlueprint.tsx`): a geometria de
`computeSketch` — a mesma que o gerador recebe — desenhada como um desenho
técnico. Quadrícula, margem tracejada com cota, a imagem com tracejado de
corte e cruz de centro, as linhas de texto como barras do comprimento real,
o botão e o logótipo como contornos, a cota da largura do logótipo. Nenhum
texto verdadeiro, nenhuma cor da marca. Os contactos levam o ícone de cada
canal: vê-se onde vai o WhatsApp e onde vai o website.

Ao lado da planta, tudo o que decide onde fica cada coisa
(`ReviewDisposition.tsx`): as seis grelhas em miniatura (`LayoutPicker`,
das mesmas regiões), a posição e o tamanho do logótipo, os contactos no
texto ou no rodapé, a cor de base. A zona que um controlo mexe pisca a
verde; escrever não pisca nada.

Saiu da revisão o que o cliente "nem precisa de saber": a cena, o
protagonista e a luz por extenso, as referências que seguem com a arte e a
contagem da biblioteca — continuam a ir para o gerador. Os cinco cartões
numerados passaram a secções leves; as notas debaixo de cada campo, a dicas.
A ideia vem em duas frases curtas (o prompt das ideias pede até 16 palavras
e uma razão até 20).

"Melhorar a ideia" substituiu "Ajustar a ideia a dedo". Aquele campo punha
uma frase solta do cliente a mandar no gerador por cima da direcção inteira.
Agora o pedido ("mais luz natural, o produto maior") volta ao modelo
criativo com a ideia actual (`refinement`, `currentIdea`, `currentTexts`),
que devolve UMA direcção: a mesma, melhorada. Os textos e os produtos ficam,
salvo se o pedido falar deles (`mentionsTexts`, `mentionsItems`); a grelha
escolhida à mão fica; as alternativas guardadas ficam (são as ideias que o
cliente ainda não viu). A melhoria entra na memória da marca como
`melhoria`.

### O indicador (3, 4)

Dizia "A procurar outra ideia" na primeira proposta. Os passos passaram a
vir do store (`WorkPhase.steps`), pelo caminho: "A ler o teu pedido" →
"A formular a ideia"; "A formular outra ideia"; "A ler o que pediste" →
"A melhorar a ideia". O segundo passo acende quando as imagens anexadas
acabam de ser lidas — uma transição real, como o resto do indicador.

O indicador ficou opaco e o ecrã de baixo `invisible` e `inert`: os dados da
proposta anterior já não se vêem através da animação. Montado e não
desmontado, para nada se perder se a operação falhar.

### O botão que voltava (5)

"Pedi para remover o CTA e ela gerou com CTA." `setText` apagava o campo
vazio, e o plano seguinte preenchia-o de novo — `applyPlan` só respeita o
que está protegido. Um texto retirado fica agora protegido e vazio (com o
que a IA propôs guardado, para o "Repor"). Quatro barreiras: o pedido do
plano leva `removedTexts` e o prompt manda devolvê-los vazios; a rota limpa-os
na mesma; o prompt da arte diz "sem chamada para acção" uma vez, tira o
botão de todas as outras frases e põe "botões" na lista negativa; e o
verificador pergunta se há botão (`noCta` → `button.present`), o que paga a
correcção. O título é a excepção: apagado, é um título por escrever.

### O design das artes (6, 10, "não vejo comunicação nas artes")

A causa estava no prompt da arte. Pedia "UMA fotografia contínua"; proibia
painéis, caixas, blocos de cor, colagens e "caixas aplicadas por cima";
mandava o texto assentar "numa zona calma da própria imagem". Sobrava o que
o cliente viu: uma fotografia com o título, o logótipo e o botão por cima.

- Cada ideia traz agora o seu DESIGN (`graphics`): dois ou três recursos —
  como a fotografia assenta no fundo (recortada sobre a cor de base, dentro
  de uma forma da marca, ou inteira com uma zona calma), a forma que liga o
  texto à imagem, a tipografia como elemento. As cores pelo papel, nunca
  pelo nome; as três ideias com tratamentos diferentes.
- O prompt da arte tem um bloco "DESIGN DA PEÇA — um anúncio desenhado, não
  uma fotografia com texto por cima", com um design por omissão para ideias
  antigas.
- As proibições que matavam o design saíram; ficou o defeito real, dito
  como defeito: "arte partida em duas metades sem ligação entre elas",
  "caixas cinzentas genéricas por trás do texto", "enfeites soltos sem
  função". "Molduras decorativas" passou a "à volta da arte".
- Os exemplos da biblioteca passaram de "exemplo de acabamento — nada do
  conteúdo dela entra" a "EXEMPLO DE DIRECÇÃO ARTÍSTICA": segue-se a
  linguagem gráfica; a disposição vem do esboço e o conteúdo desta
  publicação. Com a frase antiga o gerador punha-os de lado por inteiro, e
  "nenhuma das três artes segue o padrão das referências".
- TIPOGRAFIA pelo nome: "título numa serifada como a Playfair Display".
  Pode destacar uma palavra, sem mudar uma letra.

As artes a preto e branco: a regra era "nas superfícies, no texto e nos
realces usa SÓ as cores da marca", e uma marca a preto e branco recebia a
fotografia a preto e branco também. Agora as cores da marca pintam o
design (fundo, formas, texto, botão) e a fotografia tem cor natural,
afinada à base. Marca quase sem saturação (`isMonochromeBrand`) → uma linha
própria; e "fotografia dessaturada ou a preto e branco" entra na lista
negativa, salvo se o estilo aprendido da marca for esse.

`describeColor` passou a dizer "creme" e "castanho". Um creme saía "laranja
muito claro" — na amostra da revisão e no prompt.

### O logótipo grande (9)

Ia a 19% da largura no esboço e o prompt pedia 15 a 20%. Agora há três
tamanhos (`LOGO_SIZE_SHARE`, num módulo puro para o esboço e o prompt
dizerem o mesmo): pequeno 10%, médio 13%, grande 17%, com um tecto de altura
para os quase quadrados; pequeno por omissão. O prompt diz "uma assinatura,
nunca maior do que o título" e o tecto do tamanho escolhido. O verificador
mede (`logo.widthShare`): acima de 20% avisa, acima de 28% corrige.

### A cor de base (9b)

`Composition.base`: a principal ou a secundária da marca, a que pinta o
fundo e as grandes áreas; a outra é o realce (ou a terceira, se se
distinguir mais da base). Sem escolha do cliente, é a oposta da última
publicação da marca com arte (`brandHistory.recentBase`) — branca, preta,
branca, preta, como o cliente descreveu. A escolha fica (`baseChosen`). A
base decide também o logótipo: uma publicação creme de uma marca
azul-marinho leva a versão para fundos claros. Um terceiro botão
"Automática" ficou de fora: a alternância é o comportamento por omissão, e
três opções para duas cores pesavam na revisão.

### Os contactos no rodapé

Voltou como escolha (`contactsPlacement: 'rodape'`), com o texto por baixo
do botão a continuar por omissão: foi o único sítio que o gerador respeitou
em três testes reais. No rodapé, a linha fica ao lado do logótipo quando ele
vai num canto de baixo, por cima dele quando vai ao centro, e sozinha na
margem nos outros casos; nunca parte um contacto ao meio. O prompt avisa do
erro habitual (descê-los até à aresta).

### Verificado

- `tsc`, `eslint` e `next build` sem erros.
- Ensaio no Chrome com todas as rotas de IA respondidas no próprio browser —
  nenhum pedido a `/api/ai` nem a `/api/brand` chegou ao servidor (confirmado
  no registo do servidor), custo zero —: 42 verificações, todas certas. A
  planta sem textos nem cores da marca, com os três contactos e os seus
  ícones; grelha, tamanho do logótipo (10% → 17%), contactos no rodapé e cor
  de base a mexer na planta; "A formular a ideia" como passo activo; o ecrã
  de baixo invisível e inerte; o botão retirado continua retirado depois de
  "Actualizar proposta" com um plano que o devolve; "Melhorar a ideia" com o
  pedido, a ideia e os textos certos, e os textos intactos depois; o pedido
  da arte com a base, o tamanho, o rodapé, a tipografia e o design; o da
  verificação com `noCta`.
- Os prompts novos (arte e ideia) foram montados com dados de exemplo e
  lidos por inteiro, sem chamar nenhum fornecedor.

### Em aberto

- Nenhuma geração real correu com estas mudanças. O que mais importa ver: se
  o gerador desenha mesmo o design pedido (formas, recorte sobre a base)
  sem voltar à arte partida em dois painéis; se a fotografia mantém a cor
  numa marca a preto e branco; e o tamanho real do logótipo.
- As artes de demonstração da página de entrada, os planos e os
  testemunhos.
- Uma notificação aberta com um diálogo à frente fica por trás do fundo do
  diálogo.

## 60. A primeira dobra: duas faixas de artes

Primeiro passo da arrumação da página de entrada, a partir de uma imagem de
referência e de um componente de exemplo (título à esquerda, duas faixas de
imagens a deslizar em sentidos opostos à direita, chamada que baralha as
letras ao passar por cima).

- **O que se vê primeiro passou a ser o resultado.** A demonstração animada
  em cinco passos (`HeroDemo`) saiu da primeira dobra — o ficheiro fica, sem
  uso, para quando o processo voltar a outra secção; a página ficou 5 kB
  mais leve. No lugar dela, oito artes feitas com a Kriar.
- **O fundo é o de sempre**: o campo de pontos verdes com pulsos e o véu por
  trás do texto.
- **Texto**: o título continua "Artes à altura da tua marca."; o parágrafo
  passou a duas linhas curtas, como na referência; a chamada é uma pílula
  ("Criar a minha primeira arte"). "Ver como funciona" saiu daqui — está na
  barra do topo.

### As faixas (`HeroMarquee`, `Marquee`)

Duas cópias da mesma fila, a deslizar juntas, só em CSS (`.lp-marquee`);
a segunda é `aria-hidden`, para um leitor de ecrã ler cada arte uma vez.
Com menos movimento pedido pelo sistema, ficam paradas.

- Cada arte fica com a sua proporção (4:5 e 3:4), em vez do quadrado da
  referência: uma publicação cortada num quadrado perdia o título.
- A ordem das artes (`src/lib/landing/heroArts.ts`) alterna claras e
  escuras; no arranque, as duas faixas alinhadas fazem um xadrez.
- Com menos de quatro artes por faixa, completa-se com plantas — nunca com
  a mesma arte repetida.
- As arestas desvanecem (7%) em vez de cortarem a direito.

### As artes (`src/hero arts/`)

Importadas e não servidas de `public/`: o `next/image` sabe as medidas de
cada uma (nada salta), gera as versões reduzidas e o desfoque de espera, e
um ficheiro que falte parte a compilação em vez de partir a página.
`scripts/converter-hero.mjs` converte os PNG e JPG da pasta para WebP
(até 900 px de largura); os sete PNG de ~2 MB ficaram entre 65 e 146 KB.
Os originais ficam na pasta.

### A chamada que baralha (`HeroStart`)

Três correcções ao componente de exemplo:

- a largura não mexe: o texto verdadeiro, invisível, dá o tamanho, e o
  baralhado desenha-se por cima, posicionado. Na mesma célula da grelha
  contava para a medida, e o botão alargava 30 px a meio do efeito;
- meia letra por passo em vez de um terço: com as 27 letras desta chamada,
  ficava ilegível quase dois segundos e meio (agora cerca de 1,6 s);
- um leitor de ecrã ouve sempre o texto certo (`aria-label`); baralha
  também ao receber o foco pelo teclado, e não baralha com menos movimento
  pedido.

### Verificado

`tsc`, `eslint` e `next build` sem erros. No Chrome, em 1440 × 900,
1280 × 720 e 390 × 844: as oito artes carregadas pelo `next/image`, as duas
faixas em sentidos opostos, nada a sair da largura do ecrã, a largura da
chamada igual antes, durante e depois do efeito, sem erros na consola e sem
nenhum pedido de IA.

## 61. A segunda secção: a marca em partículas

Segundo passo da arrumação da página de entrada, a partir do componente
"Sculpture Hero" (de guglielmogiannattasio.it): uma escultura feita de
dezenas de milhares de partículas, que o cursor desfaz em líquido e que
volta sempre a assentar. O pedido: a mesma animação, no verde da página, a
contar que a Kriar usa os dados da empresa e monta com eles um sistema de
design de onde saem todas as publicações.

- **Substitui os exemplos** (`Gallery`). O ficheiro fica, sem uso, como o
  `HeroDemo` (§60). Na barra do topo, "Exemplos" aponta agora para
  `#demonstracao`; o aviso de desenvolvimento só conta as demonstrações que
  a página ainda mostra.
- **Texto**: "Conhecemos a tua marca / antes de criar." (a segunda linha a
  néon). O parágrafo diz o que acontece aos dados: analisamos o logótipo, as
  cores, as letras, os produtos e o tom; criamos com eles um sistema de
  design único, só para aquela marca; é esse sistema que vai para a IA; cada
  publicação é diferente, todas com a cara da empresa. "Ver como funciona"
  leva a `#como-funciona`.
- **Saíram**, a pedido: a etiqueta por cima do título, a fila de pastilhas e
  a palavra gigante "marca" por trás da escultura.
- **Do original saíram** a barra de navegação (a página tem a sua), o tema
  claro, as fontes do Google e a ligação de crédito visível. O crédito
  ficou no código.
- **Rejeitada pelo cliente**: a primeira versão, um quadro de design system
  desenhado em canvas (`systemBoard.ts`, apagado). Ficaram as esculturas do
  próprio componente.

### A escultura (`src/escultura/`)

As imagens escuras do componente, descarregadas para `src/escultura/origem/`
e pintadas de verde por `scripts/converter-escultura.mjs`, com um mapa de
gradiente: a claridade de cada píxel passa a um tom de uma rampa que vai do
fundo da página a verdes-musgo e médios, com o néon só nos realces. A
primeira rampa subia depressa para o néon e a escultura saía chapada, sem
volume. A segunda tem uma curva (`GAMMA` 1,35) que puxa os meios-tons para
baixo. O fundo fica exactamente na cor da página (#050706): o motor recorta
a escultura pela distância a essa cor.

**As pontas até às margens.** Num ecrã largo, a escultura (presa à altura
da faixa) acabava antes das margens e sobravam dois vazios. O script gera
uma terceira imagem, `escultura-larga.webp` (4083 × 793, abaixo do limite
de textura de 4096 de muitos GPU), com 1050 px acrescentados de cada lado.
O prolongamento é feito das 686 gotas soltas da própria escultura, cada uma
com a sua luz, recortadas uma a uma e semeadas para fora de cada ponta numa
faixa que ondula. Ficam mais raras, mais pequenas e mais escuras à medida
que se afastam, como pó que se dispersa. A semente é fixa: correr o script
outra vez dá a mesma imagem.

- Rejeitado: copiar bocados inteiros da nuvem das pontas. Davam manchas
  redondas e esbatidas, umas a seguir às outras.
- As pérolas dos pontos assinalados não se copiam (são únicas).
- O motor recebe o prolongamento como `span` (2,06): a escultura mede-se
  como antes, e a densidade de partículas, o raio do cursor e a montagem
  medem-se por ela, não pela imagem inteira. Uma imagem maior do que o
  GPU aceita sobe reduzida.
- O telemóvel tem a sua escultura, ao alto (1024 × 1300), sem
  prolongamento. A escolha entre as duas é a mesma pergunta CSS no
  `<picture>` (antes de o JavaScript correr) e no motor: o telemóvel nunca
  descarrega a deitada.

### Os pontos assinalados

Cinco pontos, cada um preso a uma pérola da escultura (as posições foram
conferidas a olho sobre a imagem), com uma linha até ao nome: Logótipo,
Cores, Tipografia, Componentes, Publicações. Escondem-se enquanto as
partículas se juntam e aparecem 2,6 s depois do primeiro fotograma. Com
menos movimento pedido pelo sistema, sem WebGL2 ou numa troca de imagem,
aparecem logo. Um ponto que caia fora do ecrã (nos tablets a escultura sai
pelos lados) esconde-se inteiro.

**Mexem com as partículas.** Antes, a partícula do logótipo voava com o
cursor e o nome dela ficava parado. Agora:

- as cinco pérolas são partículas "seguidas": ficam no começo do estado da
  simulação, e o motor lê o estado delas do GPU a cada fotograma em que o
  material se mexe (`onAnchors`). A leitura vai para um buffer e só é aberta
  quando o GPU avisa que acabou, sem o fazer esperar; a velocidade lida com
  o deslocamento compensa esse atraso de um ou dois fotogramas;
- o ponto vai exactamente com a sua partícula, incluindo o escorrer
  "líquido" que o desenho soma (o mesmo campo de ruído dos shaders,
  refeito no CPU);
- o nome vai atrás, preso por uma mola, e a linha estica entre os dois,
  como uma etiqueta presa por um fio (`liquid/callouts.ts`). O nome
  afasta-se no máximo ~80 px, para continuar legível por mais que a
  partícula voe, e nunca sai pelas margens;
- tudo por `transform`, sem redispor a página a cada fotograma. Os nomes
  perderam o `backdrop-filter`: um desfoque refeito a cada fotograma, em
  cinco nomes a mexer, pesava. O fundo passou a 90% de opacidade;
- com menos movimento pedido, o nome vai com o ponto, sem mola.

### A indicação "Passa o cursor pelos dados"

Ao centro, por baixo da escultura. Em ecrãs baixos (1024 × 768,
1280 × 720) o nome da tipografia desce até lá: a indicação passa para o
lado do nome e, se não couber, não aparece. No telemóvel não há indicação
(a escultura ao alto não deixa sítio).

### Verificado

`tsc`, `eslint` e `next build` sem erros. No Chrome, em 1920 × 1080,
1440 × 900, 1280 × 720, 1024 × 768, 820 × 1180 e 390 × 844:

- as pontas chegam às duas margens nos ecrãs largos, e nada sai da largura
  do ecrã;
- com o cursor (ou o dedo, no telemóvel) a passar pela pérola do logótipo,
  os pontos afastam-se até 40–94 px com as partículas e os nomes vão atrás
  (até ~66 px). Quando a escultura assenta, voltam a 0 px;
- com menos movimento, os pontos estão à vista aos 0,7 s e os nomes vão
  com os pontos (±1 px);
- a troca de imagem sem recarregar (do telemóvel para 1440) volta a montar
  a escultura com os pontos no sítio;
- sem erros na consola e sem nenhum pedido de IA.

Por confirmar: o direito de uso das imagens da escultura. São as do
componente de exemplo, e cabe ao dono do projecto confirmá-lo ou trocá-las
por imagens próprias (basta pô-las em `src/escultura/origem/` e correr o
script).

## 62. As secções finais na linguagem das duas primeiras

O pedido: "as duas primeiras secções estão bem profissionais, mas as finais
não" — refazer tudo o que vem depois da escultura com base na primeira
dobra e na secção da marca.

O diagnóstico: as secções finais eram anteriores às duas primeiras e
falavam outra língua — etiquetas por cima dos títulos, títulos médios a uma
só cor, caixas dentro de cartões, esboços no lugar das artes. A correcção
não foi enfeitá-las uma a uma: foi tirar das duas primeiras as peças que
lhes dão o tom e usá-las em todas.

### A linguagem partilhada (`ui.tsx`, `landing.css`)

- `SectionTitle`: duas frases, uma por linha, a segunda a néon, no tamanho
  da secção da marca.
- `SectionIntro`: o título à esquerda e o texto à direita, alinhados pelo
  fundo; nos ecrãs estreitos, o texto vai por baixo. Com `stacked`, para os
  títulos compridos, o título ocupa a linha inteira e o texto fica por
  baixo, à direita (em "Como funciona", nos exemplos e nos planos: na
  coluna da esquerda, "Uma presença profissional. / Um custo que consegues
  planear." partia-se em quatro linhas).
- `IndexTag` ("01 LOGÓTIPO"), `Hint` (o ponto a pulsar de "Passa o cursor
  pelos dados"), `Node` (o anel a néon com a onda), a ligação sublinhada
  com seta (`TextLink`, `textLinkClass`, `LinkArrow`) e `Lead`.
- Nenhuma etiqueta por cima dos títulos. `Eyebrow`, `SectionHeading` e
  `DemoTag` ficam só para os ficheiros sem uso (abaixo).

### O problema (`Problem`, `ScrollLit`)

Um manifesto: uma frase grande que se acende palavra a palavra ao rolar e
acaba na promessa a néon, uma frase por linha ("Menos trabalho para
publicar. / Mais espaço para cuidar do negócio."). Por baixo, as três dores
com o nome numerado. Sem cartões, sem ícones e sem números: continua a não
haver dados que sustentem poupanças.

- `ScrollLit` só escreve o progresso (`--lp-p`); o CSS acende cada palavra
  pelo seu número (`--i` em `--lp-n`). O progresso vai do topo do texto a
  90% da altura do ecrã ao fim do texto a 58%. Com o fim a 42%, quem
  parasse com a frase ao centro ficava com as últimas palavras apagadas.
- Só escuta o deslocamento com o texto perto do ecrã, uma vez por
  fotograma. Com menos movimento pedido (ou sem JavaScript), está tudo
  aceso desde o início.
- No telemóvel, cada frase da promessa parte-se ao meio (`text-balance`),
  em vez de deixar "publicar." e "negócio." sozinhas numa linha.

### Como funciona (`HowItWorks`)

Os passos ligam-se como os pontos da escultura: um ponto a pulsar e o nome
numerado ("01 A MARCA", "02 O PEDIDO", "03 A ARTE") num carril com um
brilho a percorrê-lo; nos ecrãs estreitos, em coluna, com um traço de cada
ponto ao seguinte. As vinhetas ficaram, com a moldura das outras peças
(cantos de 20 px, a aresta iluminada).

- Nos ecrãs estreitos, o ponto vai num invólucro posicionado: `.lp-node` diz
  `position: relative` e vem depois do Tailwind no CSS — ganhava ao
  `max-lg:absolute`.

### O controlo (`Control`, `ControlDemo`)

"A IA propõe. / Tu decides.", com a indicação "Experimenta: escreve outro
título". A revisão interactiva passou a ser uma só superfície, com campos
numerados ("01 TÍTULO" … "05 ESTILO VISUAL") separados por linhas finas.
Rejeitadas: as caixas dentro do cartão da versão anterior. O esboço ganhou
um brilho por trás e a indicação "Esboço em directo".

- A secção passou a `overflow-x-clip`: no telemóvel, o brilho do esboço
  passava 21 px da largura do ecrã e a página rolava para o lado. `clip` e
  não `hidden`, que partiria o `sticky` do esboço.

### Exemplos (`Showcase`, novo, `#exemplos`)

Substitui a identidade da Perfumaria Kianda (`Differentiation`) e o exemplo
do pedido à arte (`SocialProof`, sem testemunhos). As duas mostravam esboços
no lugar das artes, que ainda não foram geradas, e repetiam o que a secção
da marca e "Como funciona" já contam. No lugar delas, a marca da própria
Kriar, nas artes da primeira dobra:

- uma arte grande (`arte7`, 416 × 520) com os quatro primeiros elementos do
  sistema assinalados como na escultura (ponto, linha, nome numerado):
  logótipo, cores, tipografia e componentes. Os pontos ficam encostados ao
  que assinalam: em cima do "K" escondiam metade do que apontavam;
- por baixo, o quinto, "05 Publicações": quatro artes de assuntos
  diferentes (`arte1`, `arte3`, `arte6`, `arte8`), a segunda e a quarta um
  pouco mais abaixo nos ecrãs largos, para se lerem como uma série;
- abaixo de 1024 px não há sítio para os nomes ao lado da arte: os pontos
  levam o número e os nomes vão por baixo;
- o texto diz só o que se vê: foram feitas com a Kriar, para a Kriar. Não
  diz "as mesmas letras", porque duas têm títulos com serifa.

`heroArts.ts` ganhou um `id` por arte e `heroArt(id)`, que falha com um
nome que não exista. A página é estática: um nome errado parte a
compilação, não a página.

### Planos (`Plans`)

Com planos configurados, os cartões levam o nome numerado. Sem planos (o
estado actual), um bloco honesto: "Em breve", "Os planos em kwanzas são
anunciados em breve.", e só o que já é verdade sobre uma geração:

- quatro factos numerados: uma arte por geração; verificada antes de a
  veres, com uma correcção automática no máximo (a regra de
  `store/editor.ts`); PNG nas medidas exactas; várias empresas na mesma
  conta;
- os seis formatos desenhados à mesma escala (`--lp-fs`): lado a lado,
  vê-se que o story é o mais alto e o do LinkedIn o mais baixo. O formato
  por omissão (4:5) leva o contorno a néon; a proporção vem escrita como as
  redes a escrevem ("1,91:1").

Nada de preços, quantidades ou formas de pagamento inventados para encher o
espaço.

### Perguntas, última chamada e rodapé

- **Perguntas**: o título fica preso à esquerda ao rolar; cada pergunta tem
  o seu número (a néon quando aberta) e a resposta alinha com a pergunta,
  depois do número.
- **Última chamada**: o campo de pontos da primeira dobra a encher a
  secção, o título ao centro ("A próxima publicação / começa com uma
  ideia.") e a mesma pílula que baralha as letras. Saiu a arte ao lado do
  botão: era um esboço "Arte por gerar", e em produção a última imagem da
  página seria um lugar vazio.
- **Rodapé**: o logótipo, a descrição, a ligação para começar, as secções e
  a conta; por baixo, o logótipo da largura da página, a cinzento e quase
  apagado (9%), a desvanecer para o fundo; e a linha final com o ano. Sem
  redes sociais nem moradas, que ainda não existem.

### A página (`page.tsx`)

- Ordem: primeira dobra, marca, problema, como funciona, controlo, exemplos,
  testemunhos (só quando os houver), planos, perguntas, última chamada.
- "Exemplos", na barra do topo e no rodapé, aponta para `#exemplos`.
- O aviso de desenvolvimento só conta a miniatura da terceira vinheta de
  "Como funciona": é a única demonstração que a página ainda mostra.
- Ficam no projecto, sem uso: `Differentiation.tsx`, `Gallery.tsx`,
  `HeroDemo.tsx` e o exemplo do pedido à arte dentro de `SocialProof.tsx`.
  Sem git, apagá-los era perder o trabalho.

### Verificado

`tsc`, `eslint` e `next build` sem erros. No Chrome, em 1440 × 900,
1024 × 768, 768 × 1024, 390 × 844 e 360 × 740:

- nada sai da largura do ecrã (o único caso era o brilho do controlo, no
  telemóvel);
- em 1024, os nomes dos exemplos cabem ao lado da arte;
- o esboço do controlo continua preso ao rolar, com o `overflow-x-clip`;
- na pré-visualização de produção (`/?vista=producao`), "Como funciona" e os
  exemplos aparecem iguais;
- sem erros na consola e sem nenhum pedido de IA (os pedidos a `/api/ai/` e
  `/api/brand/` estavam bloqueados no teste).

## 63. Uma identidade real para a Perfumaria Kianda

O pedido: "na secção da perfumaria Kianda vamos criar uma identidade para
ela. Gere o logo bonito por IA, nos anexos use fotos bonitas e reais que
condizem com o nosso sistema. Na secção «a IA propõe, tu decides», ao
clicar em gerar arte, mostre uma arte bonita já pré-gerada da perfumaria
Kianda por você. E coloque aviso para clicar em «gerar arte». Outra coisa é
que a animação no fundo que temos no hero coloque secção sim, secção não."

Este lote gastou créditos de IA a pedido explícito do cliente — é o único
até aqui. Cada imagem custa cerca de 0,20 USD.

### Material da empresa, resultado da Kriar

A distinção que organiza tudo o que se segue:

- o LOGÓTIPO e as FOTOGRAFIAS são material da empresa — o que um cliente
  carrega na Kriar. Foram pedidos directamente ao modelo de imagem
  (`/api/v1/images` do OpenRouter, `OPENROUTER_IMAGE_MODEL`), porque não há
  nada na Kriar que gere o logótipo de alguém;
- a ARTE é um resultado da Kriar, e por isso passou pelas rotas da própria
  aplicação: `/api/ai/plan` → revisão da proposta → `/api/ai/artwork` →
  `/api/ai/review-art` → no máximo uma correcção. Mostrar na página de
  entrada uma arte que não saiu do produto seria publicidade enganosa ao
  próprio produto.

Tudo em `scripts/gerar-kianda.mjs`, que lê o `.env.local` e nunca imprime a
chave. Os originais e o registo de cada geração ficam em
`src/kianda/origem/` — incluindo as tentativas recusadas, que são a prova
do que se segue.

### O logótipo

Três propostas, escolhida a segunda: uma gota azul-marinho com uma onda
âmbar, "KIANDA" em serifa didone e "PERFUMARIA" em sans. O fundo foi
recortado com arestas não pré-multiplicadas (senão fica um halo claro em
volta), e o símbolo separado como `simbolo.png`, para os sítios onde o nome
não cabe.

`logotipo-fundo-escuro.png` troca o azul-marinho por creme `#F1EADD` e
mantém o âmbar. A arte usa esta versão, porque a base dela é primária
(azul-marinho) — a mesma lógica do `pickLogo` da aplicação.

### As fotografias

`perfume` (o "Noite de Luanda" de 50 ml: frasco azul-marinho, tampa
dourada, rótulo creme com o logótipo) e `difusor` (frasco âmbar com
varetas), ambos sobre fundo creme com seda azul. A do difusor levou a do
perfume como referência de estilo, para as duas parecerem da mesma sessão.
Paleta: primária `#152A4A`, secundária `#E7DCC8`, realce `#C98A3C`.

### A proposta, editada como o cliente a editaria

A proposta saiu de `/api/ai/plan` e foi guardada em
`origem/arte-lancamento-proposta.json`. Depois foi editada à mão, como um
cliente faz na revisão: o texto de apoio passou a "Noite de Luanda, uma
fragrância de autor." (o original repetia o website), o botão a "Descobre
já", o título ficou protegido, a frase de composição foi esvaziada e o
logótipo ficou pequeno, em cima à esquerda.

### O problema das arestas, e o `reenquadrar`

Nas seis gerações, o modelo pôs o logótipo e o website a 4–6% das arestas
da imagem 3:4. A moldura 4:5 da aplicação corta 4,2% centrados — e cortava-
os. Duas tentativas falhadas antes da que funcionou:

- passar a arte pela moldura normal: corta o logótipo;
- desfocar a arte inteira como fundo: sobram faixas visíveis dos lados.

O que ficou: o comando `reenquadrar`. Escala a arte até o logótipo e o
website ficarem a 5% das arestas, centra-a, e enche as faixas laterais com
uma cópia espelhada e desfocada, com 36 px de esfumado. Fonte final:
`arte-lancamento-2026-10-16T19-35-04-2.png`.

O registo da verificação (`origem/arte-lancamento.json`) guarda exactamente
isto: `retry: true`, com "o logótipo ficou demasiado perto da aresta (cerca
de 1,2% da largura)" entre os defeitos. A verificação da aplicação apanhou
o problema sozinha — o que faltava era o acabamento saber resolvê-lo.

### O esboço, e o que ele resolveu

A primeira arte foi gerada sem esboço e o logótipo saiu cortado. Passou a
seguir pintada (um esboço cinzento, papel `esboco`, `sketch: true` na
verificação) e em palavras (`describeLayout()`), espelhando o que
`paintGeneratorSketch`/`describeSketch` fazem na aplicação. As duas
tentativas seguintes mantiveram o mesmo defeito de aresta, e foi aí que se
percebeu que o problema não era de instrução: era de enquadramento.

### "Gerar arte", na secção do controlo

A arte aparece por cima da planta, na mesma proporção 4:5, com um
`clip-path` a revelá-la e uma linha de varrimento a néon. A indicação
acima passa de "Esboço em directo" a "Arte gerada pela Kriar".

A legenda diz a verdade sobre o que se está a ver: "Gerada pela Kriar a
partir destes dados." quando os controlos estão como vieram, e "Gerada com
os dados de origem. As tuas alterações geram-se na tua conta." quando o
visitante mexeu em algo. Um botão "Voltar ao esboço" desfaz, e qualquer
alteração aos dados também traz o esboço de volta — como na aplicação, onde
uma arte deixa de valer quando a revisão muda.

Antes do primeiro clique, a indicação lê "Clica em «Gerar arte» para veres
o resultado" e o botão leva um anel a pulsar (`lp-cta-ping`). No telemóvel a
planta está acima do botão, por isso a página rola até à arte depois do
clique — sem isso, o resultado aparecia fora do ecrã de quem carregou.

Ficou de fora o aviso "Isto é uma demonstração…": a legenda já diz de onde
vem a arte, e um aviso genérico só ocupava espaço.

### O campo de pontos, secção sim, secção não

`SectionField` leva o campo da primeira dobra às secções alternadas:
primeira dobra ✓, marca ✗, problema ✓, como funciona ✗, controlo ✓,
exemplos ✗, planos ✓, perguntas ✗, última chamada ✓.

Não interactivo (um anel a cada clique num campo de texto distraía), pontos
a 13%, e as áreas de pulso afastadas do texto mais denso. O véu
`.lp-section-wash` funde o campo com o preto da página em cima e em baixo —
senão a secção seguinte começava numa aresta — e escurece o centro, onde
está o texto. O cartão do controlo e o bloco dos planos passaram a
`bg-ink-900/85`, para os pulsos não atravessarem os campos do formulário.

### A conta de demonstração

A sementeira (`seed.ts`) passou a buscar os ficheiros verdadeiros: o
logótipo, a versão para fundo escuro como `logoForDarkBgAssetId` e as duas
fotografias, com proveniência `upload`. Se algum não carregar, entram os
desenhos em canvas de antes (`drawMonogram`, `drawBottle`) — a conta de
demonstração nunca fica por criar por causa de uma imagem.

### O que ficou de fora

A secção do trio da Kianda (`Differentiation`) saiu da página no lote 62 e
continua fora. A identidade foi aplicada aos sítios onde a Kianda aparece
hoje: as vinhetas do "Como funciona", a revisão interactiva e a conta de
demonstração.

### Verificação

`tsc`, `eslint` e `npm run build` limpos. Fotografias da página a 1440 e a
390 px, antes e depois do clique em "Gerar arte", com menos movimento
pedido e sem: a arte aparece, rola até ela no telemóvel, sem transbordo
horizontal e sem erros na consola.

## 64. Arte instantânea, e editar fotografias por zonas

Dois pedidos no mesmo lote:

> "Opção instantânea de fazer a arte na hora, então o painel de criação
> pede logo, cores, etc. Assim cobraremos por arte."

> "Nova secção edição. A pessoa manda uma foto e com IA nós editamos ela. A
> edição já existe, então será só uma nova tela onde a pessoa faz upload da
> foto."

### Arte instantânea (`/instantanea`)

O caminho curto: nome da empresa, logótipo, duas cores, o pedido — e gera.
Sem as quatro etapas do cadastro.

Vive FORA de `(painel)`, ao lado de `/entrar` e `/onboarding`, porque a
casca do painel exige uma marca pronta e manda quem não a tem para o
cadastro — exactamente o passo que este ecrã existe para saltar.

O que se salta e o que não se salta:

- salta-se o design system (cores com escalas, tipografia justificada,
  regras de composição, imagens de referência). Sem `spec` aprovada,
  `guidelinesFrom` devolve `null` e a arte sai sem regras de identidade:
  sai boa, mas a próxima não tem como ser coerente com esta. Está dito no
  ecrã, com ligação para a área Marca;
- NÃO se salta a revisão. Ela acontece — `preparePlan` propõe a ideia e os
  textos, `generateArtwork` gera a seguir —, só não pára para perguntar.
  Quem quiser decidir antes de gerar abre a arte no editor, que é a mesma
  publicação com o mesmo identificador.

Três decisões que não são óbvias:

1. A marca é GRAVADA antes de gerar, não mantida em memória. O projecto
   guarda `brandId`, e um projecto a apontar para uma marca que não existe
   não abre no editor; a arte é um ficheiro que tem de ficar na conta de
   alguém; e a segunda arte deste cliente já vem com os campos preenchidos.
   `applyInstantInput` (em `src/lib/domain/instant.ts`) só toca no que o
   ecrã recolhe — uma marca que já tenha identidade, biblioteca ou memória
   sai de lá com tudo isso intacto.

2. `colorsConfirmed: true`. As cores de arranque do `createBrand` são
   valores de reserva e não têm autoridade sobre a arte precisamente porque
   ninguém as escolheu. Estas foram escolhidas.

3. Os ficheiros da marca são resolvidos ANTES de gerar
   (`ensureBrandAssets`). `startDraft` manda-os resolver e não espera; no
   editor isso não se nota, porque entre abrir o ecrã e carregar em gerar
   passam minutos, mas aqui as duas coisas acontecem no mesmo clique — e
   uma arte gerada antes de o logótipo estar resolvido sai sem logótipo.

A chamada da página pública passou a apontar para aqui. `useStartTarget` é
o único sítio que decide o destino de "Criar a minha primeira arte", e sem
marca pronta esse destino era o cadastro: um botão que promete uma arte e
entrega um formulário de identidade visual. O cadastro continua a ser o
destino de quem entra directamente numa página do painel sem marca — aí a
intenção já é outra — e tem uma saída para o ecrã instantâneo na primeira
etapa.

Sobre cobrar por arte: não há cobrança implementada, e há um buraco a
fechar antes de haver. As rotas de IA não verificam conta nenhuma, não têm
limite de pedidos e não contam nada. Hoje isso é um risco de custo; com
cobrança por arte passa a ser a porta por onde se gera de graça. O ponto
onde isso se resolve é `/api/ai/artwork`, antes de `resolveImageProvider` —
é o único sítio por onde o custo passa.

### Editar fotografias, por zonas (`/editar-foto`)

A primeira tentativa deste ecrã foi outra, e foi recusada: quatro operações
escritas por nós ("melhorar", "trocar o fundo", "pôr noutro cenário", "dizer
o que mudar") sobre a fotografia inteira. O cliente corrigiu:

> "O editor que quero é aquele que já temos depois de criar o rascunho, onde
> você selecciona a área e pede para mudar."

A correcção é melhor, e não só por ser o que foi pedido: a edição por zonas
tem uma garantia que a edição da imagem inteira não tem. Com "só dentro das
zonas" ligado, `composeEdit` alinha o que o gerador devolveu e deixa-o
entrar apenas dentro das máscaras. Fora delas, a fotografia que sai é igual
à que entrou, ao píxel. Numa fotografia de produto — onde o que importa é
que o produto não mude — isso é a diferença entre útil e inútil.

Nada foi reimplementado. `useZoneEditor`, `ZoneCanvas`, `ZonePanel`,
`prepareZoneEdit`, `CompareSlider`, `measureMasks` e `composeEdit` são os
mesmos da arte final. O que mudou:

- `prepareZoneEdit` recebia um `FormatId` e passou a receber a MOLDURA
  (`frame: { width, height }`). Numa publicação, o cliente pinta sobre o
  formato (4:5) e o ficheiro do gerador tem outra proporção (3:4), e a
  função faz a conta entre as duas; numa fotografia, a moldura e o ficheiro
  são a mesma coisa;
- `ZonePanel` ganhou um `subject` (`arte` | `fotografia`), com as frases
  num mapa dentro do próprio painel. Espalhá-las pelos dois ecrãs que o
  usam era a forma garantida de elas divergirem;
- `usePaintedArt` saiu de dentro do `ArtworkView` para um ficheiro próprio:
  duas telas mostram artes geradas, e é sempre por aqui que uma arte se
  mostra — nunca pelo ficheiro cru do gerador, que tem a proporção do
  gerador e não a da publicação.

Rota nova, `/api/ai/edit-photo`, em vez de um parâmetro na da arte: o
prompt é outro (`buildPhotoEditPrompt` não fala de publicação aprovada, de
cores de marca, de textos letra a letra nem de logótipo; fala de continuar
a parecer uma fotografia e de não inventar texto) e a entrada é outra —
chega um ficheiro de fora, que passa por `validateUploadBytes` e por um
mínimo de 320 px no lado curto.

Sem verificação automática e sem segunda tentativa, ao contrário da arte. A
verificação da arte compara o resultado com o título, os contactos e o
logótipo esperados, e numa fotografia não há nada disso para comparar: uma
correcção automática custaria uma segunda geração para decidir à sorte.
Fica uma passagem, e quem decide é quem vê — o resultado abre em
comparação, com "voltar à anterior" ao lado.

Mais duas decisões:

- a fotografia é reduzida a 1600 px no browser, com `reencode: true` mesmo
  quando já cabe. Uma fotografia de telemóvel chega com 12 MP: em base64
  passava o limite da rota, e o gerador não aproveita a diferença. A
  reconversão limpa também os metadados — a localização incluída — antes de
  a fotografia sair do browser;
- `closestFormat` escolhe a proporção pedida ao gerador, e a ORIENTAÇÃO
  decide primeiro. Uma fotografia 4:3 fica exactamente à mesma distância
  logarítmica de 1:1 e de 16:9 (4:3 é a média geométrica dos dois), e o
  desempate pela ordem do catálogo devolvia `quadrado` para uma fotografia
  deitada. Pedir um quadrado obriga o gerador a recompor a cena, a
  composição com máscaras deixa de encaixar e a garantia do "resto fica
  igual" perde-se. Foi um defeito real, apanhado na prova: o pedido saía com
  `formato: "quadrado"` para uma fotografia de 1200×900.

No fim há uma ponte para o produto: "usar numa publicação" abre uma
publicação nova com a fotografia já anexada. `saveNow()` antes de navegar
não é zelo — o rascunho vive em memória e `/editor/[id]` lê o projecto do
armazenamento; sem a gravação forçada, a navegação chegava lá primeiro e o
editor abria em "este projecto já não existe".

A entrada na barra de navegação diz "Foto" e não "Editar foto": a etiqueta
é desenhada a 10 px debaixo do ícone, e duas palavras partiam-se em duas
linhas e desalinhavam o botão dos outros.

### Verificação

`tsc`, `eslint` e `npm run build` limpos.

Provas no browser, com as rotas de IA interceptadas — nenhum crédito gasto:

- a edição por zonas de ponta a ponta, a 1440 e a 390 px: carregar a
  fotografia (1200×900 lidos), pintar duas zonas (cartões 1 e 2, posições
  descritas em palavras), o botão travado com "falta dizer o que queres na
  zona 1", o pedido enviado com fotografia, mapa, duas máscaras e as duas
  posições, a comparação antes/depois, "continuar a editar", "voltar à
  anterior", e a ponte para `/editor/[id]` sem erros;
- a arte instantânea: campos pré-preenchidos pela marca activa, o botão
  travado sem pedido, e o erro da rota à vista sem deixar o ecrã preso;
- a barra do topo a 390 px nas quatro rotas do painel (`/projectos`,
  `/marca`, `/definicoes`, `/editar-foto`): sem transbordo e sem
  sobreposição, com a mesma folga de 12 px — o `/editar-foto` comporta-se
  como os outros.

Uma nota sobre a prova em si: a primeira versão dela falhava em silêncio
porque clicava no botão assim que ele existia no DOM. O HTML do servidor já
o traz, e um clique antes de o React ligar os manipuladores não faz nada.
As provas passaram a esperar que o botão tenha um `onClick` ligado.

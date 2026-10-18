/**
 * A identidade da Perfumaria Kianda, a marca fictícia das demonstrações.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * GASTA CRÉDITOS DE IA. Cada imagem custa perto de 0,20 USD e leva um a
 * dois minutos. Os ficheiros que a página usa já estão em `src/kianda/`;
 * isto só volta a correr para refazer a identidade.
 *
 *   node scripts/gerar-kianda.mjs logo [quantos]
 *       Propostas de logótipo → src/kianda/origem/logotipo-N.png
 *
 *   node scripts/gerar-kianda.mjs recortar-logo <ficheiro>
 *       Tira o fundo da proposta escolhida e separa o símbolo:
 *       src/kianda/logotipo.png e src/kianda/simbolo.png
 *
 *   node scripts/gerar-kianda.mjs foto perfume|difusor
 *       A fotografia do produto, com o logótipo no rótulo (o difusor segue a
 *       luz da fotografia do perfume) → src/kianda/origem/<produto>.png e
 *       src/kianda/<produto>.webp
 *
 *   node scripts/gerar-kianda.mjs versao-escura
 *       Só a versão do logótipo para fundos escuros (o recorte já a faz).
 *
 *   node scripts/gerar-kianda.mjs proposta
 *   node scripts/gerar-kianda.mjs arte
 *       A arte da revisão interactiva, feita PELA KRIAR: com o servidor de
 *       desenvolvimento a correr, segue o caminho de uma publicação real.
 *       "proposta" pede a ideia e os textos (`/api/ai/plan`) e guarda-os em
 *       src/kianda/origem/arte-lancamento-proposta.json, para serem revistos
 *       antes de se gastar a geração; "arte" gera (`/api/ai/artwork`),
 *       verifica (`/api/ai/review-art`) e, se a verificação reprovar, corrige
 *       uma vez. Guarda a arte na moldura de 1080 × 1350 em
 *       src/kianda/arte-lancamento.webp e o registo do pedido ao lado do
 *       original.
 *
 * O logótipo e as fotografias são pedidos directamente ao modelo de imagem:
 * são o MATERIAL da empresa (o que um cliente carrega), não resultados da
 * Kriar. A arte é o contrário, e por isso passa pelas rotas da aplicação.
 *
 * A chave vem de `.env.local` e nunca é escrita no ecrã.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'src', 'kianda');
const ORIGIN = path.join(OUT, 'origem');
const APP = process.env.KRIAR_URL ?? 'http://localhost:3000';

/** A paleta da marca, a mesma da conta de demonstração (`src/lib/data/seed.ts`). */
const COLORS = { primary: '#152A4A', secondary: '#E7DCC8', accent: '#C98A3C' };

// --- Ambiente ------------------------------------------------------------------

function readEnv() {
  const file = path.join(ROOT, '.env.local');
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const ENV = readEnv();
const KEY = ENV.OPENROUTER_API_KEY?.trim();
const MODEL = ENV.OPENROUTER_IMAGE_MODEL?.trim() || 'openai/gpt-5.4-image-2';

// --- O modelo de imagem ----------------------------------------------------------

let spent = 0;

/** Um pedido ao ponto de entrada de imagens do OpenRouter. Devolve os PNG. */
async function generateImages({ prompt, aspect, n = 1, references = [] }) {
  if (!KEY) throw new Error('Falta OPENROUTER_API_KEY em .env.local.');
  const started = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${KEY}`,
      ...(ENV.OPENROUTER_SITE_URL ? { 'HTTP-Referer': ENV.OPENROUTER_SITE_URL } : {}),
      ...(ENV.OPENROUTER_APP_NAME ? { 'X-Title': ENV.OPENROUTER_APP_NAME } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n,
      aspect_ratio: aspect,
      quality: 'high',
      ...(references.length > 0
        ? { input_references: references.map((url) => ({ type: 'image_url', image_url: { url } })) }
        : {}),
    }),
    signal: AbortSignal.timeout(420_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.data?.length) {
    throw new Error(`O modelo respondeu ${response.status}: ${data?.error?.message ?? 'sem imagem'}`);
  }
  const cost = data.usage?.cost ?? 0;
  spent += cost;
  console.log(`  ${data.data.length} imagem(ns) em ${Math.round((Date.now() - started) / 1000)} s, ${cost.toFixed(3)} USD`);
  return Promise.all(
    data.data.map(async (entry) => {
      if (entry.b64_json) return Buffer.from(entry.b64_json, 'base64');
      const file = await fetch(entry.url);
      return Buffer.from(await file.arrayBuffer());
    }),
  );
}

const dataUrl = (buffer, mime) => `data:${mime};base64,${buffer.toString('base64')}`;

async function pngDataUrl(file, max = 1024) {
  const buffer = await sharp(file).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return dataUrl(buffer, 'image/png');
}

async function jpegDataUrl(file, max, quality) {
  const buffer = await sharp(file)
    .flatten({ background: '#ffffff' })
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
  return dataUrl(buffer, 'image/jpeg');
}

// --- 1. O logótipo ----------------------------------------------------------------

const LOGO_PROMPT = `A professional logo for a perfume house called "Perfumaria Kianda", from Luanda, Angola. In Angolan tradition, Kianda is the spirit of the sea and of the waters of the bay of Luanda — so the brand joins perfume and water, with quiet luxury.

Layout: ONE horizontal lockup, centred in the image, with very wide empty margins on every side (the lockup uses at most 70% of the width and 40% of the height).
- On the left, a compact emblem: a single perfume drop, solid deep navy (${COLORS.primary}), with one fine flowing wave line cut through its lower half in warm amber gold (${COLORS.accent}), like a ripple on the bay at dusk. Symmetrical, simple and recognisable even at 24 pixels.
- To the right of the emblem, separated by a clear gap: the word "KIANDA" in capital letters, set in an elegant high-contrast Didone serif like Playfair Display, deep navy (${COLORS.primary}), with slightly open letter spacing. Directly beneath it, much smaller, the word "PERFUMARIA" in widely letter-spaced light sans-serif capitals like Inter, warm amber gold (${COLORS.accent}), aligned with the left edge of "KIANDA".

Style: flat vector logo artwork with crisp edges, using only these two colours. No gradients, no shadows, no 3D, no texture, no mockup, no paper, no frame, no badge, no circle behind it. The background is perfectly flat pure white (#FFFFFF) across the whole image.
The only words in the image are "KIANDA" and "PERFUMARIA", spelled exactly like this.`;

async function logo(count) {
  await mkdir(ORIGIN, { recursive: true });
  console.log(`Logótipo: ${count} proposta(s) com ${MODEL}`);
  const images = await generateImages({ prompt: LOGO_PROMPT, aspect: '3:2', n: count });
  for (const [index, image] of images.entries()) {
    const file = path.join(ORIGIN, `logotipo-${index + 1}.png`);
    await writeFile(file, image);
    console.log(`  → ${path.relative(ROOT, file)}`);
  }
}

/**
 * Tira o fundo branco e separa o símbolo do nome.
 *
 * A opacidade de cada píxel sai da distância à cor do fundo (lida nos
 * cantos): até 10 é fundo, a partir de 120 é logótipo, e pelo meio é a
 * aresta suavizada — a cor dela é "desmultiplicada" do fundo, para não ficar
 * uma auréola branca. O símbolo é o primeiro bloco de colunas ocupadas, à
 * esquerda do intervalo antes do nome.
 */
async function cutLogo(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x, y) => (y * width + x) * 4;

  // O fundo: a mediana de quatro quadrados nos cantos.
  const samples = [];
  const patch = Math.round(Math.min(width, height) * 0.04);
  for (const [cx, cy] of [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ]) {
    for (let y = cy; y < cy + patch; y += 2) {
      for (let x = cx; x < cx + patch; x += 2) samples.push([data[at(x, y)], data[at(x, y) + 1], data[at(x, y) + 2]]);
    }
  }
  const median = (channel) => samples.map((s) => s[channel]).sort((a, b) => a - b)[samples.length >> 1];
  const bg = [median(0), median(1), median(2)];

  const LOW = 10;
  const HIGH = 120;
  const out = Buffer.alloc(width * height * 4);
  const alpha = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = at(x, y);
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      const distance = Math.hypot(dr, dg, db);
      const a = Math.min(1, Math.max(0, (distance - LOW) / (HIGH - LOW)));
      alpha[y * width + x] = a;
      if (a <= 0) continue;
      out[i] = Math.round(Math.min(255, Math.max(0, bg[0] + dr / a)));
      out[i + 1] = Math.round(Math.min(255, Math.max(0, bg[1] + dg / a)));
      out[i + 2] = Math.round(Math.min(255, Math.max(0, bg[2] + db / a)));
      out[i + 3] = Math.round(a * 255);
    }
  }

  // Caixa do que é logótipo.
  const box = (x0, x1) => {
    let top = height;
    let bottom = -1;
    let left = width;
    let right = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (alpha[y * width + x] < 0.04) continue;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    return { top, bottom, left, right };
  };
  const all = box(0, width - 1);
  if (all.right < 0) throw new Error('Não encontrei logótipo nenhum na imagem.');

  const image = sharp(out, { raw: { width, height, channels: 4 } });
  const save = async (region, file, padRatio) => {
    const pad = Math.round((region.bottom - region.top) * padRatio);
    const left = Math.max(0, region.left - pad);
    const top = Math.max(0, region.top - pad);
    const w = Math.min(width, region.right + pad + 1) - left;
    const h = Math.min(height, region.bottom + pad + 1) - top;
    await image.clone().extract({ left, top, width: w, height: h }).png({ compressionLevel: 9 }).toFile(file);
    console.log(`  → ${path.relative(ROOT, file)} (${w} × ${h})`);
  };

  await save(all, path.join(OUT, 'logotipo.png'), 0.06);

  // Colunas ocupadas, para achar o intervalo entre o símbolo e o nome.
  const filled = [];
  for (let x = all.left; x <= all.right; x += 1) {
    let count = 0;
    for (let y = all.top; y <= all.bottom; y += 1) if (alpha[y * width + x] > 0.5) count += 1;
    filled.push(count > 0);
  }
  const minGap = Math.round((all.right - all.left) * 0.02);
  let run = 0;
  let symbolEnd = -1;
  for (let i = 0; i < filled.length; i += 1) {
    if (filled[i]) {
      if (run >= minGap && symbolEnd < 0) symbolEnd = all.left + i - run - 1;
      run = 0;
    } else {
      run += 1;
    }
  }
  if (symbolEnd < 0) {
    console.log('  Sem intervalo claro entre o símbolo e o nome: o símbolo não foi separado.');
    return;
  }
  await save(box(all.left, symbolEnd), path.join(OUT, 'simbolo.png'), 0.1);
  await darkVersion();
}

/**
 * A versão para fundos escuros: o azul-marinho passa a creme, o âmbar fica.
 *
 * Cada píxel é lido entre as duas cores do logótipo (a projecção na linha do
 * azul ao âmbar) e pintado na mesma posição entre o creme e o âmbar — as
 * arestas entre as duas cores continuam suaves. É a versão que a arte leva
 * sobre o azul-marinho da marca (`pickLogo`, "Para fundo escuro").
 */
async function darkVersion() {
  const { data, info } = await sharp(path.join(OUT, 'logotipo.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hex = (value) => [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
  const navy = hex(COLORS.primary);
  const amber = hex(COLORS.accent);
  const cream = hex('#F1EADD');
  const axis = amber.map((value, i) => value - navy[i]);
  const length = axis.reduce((sum, value) => sum + value * value, 0);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const t = Math.min(1, Math.max(0, ((data[i] - navy[0]) * axis[0] + (data[i + 1] - navy[1]) * axis[1] + (data[i + 2] - navy[2]) * axis[2]) / length));
    for (let c = 0; c < 3; c += 1) data[i + c] = Math.round(cream[c] + (amber[c] - cream[c]) * t);
  }
  const file = path.join(OUT, 'logotipo-fundo-escuro.png');
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(file);
  console.log(`  → ${path.relative(ROOT, file)}`);
}

// --- 2. As fotografias dos produtos ---------------------------------------------

const PHOTO_PROMPTS = {
  perfume: `Photorealistic studio product photograph, square format.

Subject: the eau de parfum "Noite de Luanda" (50 ml) by Perfumaria Kianda. The attached image is the brand's logo: reproduce it faithfully and small on the bottle's label — the same emblem, the same letters, the same colours. Never redraw or reinterpret it.

The bottle: a tall rectangular flacon of thick deep-navy tinted glass (${COLORS.primary}) with softly rounded shoulders and a heavy clear glass base, filled with perfume; a polished warm amber-gold cap (${COLORS.accent}); a small cream paper label (${COLORS.secondary}) on the front with the Kianda logo and, beneath it, "NOITE DE LUANDA" and "EAU DE PARFUM · 50 ML" in tiny refined capitals.

Scene: the bottle stands upright, centred, on a warm cream seamless studio backdrop, with a soft fold of deep navy silk draped behind it on one side. Warm late-afternoon window light from the left, a soft realistic shadow to the right, crisp reflections and refraction in the glass.

Camera: 100 mm macro lens at eye level, shallow depth of field; the whole bottle sharp and fully in frame, with generous margins (the bottle is about 60% of the image height).

Look: high-end editorial perfume photography, natural colours, real materials. No props other than the silk, no other text, no watermark.`,

  difusor: `Photorealistic studio product photograph, square format, from the same series as the SECOND attached photo: match its backdrop, light direction, colour grading, camera and framing.

Subject: the reed diffuser "Difusor de ambiente" by Perfumaria Kianda. The FIRST attached image is the brand's logo: reproduce it faithfully and small on the label. Never redraw or reinterpret it.

The diffuser: a wide, low cylindrical vessel of thick warm amber glass with a deep-navy (${COLORS.primary}) collar, filled with fragrance oil, with eight slender natural rattan reeds fanning out from the neck; a small cream paper label (${COLORS.secondary}) on the front with the Kianda logo and, beneath it, "DIFUSOR DE AMBIENTE" in tiny refined capitals.

Scene: centred on the same warm cream seamless backdrop, with the same fold of deep navy silk, warm window light from the left and a soft realistic shadow; crisp glass.

The whole object sharp and fully in frame, reeds included, with generous margins. No other text, no watermark.`,
};

async function photo(product) {
  const prompt = PHOTO_PROMPTS[product];
  if (!prompt) throw new Error('Produto desconhecido: usa perfume ou difusor.');
  const logoFile = path.join(OUT, 'logotipo.png');
  if (!existsSync(logoFile)) throw new Error('Falta src/kianda/logotipo.png: corre primeiro "recortar-logo".');

  // O logótipo sobre o creme da marca: transparente, o modelo lia-o sobre preto.
  const logoOnCream = await sharp(logoFile)
    .flatten({ background: '#F4F2EE' })
    .extend({ top: 60, bottom: 60, left: 60, right: 60, background: '#F4F2EE' })
    .resize({ width: 1024, height: 1024, fit: 'inside' })
    .png()
    .toBuffer();
  const references = [dataUrl(logoOnCream, 'image/png')];
  if (product === 'difusor') {
    const perfume = path.join(ORIGIN, 'perfume.png');
    if (!existsSync(perfume)) throw new Error('Falta a fotografia do perfume: o difusor segue a luz dela.');
    references.push(await jpegDataUrl(perfume, 1024, 90));
  }

  await mkdir(ORIGIN, { recursive: true });
  console.log(`Fotografia: ${product}`);
  const [image] = await generateImages({ prompt, aspect: '1:1', references });
  const original = path.join(ORIGIN, `${product}.png`);
  await writeFile(original, image);
  const info = await sharp(image).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 86 }).toFile(path.join(OUT, `${product}.webp`));
  console.log(`  → ${path.relative(ROOT, original)} e src/kianda/${product}.webp (${info.width} × ${info.height})`);
}

// --- 3. A arte, pelas rotas da Kriar ---------------------------------------------

/** O que a revisão interactiva mostra por omissão (`ControlDemo`). */
const DEMO = {
  brief: 'Quero anunciar o novo perfume da Kianda, o Noite de Luanda, de 50 ml. Uma publicação elegante para o Instagram, com o nosso website.',
  headline: 'Chegou o novo perfume Kianda',
  product: 'Noite de Luanda · 50 ml',
  website: 'www.kianda.ao',
};

async function post(route, body, timeout = 330_000) {
  const started = Date.now();
  const response = await fetch(`${APP}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => null);
  console.log(`  ${route}: ${response.status} em ${Math.round((Date.now() - started) / 1000)} s`);
  if (!response.ok || !data?.ok) throw new Error(`${route} falhou: ${data?.error ?? response.status} ${JSON.stringify(data?.details ?? '')}`);
  return data;
}

/*
  ──────────────────────────────────────────────────────────────────────────
  O ESBOÇO aprovado: a disposição da planta da secção (`Blueprint`) — o
  logótipo em cima à esquerda, o título em duas linhas no topo, o texto de
  apoio, o frasco ao centro, o botão e o website por baixo.

  Na aplicação, o esboço vai desenhado (`paintGeneratorSketch`) e por
  palavras (`describeSketch`). Sem ele, numa primeira tentativa, o gerador
  encostou o logótipo à aresta de cima e o website à de baixo, e a moldura
  4:5 cortou os dois. Aqui desenha-se da mesma maneira: cinzentos, sem
  palavras, a moldura da publicação ao centro da imagem 3:4 do gerador.

  As medidas estão em píxeis da publicação (1080 × 1350), com a margem de
  8% do lado menor (86 px).
  ──────────────────────────────────────────────────────────────────────────
*/
/*
  O logótipo e os contactos ficam mais para dentro do que a margem mínima
  pede: nas duas primeiras gerações, com o esboço ou sem ele, o gerador pôs
  o logótipo a 4,5% da aresta de cima da imagem dele — e a moldura corta
  4,2%. Com o esboço a pedir 14%, sobra folga para ele subir.
*/
const SKETCH = {
  W: 1080,
  H: 1350,
  logo: { x: 86, y: 150, w: 118, h: 36 },
  title: [
    { x: 233, y: 252, w: 614, h: 53 },
    { x: 209, y: 342, w: 662, h: 53 },
  ],
  support: { x: 212, y: 446, w: 656, h: 20 },
  image: { x: 340, y: 500, w: 400, h: 500 },
  cta: { x: 395, y: 1030, w: 290, h: 66 },
  contacts: { x: 420, y: 1125, w: 240, h: 17 },
};

/** As fracções da imagem do gerador (3:4) que a moldura 4:5 não mostra, como `hiddenFractions`. */
const HIDDEN = (() => {
  const source = 3 / 4;
  const target = SKETCH.W / SKETCH.H;
  const usable = 1 - 0.012 * 2;
  return { x: 0.012, y: 0.012 + (usable * (1 - source / target)) / 2 };
})();

/** O esboço em cinzentos, 768 × 1024 (o lado maior a 1024, como na aplicação). */
async function paintSketch() {
  const cw = 768;
  const ch = 1024;
  const fx = HIDDEN.x * cw;
  const fy = HIDDEN.y * ch;
  const scale = (cw - fx * 2) / SKETCH.W;
  const r = (box, radius = 0, fill = '#333333') =>
    `<rect x="${(fx + box.x * scale).toFixed(1)}" y="${(fy + box.y * scale).toFixed(1)}" width="${(box.w * scale).toFixed(1)}" height="${(box.h * scale).toFixed(1)}" rx="${radius}" fill="${fill}"/>`;
  const img = SKETCH.image;
  const bar = (box, fill) => r(box, (box.h * scale) / 2, fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
  <defs><radialGradient id="mancha" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#a3a3a3"/><stop offset="0.55" stop-color="#b9b9b9"/><stop offset="1" stop-color="#d9d9d9" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${cw}" height="${ch}" fill="#d9d9d9"/>
  <ellipse cx="${(fx + (img.x + img.w / 2) * scale).toFixed(1)}" cy="${(fy + (img.y + img.h / 2) * scale).toFixed(1)}" rx="${((img.w / 2) * scale).toFixed(1)}" ry="${((img.h / 2) * scale).toFixed(1)}" fill="url(#mancha)"/>
  ${r(SKETCH.logo, Math.min(8, (SKETCH.logo.h * scale) / 3), '#4d4d4d')}
  ${SKETCH.title.map((line) => bar(line, '#333333')).join('\n  ')}
  ${bar(SKETCH.support, '#5c5c5c')}
  ${r(SKETCH.cta, (SKETCH.cta.h * scale) / 2.6, '#3a3a3a')}
  ${bar(SKETCH.contacts, '#5c5c5c')}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** A mesma disposição por palavras, como `describeSketch` a escreve. */
function describeLayout() {
  const { W, H } = SKETCH;
  const pct = (value, total) => Math.round((value / total) * 100);
  const toY = (y) => HIDDEN.y + (y / H) * (1 - HIDDEN.y * 2);
  const toX = (x) => HIDDEN.x + (x / W) * (1 - HIDDEN.x * 2);
  const lastBase = SKETCH.contacts.y + SKETCH.contacts.h;
  return {
    label: 'Título no topo',
    zones: [
      `Imagem protagonista: ao centro, a meio da arte — cerca de ${pct(SKETCH.image.w, W)}% da largura e ${pct(SKETCH.image.h, H)}% da altura da arte.`,
      'Título: ao centro, no topo, centrado, em 2 linhas. É o maior texto da arte.',
      'Texto de apoio: logo por baixo do título, com o mesmo alinhamento.',
      'Botão: por baixo da imagem protagonista, centrado.',
      `Logótipo: no canto de cima, à esquerda, com cerca de ${pct(SKETCH.logo.w, W)}% da largura — uma assinatura discreta, nunca maior do que isso — e com folga às arestas: pelo menos ${pct(SKETCH.logo.x, W)}% da largura até cada aresta. Nunca encostado a uma aresta.`,
      'Contactos: por baixo do botão, no mesmo bloco e com o mesmo alinhamento do texto, numa linha, em letra pequena mas legível. Não descem para a aresta de baixo: são a última linha do texto, logo a seguir ao botão.',
      `Distâncias às arestas DA IMAGEM QUE DESENHAS: o primeiro texto começa a ${Math.round(toY(SKETCH.logo.y) * 100)}% da altura, a contar da aresta de cima; a base da última linha de texto fica a ${Math.round((1 - toY(lastBase)) * 100)}% da altura acima da aresta de baixo; nenhum texto fica a menos de ${Math.round(toX(SKETCH.logo.x) * 100)}% da largura das arestas dos lados. Daí até às arestas continua só a cena, sem nada escrito por cima.`,
    ],
  };
}

/**
 * A moldura 4:5 com folga, para uma arte em que o conteúdo enche a imagem.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Nas seis gerações desta arte o gerador pôs o logótipo a 4–5% da aresta
 * de cima da imagem 3:4 e o website a 4–6% da de baixo — com o esboço ou
 * sem ele, e também depois da correcção automática. A moldura da
 * aplicação, ao centro, corta 4,2% de cada lado: o logótipo ficava com 1 a
 * 7 px de folga, ou cortado.
 *
 * Aqui a arte entra inteira: reduzida até o logótipo e o website ficarem a
 * 5% das arestas, centrada pelo conteúdo, com a própria arte desfocada por
 * trás a preencher as duas faixas estreitas dos lados (as arestas da arte
 * esbatem-se nela). Não se acrescenta nada à composição; muda só quanto
 * dela cabe na moldura.
 * ──────────────────────────────────────────────────────────────────────────
 */
async function reframe(file) {
  const source = path.resolve(file);
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const lum = (x, y) => {
    const i = (y * width + x) * 3;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  const rowHas = (y, x0, x1, limit) => {
    for (let x = x0; x < x1; x += 1) if (lum(x, y) > limit) return true;
    return false;
  };
  let top = 0;
  while (top < height * 0.2 && !rowHas(top, Math.round(width * 0.03), Math.round(width * 0.4), 150)) top += 1;
  let bottom = height - 1;
  while (bottom > height * 0.8 && !rowHas(bottom, Math.round(width * 0.35), Math.round(width * 0.65), 170)) bottom -= 1;

  const W = 1080;
  const H = 1350;
  const margin = Math.round(H * 0.05);
  const scale = (H - margin * 2) / (bottom - top);
  const side = 6; // as colunas da aresta, onde os geradores deixam por vezes uma tira
  const fgW = Math.round((width - side * 2) * scale);
  const fgH = Math.round(height * scale);
  const left = Math.round((W - fgW) / 2);
  const offsetY = Math.round(margin - top * scale);
  console.log(`  conteúdo ${top}–${bottom}px; redução ${(scale * 100).toFixed(1)}%; faixas dos lados ${left}px`);

  /*
    O fundo é a própria arte reduzida, prolongada em espelho para lá das
    arestas e desfocada: na junção, a cor de um lado e do outro é a mesma, e
    a costura não se vê. (Desfocar a arte inteira, noutra escala, deixava
    duas faixas com outra luz e outro desenho.)
  */
  const reduced = await sharp(source)
    .extract({ left: side, top: 0, width: width - side * 2, height })
    .resize(fgW, fgH)
    .removeAlpha()
    .toBuffer();
  const padTop = Math.max(0, offsetY);
  const padBottom = Math.max(0, H - (offsetY + fgH));
  const background = await sharp(
    await sharp(reduced)
      .extend({ left, right: W - fgW - left, top: padTop, bottom: padBottom, extendWith: 'mirror' })
      .toBuffer(),
  )
    .extract({ left: 0, top: Math.max(0, -offsetY), width: W, height: H })
    .blur(16)
    .toBuffer();
  // As arestas da arte esbatem-se no fundo desfocado, em 36 px.
  const feather = 36;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fgW}" height="${fgH}">
      <defs>
        <linearGradient id="h" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#000"/><stop offset="${(feather / fgW).toFixed(4)}" stop-color="#fff"/>
          <stop offset="${(1 - feather / fgW).toFixed(4)}" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
        </linearGradient>
        <linearGradient id="v" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#000"/><stop offset="${(feather / fgH).toFixed(4)}" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="m"><rect width="100%" height="100%" fill="url(#v)"/></mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#h)" mask="url(#m)"/>
    </svg>`,
  );
  const alpha = await sharp(mask).resize(fgW, fgH).extractChannel(0).toBuffer();
  const foreground = await sharp(reduced).joinChannel(alpha).png().toBuffer();

  // A parte da arte reduzida que passa da moldura fica de fora.
  const cropTop = Math.max(0, -offsetY);
  const visibleH = Math.min(fgH - cropTop, H - Math.max(0, offsetY));
  const piece = await sharp(foreground).extract({ left: 0, top: cropTop, width: fgW, height: visibleH }).toBuffer();
  const info2 = await sharp(background)
    .composite([{ input: piece, left, top: Math.max(0, offsetY) }])
    .webp({ quality: 88 })
    .toFile(path.join(OUT, 'arte-lancamento.webp'));
  console.log(`  → src/kianda/arte-lancamento.webp (${info2.width} × ${info2.height}) a partir de ${path.relative(ROOT, source)}`);
}

/** A moldura de 1080 × 1350, como `coverGeometry`: 1,2% de cada lado e `cover` ao centro. */
async function frame(buffer, width = 1080, height = 1350) {
  const meta = await sharp(buffer).metadata();
  const crop = 0.012;
  const left = Math.round(meta.width * crop);
  const top = Math.round(meta.height * crop);
  return sharp(buffer)
    .extract({ left, top, width: meta.width - left * 2, height: meta.height - top * 2 })
    .resize(width, height, { fit: 'cover', position: 'centre' });
}

const BRAND = {
  name: 'Perfumaria Kianda',
  segment: 'lojas',
  description: 'Perfumaria em Luanda com marcas originais, atendimento próximo e entrega no mesmo dia.',
  contacts: [{ type: 'website', value: DEMO.website }],
  colors: COLORS,
};

const PROPOSAL = path.join(ORIGIN, 'arte-lancamento-proposta.json');
const PERFUME = path.join(OUT, 'perfume.webp');

/**
 * O primeiro passo, à parte: a proposta da Kriar para o pedido.
 *
 * Fica num ficheiro para ser revista ANTES de se gastar a geração — como na
 * revisão da aplicação. Os textos em `textos` podem ser editados à mão; o
 * título fica protegido (`lockedTexts`), como o que o cliente confirmou.
 */
async function proposal() {
  if (!existsSync(PERFUME)) throw new Error('Falta src/kianda/perfume.webp.');
  await mkdir(ORIGIN, { recursive: true });
  console.log('A proposta');
  const plan = await post('/api/ai/plan', {
    brief: DEMO.brief,
    format: 'vertical',
    style: 'auto',
    imageCount: 1,
    itemCount: 1,
    attachments: [{ note: `${DEMO.product}, o perfume a anunciar`, kind: 'produto', dataUrl: await jpegDataUrl(PERFUME, 768, 82) }],
    brand: BRAND,
    lockedTexts: { headline: DEMO.headline },
  });
  const saved = {
    fornecedor: plan.provider ?? plan.source,
    estilo: plan.style,
    textos: {
      headline: DEMO.headline,
      subheadline: plan.plan.subheadline ?? '',
      cta: plan.plan.cta ?? '',
    },
    direccao: plan.direction,
    referencias: plan.references ?? [],
    aviso: plan.notice ?? null,
  };
  await writeFile(PROPOSAL, JSON.stringify(saved, null, 2));
  console.log(JSON.stringify(saved, null, 2));
  console.log(`  → ${path.relative(ROOT, PROPOSAL)}`);
}

async function art() {
  /*
    A arte assenta no azul-marinho da marca (`base: 'primaria'`), e é para
    esse fundo que a aplicação escolhe a versão do logótipo "Para fundo
    escuro" (`pickLogo`). Aqui escolhe-se a mesma.
  */
  const logoFile = path.join(OUT, 'logotipo-fundo-escuro.png');
  for (const file of [logoFile, PERFUME, PROPOSAL]) {
    if (!existsSync(file)) throw new Error(`Falta ${path.relative(ROOT, file)} (a proposta sai de "proposta").`);
  }
  const plan = JSON.parse(readFileSync(PROPOSAL, 'utf8'));
  const logoRef = await pngDataUrl(logoFile, 1024);
  const brand = BRAND;
  const perfumeFile = PERFUME;
  const sketch = await paintSketch();
  await writeFile(path.join(ORIGIN, 'arte-lancamento-esboco.png'), sketch);

  const texts = {
    headline: plan.textos.headline,
    subheadline: plan.textos.subheadline ?? '',
    cta: plan.textos.cta ?? '',
    badge: '',
    price: '',
  };
  console.log(`Textos: ${JSON.stringify(texts)}`);
  const request = {
    direction: plan.direccao,
    // A disposição aprovada, zona a zona, nas palavras de `describeSketch`.
    layout: describeLayout(),
    referenceUsage: plan.referencias ?? [],
    format: 'vertical',
    style: plan.estilo,
    company: brand.name,
    segment: brand.segment,
    colors: COLORS,
    base: 'primaria',
    logoSize: plan.logotipo?.tamanho ?? 'pequeno',
    contactsPlacement: 'texto',
    typography: { display: 'Playfair Display', body: 'Inter', displayKind: 'serif', bodyKind: 'sans' },
    texts,
    items: [{ name: DEMO.product, highlighted: true, hasImage: true }],
    drawLogo: true,
    contacts: [{ label: 'Website', value: DEMO.website }],
    // A ordem da aplicação: o logótipo, o esboço logo a seguir, os produtos.
    references: [
      { role: 'logotipo', label: 'logótipo da Perfumaria Kianda', dataUrl: logoRef },
      { role: 'esboco', label: 'Título no topo', dataUrl: dataUrl(sketch, 'image/png') },
      { role: 'produto', label: DEMO.product, dataUrl: await jpegDataUrl(perfumeFile, 1024, 92) },
    ],
    guidelines: null,
    brandStyle: null,
    memory: [],
  };
  const reviewInput = {
    logo: logoRef,
    expected: { headline: texts.headline, texts: [texts.subheadline, texts.cta].filter(Boolean), contacts: [DEMO.website] },
    prices: [],
    noCta: !texts.cta,
    sketch: true,
    examples: [],
  };

  // Cada tentativa fica guardada, como as versões na aplicação: o dono pode
  // repor qualquer uma (`escolher`).
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let tries = 0;
  const attempt = async (correction) => {
    const generated = await post('/api/ai/artwork', { ...request, correction });
    if (generated.costUsd) spent += generated.costUsd;
    const buffer = Buffer.from(generated.dataUrl.split(',')[1], 'base64');
    tries += 1;
    await writeFile(path.join(ORIGIN, `arte-lancamento-${stamp}-${tries}.png`), buffer);
    const framed = await (await frame(buffer, 1024, 1280)).jpeg({ quality: 88 }).toBuffer();
    const checked = await post('/api/ai/review-art', { art: dataUrl(framed, 'image/jpeg'), ...reviewInput }, 150_000).catch(
      (error) => {
        console.log(`  verificação: ${error.message}`);
        return null;
      },
    );
    return { buffer, generated, review: checked?.review ?? null };
  };

  console.log('2. A geração');
  let chosen = await attempt([]);
  console.log(`  verificação: ${JSON.stringify(chosen.review)}`);
  let corrected = false;
  if (chosen.review?.retry) {
    console.log('3. A correcção');
    const second = await attempt(chosen.review.issues.slice(0, 4));
    console.log(`  verificação: ${JSON.stringify(second.review)}`);
    if (!second.review || second.review.score <= chosen.review.score) {
      chosen = second;
      corrected = true;
    }
  }

  await writeFile(path.join(ORIGIN, 'arte-lancamento.png'), chosen.buffer);
  const info = await (await frame(chosen.buffer)).webp({ quality: 88 }).toFile(path.join(OUT, 'arte-lancamento.webp'));
  await writeFile(
    path.join(ORIGIN, 'arte-lancamento.json'),
    JSON.stringify(
      {
        criada: new Date().toISOString(),
        fornecedor: chosen.generated.provider,
        corrigida: corrected,
        verificacao: chosen.review,
        proposta: plan,
        // O pedido sem os ficheiros (só o papel e o rótulo de cada um).
        pedido: { ...request, references: request.references.map(({ role, label }) => ({ role, label })) },
        prompt: chosen.generated.prompt,
      },
      null,
      2,
    ),
  );
  console.log(`  → src/kianda/arte-lancamento.webp (${info.width} × ${info.height})${corrected ? ', corrigida' : ''}`);
}

// --- Entrada ------------------------------------------------------------------------

const [command, argument] = process.argv.slice(2);
try {
  if (command === 'logo') await logo(Math.min(4, Math.max(1, Number(argument) || 3)));
  else if (command === 'recortar-logo') await cutLogo(argument);
  else if (command === 'versao-escura') await darkVersion();
  else if (command === 'foto') await photo(argument);
  else if (command === 'proposta') await proposal();
  else if (command === 'esboco') {
    // Sem custo: só o esboço e a disposição por palavras, para conferir.
    await mkdir(ORIGIN, { recursive: true });
    await writeFile(path.join(ORIGIN, 'arte-lancamento-esboco.png'), await paintSketch());
    console.log(describeLayout().zones.join('\n'));
  }
  else if (command === 'arte') await art();
  else if (command === 'reenquadrar') await reframe(argument);
  else if (command === 'escolher') {
    // Repõe uma das tentativas guardadas como a arte da página, na moldura 4:5.
    const info = await (await frame(readFileSync(path.resolve(argument)))).webp({ quality: 88 }).toFile(path.join(OUT, 'arte-lancamento.webp'));
    console.log(`  → src/kianda/arte-lancamento.webp (${info.width} × ${info.height}) a partir de ${argument}`);
  }
  else {
    console.log(
      'Uso: node scripts/gerar-kianda.mjs logo [quantos] | recortar-logo <ficheiro> | versao-escura | foto perfume|difusor | proposta | arte',
    );
    process.exit(1);
  }
} finally {
  if (spent > 0) console.log(`Custo registado: ${spent.toFixed(3)} USD`);
}

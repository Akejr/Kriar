/**
 * Pinta a escultura da secção da marca com o verde da página.
 *
 * Lê os originais de `src/escultura/origem/` (as imagens escuras do
 * componente "Sculpture Hero", de guglielmogiannattasio.it) e escreve em
 * `src/escultura/` a mesma imagem num mapa de gradiente: a luminância de
 * cada píxel passa a um tom da rampa verde abaixo. O fundo fica EXACTAMENTE
 * na cor da página (#050706) — o motor recorta a escultura pela distância a
 * essa cor, e um fundo diferente da página escurecia-lhe os brilhos.
 *
 * A escultura deitada sai também prolongada (`escultura-larga.webp`): as
 * nuvens de pérolas das pontas continuam até às margens do ecrã — ver
 * `EXTEND`, mais abaixo.
 *
 *    node scripts/converter-escultura.mjs
 *
 * Para mudar o verde, mexe nas paragens de `RAMP` e corre outra vez.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = path.join(process.cwd(), 'src', 'escultura', 'origem');
const TARGET = path.join(process.cwd(), 'src', 'escultura');

/** O fundo da página (`ink-950`). */
const BACKGROUND = [5, 7, 6];

/**
 * Da sombra ao brilho: o fundo, verdes-musgo nas sombras, verdes médios no
 * corpo da escultura, o néon da Kriar só onde a luz bate e um branco
 * esverdeado nos pontos de brilho das pérolas.
 *
 * A primeira versão subia depressa para o néon, e a escultura saía uma
 * mancha néon chapada, sem volume: o corpo bege do original caía todo no
 * troço mais vivo da rampa. Agora o néon é o realce, como na interface.
 */
const RAMP = [
  [0.0, BACKGROUND],
  [0.1, [10, 14, 8]],
  [0.28, [24, 36, 12]],
  [0.45, [46, 70, 18]],
  [0.62, [86, 124, 26]],
  [0.78, [150, 200, 40]],
  [0.9, [191, 248, 57]],
  [1.0, [236, 255, 200]],
];

/** Curva antes da rampa: puxa os meios-tons para baixo, para ficar volume. */
const GAMMA = 1.35;

/**
 * O prolongamento das pontas, por imagem (o nome sem extensão).
 *
 * Num ecrã largo, a escultura (presa à altura da faixa) não chegava às
 * margens e sobravam dois vazios escuros dos lados. O prolongamento é feito
 * das gotas soltas da própria escultura — pérolas verdadeiras, com a luz
 * delas, tiradas uma a uma —, semeadas para fora de cada ponta numa faixa
 * que ondula, umas sozinhas, outras em grupos. Ficam mais raras, mais
 * pequenas e um pouco mais escuras à medida que se afastam, como pó que se
 * dispersa; mas chegam à borda da imagem. (Copiar bocados inteiros da nuvem
 * dava manchas redondas e esbatidas, uma a seguir à outra.)
 *
 * - `side`: píxeis acrescentados de cada lado. A imagem fica abaixo de 4096
 *   de largura, o limite de textura de muitos GPUs.
 * - `start`: onde acaba a nuvem do original (a coluna em que o
 *   prolongamento começa a contar); `y`: a altura a que a faixa corre;
 *   `wave`: quanto ondula.
 * - `density`: material por coluna (px²), junto à ponta e na borda — o
 *   original tem ~50 onde a nuvem acaba e ~180 no meio dela. O começo é o
 *   que mais se vê (num ecrã de 1920, só os primeiros ~250 px), por isso
 *   começa cheio.
 * - `avoid`: [x, y, raio] de onde não se tiram gotas — as pérolas dos
 *   pontos assinalados, que são únicas.
 */
const EXTEND = {
  escultura: {
    side: 1050,
    seed: 20261015,
    left: { start: 112, y: 330, wave: 24 },
    right: { start: 1876, y: 370, wave: 20 },
    density: [100, 34],
    avoid: [
      [540, 380, 36],
      [948, 228, 36],
      [1020, 410, 36],
      [1190, 268, 36],
      [1795, 418, 36],
    ],
  },
};

const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (r, g, b) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
// Em espaço perceptual: com a luminância linear, os meios-tons caíam todos no escuro.
const lightness = (r, g, b) => Math.cbrt(luminance(r, g, b));

function rampAt(t) {
  for (let index = 1; index < RAMP.length; index += 1) {
    const [end, to] = RAMP[index];
    if (t <= end) {
      const [start, from] = RAMP[index - 1];
      const k = (t - start) / (end - start || 1);
      return from.map((value, channel) => Math.round(value + (to[channel] - value) * k));
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/* ── o prolongamento ─────────────────────────────────────────────────── */

/** Aleatório com semente: correr outra vez dá a mesma imagem. */
function seeded(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Desvio mínimo do fundo (0–255, no canal que mais se afasta) para um píxel ser material. */
const MATERIAL = 14;

/**
 * As gotas soltas da escultura: bocados de material pequenos, mais ou menos
 * redondos e separados do resto por fundo. Cada uma leva a máscara dela,
 * com um píxel à volta (a borda suave da gota), sem as vizinhas.
 */
function findDrops(src, width, height, avoid) {
  const total = width * height;
  const material = new Uint8Array(total);
  for (let p = 0, i = 0; p < total; p += 1, i += 3) {
    const deviation = Math.max(
      Math.abs(src[i] - BACKGROUND[0]),
      Math.abs(src[i + 1] - BACKGROUND[1]),
      Math.abs(src[i + 2] - BACKGROUND[2]),
    );
    material[p] = deviation > MATERIAL ? 1 : 0;
  }

  const label = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  const drops = [];
  let id = 0;
  for (let p = 0; p < total; p += 1) {
    if (!material[p] || label[p] !== -1) continue;
    let top = 0;
    stack[top++] = p;
    label[p] = id;
    let area = 0;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    while (top > 0) {
      const q = stack[--top];
      area += 1;
      const qx = q % width;
      const qy = (q - qx) / width;
      if (qx < x0) x0 = qx;
      if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy;
      if (qy > y1) y1 = qy;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = qx + dx;
          const ny = qy + dy;
          if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const r = ny * width + nx;
          if (material[r] && label[r] === -1) {
            label[r] = id;
            stack[top++] = r;
          }
        }
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const round = area / (w * h) >= 0.4 && w / h >= 0.45 && w / h <= 2.2;
    const inside = x0 > 2 && y0 > 2 && x1 < width - 3 && y1 < height - 3;
    const unique = avoid.some(([ax, ay, radius]) => Math.hypot(cx - ax, cy - ay) < radius);
    if (area >= 3 && area <= 700 && w <= 34 && h <= 34 && round && inside && !unique) {
      drops.push({ id, x0: x0 - 1, y0: y0 - 1, w: w + 2, h: h + 2, area });
    }
    id += 1;
  }

  for (const drop of drops) {
    const mask = new Float32Array(drop.w * drop.h);
    for (let y = 0; y < drop.h; y += 1) {
      for (let x = 0; x < drop.w; x += 1) {
        const sx = drop.x0 + x;
        const sy = drop.y0 + y;
        const own = label[sy * width + sx];
        if (own === drop.id) {
          mask[y * drop.w + x] = 1;
          continue;
        }
        if (own !== -1) continue;
        // A borda: fundo encostado à gota.
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy += 1) {
          for (let dx = -1; dx <= 1 && !touches; dx += 1) {
            touches = label[(sy + dy) * width + sx + dx] === drop.id;
          }
        }
        if (touches) mask[y * drop.w + x] = 1;
      }
    }
    drop.mask = mask;
  }
  return drops;
}

function extend(src, width, height, config) {
  const { side, avoid } = config;
  const [densityNear, densityFar] = config.density;
  const rand = seeded(config.seed);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };

  const W = width + side * 2;
  const out = Buffer.alloc(W * height * 3);
  for (let i = 0; i < out.length; i += 3) {
    out[i] = BACKGROUND[0];
    out[i + 1] = BACKGROUND[1];
    out[i + 2] = BACKGROUND[2];
  }
  for (let y = 0; y < height; y += 1) {
    src.copy(out, (y * W + side) * 3, y * width * 3, (y + 1) * width * 3);
  }

  const drops = findDrops(src, width, height, avoid);
  if (drops.length < 40) throw new Error(`Só ${drops.length} gotas soltas: pouco para semear.`);
  // As grandes reconhecem-se repetidas: saem menos, e cada vez menos para longe.
  const pick = (f) => {
    for (;;) {
      const drop = drops[Math.floor(rand() * drops.length)];
      if (drop.area <= 90 || rand() < 0.3 * (1 - f)) return drop;
    }
  };

  const texel = (x, y, channel) => src[(y * width + x) * 3 + channel];
  // Bilinear, com o fundo fora da imagem.
  const sample = (x, y, channel) => {
    if (x < 0 || y < 0 || x > width - 2 || y > height - 2) return BACKGROUND[channel];
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const top = texel(x0, y0, channel) * (1 - fx) + texel(x0 + 1, y0, channel) * fx;
    const bottom = texel(x0, y0 + 1, channel) * (1 - fx) + texel(x0 + 1, y0 + 1, channel) * fx;
    return top * (1 - fy) + bottom * fy;
  };
  const maskAt = (drop, x, y) => {
    if (x < 0 || y < 0 || x > drop.w - 1 || y > drop.h - 1) return 0;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(drop.w - 1, x0 + 1);
    const y1 = Math.min(drop.h - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const m = drop.mask;
    const top = m[y0 * drop.w + x0] * (1 - fx) + m[y0 * drop.w + x1] * fx;
    const bottom = m[y1 * drop.w + x0] * (1 - fx) + m[y1 * drop.w + x1] * fx;
    return top * (1 - fy) + bottom * fy;
  };

  /** Uma gota posta com o centro em `cx, cy`, reduzida a `scale`. */
  const stamp = (drop, cx, cy, scale, gain) => {
    const dw = Math.max(1, Math.round(drop.w * scale));
    const dh = Math.max(1, Math.round(drop.h * scale));
    const ox = Math.round(cx - dw / 2);
    const oy = Math.round(cy - dh / 2);
    for (let v = 0; v < dh; v += 1) {
      for (let u = 0; u < dw; u += 1) {
        const x = ox + u;
        const y = oy + v;
        if (x < 0 || y < 0 || x >= W || y >= height) continue;
        const fx = (u + 0.5) / scale - 0.5;
        const fy = (v + 0.5) / scale - 0.5;
        // As pontas da imagem prolongada esbatem-se: num ecrã ainda mais largo, não acabam a direito.
        const k = maskAt(drop, fx, fy) * gain * smoothstep(0, 140, Math.min(x, W - 1 - x));
        if (k <= 0.01) continue;
        const i = (y * W + x) * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          const base = BACKGROUND[channel];
          const value = base + (sample(drop.x0 + fx, drop.y0 + fy, channel) - base) * k;
          // Sobrepostas pela mais clara: a rampa sobe nos três canais ao mesmo tempo.
          if (value > out[i + channel]) out[i + channel] = Math.round(value);
        }
      }
    }
  };

  let sown = 0;
  for (const [sideConfig, dir] of [
    [config.left, -1],
    [config.right, 1],
  ]) {
    const { start, y: yc, wave } = sideConfig;
    // Da ponta da nuvem até à borda da imagem prolongada.
    const length = side + (dir < 0 ? start : width - start);
    const STEP = 4;
    let previous = null;
    // Começa por dentro da franja do original e cresce até à densidade cheia: não há junta.
    for (let t = -40; t < length; t += STEP) {
      const f = Math.min(1, Math.max(0, t / length));
      let budget = (densityNear + (densityFar - densityNear) * f) * STEP * smoothstep(-40, 50, t);
      while (budget > 0) {
        const drop = pick(f);
        const scale = Math.min(1, (0.7 + rand() * 0.4) * (1 - 0.25 * f));
        let x;
        let y;
        if (previous && rand() < 0.45) {
          // Em grupo, encostada à anterior.
          x = previous.x + gauss() * 9;
          y = previous.y + gauss() * 7;
        } else {
          x = side + start + dir * (t + rand() * STEP);
          y = yc + dir * wave * Math.sin((t / 560) * Math.PI) + gauss() * 46 * (1 + 0.3 * f);
        }
        stamp(drop, x, y, scale, (0.86 + rand() * 0.14) * (1 - 0.32 * f));
        previous = { x, y };
        budget -= drop.area * scale * scale;
        sown += 1;
      }
    }
  }

  return { data: out, width: W, drops: drops.length, sown };
}

/* ── conversão ───────────────────────────────────────────────────────── */

const files = (await readdir(SOURCE)).filter((name) => /\.(webp|png|jpe?g)$/i.test(name));
if (files.length === 0) {
  console.log(`Nada a converter em ${SOURCE}.`);
  process.exit(0);
}

for (const name of files) {
  const { data, info } = await sharp(path.join(SOURCE, name))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // O fundo do original, lido nos quatro cantos: é o zero da rampa.
  const corner = Math.max(2, Math.round(info.width * 0.012));
  let sum = 0;
  let count = 0;
  for (const [cx, cy] of [
    [0, 0],
    [info.width - corner, 0],
    [0, info.height - corner],
    [info.width - corner, info.height - corner],
  ]) {
    for (let y = cy; y < cy + corner; y += 1) {
      for (let x = cx; x < cx + corner; x += 1) {
        const i = (y * info.width + x) * 3;
        sum += lightness(data[i], data[i + 1], data[i + 2]);
        count += 1;
      }
    }
  }
  const floor = sum / count;

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    const l = lightness(data[i], data[i + 1], data[i + 2]);
    const t = Math.min(1, Math.max(0, (l - floor) / (1 - floor))) ** GAMMA;
    const [r, g, b] = rampAt(t);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }

  const base = name.replace(/\.(webp|png|jpe?g)$/i, '');
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality: 88 })
    .toFile(path.join(TARGET, `${base}.webp`));
  console.log(`${base}.webp  ${info.width} × ${info.height}  (fundo do original ${floor.toFixed(3)})`);

  const extension = EXTEND[base];
  if (extension) {
    const wide = extend(out, info.width, info.height, extension);
    await sharp(wide.data, { raw: { width: wide.width, height: info.height, channels: 3 } })
      .webp({ quality: 86 })
      .toFile(path.join(TARGET, `${base}-larga.webp`));
    console.log(
      `${base}-larga.webp  ${wide.width} × ${info.height}  (+${extension.side} px de cada lado; ${wide.sown} gotas semeadas, de ${wide.drops} soltas no original)`,
    );
  }
}

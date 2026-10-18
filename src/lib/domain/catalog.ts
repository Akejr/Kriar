import type {
  ContactType,
  FormatId,
  FormatSpec,
  SegmentId,
  StyleId,
  TextRole,
} from './types';

// --- Formatos ---------------------------------------------------------------

/**
 * Formatos disponíveis, pela ordem em que fazem sentido escolher.
 *
 * O vertical vem primeiro porque é o que ocupa mais ecrã no telemóvel, que é
 * onde a maior parte dos clientes de uma empresa angolana vê as publicações.
 * As medidas são as recomendadas por cada plataforma; quando a plataforma
 * aceita várias, fica a que ganha mais espaço no feed.
 */
export const FORMATS: FormatSpec[] = [
  {
    id: 'vertical',
    label: 'Ocupa mais ecrã no telemóvel. A escolha por omissão.',
    hint: '1080 × 1350',
    platform: 'Instagram e Facebook',
    width: 1080,
    height: 1350,
  },
  {
    id: 'quadrado',
    label: 'Serve em qualquer rede sem recorte.',
    hint: '1080 × 1080',
    platform: 'Qualquer rede',
    width: 1080,
    height: 1080,
  },
  {
    id: 'story',
    label: 'Ecrã inteiro, para stories e estado do WhatsApp.',
    hint: '1080 × 1920',
    platform: 'Stories e WhatsApp',
    width: 1080,
    height: 1920,
  },
  {
    id: 'reels',
    /*
      Mesmos píxeis do story, propósito diferente.

      A interface do Reels tapa a base com a legenda e os botões, e o topo
      com o nome da conta. O que distingue este formato não é a medida — é o
      que se pede ao gerador: uma peça que para o dedo, com a mensagem no
      centro e não nas pontas.
    */
    label: 'Capa de vídeo. Mensagem ao centro, longe dos botões.',
    hint: '1080 × 1920',
    platform: 'Reels e TikTok',
    width: 1080,
    height: 1920,
  },
  {
    id: 'linkedin',
    label: 'Imagem única no feed. Formato deitado, mais sóbrio.',
    hint: '1200 × 627',
    platform: 'LinkedIn',
    width: 1200,
    height: 627,
  },
  {
    id: 'horizontal',
    label: 'Miniatura de vídeo, capa de evento, apresentação.',
    hint: '1920 × 1080',
    platform: 'YouTube e capas',
    width: 1920,
    height: 1080,
  },
];

export const DEFAULT_FORMAT: FormatId = 'vertical';

const formatsById = new Map(FORMATS.map((f) => [f.id, f]));

export function getFormat(id: FormatId | string | undefined | null): FormatSpec {
  return formatsById.get(id as FormatId) ?? formatsById.get(DEFAULT_FORMAT)!;
}

export function isFormatId(value: unknown): value is FormatId {
  return typeof value === 'string' && formatsById.has(value as FormatId);
}

/**
 * O formato cuja proporção mais se aproxima de uma imagem.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Serve a edição de fotografias, onde não há publicação a compor: o que se
 * quer é pedir ao gerador uma proporção parecida com a da fotografia que o
 * cliente enviou, para ela voltar com o mesmo aspecto.
 *
 * A comparação é feita no logaritmo da proporção, e não na diferença
 * directa. Entre uma fotografia 9:16 (0,5625) e os candidatos 0,5625 e 0,8,
 * a diferença directa chega para decidir; mas entre 1,0 e 1,78 a diferença
 * directa favorece sempre o lado estreito — no logaritmo, "duas vezes mais
 * larga" e "duas vezes mais alta" ficam à mesma distância, que é como o
 * olho as lê.
 *
 * A ORIENTAÇÃO decide primeiro, e não é um detalhe.
 *
 * Uma fotografia 4:3 fica exactamente à mesma distância logarítmica de 1:1
 * e de 16:9 — 4:3 é a média geométrica dos dois —, e o desempate pela ordem
 * do catálogo devolvia `quadrado` para uma fotografia deitada. Pedir um
 * quadrado obriga o gerador a recompor a cena, e numa edição por zonas isso
 * é o pior resultado possível: a composição com máscaras deixa de encaixar
 * e a garantia de "o resto fica igual" perde-se. Entre proporções
 * igualmente próximas, a que não vira a fotografia ganha sempre.
 *
 * `reels` nunca é devolvido: tem os píxeis do `story` e escolher entre os
 * dois é uma decisão de propósito, não de medida.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function closestFormat(width: number, height: number): FormatId {
  if (!width || !height) return DEFAULT_FORMAT;

  /** Deitada, em pé ou quadrada — com uma zona morta para o quase-quadrado. */
  const orientation = (ratio: number) => (ratio > 1.05 ? 1 : ratio < 0.95 ? -1 : 0);

  const ratio = width / height;
  const target = Math.log(ratio);
  const wanted = orientation(ratio);

  const usable = FORMATS.filter((format) => format.id !== 'reels');
  const sameWay = usable.filter(
    (format) => orientation(format.width / format.height) === wanted,
  );
  const candidates = sameWay.length > 0 ? sameWay : usable;

  let best: FormatId = DEFAULT_FORMAT;
  let distance = Infinity;
  for (const format of candidates) {
    const current = Math.abs(Math.log(format.width / format.height) - target);
    if (current < distance) {
      distance = current;
      best = format.id;
    }
  }
  return best;
}

// --- Segmentos --------------------------------------------------------------

export const SEGMENTS: Array<{ id: SegmentId; label: string; examples: string }> = [
  { id: 'restaurantes', label: 'Restauração', examples: 'restaurantes, cafés, catering, padarias' },
  { id: 'beleza', label: 'Beleza e bem-estar', examples: 'salões, barbearias, estética, spa' },
  { id: 'lojas', label: 'Lojas e produtos', examples: 'retalho, moda, perfumaria, electrónica' },
  { id: 'servicos', label: 'Serviços', examples: 'consultoria, obras, saúde, formação, transportes' },
  { id: 'outro', label: 'Outro', examples: 'qualquer outra actividade' },
];

const segmentsById = new Map(SEGMENTS.map((s) => [s.id, s]));

export function getSegment(id: SegmentId | string | undefined | null) {
  return segmentsById.get(id as SegmentId) ?? segmentsById.get('outro')!;
}

export function isSegmentId(value: unknown): value is SegmentId {
  return typeof value === 'string' && segmentsById.has(value as SegmentId);
}

// --- Estilos ----------------------------------------------------------------

/**
 * Estilos oferecidos ao cliente.
 *
 * Cada `guidance` é o que entra na instrução do gerador. Repara no que cada
 * uma NÃO diz: nenhuma fixa uma cor, um objecto ou uma composição. Clean não
 * é fundo branco, elegante não é preto e dourado, tecnológico não é azul com
 * circuitos. Essas associações eram o atalho que fazia todas as artes do
 * mesmo estilo saírem iguais.
 */
export const STYLES: Array<{
  id: StyleId;
  label: string;
  hint: string;
  /** Descrição enviada à IA. Vazia em `auto`, que não é um estilo. */
  guidance: string;
}> = [
  {
    id: 'auto',
    label: 'Automático',
    hint: 'Escolhemos a direcção que serve o pedido.',
    guidance: '',
  },
  {
    id: 'clean',
    label: 'Clean',
    hint: 'Poucos elementos, leitura rápida.',
    guidance:
      'Poucos elementos, espaço livre generoso, leitura rápida, hierarquia evidente e decoração contida. Não exige fundo branco nem ausência de cor: exige que nada compita com a mensagem.',
  },
  {
    id: 'elegante',
    label: 'Elegante',
    hint: 'Tipografia cuidada, materiais sofisticados.',
    guidance:
      'Tipografia cuidada, composição equilibrada, materiais e luz sofisticados, detalhes discretos. Não exige preto e dourado: a sofisticação vem do cuidado, não da cor.',
  },
  {
    id: 'vibrante',
    label: 'Vibrante',
    hint: 'Energia, contraste, ritmo visual.',
    guidance:
      'Energia, contrastes expressivos, ritmo visual e cores de destaque compatíveis com a marca. Não significa encher a arte de elementos: a energia vem do contraste e do ritmo, não da quantidade.',
  },
  {
    id: 'tecnologico',
    label: 'Tecnológico',
    hint: 'Precisão, superfícies contemporâneas.',
    guidance:
      'Precisão, superfícies contemporâneas, interfaces ou profundidade quando forem relevantes para a mensagem, iluminação controlada. Não exige azul, circuitos, néon nem ecrãs.',
  },
  {
    id: 'cinematografico',
    label: 'Cinematográfico',
    hint: 'Narrativa, profundidade, luz dramática.',
    guidance:
      'Narrativa visual, enquadramento expressivo, profundidade e iluminação dramática. Não exige cenários escuros nem personagens de filmes.',
  },
];

export const DEFAULT_STYLE: StyleId = 'auto';

const stylesById = new Map(STYLES.map((s) => [s.id, s]));

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === 'string' && stylesById.has(value as StyleId);
}

export function getStyle(id: StyleId | string | undefined | null) {
  return stylesById.get(id as StyleId) ?? stylesById.get(DEFAULT_STYLE)!;
}

/**
 * Estilos que o sistema pode escolher quando o cliente pede `auto`.
 *
 * `auto` fica de fora por não ser um destino possível.
 */
export const CONCRETE_STYLES = STYLES.filter((style) => style.id !== 'auto');

/**
 * Traduz estilos de versões anteriores.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Projectos gravados com `minimalista`, `moderno` ou `promocional` continuam
 * a abrir. A migração é de LEITURA e não destrutiva: o valor antigo é
 * traduzido quando o projecto entra na aplicação.
 *
 * `promocional` vira `vibrante` por ser a leitura mais fiel da intenção de
 * quem o escolheu — cores fortes e energia. O objectivo promocional continua
 * a existir, mas no briefing, que é onde pertence.
 * ──────────────────────────────────────────────────────────────────────────
 */
const LEGACY_STYLES: Record<string, StyleId> = {
  minimalista: 'clean',
  moderno: 'clean',
  promocional: 'vibrante',
};

export function migrateStyle(value: unknown): StyleId {
  if (isStyleId(value)) return value;
  if (typeof value === 'string' && LEGACY_STYLES[value]) return LEGACY_STYLES[value];
  return DEFAULT_STYLE;
}

/**
 * Palavras do pedido que sugerem um estilo.
 *
 * Só sugestão: preenche o selector quando o cliente ainda não escolheu, e
 * nunca sobrepõe uma escolha dele. Não detecta `vibrante` a partir de
 * "promoção" — uma promoção não tem estilo obrigatório.
 */
export function detectStyleHint(brief: string): StyleId | null {
  const text = brief.toLowerCase();
  if (/\belegante|sofisticad|luxo|premium|requintad|exclusiv/.test(text)) return 'elegante';
  if (/\bminimalista|simples|limpo|clean|discret|sóbri|sobri/.test(text)) return 'clean';
  if (/\bvibrante|energia|ousad|jovem|alegre|colorid|divertid/.test(text)) return 'vibrante';
  if (/\btecnolog|digital|app|aplicaç|software|inovaç|moderno/.test(text)) return 'tecnologico';
  if (/\bcinema|dramátic|dramatic|épic|epic|narrativ|atmosfer/.test(text)) return 'cinematografico';
  return null;
}

// --- Contactos --------------------------------------------------------------

export const CONTACT_TYPES: Array<{
  type: ContactType;
  label: string;
  placeholder: string;
  /** Como aparece na arte. */
  artPrefix: string;
  inputMode?: 'tel' | 'url' | 'text';
}> = [
  {
    type: 'whatsapp',
    label: 'WhatsApp',
    placeholder: '+244 923 000 000',
    artPrefix: 'WhatsApp',
    inputMode: 'tel',
  },
  {
    type: 'telefone',
    label: 'Telemóvel',
    placeholder: '+244 923 000 000',
    artPrefix: 'Tel.',
    inputMode: 'tel',
  },
  {
    type: 'instagram',
    label: 'Instagram',
    placeholder: '@aminhaempresa',
    artPrefix: 'Instagram',
  },
  { type: 'facebook', label: 'Facebook', placeholder: 'facebook.com/aminhaempresa', artPrefix: 'Facebook' },
  { type: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/company/...', artPrefix: 'LinkedIn' },
  { type: 'website', label: 'Website', placeholder: 'www.aminhaempresa.ao', artPrefix: '', inputMode: 'url' },
  { type: 'endereco', label: 'Endereço', placeholder: 'Rua, bairro, município', artPrefix: '' },
];

const contactsByType = new Map(CONTACT_TYPES.map((c) => [c.type, c]));

export function getContactType(type: ContactType) {
  return contactsByType.get(type) ?? CONTACT_TYPES[0];
}

export function isContactType(value: unknown): value is ContactType {
  return typeof value === 'string' && contactsByType.has(value as ContactType);
}

/** Linha única de um contacto, como aparece na arte. */
export function formatContactForArt(type: ContactType, value: string): string {
  const spec = getContactType(type);
  const clean = value.trim();
  if (!clean) return '';
  if (!spec.artPrefix) return clean;
  if (type === 'instagram') {
    const handle = clean.startsWith('@') ? clean : `@${clean.replace(/^.*instagram\.com\//, '')}`;
    return handle;
  }
  return `${spec.artPrefix} ${clean}`;
}

// --- Papéis de texto --------------------------------------------------------

export const TEXT_ROLE_LABELS: Record<TextRole, string> = {
  headline: 'Título',
  subheadline: 'Subtítulo',
  price: 'Preço',
  cta: 'Chamada para acção',
  contacts: 'Contactos',
  badge: 'Etiqueta',
};

/**
 * Dados de exemplo.
 *
 * Empresa, contactos e publicações fictícios, para se poder percorrer o fluxo
 * completo sem ter de carregar ficheiros. O logótipo (e a versão dele para
 * fundos escuros) e as fotografias do perfume e do difusor são os da
 * identidade da Perfumaria Kianda, em `src/kianda/` — os mesmos que a página
 * de entrada mostra (`src/lib/landing/kianda.ts`). Foram criados para esta
 * marca fictícia; não há imagens nem marcas de terceiros. Se um deles não
 * carregar, entra o desenho de antes, em canvas.
 *
 * Os textos das publicações saem do planeador determinístico, a partir dos
 * pedidos de exemplo — exactamente o mesmo caminho que um pedido real segue
 * em modo de demonstração.
 */
import { applyGuardrails } from '@/lib/ai/guardrails';
import { planDeterministically } from '@/lib/ai/deterministicPlanner';
import type { PlanRequest } from '@/lib/ai/schema';
import { paintBackground, recipeFor } from '@/lib/composition/backgrounds';
import {
  createComposition,
  createContact,
  createItem,
  createProject,
} from '@/lib/domain/factories';
import type { Account, Brand, Project } from '@/lib/domain/types';
import { KIANDA_LOGO, KIANDA_LOGO_ON_DARK, KIANDA_PHOTOS } from '@/lib/landing/kianda';
import { newId } from '@/lib/utils/id';
import type { StaticImageData } from 'next/image';
import { registerAsset } from './assetCache';
import type { DataBackend } from './backend';

// Sem anotação de tipo de propósito: assim o TypeScript infere `string` em
// vez de `string | null | undefined`, e estas cores podem ser usadas
// directamente no desenho das imagens de exemplo.
const BRAND_COLORS = {
  primary: '#152A4A',
  secondary: '#E7DCC8',
  accent: '#C98A3C',
};

const BRAND_COMPANY = {
  name: 'Perfumaria Kianda',
  segment: 'lojas' as const,
  description:
    'Perfumaria em Luanda com marcas originais, atendimento próximo e entrega no mesmo dia.',
  website: 'www.kianda.ao',
  address: 'Rua Comandante Che Guevara, Maianga, Luanda',
};

const BRIEFS = [
  {
    name: 'Perfumes de autor',
    brief:
      'Quero anunciar estes perfumes por 15.000 Kz. Usa um estilo elegante e destaca as encomendas pelo WhatsApp.',
    style: 'elegante' as const,
    format: 'vertical' as const,
    images: 1,
  },
  {
    name: 'Promoção de fim de semana',
    brief:
      'Promoção de fim de semana nos difusores de ambiente a 7.500 Kz. Mostra que temos entrega em Luanda.',
    // "Promocional" deixou de ser estilo: promoção é objectivo, e este
    // pedido pede energia — logo, vibrante.
    style: 'vibrante' as const,
    format: 'quadrado' as const,
    images: 2,
  },
];

// --- Desenho das imagens de exemplo -----------------------------------------

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha a criar a imagem de exemplo.'))),
      'image/png',
    );
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

type SeedFile = { blob: Blob; width: number; height: number; provenance: 'upload' | 'local' };

/** Um ficheiro da identidade da Kianda, como um cliente o carregaria. */
async function load(image: StaticImageData): Promise<SeedFile> {
  const response = await fetch(image.src);
  if (!response.ok) throw new Error(`Não foi possível carregar ${image.src}.`);
  return { blob: await response.blob(), width: image.width, height: image.height, provenance: 'upload' };
}

/**
 * O ficheiro da identidade; sem ele (sem rede, por exemplo), o desenho de
 * antes. A conta de demonstração nunca fica por criar por causa de uma
 * imagem.
 */
async function loadOrDraw(image: StaticImageData, draw: () => HTMLCanvasElement): Promise<SeedFile> {
  try {
    return await load(image);
  } catch {
    const canvas = draw();
    return { blob: await toBlob(canvas), width: canvas.width, height: canvas.height, provenance: 'local' };
  }
}

/** O monograma de antes: quadrado azul-marinho com o "K" e o nome ao lado. */
function drawMonogram(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = BRAND_COLORS.primary;
  roundRect(ctx, 8, 30, 140, 140, 34);
  ctx.fill();
  ctx.fillStyle = BRAND_COLORS.secondary;
  ctx.font = '700 86px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('K', 78, 104);
  ctx.fillStyle = BRAND_COLORS.primary;
  ctx.font = '600 58px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KIANDA', 176, 104);
  return canvas;
}

/** Frasco abstracto, com fundo transparente. */
function drawBottle(variant: 'alto' | 'largo', glass: string, cap: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;

  const bodyW = variant === 'alto' ? 420 : 560;
  const bodyH = variant === 'alto' ? 720 : 560;
  const bodyX = (canvas.width - bodyW) / 2;
  const bodyY = canvas.height - bodyH - 120;

  // Gargalo e tampa
  const neckW = bodyW * 0.3;
  const neckX = (canvas.width - neckW) / 2;
  ctx.fillStyle = glass;
  roundRect(ctx, neckX, bodyY - 110, neckW, 130, 14);
  ctx.fill();

  ctx.fillStyle = cap;
  roundRect(ctx, neckX - 26, bodyY - 230, neckW + 52, 140, 20);
  ctx.fill();

  // Corpo
  const gradient = ctx.createLinearGradient(bodyX, bodyY, bodyX + bodyW, bodyY + bodyH);
  gradient.addColorStop(0, glass);
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.92)');
  gradient.addColorStop(1, glass);
  ctx.fillStyle = gradient;
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, variant === 'alto' ? 42 : 70);
  ctx.fill();

  // Reflexo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  roundRect(ctx, bodyX + bodyW * 0.14, bodyY + bodyH * 0.1, bodyW * 0.12, bodyH * 0.62, 30);
  ctx.fill();

  // Rótulo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  roundRect(ctx, bodyX + bodyW * 0.18, bodyY + bodyH * 0.42, bodyW * 0.64, bodyH * 0.3, 12);
  ctx.fill();
  ctx.fillStyle = cap;
  ctx.fillRect(bodyX + bodyW * 0.28, bodyY + bodyH * 0.52, bodyW * 0.44, 10);
  ctx.fillRect(bodyX + bodyW * 0.34, bodyY + bodyH * 0.58, bodyW * 0.32, 6);

  return canvas;
}

// --- Sementeira --------------------------------------------------------------

export type SeedResult = {
  brand: Brand;
  projects: Project[];
};

export async function seedDemoData(
  backend: DataBackend,
  account: Account,
): Promise<SeedResult> {
  const now = new Date().toISOString();

  /** Um ficheiro, carregado ou desenhado, guardado como recurso da conta. */
  const store = async (kind: 'product' | 'logo', name: string, file: SeedFile) => {
    const asset = await backend.uploadAsset({
      accountId: account.id,
      kind,
      file: file.blob,
      name,
      width: file.width,
      height: file.height,
      provenance: file.provenance,
    });
    registerAsset(asset, await backend.resolveAssetUrl(asset));
    return asset;
  };

  // 1. Fotografias de produto: o perfume (alto) e o difusor (largo).
  const products = [
    {
      name: 'kianda-perfume-noite-de-luanda.webp',
      image: KIANDA_PHOTOS.perfume.src,
      draw: () => drawBottle('alto', '#DCE6F2', BRAND_COLORS.accent),
    },
    {
      name: 'kianda-difusor-de-ambiente.webp',
      image: KIANDA_PHOTOS.difusor.src,
      draw: () => drawBottle('largo', '#EFE6D6', BRAND_COLORS.primary),
    },
  ];

  const productAssetIds: string[] = [];
  for (const product of products) {
    const asset = await store('product', product.name, await loadOrDraw(product.image, product.draw));
    productAssetIds.push(asset.id);
  }

  // 2. Logótipo, e a versão para fundos escuros (a que vai para as artes de base azul-marinho).
  const logoAsset = await store('logo', 'kianda-logotipo.png', await loadOrDraw(KIANDA_LOGO.src, drawMonogram));
  const darkLogo = await load(KIANDA_LOGO_ON_DARK.src).catch(() => null);
  const darkLogoAsset = darkLogo ? await store('logo', 'kianda-logotipo-fundo-escuro.png', darkLogo) : null;

  // 3. Marca
  const contacts = [
    createContact({ type: 'whatsapp', value: '+244 923 000 000', showByDefault: true }),
    createContact({ type: 'instagram', value: '@kianda.ao', showByDefault: true }),
    createContact({ type: 'website', value: 'www.kianda.ao', showByDefault: false }),
    createContact({
      type: 'endereco',
      value: BRAND_COMPANY.address,
      showByDefault: false,
    }),
  ];

  /*
    O exemplo é uma empresa À PARTE.

    Reaproveitava a marca da conta, com o mesmo identificador — e numa conta
    já configurada, "Carregar dados de exemplo" escrevia a Perfumaria Kianda
    por cima da empresa do cliente. Agora só reaproveita um esqueleto vazio,
    o de uma conta acabada de criar; em qualquer outro caso, é mais uma
    empresa na conta.
  */
  const existing = (await backend.listBrands(account.id)).find(
    (entry) => !entry.onboardingComplete && !entry.company.name.trim(),
  );
  const brand: Brand = {
    id: existing?.id ?? newId('brd'),
    accountId: account.id,
    company: BRAND_COMPANY,
    contacts,
    identity: {
      colors: BRAND_COLORS,
      fontDisplay: 'playfair',
      fontBody: 'inter',
      logoAssetId: logoAsset.id,
      logoForLightBgAssetId: null,
      logoForDarkBgAssetId: darkLogoAsset?.id ?? null,
      setupMode: 'manual',
      importReport: null,
    },
    onboardingComplete: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const savedBrand = await backend.saveBrand(brand);

  // 4. Publicações, com os textos vindos do planeador determinístico
  const projects: Project[] = [];
  for (const sample of BRIEFS) {
    const base = createProject(account.id, savedBrand, {
      name: sample.name,
      format: sample.format,
      style: sample.style,
    });

    const images = productAssetIds.slice(0, sample.images).map((assetId) => ({
      assetId,
      focal: { x: 0.5, y: 0.5 },
      note: '',
      kind: 'produto' as const,
    }));

    const planRequest: PlanRequest = {
      brief: sample.brief,
      format: sample.format,
      style: sample.style,
      imageCount: images.length,
      itemCount: 0,
      attempt: 0,
      recentIdeas: [],
      seenIdeas: [],
      refinement: '',
      currentTexts: {},
      removedTexts: [],
      identity: null,
      learnedStyle: '',
      memory: [],
      attachments: [],
      brand: {
        name: savedBrand.company.name,
        segment: savedBrand.company.segment,
        description: savedBrand.company.description,
        contacts: contacts
          .filter((contact) => contact.showByDefault)
          .map((contact) => ({ type: contact.type, value: contact.value })),
        colors: savedBrand.identity.colors,
      },
      lockedTexts: {},
    };

    const { plan } = applyGuardrails(planDeterministically(planRequest), planRequest);

    const composition = createComposition(savedBrand, {
      format: sample.format,
      style: sample.style,
    });

    const project: Project = {
      ...base,
      brief: sample.brief,
      status: 'composicao',
      planSource: 'deterministico',
      missingFields: plan.missingFields,
      composition: {
        ...composition,
        templateId: plan.templateId,
        images,
        // As opções vêm do pedido do exemplo, pelo planeador determinístico.
        items: plan.items.map((name) => createItem(name)),
        highlightedItemIndex: plan.highlightedItemIndex,
        texts: {
          ...(plan.badge ? { badge: { value: plan.badge, locked: false } } : {}),
          headline: { value: plan.headline, locked: false },
          ...(plan.subheadline
            ? { subheadline: { value: plan.subheadline, locked: false } }
            : {}),
          ...(plan.price ? { price: { value: plan.price, locked: false } } : {}),
          ...(plan.cta ? { cta: { value: plan.cta, locked: false } } : {}),
        },
        visualDirection: plan.visualDirection,
        background: {
          mode: 'modelo',
          assetId: null,
          prompt: plan.backgroundPrompt,
          producedBy: null,
        },
      },
    };

    projects.push(await backend.saveProject(project));
  }

  // 5. Um dos exemplos já com fundo local gerado, para se ver a arte final
  const first = projects[0];
  if (first) {
    const recipe = recipeFor(first.composition.style, first.composition.colors, first.brief, 0);
    const canvas = paintBackground(recipe, 1080, 1350);
    const blob = await toBlob(canvas);
    const asset = await backend.uploadAsset({
      accountId: account.id,
      kind: 'generated-bg',
      file: blob,
      name: 'exemplo-fundo-local.png',
      width: 1080,
      height: 1350,
      provenance: 'local',
    });
    registerAsset(asset, await backend.resolveAssetUrl(asset));

    projects[0] = await backend.saveProject({
      ...first,
      status: 'arte-final',
      composition: {
        ...first.composition,
        background: {
          mode: 'gerado',
          assetId: asset.id,
          prompt: first.composition.background.prompt,
          producedBy: 'local',
        },
      },
    });
  }

  return { brand: savedBrand, projects };
}

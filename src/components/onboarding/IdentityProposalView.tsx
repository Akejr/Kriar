'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Maximize2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { colorOf, SOURCE_LABEL } from '@/lib/brand/identitySpec';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import { FONT_CATALOG, getFont, type FontId } from '@/lib/fontCatalog';
import type {
  Brand,
  BrandColorRole,
  BrandIdentitySpec,
  BrandSectionId,
  BrandVisual,
  DecisionSource,
  LogoPlacement,
} from '@/lib/domain/types';
import { bestTextOn, tonalRamp } from '@/lib/utils/color';
import { cn } from '@/lib/utils/cn';
import { ColorField } from '@/components/ui/ColorField';
import { Dialog } from '@/components/ui/Dialog';
import { Badge, Button, Callout, Select } from '@/components/ui/primitives';

/**
 * O design system da marca, numa grelha compacta.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Cinco cartões de altura contida, não cinco secções empilhadas. A versão
 * anterior crescia até dois ou três ecrãs de altura, e a maior parte desse
 * espaço era vazio — molduras à espera de uma imagem que o cliente tinha de
 * mandar gerar peça por peça.
 *
 * Duas decisões de estrutura dão conta disso:
 *
 *  · tudo é gerado quando a proposta é pedida, pelo que não há molduras
 *    vazias a ocupar espaço;
 *  · "Ajustar" abre um DIÁLOGO em vez de expandir o cartão. Expandir
 *    desalinhava a grelha e empurrava tudo para baixo, que é exactamente a
 *    rolagem que queríamos evitar.
 * ──────────────────────────────────────────────────────────────────────────
 */

const PLACEMENT_LABEL: Record<LogoPlacement, string> = {
  'superior-esquerdo': 'Sup. esquerdo',
  'superior-centro': 'Sup. centro',
  'superior-direito': 'Sup. direito',
  'inferior-esquerdo': 'Inf. esquerdo',
  'inferior-centro': 'Inf. centro',
  'inferior-direito': 'Inf. direito',
};

const RADIUS_PX: Record<BrandIdentitySpec['graphics']['cornerRadius'], number> = {
  recto: 0,
  suave: 10,
  redondo: 999,
};

/** Papéis com escala tonal. `accent` entra apenas se o cliente a acrescentar. */
const RAMP_ROLES: BrandColorRole[] = ['primary', 'secondary', 'accent'];

/**
 * Estado de uma moldura de visual.
 *
 * Existe porque "sem imagem" não é uma só situação. Mostrar o mesmo ícone
 * para quem está na fila, para quem está a ser gerado e para quem falhou faz
 * parecer que a aplicação não gerou nada.
 */
export type VisualState = 'pronto' | 'a-gerar' | 'na-fila' | 'falhou' | 'vazio';

export function IdentityProposalView({
  spec,
  brand,
  assets,
  logoUrl,
  logoOnLightUrl,
  logoOnDarkUrl,
  visualStates,
  busy,
  onRegenerateVisual,
  onColorChange,
  onAddAccent,
  onRemoveAccent,
  onTypographyChange,
  onTaglineChange,
  onVisualPromptChange,
  onPreviewVisual,
}: {
  spec: BrandIdentitySpec;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
  logoUrl: string | null;
  /** Versão própria para fundos claros, quando o cliente a carregou. */
  logoOnLightUrl: string | null;
  /** Versão própria para fundos escuros, quando o cliente a carregou. */
  logoOnDarkUrl: string | null;
  visualStates: Partial<Record<BrandVisual['kind'], VisualState>>;
  /** `true` enquanto há uma geração a correr. */
  busy: boolean;
  onRegenerateVisual: () => void;
  onColorChange: (role: BrandColorRole, hex: string) => void;
  onAddAccent: () => void;
  onRemoveAccent: () => void;
  onTypographyChange: (patch: { display?: FontId; body?: FontId }) => void;
  onTaglineChange: (value: string) => void;
  onVisualPromptChange: (kind: BrandVisual['kind'], prompt: string) => void;
  onPreviewVisual: (visual: BrandVisual) => void;
}) {
  const [editing, setEditing] = React.useState<BrandSectionId | null>(null);

  const bgLight = colorOf(spec, 'bgLight', '#F4F2EE');
  const bgDark = colorOf(spec, 'bgDark', '#14181A');
  const primary = colorOf(spec, 'primary', '#16324F');
  const secondary = colorOf(spec, 'secondary', '#FFFFFF');
  const accent = spec.colors.find((entry) => entry.role === 'accent')?.hex ?? null;
  const onLight = colorOf(spec, 'textOnLight', '#1B1B1B');

  const visual = (kind: BrandVisual['kind']) =>
    spec.visuals.find((entry) => entry.kind === kind);
  const url = (entry: BrandVisual | undefined) =>
    entry?.assetId ? (assets[entry.assetId]?.url ?? null) : null;

  const identidade = visual('identidade');

  const ramps = spec.colors.filter((entry) => RAMP_ROLES.includes(entry.role));
  const roleColors = spec.colors.filter((entry) => !RAMP_ROLES.includes(entry.role));

  const state = (entry: BrandVisual | undefined): VisualState =>
    (entry && visualStates[entry.kind]) || 'vazio';

  return (
    <div className="flex flex-col gap-2.5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-ink-800">
              <img src={logoUrl} alt="" className="max-h-5 max-w-5 object-contain" />
            </span>
          ) : null}
          <h2 className="truncate text-[14px] font-semibold tracking-tight text-fg">
            {brand.company.name || 'A tua marca'}
          </h2>
          <Badge tone="neon">
            <Check className="size-2.5" aria-hidden />
            Design system
          </Badge>
        </div>
        <span className="shrink-0 text-[10.5px] text-fg-faint">
          v{spec.version} ·{' '}
          {spec.producedBy === 'ia' ? 'gerado por IA' : 'regras locais'}
        </span>
      </div>

      {state(identidade) === 'falhou' ? (
        <Callout
          tone="warn"
          size="sm"
          title="A folha de identidade não saiu desta vez."
          action={
            <Button variant="outline" size="sm" onClick={onRegenerateVisual} disabled={busy}>
              <RefreshCw className="size-3.5" aria-hidden />
              Gerar novo
            </Button>
          }
        >
          O resto da proposta está pronto. Pede outra imagem para poderes aprovar.
        </Callout>
      ) : null}

      {/*
        Grelha de três colunas. A identidade visual ocupa duas, porque é a
        peça que o cliente quer ver; o resto são cartões de uma coluna com
        altura contida.
      */}
      <div className="grid gap-2.5 xl:grid-cols-3">
        {/* --- Identidade visual (hero) ----------------------------------- */}
        {/*
          A folha de identidade sozinha, a ocupar as duas colunas.

          Tinha ao lado um bloco creme com o logótipo e o nome da empresa
          escrito por baixo. Saiu: não era nem uma peça da identidade nem uma
          decisão do sistema, era uma amostra de um logótipo que já se vê na
          própria fotografia, com o nome repetido duas linhas abaixo do
          cabeçalho do cartão. Ocupava um terço do cartão principal para não
          dizer nada.

          "Gerar novo" em vez de "Ajustar": a imagem não se afina com
          campos, pede-se outra. O briefing continua editável no diálogo das
          instruções, que é onde faz sentido mexer-lhe.
        */}
        <Card
          title="Identidade visual"
          section="identidade"
          locked={spec.lockedSections.includes('identidade')}
          onEdit={setEditing}
          editLabel="Gerar novo"
          editIcon={RefreshCw}
          editDisabled={busy}
          onEditClick={onRegenerateVisual}
          /*
            Uma coluna de largura, duas linhas de altura.

            A folha é gerada em quadrado. Antes o cartão ocupava duas colunas
            e tinha o bloco do nome ao lado; sem esse bloco, um quadrado com
            duas colunas de largura ficava altíssimo e devolvia a rolagem que
            esta grelha existe para evitar. Em pé encaixa na altura de duas
            linhas e a imagem aparece grande sem empurrar nada.
          */
          className="xl:row-span-2"
        >
          <VisualFrame
            visual={identidade}
            url={url(identidade)}
            state={state(identidade)}
            fill
            onPreview={onPreviewVisual}
          />
        </Card>

        {/* --- Paleta ------------------------------------------------------ */}
        <Card
          title="Paleta"
          section="paleta"
          locked={spec.lockedSections.includes('paleta')}
          onEdit={setEditing}
          aside={`${ramps.length * 10} tons`}
        >
          <div className="flex flex-col gap-1.5">
            {ramps.map((entry) => (
              <Ramp
                key={entry.role}
                label={entry.label}
                hex={entry.hex}
                source={entry.source}
              />
            ))}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {roleColors.map((entry) => (
              <div key={entry.role} className="min-w-0" title={`${entry.label} — ${entry.usage}`}>
                <div
                  className="h-7 rounded-[6px] ring-1 ring-inset ring-black/15"
                  style={{ backgroundColor: entry.hex }}
                />
                <p className="mt-0.5 truncate text-[9px] text-fg-faint">{entry.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-1.5">
            <ContrastChip label="Aa sobre claro" fg={onLight} bg={bgLight} />
            <ContrastChip
              label="Aa sobre escuro"
              fg={colorOf(spec, 'textOnDark', '#F4F4F4')}
              bg={bgDark}
            />
          </div>
        </Card>

        {/* --- Tipografia -------------------------------------------------- */}
        <Card
          title="Tipografia"
          section="tipografia"
          locked={spec.lockedSections.includes('tipografia')}
          onEdit={setEditing}
          aside={`${spec.typeScale.length} degraus`}
        >
          {/*
            O espécime cresce para preencher o cartão.

            A grelha alinha as alturas por linha, e este cartão tem menos
            conteúdo do que os vizinhos: ficava com um terço de vazio por
            baixo. Em vez de encurtar o cartão, que desalinhava a grelha, o
            espécime estica e passa a mostrar a escala toda — o espaço passa
            a dizer algo.
          */}
          <div
            className="flex flex-1 items-center gap-3 overflow-hidden rounded-[9px] px-3 py-2.5"
            style={{ backgroundColor: bgLight }}
          >
            <p
              className="shrink-0 text-[2.6rem] font-bold leading-[0.85] tracking-tight"
              style={{
                color: primary,
                fontFamily: `var(${getFont(spec.typography.display).cssVar})`,
              }}
            >
              Aa
            </p>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              {spec.typeScale.slice(0, 6).map((step) => (
                <div key={step.id} className="flex items-baseline gap-2">
                  <span className="w-7 shrink-0 font-mono text-[8.5px] text-black/40">
                    {step.sizePx}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={step.usage}
                    style={{
                      // Reduzido: o que interessa é a proporção entre
                      // degraus, não o tamanho absoluto.
                      fontSize: `${Math.max(9, Math.min(17, step.sizePx * 0.17))}px`,
                      fontWeight: step.weight,
                      lineHeight: 1.15,
                      letterSpacing: `${step.tracking}em`,
                      textTransform: step.uppercase ? 'uppercase' : 'none',
                      color: step.font === 'display' ? primary : onLight,
                      fontFamily: `var(${
                        getFont(
                          step.font === 'display'
                            ? spec.typography.display
                            : spec.typography.body,
                        ).cssVar
                      })`,
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <dl className="mt-2 grid grid-cols-2 gap-x-2 text-[10.5px]">
            <Spec term="Títulos" value={getFont(spec.typography.display).label} />
            <Spec term="Texto" value={getFont(spec.typography.body).label} />
          </dl>

          {/* Uma linha num cartão pequeno: o tom fica só no ícone, o texto é o do cartão. */}
          {spec.typography.unavailable.length > 0 ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-fg-muted">
              <AlertTriangle className="mt-px size-2.5 shrink-0 text-warn/90" aria-hidden />
              O manual pede {spec.typography.unavailable[0].requested}; não a temos.
            </p>
          ) : null}
        </Card>

        {/* --- Aplicações do logótipo -------------------------------------- */}
        {/*
          Aplicações desenhadas pela aplicação, não geradas.

          ────────────────────────────────────────────────────────────────
          Eram duas imagens de IA, e o gerador dava-lhes o pior resultado
          possível: um logótipo azul-marinho num envelope azul-marinho, a
          marca a desaparecer na peça feita para a mostrar.

          Aqui o ficheiro real do cliente assenta sobre as duas cores de
          fundo da paleta. É instantâneo, não custa nada, e mostra o
          contraste VERDADEIRO — que é precisamente a pergunta a que estas
          duas caixas respondem.
          ────────────────────────────────────────────────────────────────
        */}
        <Card
          title="Aplicações do logótipo"
          section="logotipo"
          locked={spec.lockedSections.includes('logotipo')}
          onEdit={setEditing}
        >
          <div className="grid grid-cols-2 gap-1.5">
            <LogoOnSurface
              logoUrl={logoOnLightUrl ?? logoUrl}
              ownVersion={Boolean(logoOnLightUrl)}
              background={bgLight}
              caption="Sobre claro"
              fallbackText={onLight}
              name={brand.company.name}
              font={getFont(spec.typography.display).cssVar}
            />
            <LogoOnSurface
              logoUrl={logoOnDarkUrl ?? logoUrl}
              ownVersion={Boolean(logoOnDarkUrl)}
              background={bgDark}
              caption="Sobre escuro"
              fallbackText={colorOf(spec, 'textOnDark', '#F4F4F4')}
              name={brand.company.name}
              font={getFont(spec.typography.display).cssVar}
            />
          </div>

          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px]">
            <Spec term="Mínimo" value={`${spec.logoRules.minWidthPx} px`} />
            <Spec
              term="Margem"
              value={`${Math.round(spec.logoRules.clearSpaceRatio * 100)}%`}
            />
            <Spec
              term="Posição"
              value={PLACEMENT_LABEL[spec.logoRules.preferredPlacements[0]] ?? '—'}
            />
            <Spec
              term="Apoio"
              value={
                spec.logoRules.needsBackdropOn === 'nenhum'
                  ? 'não precisa'
                  : spec.logoRules.needsBackdropOn
              }
            />
          </dl>
        </Card>

        {/* --- Fundos e elementos ------------------------------------------ */}
        <Card
          title="Fundos e elementos"
          section="fundos"
          locked={spec.lockedSections.includes('fundos')}
          onEdit={setEditing}
        >
          {/*
            Fundos como cor, não como ficheiro.

            A textura era uma quarta geração paga para ilustrar o que a
            paleta já diz. As cores acompanham a empresa como DADOS: cada
            publicação recebe-as em palavras no prompt, e é de lá que sai o
            fundo da arte — não de uma imagem guardada aqui.
          */}
          <div className="grid grid-cols-3 gap-1.5">
            {spec.backgrounds.slice(0, 3).map((background) => (
              <div key={background.id} className="min-w-0" title={background.description}>
                <div
                  className="rounded-[7px] ring-1 ring-inset ring-black/15"
                  style={{
                    aspectRatio: '1 / 1',
                    background:
                      background.hexes.length > 1
                        ? `linear-gradient(145deg, ${background.hexes[0]}, ${background.hexes[1]})`
                        : background.hexes[0],
                  }}
                />
                <p className="mt-0.5 truncate text-[9.5px] text-fg-faint">{background.label}</p>
              </div>
            ))}
          </div>

          {/* Símbolos desenhados com os tokens propostos */}
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5 rounded-[9px] px-2.5 py-2"
            style={{ backgroundColor: bgLight }}
          >
            <span
              className="px-2.5 py-1.5 text-[10.5px] font-semibold"
              style={{
                backgroundColor: primary,
                color: bestTextOn(primary),
                borderRadius: RADIUS_PX[spec.graphics.cornerRadius],
                boxShadow:
                  spec.graphics.shadow === 'nenhuma'
                    ? 'none'
                    : spec.graphics.shadow === 'discreta'
                      ? '0 2px 5px rgba(0,0,0,0.14)'
                      : '0 6px 14px rgba(0,0,0,0.26)',
                fontFamily: `var(${getFont(spec.typography.body).cssVar})`,
              }}
            >
              Botão
            </span>
            <span
              className="px-2 py-1 text-[10px] font-medium"
              style={{
                color: primary,
                border: `${spec.graphics.lineWeight === 'fina' ? 1 : spec.graphics.lineWeight === 'media' ? 1.5 : 2}px solid ${primary}`,
                borderRadius: RADIUS_PX[spec.graphics.cornerRadius],
                fontFamily: `var(${getFont(spec.typography.body).cssVar})`,
              }}
            >
              Contorno
            </span>
            <span
              className="px-2 py-1.5 text-[10px]"
              style={{
                backgroundColor: secondary,
                color: bestTextOn(secondary),
                borderRadius: RADIUS_PX[spec.graphics.cornerRadius],
                fontFamily: `var(${getFont(spec.typography.body).cssVar})`,
              }}
            >
              Cartão
            </span>
            {accent ? (
              <span
                className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: accent,
                  color: bestTextOn(accent),
                  borderRadius: 999,
                  fontFamily: `var(${getFont(spec.typography.body).cssVar})`,
                }}
              >
                Etiqueta
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1">
            <Chip label="Cantos" value={spec.graphics.cornerRadius} />
            <Chip label="Sombra" value={spec.graphics.shadow} />
            <Chip label="Linhas" value={spec.graphics.lineWeight} />
          </div>
        </Card>
      </div>

      {/* --- Diálogos de ajuste ------------------------------------------- */}
      <EditDialog
        section="identidade"
        title="Ajustar a identidade visual"
        open={editing === 'identidade'}
        onClose={() => setEditing(null)}
      >
        <LabelledInput
          label="Assinatura sugerida"
          defaultValue={spec.tagline?.value ?? ''}
          placeholder="Deixa vazio para não ter assinatura"
          onCommit={onTaglineChange}
        />
        {identidade ? (
          <PromptField
            label="Instrução da folha de identidade"
            hint="É isto que vai ser pedido ao gerador na próxima actualização."
            value={identidade.prompt}
            onCommit={(prompt) => onVisualPromptChange('identidade', prompt)}
          />
        ) : null}
      </EditDialog>

      <EditDialog
        section="paleta"
        title="Ajustar a paleta"
        open={editing === 'paleta'}
        onClose={() => setEditing(null)}
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {spec.colors.map((entry) => (
            <ColorField
              key={entry.role}
              label={entry.label}
              value={entry.hex}
              onChange={(hex) => onColorChange(entry.role, hex)}
              onClear={entry.role === 'accent' ? onRemoveAccent : undefined}
            />
          ))}
        </div>

        {/*
          A terceira cor não existe por omissão. A maioria das marcas tem
          duas, e mostrar uma terceira derivada era afirmar que a empresa tem
          uma cor que nunca escolheu.
        */}
        {!accent ? (
          <Button variant="outline" onClick={onAddAccent}>
            <Plus className="size-3.5" aria-hidden />
            Acrescentar terceira cor
          </Button>
        ) : null}
      </EditDialog>

      <EditDialog
        section="tipografia"
        title="Ajustar a tipografia"
        open={editing === 'tipografia'}
        onClose={() => setEditing(null)}
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          <FontPicker
            label="Títulos"
            value={spec.typography.display}
            onChange={(display) => onTypographyChange({ display })}
          />
          <FontPicker
            label="Texto"
            value={spec.typography.body}
            onChange={(body) => onTypographyChange({ body })}
          />
        </div>

        {/* Escala completa, que no cartão só mostra os primeiros degraus. */}
        <div className="rounded-[10px] border border-line bg-ink-950/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-faint">
            Escala completa
          </p>
          <ul className="flex flex-col gap-1.5">
            {spec.typeScale.map((step) => (
              <li key={step.id} className="flex items-baseline gap-2 text-[11.5px]">
                <span className="w-16 shrink-0 font-mono text-[10px] text-fg-faint">
                  {step.sizePx}px
                </span>
                <span className="min-w-0 flex-1 truncate text-fg">{step.label}</span>
                <span className="shrink-0 font-mono text-[10px] text-fg-faint">
                  {step.weight}/{step.lineHeight}
                  {step.uppercase ? ' · caixa alta' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </EditDialog>

      <EditDialog
        section="logotipo"
        title="Ajustar as aplicações do logótipo"
        open={editing === 'logotipo'}
        onClose={() => setEditing(null)}
      >
        {!brand.identity.logoForDarkBgAssetId && !spec.logoRules.worksOnDark ? (
          <Callout tone="warn" size="sm" title="O teu logótipo não contrasta sobre fundo escuro.">
            Usamos uma área de contraste atrás — nunca lhe mudamos a cor. Se tiveres uma
            versão para fundos escuros, carrega-a no painel ao lado.
          </Callout>
        ) : null}
        <p className="text-[11.5px] leading-relaxed text-fg-muted">
          As duas caixas ao lado são o teu ficheiro desenhado sobre as cores de fundo da
          paleta, sem geração nenhuma pelo meio: é o contraste real que vais ter nas
          publicações.
        </p>
      </EditDialog>

      <EditDialog
        section="fundos"
        title="Ajustar fundos e elementos"
        open={editing === 'fundos'}
        onClose={() => setEditing(null)}
      >
        {spec.graphics.notes ? (
          <p className="text-[11.5px] leading-relaxed text-fg-muted">{spec.graphics.notes}</p>
        ) : null}
        <p className="text-[11.5px] leading-relaxed text-fg-muted">
          Estes fundos são cores da tua marca, não ficheiros. Cada publicação recebe-os
          na instrução de geração, e é de lá que sai o fundo da arte.
        </p>
      </EditDialog>
    </div>
  );
}

// --- Peças ------------------------------------------------------------------

/**
 * Cartão de altura contida.
 *
 * `Ajustar` abre um diálogo. Expandir o cartão desalinhava a grelha e
 * empurrava o resto para baixo — a rolagem que esta estrutura existe para
 * evitar.
 */
function Card({
  title,
  section,
  locked,
  aside,
  onEdit,
  editLabel = 'Ajustar',
  editIcon: EditIcon = Pencil,
  editDisabled = false,
  onEditClick,
  className,
  children,
}: {
  title: string;
  section: BrandSectionId;
  locked: boolean;
  aside?: string;
  onEdit: (section: BrandSectionId) => void;
  /**
   * Rótulo da acção do cartão.
   *
   * A paleta e a tipografia ajustam-se: o cliente escreve um código de cor
   * ou escolhe uma fonte, e essa decisão passa a ser dele. Uma fotografia
   * não se ajusta com campos — pede-se outra. Daí o cartão da identidade
   * visual dizer "Gerar novo".
   */
  editLabel?: string;
  editIcon?: React.ComponentType<{ className?: string }>;
  editDisabled?: boolean;
  /** Quando dado, substitui a abertura do diálogo. */
  onEditClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-[12px] border border-line bg-ink-900/60 p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-fg">
          <span className="truncate">{title}</span>
          {aside ? (
            <span className="shrink-0 rounded-full bg-ink-800 px-1.5 py-0.5 text-[9px] font-medium text-fg-faint">
              {aside}
            </span>
          ) : null}
          {locked ? (
            <span
              title="Ajustado por ti. Uma actualização não toca nesta secção."
              className="shrink-0 text-neon"
            >
              <Check className="size-3" aria-hidden />
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={() => (onEditClick ? onEditClick() : onEdit(section))}
          disabled={editDisabled}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-fg-muted transition-colors hover:text-neon disabled:cursor-not-allowed disabled:opacity-40"
        >
          <EditIcon className="size-2.5" aria-hidden />
          {editLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function EditDialog({
  title,
  open,
  onClose,
  children,
}: {
  section: BrandSectionId;
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width="md"
      footer={
        <Button variant="primary" onClick={onClose}>
          <Check className="size-4" aria-hidden />
          Concluir
        </Button>
      }
    >
      <div className="flex flex-col gap-3.5">{children}</div>
    </Dialog>
  );
}

/**
 * Escala tonal de uma cor de marca.
 *
 * Dez degraus derivados em HSL, com o 500 a ser sempre a cor original. É o
 * que transforma uma cor num sistema: há um tom para fundos, um para
 * elementos e um para texto, todos da mesma família.
 */
function Ramp({
  label,
  hex,
  source,
}: {
  label: string;
  hex: string;
  source: DecisionSource;
}) {
  const ramp = React.useMemo(() => tonalRamp(hex), [hex]);

  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[10px] font-medium text-fg">
          {label}
          <span className="ml-1 font-mono text-[9px] uppercase text-fg-faint">{hex}</span>
        </p>
        <span className="shrink-0 text-[9px] text-fg-faint">{SOURCE_LABEL[source]}</span>
      </div>
      <div className="flex overflow-hidden rounded-[5px] ring-1 ring-inset ring-black/15">
        {ramp.map((step) => (
          <span
            key={step.step}
            title={`${step.step} · ${step.hex}`}
            className="h-6 flex-1"
            style={{ backgroundColor: step.hex }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Moldura de um visual gerado.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Não tem botão de geração: tudo é gerado quando a proposta é pedida. Uma
 * moldura vazia com um botão "Gerar" era espaço morto a pedir trabalho ao
 * cliente que a aplicação já devia ter feito.
 *
 * Mas vazia tem de dizer POR QUE está vazia. Antes mostrava sempre o mesmo
 * ícone a pulsar, e três situações distintas — à espera da vez, a ser gerada
 * agora, falhou — ficavam indistinguíveis. O resultado prático foi concluir
 * que a aplicação não gerava imagem nenhuma.
 * ──────────────────────────────────────────────────────────────────────────
 */
function VisualFrame({
  visual,
  url,
  state,
  ratio,
  fill = false,
  caption,
  onPreview,
}: {
  visual: BrandVisual | undefined;
  url: string | null;
  state: VisualState;
  ratio?: string;
  /** Ocupa a altura disponível do cartão em vez de fixar uma proporção. */
  fill?: boolean;
  caption?: string;
  onPreview: (visual: BrandVisual) => void;
}) {
  if (!visual) return null;

  return (
    <div className={cn('min-w-0', fill && 'flex min-h-0 flex-1 flex-col')}>
      <div
        className={cn(
          'relative overflow-hidden rounded-[8px] bg-ink-950/70 ring-1 ring-inset ring-line',
          fill && 'min-h-0 flex-1',
        )}
        style={fill ? undefined : { aspectRatio: ratio }}
      >
        {url ? (
          <>
            <img src={url} alt={visual.label} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onPreview(visual)}
              aria-label={`Ver ${visual.label} em grande`}
              className="absolute inset-0 grid place-items-center bg-ink-950/0 text-transparent transition-colors hover:bg-ink-950/45 hover:text-fg"
            >
              <Maximize2 className="size-4" aria-hidden />
            </button>
          </>
        ) : (
          <FrameState state={state} />
        )}

        {/*
          Pílula escura com ponto âmbar, como as etiquetas de estado. Fica por
          cima de uma fotografia: o fundo tem de ser opaco o bastante para o
          texto se ler sobre qualquer imagem.
        */}
        {visual.stale ? (
          <span className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink-950/85 py-0.5 pl-1.5 pr-2 text-[9.5px] font-medium text-fg-muted ring-1 ring-line-strong backdrop-blur-sm">
            <span aria-hidden className="size-1.5 rounded-full bg-warn" />
            desactualizado
          </span>
        ) : null}
      </div>
      {caption ? (
        <p className="mt-0.5 truncate text-[9.5px] text-fg-faint">{caption}</p>
      ) : null}
    </div>
  );
}

/**
 * O ficheiro do logótipo sobre uma cor de fundo da paleta.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Substitui duas gerações de IA que davam o resultado errado: o logótipo
 * sobre material da mesma cor que ele, invisível.
 *
 * Aqui não há nada a adivinhar. É o ficheiro que o cliente carregou, em
 * `object-contain` para não esticar nem cortar, sobre a cor de fundo que a
 * paleta declara. O contraste que se vê é o contraste que vai existir.
 *
 * Sem logótipo, mostra o nome da empresa na tipografia proposta — que é a
 * aplicação provisória que as regras da identidade prevêem.
 * ──────────────────────────────────────────────────────────────────────────
 */
function LogoOnSurface({
  logoUrl,
  ownVersion,
  background,
  caption,
  fallbackText,
  name,
  font,
}: {
  logoUrl: string | null;
  /** `true` quando é a versão própria desta superfície, não o principal. */
  ownVersion: boolean;
  background: string;
  caption: string;
  fallbackText: string;
  name: string;
  font: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className="grid place-items-center overflow-hidden rounded-[8px] p-3 ring-1 ring-inset ring-black/15"
        style={{ aspectRatio: '1 / 1', backgroundColor: background }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`Logótipo ${caption.toLowerCase()}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p
            className="truncate text-[13px] font-semibold tracking-tight"
            style={{ color: fallbackText, fontFamily: `var(${font})` }}
          >
            {name || 'A tua marca'}
          </p>
        )}
      </div>
      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[9.5px] text-fg-faint">
        <span className="truncate">{caption}</span>
        {/*
          Dizer QUAL ficheiro está à vista.

          Sem isto as duas caixas são indistinguíveis de um caso em que a
          versão própria não está a ser usada — que era precisamente o
          defeito. Com a etiqueta, o cliente vê que o ficheiro que carregou
          entrou.
        */}
        {ownVersion ? (
          <span className="shrink-0 text-neon" title="A usar a versão que carregaste para esta superfície.">
            versão própria
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** O interior de uma moldura sem imagem. */
function FrameState({ state }: { state: VisualState }) {
  if (state === 'a-gerar') {
    return (
      <div className="grid size-full place-items-center gap-1 p-2 text-center">
        <Sparkles
          className="size-4 animate-[kriar-pulse-soft_1.2s_ease-in-out_infinite] text-neon"
          aria-hidden
        />
        <span className="text-[9px] font-medium text-neon">a gerar</span>
      </div>
    );
  }

  if (state === 'falhou') {
    return (
      <div className="grid size-full place-items-center gap-1 p-2 text-center">
        <AlertTriangle className="size-4 text-warn/90" aria-hidden />
        <span className="text-[9px] font-medium text-fg-muted">falhou</span>
      </div>
    );
  }

  if (state === 'na-fila') {
    return (
      <div className="grid size-full place-items-center gap-1 p-2 text-center">
        <Clock className="size-4 text-fg-faint" aria-hidden />
        <span className="text-[9px] text-fg-faint">na fila</span>
      </div>
    );
  }

  return (
    <div className="grid size-full place-items-center p-2">
      <Sparkles className="size-4 text-fg-faint/60" aria-hidden />
    </div>
  );
}

function ContrastChip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <span
      className="flex-1 rounded-[6px] px-2 py-1.5 text-center text-[9.5px] font-medium ring-1 ring-inset ring-black/15"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-line bg-ink-950/60 px-2 py-0.5 text-[9.5px] text-fg-muted">
      <span className="text-fg-faint">{label}: </span>
      {value}
    </span>
  );
}

function Spec({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 text-fg-faint">{term}</dt>
      <dd className="min-w-0 truncate text-fg-muted">{value}</dd>
    </div>
  );
}

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontId;
  onChange: (id: FontId) => void;
}) {
  const id = React.useId().replace(/:/g, '');
  return (
    <div>
      <label htmlFor={`fonte-${id}`} className="mb-1 block text-[12px] text-fg-muted">
        {label}
      </label>
      <Select
        id={`fonte-${id}`}
        value={value}
        onChange={(event) => onChange(event.target.value as FontId)}
        className="h-10 text-[13px]"
      >
        {FONT_CATALOG.map((font) => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function LabelledInput({
  label,
  defaultValue,
  placeholder,
  onCommit,
}: {
  label: string;
  defaultValue: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const id = React.useId().replace(/:/g, '');
  return (
    <div>
      <label htmlFor={`campo-${id}`} className="mb-1 block text-[12px] text-fg-muted">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={`campo-${id}`}
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={70}
          onBlur={(event) => onCommit(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-ink-950/70 px-3 text-[13px] text-fg outline-none focus:border-neon/60"
        />
        {defaultValue ? (
          <button
            type="button"
            onClick={() => onCommit('')}
            aria-label={`Remover ${label}`}
            className="grid size-10 shrink-0 place-items-center rounded-[10px] text-fg-faint transition-colors hover:bg-ink-800 hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Instrução de um visual.
 *
 * Exposta de propósito: é o que vai ser pedido ao gerador, e quem conhece o
 * negócio corrige melhor do que nós adivinhamos.
 */
function PromptField({
  label,
  hint,
  value,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const id = React.useId().replace(/:/g, '');
  return (
    <div>
      <label htmlFor={`prompt-${id}`} className="mb-1 block text-[12px] text-fg-muted">
        {label}
      </label>
      <textarea
        id={`prompt-${id}`}
        rows={3}
        defaultValue={value}
        maxLength={700}
        onBlur={(event) => onCommit(event.target.value)}
        className="w-full resize-none rounded-[10px] border border-line bg-ink-950/70 px-3 py-2 text-[12.5px] leading-relaxed text-fg outline-none focus:border-neon/60"
      />
      {hint ? <p className="mt-1 text-[11px] text-fg-faint">{hint}</p> : null}
    </div>
  );
}

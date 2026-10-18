'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { libraryOf } from '@/lib/brand/library';
import type { Brand, BrandMemory, BrandStyleLearning } from '@/lib/domain/types';
import { BrandArtsLearning } from '@/components/brand/BrandArtsLearning';
import { BrandHeader } from '@/components/brand/BrandHeader';
import { BrandMemoryCard } from '@/components/brand/BrandMemoryCard';
import { CompanyFields } from '@/components/brand/CompanyFields';
import { IdentityFields } from '@/components/brand/IdentityFields';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Card, Spinner } from '@/components/ui/primitives';
import { TabPanel, Tabs, type TabItem } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceBackdrop } from '@/components/ui/WorkspaceBackdrop';
import { useBrandMemory } from '@/store/brandMemory';
import { useSession } from '@/store/session';
import { usePageHeader } from '@/store/shell';

/*
  A página Marca, em separadores.

  ────────────────────────────────────────────────────────────────────────────
  Era uma coluna de seis cartões — resumo, dados, identidade, biblioteca,
  memória e apagar — com mais de três ecrãs de altura. A queixa foi "muito
  confusa, muitas informações, muito scroll", e as três coisas tinham a
  mesma causa: tudo aberto ao mesmo tempo, e o resumo do topo a repetir o
  que os cartões de baixo já mostravam.

  Agora o topo diz quem é a empresa numa linha (o `BrandHeader`), e cada
  parte abre no seu separador. O cabeçalho e os separadores ficam presos ao
  topo da área que rola: o Guardar e a troca de separador estão sempre a um
  clique, por mais comprido que seja o formulário.

  Dois modelos de gravação continuam lado a lado, e os separadores dizem
  qual é qual:
   · "Empresa" e "Identidade" editam um rascunho, gravado com o Guardar. Um
     ponto verde no separador diz onde há alterações por guardar;
   · "Biblioteca" e "Memória" gravam-se sozinhas (custam uma leitura por IA
     e não podem depender de o cliente se lembrar de carregar em Guardar).
     Nunca têm ponto.
  ────────────────────────────────────────────────────────────────────────────
*/

const SECTIONS = ['empresa', 'identidade', 'biblioteca', 'memoria'] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_COPY: Record<Section, { label: string; description: string }> = {
  empresa: {
    label: 'Empresa',
    description:
      'Dados e contactos da empresa. Orientam as publicações novas; as já criadas não mudam.',
  },
  identidade: {
    label: 'Identidade',
    description:
      'Logótipo, cores e tipografia: é isto que as artes novas usam. As já criadas não mudam.',
  },
  biblioteca: {
    label: 'Biblioteca',
    description:
      'As artes que representam a marca. As novas seguem o estilo delas, sem copiar nenhuma. Grava-se sozinho.',
  },
  memoria: {
    label: 'Memória',
    description:
      'O que a Kriar aprendeu com o teu uso, em regras curtas que entram nas ideias e nas artes. Grava-se sozinho.',
  },
};

/** O separador pedido no endereço; "empresa" quando falta ou não existe. */
function parseSection(raw: string | null): Section {
  return SECTIONS.find((section) => section === raw) ?? 'empresa';
}

/**
 * A parte da identidade que o rascunho edita, para comparar.
 *
 * O estilo aprendido e a memória ficam de fora: gravam-se sozinhos e entram
 * no rascunho já gravados (ver o efeito de sincronização). Comparar o resto
 * todo — e não só logótipo, cores e fontes — apanha também o que a
 * importação de um manual escreve (`setupMode`, `importReport`): o ponto do
 * separador e o Guardar têm de concordar sempre.
 */
function editableIdentity(identity: Brand['identity']): string {
  return JSON.stringify({ ...identity, styleLearning: null, memory: null });
}

export default function MarcaPage() {
  usePageHeader(['Marca']);
  /*
    `useSearchParams` precisa de uma fronteira de Suspense numa página
    pré-gerada: sem ela, o `next build` falha ("useSearchParams() should be
    wrapped in a suspense boundary"). No browser não chega a suspender.
  */
  return (
    <React.Suspense fallback={<Loading />}>
      <MarcaScreen />
    </React.Suspense>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner label="A carregar a marca…" />
    </div>
  );
}

function MarcaScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const { account, brand, brands, saveBrand, updateBrand, deleteCompany } = useSession();
  const memory = useBrandMemory();

  const [draft, setDraft] = React.useState<Brand | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ name?: string }>({});
  const [learningMemory, setLearningMemory] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  /*
    O separador activo vive no endereço (`?separador=`).

    Assim um recarregamento, ou uma ligação para "a memória da marca",
    abrem no sítio certo. Mas `router.replace` só muda o endereço depois de
    uma ida ao servidor, e um separador que espera pela rede parece avariado
    — ainda mais numa ligação móvel. Por isso o separador pedido entra logo
    em `requested`, e larga-se quando o endereço o alcança. Com dois cliques
    seguidos, o endereço do primeiro não puxa a página para trás.
  */
  const urlSection = parseSection(searchParams.get('separador'));
  const [requested, setRequested] = React.useState<Section | null>(null);
  if (requested !== null && requested === urlSection) setRequested(null);
  const section = requested ?? urlSection;

  /*
    Só se monta um separador quando é aberto — e depois fica montado,
    escondido.

    A biblioteca guarda dentro dela as artes escolhidas e ainda por ler, e o
    progresso de uma leitura que leva meio minuto; a identidade guarda o que
    encontrou num manual. Desmontar ao trocar de separador deitava isso fora
    sem aviso. Escondido, o separador não ocupa altura nem entra na ordem do
    teclado.
  */
  const [visited, setVisited] = React.useState<ReadonlySet<Section>>(() => new Set([section]));
  if (!visited.has(section)) setVisited(new Set([...visited, section]));

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickyRef = React.useRef<HTMLDivElement>(null);
  /** Pedidos para pôr o foco no nome da empresa (o Guardar sem nome). */
  const [nameFocus, setNameFocus] = React.useState(0);

  /*
    O rascunho segue a marca gravada — sem perder o que está por guardar.

    Repunha o rascunho a cada mudança da marca. Com a biblioteca e a memória,
    que se gravam sozinhas (custam uma leitura por IA e não podem depender de
    o cliente se lembrar de carregar em Guardar), isso apagava as alterações
    por guardar dos outros cartões. Agora: sem alterações pendentes, o
    rascunho passa a ser a marca gravada; com alterações pendentes, só o
    estilo e a memória entram nele.

    Mudar de EMPRESA é outra coisa: o rascunho de uma não pode ir parar à
    outra, e recomeça.
  */
  const synced = React.useRef<Brand | null>(null);
  React.useEffect(() => {
    if (!brand) return;
    const previous = synced.current;
    synced.current = brand;
    setDraft((current) => {
      if (!current || !previous || current.id !== brand.id) return brand;
      if (JSON.stringify(current) === JSON.stringify(previous)) return brand;
      return {
        ...current,
        identity: {
          ...current.identity,
          styleLearning: brand.identity.styleLearning ?? null,
          memory: brand.identity.memory ?? null,
        },
      };
    });
  }, [brand]);

  // Cada separador abre no princípio: o fim do formulário da empresa não
  // tem nada a ver com o topo da memória.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [section]);

  React.useEffect(() => {
    if (nameFocus > 0) document.getElementById('empresa-nome')?.focus();
  }, [nameFocus]);

  /*
    O cabeçalho preso ao topo não pode tapar o campo com o foco.

    Quem anda pelo formulário com Tab (ou Shift+Tab, para cima) faz o
    browser rolar até ao campo seguinte — e, sem isto, o campo parava
    debaixo do cabeçalho, onde não se vê. `scroll-padding-top` diz ao
    browser quanto do topo está ocupado; a altura muda com a largura do
    ecrã (o cabeçalho parte-se em duas linhas), por isso é medida.
  */
  const ready = Boolean(draft && brand && account);
  React.useEffect(() => {
    const scroller = scrollRef.current;
    const sticky = stickyRef.current;
    if (!ready || !scroller || !sticky) return;
    const apply = () => {
      scroller.style.scrollPaddingTop = `${sticky.offsetHeight + 16}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(sticky);
    return () => observer.disconnect();
  }, [ready]);

  if (!draft || !brand || !account) return <Loading />;

  const companyDirty =
    JSON.stringify([draft.company, draft.contacts]) !==
    JSON.stringify([brand.company, brand.contacts]);
  const identityDirty = editableIdentity(draft.identity) !== editableIdentity(brand.identity);
  /*
    Há alterações por guardar quando um dos dois separadores do rascunho as
    tem — e só então.

    Comparava o rascunho inteiro com a marca. Depois de uma gravação da
    biblioteca com alterações pendentes, a data de actualização do rascunho
    ficava para trás, e o Guardar continuava aceso mesmo que o cliente
    desfizesse tudo à mão — sem nenhum separador com ponto a dizer onde.
  */
  const dirty = companyDirty || identityDirty;
  const brandId = brand.id;
  const arts = libraryOf(brand.identity.styleLearning).length;
  const rules = brand.identity.memory?.rules.length ?? 0;

  const tabs: Array<TabItem<Section>> = [
    { value: 'empresa', label: SECTION_COPY.empresa.label, dot: companyDirty },
    { value: 'identidade', label: SECTION_COPY.identidade.label, dot: identityDirty },
    {
      value: 'biblioteca',
      label: SECTION_COPY.biblioteca.label,
      count: arts,
      countLabel: `${arts} ${arts === 1 ? 'arte' : 'artes'}`,
    },
    {
      value: 'memoria',
      label: SECTION_COPY.memoria.label,
      count: rules,
      countLabel: `${rules} ${rules === 1 ? 'regra' : 'regras'}`,
    },
  ];

  function selectSection(next: Section) {
    if (next === section) return;
    setRequested(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('separador', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  /**
   * A biblioteca e a memória gravam-se logo, sobre a marca GRAVADA.
   *
   * Pela fila da sessão (`updateBrand`): uma leitura da biblioteca e uma da
   * memória a acabar ao mesmo tempo já não se apagam uma à outra, e as
   * alterações por guardar dos outros cartões continuam por guardar.
   */
  async function saveLearning(learning: BrandStyleLearning | null): Promise<boolean> {
    try {
      const saved = await updateBrand(brandId, (latest) => ({
        ...latest,
        identity: { ...latest.identity, styleLearning: learning },
      }));
      return Boolean(saved);
    } catch (cause) {
      show({
        tone: 'erro',
        message: cause instanceof Error ? cause.message : 'Não foi possível guardar o estilo.',
      });
      return false;
    }
  }

  async function saveMemory(next: BrandMemory): Promise<boolean> {
    try {
      const saved = await updateBrand(brandId, (latest) => ({
        ...latest,
        identity: { ...latest.identity, memory: next },
      }));
      return Boolean(saved);
    } catch (cause) {
      show({
        tone: 'erro',
        message: cause instanceof Error ? cause.message : 'Não foi possível guardar a memória.',
      });
      return false;
    }
  }

  async function learnMemory() {
    if (!brand) return;
    setLearningMemory(true);
    const result = await memory.learn(brand);
    setLearningMemory(false);
    if (result.ok) show({ tone: 'sucesso', message: 'Memória actualizada.' });
    else if (result.error) show({ tone: 'aviso', message: result.error });
  }

  async function removeCompany() {
    setDeleting(true);
    try {
      const name = brand?.company.name || 'A empresa';
      await deleteCompany(brandId);
      show({ tone: 'info', message: `${name} foi apagada, com as publicações dela.` });
      router.replace('/inicio');
    } catch (cause) {
      show({
        tone: 'erro',
        message: cause instanceof Error ? cause.message : 'Não foi possível apagar a empresa.',
      });
      setDeleting(false);
    }
  }

  function discard() {
    if (!brand) return;
    setDraft(brand);
    // O erro do nome era do rascunho que se deitou fora.
    setErrors({});
  }

  async function handleSave() {
    // Guarda repetida: o TypeScript não mantém o estreitamento feito acima
    // dentro de funções declaradas, porque podem ser chamadas mais tarde.
    if (!draft) return;
    if (!draft.company.name.trim()) {
      setErrors({ name: 'O nome da empresa é obrigatório.' });
      // Com separadores, o campo pode não estar à vista: o Guardar leva lá o
      // cliente, em vez de não fazer nada visível.
      selectSection('empresa');
      setNameFocus((count) => count + 1);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = await saveBrand({ ...draft, onboardingComplete: true });
      // O que acabou de ser gravado é o novo ponto de partida do rascunho.
      synced.current = saved;
      setDraft(saved);
      show({ tone: 'sucesso', message: 'Marca actualizada.' });
    } catch (cause) {
      show({
        tone: 'erro',
        message: cause instanceof Error ? cause.message : 'Não foi possível guardar.',
      });
    } finally {
      setSaving(false);
    }
  }

  /** O conteúdo de um separador, com a frase que diz o que é. */
  function panel(value: Section, content: React.ReactNode) {
    return (
      <TabPanel key={value} id="marca" value={value} active={value === section}>
        {visited.has(value) ? (
          <>
            <p className="mb-3 text-[13px] leading-relaxed text-fg-muted">
              {SECTION_COPY[value].description}
            </p>
            {content}
          </>
        ) : null}
      </TabPanel>
    );
  }

  return (
    // `isolate`: o cabeçalho preso ao topo empilha-se dentro da página. Sem
    // isto ficava acima da barra do topo da casca, e tapava o menu de
    // empresas e o da conta quando se abrem por cima dele.
    <div className="relative isolate h-full overflow-hidden">
      <WorkspaceBackdrop pingEvery={4.8} />
      {/*
        `scrollbar-gutter: stable` reserva sempre o lugar da barra de
        rolagem. Sem ele, passar da "Empresa" (que rola) para a "Memória"
        (que não rola) deslocava o cabeçalho e os separadores meia barra para
        o lado — um salto a cada troca.
      */}
      <div ref={scrollRef} className="relative h-full overflow-y-auto [scrollbar-gutter:stable]">
        <div
          ref={stickyRef}
          className="sticky top-0 z-10 border-b border-line bg-ink-950/90 backdrop-blur-md"
        >
          <div className="mx-auto w-full max-w-4xl px-4 pt-5 sm:px-6">
            <BrandHeader
              brand={draft}
              dirty={dirty}
              saving={saving}
              onDiscard={discard}
              onSave={() => void handleSave()}
            />
            <Tabs
              id="marca"
              label="Partes da marca"
              value={section}
              onChange={selectSection}
              items={tabs}
              className="-mx-3 mt-4"
            />
          </div>
        </div>

        {/* Outra empresa, separadores novos: nada do estado de uma passa para a outra. */}
        <div key={brand.id} className="mx-auto w-full max-w-4xl px-4 pb-12 pt-5 sm:px-6">
          {panel(
            'empresa',
            <Card>
              <div className="p-5">
                <CompanyFields brand={draft} onChange={setDraft} errors={errors} />
              </div>

              {/*
                Apagar uma empresa, só quando há outra.

                A conta precisa de pelo menos uma: sem empresa não há onde
                criar. Fica no fim dos dados da empresa, numa linha — era um
                cartão inteiro, ao nível da identidade e da memória, para uma
                acção que quase ninguém faz. Confirmação no sítio, com o que
                se perde dito por extenso.
              */}
              {brands.length > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-5 py-4">
                  <div className="min-w-0 flex-1 basis-80">
                    <h2 className="text-[13px] font-semibold text-fg">Apagar esta empresa</h2>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">
                      Apaga a marca, a biblioteca, a memória e todas as publicações desta empresa.
                      As outras empresas da conta ficam como estão.
                    </p>
                  </div>
                  {/*
                    Com a pergunta aberta, a confirmação passa a ocupar a
                    linha inteira, por baixo da explicação — encolhida ao
                    lado dela, a frase partia-se em três linhas.
                  */}
                  <div className="shrink-0 has-[[role=group]]:basis-full [&>[role=group]]:w-full">
                    <InlineConfirm
                      label={`Apagar ${brand.company.name || 'esta empresa'}`}
                      icon={<Trash2 className="size-4" aria-hidden />}
                      variant="danger"
                      confirmLabel="Apagar de vez"
                      danger
                      loading={deleting}
                      message={`Isto não se desfaz. ${brand.company.name || 'A empresa'} e as publicações dela deixam de existir.`}
                      onConfirm={removeCompany}
                    />
                  </div>
                </div>
              ) : null}
            </Card>,
          )}

          {panel(
            'identidade',
            <Card className="p-5">
              <IdentityFields brand={draft} onChange={setDraft} accountId={account.id} />
            </Card>,
          )}

          {panel(
            'biblioteca',
            <Card className="p-5">
              <BrandArtsLearning
                key={brand.id}
                brand={draft}
                accountId={account.id}
                onLearningChange={saveLearning}
              />
            </Card>,
          )}

          {panel(
            'memoria',
            <Card className="p-5">
              <BrandMemoryCard
                memory={brand.identity.memory ?? null}
                learning={learningMemory}
                onChange={saveMemory}
                onLearn={() => void learnMemory()}
              />
            </Card>,
          )}
        </div>
      </div>
    </div>
  );
}

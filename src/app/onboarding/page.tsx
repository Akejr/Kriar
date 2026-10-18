'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { approveSpec, isSpecComplete, missingVisuals } from '@/lib/brand/identitySpec';
import { isBrandReady } from '@/lib/domain/factories';
import type { Brand, BrandStyleLearning } from '@/lib/domain/types';
import {
  BrandArtsLearning,
  type BrandArtsLearningHandle,
} from '@/components/brand/BrandArtsLearning';
import { BrandSummary } from '@/components/brand/BrandSummary';
import { CompanyFields } from '@/components/brand/CompanyFields';
import { IdentityStep } from '@/components/onboarding/IdentityStep';
import {
  ONBOARDING_STEPS,
  OnboardingHeader,
  STEP,
} from '@/components/onboarding/OnboardingHeader';
import { Button, Callout, Card, Spinner } from '@/components/ui/primitives';
import { SonarGrid } from '@/components/ui/SonarGrid';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/store/session';

/**
 * Cadastro da marca.
 *
 * Quatro etapas: dados da empresa, artes da marca (opcional), identidade da
 * marca, concluir. A etapa da identidade é a que dá trabalho — e é a que
 * faz tudo o resto funcionar, porque é dela que saem as cores, a
 * tipografia e as regras que cada publicação herda.
 *
 * As artes vêm ANTES da identidade de propósito: o estilo aprendido com o
 * que a empresa já publica entra na proposta de identidade, e a identidade
 * nova nasce coerente com o que os clientes dela já conhecem.
 *
 * O progresso é gravado em cada transição e em "Guardar e sair": decidir uma
 * identidade visual não se faz de uma sentada.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { show } = useToast();
  const { status, account, brand, brands, saveBrand, selectBrand, deleteCompany } = useSession();

  const [step, setStep] = React.useState(1);
  const [draft, setDraft] = React.useState<Brand | null>(null);
  const [errors, setErrors] = React.useState<{ name?: string }>({});
  const [saving, setSaving] = React.useState(false);
  /** A etapa da identidade está a gerar algo? */
  const [identityWorking, setIdentityWorking] = React.useState(false);
  /** A etapa das artes: a ler? quantas artes escolhidas e ainda por ler? */
  const [arts, setArts] = React.useState({ working: false, pending: 0 });
  const artsRef = React.useRef<BrandArtsLearningHandle>(null);
  /*
    O rascunho mais recente, numa referência.

    A leitura das artes leva meio minuto e grava no fim. Com a cópia do
    render em que começou, gravava por cima do que tivesse mudado entretanto.
  */
  const draftRef = React.useRef<Brand | null>(null);
  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useEffect(() => {
    if (status === 'anon') router.replace('/entrar');
  }, [status, router]);

  React.useEffect(() => {
    // Também quando a empresa muda: "Nova empresa" com o cadastro de outra
    // aberto não pode continuar o rascunho da anterior.
    if (brand && (!draft || draft.id !== brand.id)) {
      setDraft(brand);
      setErrors({});
      // Quem já tem identidade aprovada e volta ao cadastro entra na etapa
      // dela, não no primeiro formulário.
      setStep(
        brand.identity.spec && brand.company.name.trim() ? STEP.identidade : STEP.empresa,
      );
    }
  }, [brand, draft]);

  /*
    Outra empresa da conta já configurada.

    Com ela, este cadastro é o de uma empresa NOVA: "Guardar e sair" volta à
    que estava, em vez de mandar o cliente para o ecrã de entrada.
  */
  const fallback = brands.find((entry) => entry.id !== brand?.id && isBrandReady(entry)) ?? null;

  if (status === 'loading' || !draft || !account) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner label="A preparar o teu espaço…" />
      </main>
    );
  }

  // O estreitamento do `return` acima não chega às funções declaradas a
  // seguir, por isso fixamo-lo numa constante.
  const current: Brand = draft;

  /*
    Só se aprova a proposta COMPLETA.

    `isSpecComplete` e não `isSpecReady`: o design system fica pronto em
    poucos segundos, as quatro imagens levam minutos. Com a guarda anterior o
    botão acendia a meio da geração e era possível concluir o cadastro com as
    molduras vazias — a identidade visual aprovada antes de existir.
  */
  const specReady = isSpecComplete(current.identity.spec) && !identityWorking;
  const faltam = missingVisuals(current.identity.spec).length;
  /** A etapa da identidade tem o seu próprio esquema: altura fixa, colunas a rolar. */
  const isIdentity = step === STEP.identidade;

  async function persist(next: Brand): Promise<boolean> {
    try {
      await saveBrand(next);
      return true;
    } catch (error) {
      show({
        tone: 'erro',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível guardar. As tuas alterações continuam no ecrã.',
      });
      return false;
    }
  }

  function goToArts() {
    if (!current.company.name.trim()) {
      setErrors({ name: 'Precisamos do nome da empresa para continuar.' });
      return;
    }
    setErrors({});
    void persist(current);
    setStep(STEP.artes);
  }

  function goToIdentity() {
    void persist(draftRef.current ?? current);
    setStep(STEP.identidade);
  }

  /** Há artes escolhidas e ainda não lidas: lê-as e só depois avança. */
  async function learnAndContinue() {
    const ok = await artsRef.current?.learnPending();
    if (ok) goToIdentity();
  }

  /** O estilo aprendido entra na marca e fica gravado logo. */
  async function saveLearning(learning: BrandStyleLearning | null): Promise<boolean> {
    const base = draftRef.current ?? current;
    const next: Brand = { ...base, identity: { ...base.identity, styleLearning: learning } };
    draftRef.current = next;
    setDraft(next);
    return persist(next);
  }

  /** Aprova a identidade e passa à conclusão. */
  async function approveIdentity() {
    const spec = current.identity.spec;
    if (!spec) return;

    setSaving(true);
    const next: Brand = {
      ...current,
      identity: { ...current.identity, spec: approveSpec(spec) },
    };
    setDraft(next);
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      show({ tone: 'sucesso', message: 'Identidade aprovada.' });
      setStep(STEP.concluir);
    }
  }

  async function finish() {
    setSaving(true);
    const next: Brand = { ...current, onboardingComplete: true };
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      show({ tone: 'sucesso', message: 'Cadastro concluído.' });
      router.replace('/inicio');
    }
  }

  async function saveAndExit() {
    /*
      Uma empresa nova ainda sem nome não se guarda: não há nada dela para
      continuar mais tarde. Volta-se à empresa que estava, sem deixar um
      registo vazio na conta.
    */
    if (fallback && !current.onboardingComplete && !current.company.name.trim()) {
      await deleteCompany(current.id).catch(() => undefined);
      router.replace('/inicio');
      return;
    }
    setSaving(true);
    const ok = await persist(current);
    setSaving(false);
    if (ok) {
      show({ tone: 'info', message: 'Guardado. Podes continuar quando quiseres.' });
      if (current.onboardingComplete) {
        router.replace('/inicio');
      } else if (fallback) {
        // O cadastro desta fica a meio; trabalha-se na que estava pronta.
        selectBrand(fallback.id);
        router.replace('/inicio');
      } else {
        router.replace('/entrar');
      }
    }
  }

  return (
    <div
      className={
        // Na etapa da identidade a altura é a do ecrã e nada transborda. Nas
        // outras o conteúdo é curto e pode crescer à vontade.
        //
        // `isolate` existe por causa do campo de pontos: ver o comentário do
        // invólucro abaixo.
        isIdentity
          ? 'isolate flex h-dvh flex-col overflow-hidden bg-ink-950'
          : 'isolate flex min-h-dvh flex-col bg-ink-950'
      }
    >
      {/*
        Campo de pontos no fundo da PÁGINA, não do cartão.

        `fixed` e não `absolute`: nas etapas que rolam, o campo fica parado
        enquanto o conteúdo passa por cima — é fundo de ecrã, não textura de
        um elemento.

        O par `isolate` (no contentor) + `-z-10` (aqui) é o que põe o campo
        atrás de tudo sem o esconder. Um filho com índice negativo é pintado
        depois do fundo do contexto de empilhamento a que pertence e antes do
        conteúdo em fluxo. Sem o `isolate`, o contexto mais próximo seria a
        raiz do documento, e tanto o `html` como o `body` como este contentor
        pintam `ink-950` opaco por cima — o campo desaparecia.

        Em todas as etapas menos a da identidade: aí é a proposta da marca
        que tem de prender o olhar, e um fundo animado por trás de uma paleta
        é ruído. Mesmo critério do editor, onde o campo só existe no estado
        vazio.
      */}
      {!isIdentity ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <SonarGrid
            className="size-full"
            // Sem interacção: há formulários por cima e os eventos de
            // ponteiro já estão desligados neste invólucro.
            interactive={false}
            pingArea={[0.08, 0.12, 0.92, 0.88]}
            baseOpacity={0.18}
            dotRadius={1.5}
            pingEvery={3.4}
          />
          <span className="sonar-wash absolute inset-0" />
        </div>
      ) : null}

      <OnboardingHeader step={step} saving={saving} onSaveAndExit={saveAndExit} />

      <main
        id="conteudo"
        className={
          // A etapa da identidade ocupa a altura toda e não rola: são as
          // colunas que rolam por dentro, para o rodapé de aprovação não
          // sair do ecrã.
          isIdentity
            ? 'mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col px-4 pb-3 pt-4 sm:px-6'
            : 'mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12'
        }
      >
        <header className={isIdentity ? 'mb-3 shrink-0' : 'mb-5'}>
          {isIdentity ? null : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-faint">
              {fallback && !current.onboardingComplete ? 'Nova empresa · ' : ''}
              Etapa {step} de {ONBOARDING_STEPS.length}
              {step === STEP.artes ? ' · opcional' : ''}
            </p>
          )}
          <h1
            className={
              isIdentity
                ? 'text-[1.3rem] font-semibold tracking-tight text-fg'
                : 'mt-1.5 text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]'
            }
          >
            {step === STEP.empresa
              ? fallback && !current.onboardingComplete
                ? 'Vamos conhecer a nova empresa'
                : 'Vamos conhecer a tua empresa'
              : step === STEP.artes
                ? 'Já tens artes da tua empresa?'
                : isIdentity
                  ? 'Vamos dar identidade à tua marca'
                  : 'Está tudo pronto'}
          </h1>
          <p
            className={
              isIdentity
                ? 'mt-0.5 text-[12.5px] leading-relaxed text-fg-muted'
                : 'mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-fg-muted'
            }
          >
            {step === STEP.empresa
              ? 'Estes dados orientam o texto e o cenário de cada publicação.'
              : step === STEP.artes
                ? 'Se já publicas nas redes sociais, envia as artes que fizeste. A Kriar aprende o estilo — a tipografia, as cores, a forma de compor — e as publicações novas seguem-no, sem copiar nenhuma. Se ainda não tens, salta este passo.'
                : isIdentity
                  ? `Já conhecemos a ${current.company.name || 'tua empresa'}. Junta o logótipo, as cores e o que mais tiveres — a proposta só é gerada quando a pedires.`
                  : 'A identidade está aprovada e vai ser aplicada automaticamente nas tuas publicações.'}
          </p>
        </header>

        {isIdentity ? (
          <div className="min-h-0 flex-1">
            <IdentityStep
              // Uma instância por empresa: as leituras do logótipo, as pistas
              // do manual e a fotografia da última proposta vivem no estado
              // desta etapa e não podem passar de uma empresa para outra.
              key={current.id}
              brand={current}
              accountId={account.id}
              onBrandChange={setDraft}
              onWorkingChange={setIdentityWorking}
            />
          </div>
        ) : (
          <Card className="bg-ink-900/70 p-5 backdrop-blur-sm sm:p-6">
            {step === STEP.empresa ? (
              <>
                <CompanyFields brand={current} onChange={setDraft} errors={errors} />
                {/*
                  A saída curta, só na primeira etapa.

                  Quem chega aqui por ter aberto uma página do painel sem
                  marca não pediu um cadastro — pediu para trabalhar. Sem
                  esta linha, a arte instantânea só se descobre pela página
                  pública ou criando outra conta.

                  Fica no fim do formulário e não no rodapé: o rodapé é das
                  acções deste cadastro, e já tem três.
                */}
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-[12.5px] leading-relaxed text-fg-muted">
                    Só queres uma arte agora?{' '}
                    <Link
                      href="/instantanea"
                      className="font-medium text-neon underline-offset-4 hover:underline"
                    >
                      Faz uma arte instantânea
                    </Link>{' '}
                    com o nome, o logótipo e as cores. O cadastro completo fica a aguardar.
                  </p>
                </div>
              </>
            ) : step === STEP.artes ? (
              <BrandArtsLearning
                ref={artsRef}
                brand={current}
                accountId={account.id}
                onLearningChange={saveLearning}
                onStateChange={setArts}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <BrandSummary brand={current} />
                <Callout tone="info">
                  Podes voltar a editar isto a qualquer momento na área{' '}
                  <strong>Marca</strong>. Alterar a identidade cria uma versão nova e os
                  projectos já feitos continuam com a versão com que foram criados.
                </Callout>
              </div>
            )}
          </Card>
        )}
      </main>

      {/* Rodapé de acções */}
      <footer className="relative shrink-0 px-4 py-3.5 sm:px-6">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
        />
        <div
          className={
            isIdentity
              ? 'mx-auto flex w-full max-w-[86rem] flex-wrap items-center gap-3'
              : 'mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3'
          }
        >
          <Button
            variant="ghost"
            onClick={() => setStep((value) => Math.max(STEP.empresa, value - 1))}
            // Sair a meio da geração atira fora imagens já pagas e ainda não
            // guardadas na marca. O mesmo para a leitura das artes.
            disabled={step === STEP.empresa || saving || identityWorking || arts.working}
          >
            <ArrowLeft className="size-4" aria-hidden />
            {step === STEP.artes
              ? 'Voltar aos dados da empresa'
              : isIdentity
                ? 'Voltar às artes'
                : 'Voltar'}
          </Button>

          {/* `fg-muted` e não `fg-faint`: é a linha que diz o que falta, tem de passar o AA. */}
          <p className="ml-auto text-[11.5px] text-fg-muted">
            {isIdentity
              ? identityWorking
                ? 'A gerar as peças da tua identidade. Fica nesta página.'
                : !current.identity.spec
                  ? // Aponta para o botão: carregar o logótipo já não gera nada.
                    'Quando tiveres tudo, carrega em «Gerar a identidade da marca».'
                  : faltam > 0
                    ? // O verbo concorda com o número: "Faltam 1 peça" lia-se como gralha.
                      `${faltam === 1 ? 'Falta 1 peça' : `Faltam ${faltam} peças`} para poderes aprovar.`
                    : 'Podes alterar a identidade mais tarde.'
              : step === STEP.empresa
                ? 'Leva menos de um minuto.'
                : step === STEP.artes
                  ? arts.working
                    ? 'A ler as tuas artes. Fica nesta página.'
                    : 'Opcional. Podes fazê-lo mais tarde na área Marca.'
                  : 'Podes alterar a identidade mais tarde.'}
          </p>

          {step === STEP.empresa ? (
            <Button variant="primary" size="lg" onClick={goToArts}>
              Continuar
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : step === STEP.artes ? (
            /*
              Três saídas, conforme o que o cliente fez neste passo:
              escolheu artes e ainda não as leu — lê e avança; já aprendeu —
              continua; não tem artes — salta, sem cerimónia.
            */
            arts.pending > 0 ? (
              <Button
                variant="primary"
                size="lg"
                loading={arts.working}
                onClick={() => void learnAndContinue()}
                className={arts.working ? undefined : 'glow-neon'}
              >
                Aprender e continuar
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : current.identity.styleLearning ? (
              <Button variant="primary" size="lg" disabled={arts.working} onClick={goToIdentity}>
                Continuar
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button variant="secondary" size="lg" disabled={arts.working} onClick={goToIdentity}>
                Saltar este passo
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )
          ) : isIdentity ? (
            /*
              Sem proposta, este botão não avança nem gera.

              ──────────────────────────────────────────────────────────────
              Ponderámos deixar saltar a etapa e não deixámos. O cadastro
              nunca o permitiu — a aprovação exige a proposta completa
              (`isSpecComplete`) — e a identidade é o que cada publicação
              herda: concluir sem ela era chegar ao editor com cores de
              arranque que ninguém escolheu.

              Também não gera. Um "Continuar" que lançasse a geração em
              silêncio era o mesmo defeito de antes com outro gatilho: o
              cliente pediu para gerar quando ele decidir. Fica desligado, e
              a linha ao lado diz qual é o botão que falta carregar — está
              logo acima, no fim da coluna dos dados.
              ──────────────────────────────────────────────────────────────
            */
            <Button
              variant="primary"
              size="lg"
              loading={saving}
              disabled={!specReady}
              onClick={approveIdentity}
              className={specReady && !saving ? 'glow-neon' : undefined}
            >
              <Check className="size-4" aria-hidden />
              Aprovar e continuar
            </Button>
          ) : (
            <Button variant="primary" size="lg" loading={saving} onClick={finish}>
              Começar a criar
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

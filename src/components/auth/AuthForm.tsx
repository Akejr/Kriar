'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HardDrive, PlayCircle, ShieldCheck } from 'lucide-react';
import { BackendError, getBackend } from '@/lib/data';
import { seedDemoData } from '@/lib/data/seed';
import { isBrandReady } from '@/lib/domain/factories';
import { Logo } from '@/components/ui/Logo';
import { SonarGrid } from '@/components/ui/SonarGrid';
import { Button, Callout, Field, Input } from '@/components/ui/primitives';
import { useSession } from '@/store/session';

type Mode = 'entrar' | 'criar-conta';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { signIn, signUp, status, brand, storage, reloadBrand } = useSession();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);

  const isSignUp = mode === 'criar-conta';

  // Já autenticado: segue o fluxo.
  // Durante a sementeira dos dados de exemplo a conta já está autenticada mas
  // a marca ainda não foi gravada. Sem esta guarda, o utilizador seria
  // encaminhado para o onboarding a meio do processo.
  /*
    Sem marca pronta, o destino é a ARTE INSTANTÂNEA.

    Era o cadastro. Quem cria conta quer ver uma arte, não decidir uma
    identidade visual em quatro etapas — e o ecrã instantâneo leva lá em
    quatro campos, com uma ligação para o cadastro completo a quem o
    preferir. O cadastro continua a ser o destino de quem entra directamente
    numa página do painel sem marca (ver `AppShell`), porque aí a intenção
    já é outra.
  */
  React.useEffect(() => {
    if (status !== 'authed' || seeding) return;
    router.replace(isBrandReady(brand) ? '/inicio' : '/instantanea');
  }, [status, brand, router, seeding]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(null);

    if (isSignUp && password.length < 8) {
      setError('A palavra-passe tem de ter pelo menos 8 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) await signUp({ name, email, password });
      else await signIn({ email, password });
      router.replace(isSignUp ? '/instantanea' : '/inicio');
    } catch (cause) {
      // Com confirmação de e-mail activa no Supabase, a conta é criada mas a
      // sessão só existe depois do clique no link. Não é um erro.
      if (cause instanceof BackendError && cause.code === 'confirmacao-pendente') {
        setPending(cause.message);
        setPassword('');
      } else {
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível concluir. Tenta de novo.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Conta de demonstração com dados fictícios.
   *
   * Cria a conta local, semeia uma empresa de exemplo — a Perfumaria Kianda,
   * com o logótipo e as fotografias da identidade dela (`src/kianda/`) —, e
   * duas publicações já com composição preparada.
   */
  async function handleDemo() {
    setError(null);
    setSeeding(true);
    try {
      const suffix = Math.random().toString(36).slice(2, 8);
      await signUp({
        name: 'Conta de demonstração',
        email: `demo-${suffix}@exemplo.ao`,
        password: 'demonstracao',
      });

      const backend = getBackend();
      const session = await backend.getSession();
      if (!session) throw new Error('Não foi possível iniciar a conta de demonstração.');

      const seeded = await seedDemoData(backend, session);
      await reloadBrand(seeded.brand.id);
      router.replace('/inicio');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível preparar os dados de exemplo.',
      );
      setSeeding(false);
    }
  }

  return (
    <SonarGrid
      className="flex min-h-dvh flex-col items-center justify-center px-5 py-10"
      pingArea={[0.08, 0.1, 0.92, 0.9]}
      baseOpacity={0.2}
      pingEvery={3.4}
    >
      <div aria-hidden className="sonar-wash pointer-events-none absolute inset-0 -z-10" />

      <main id="conteudo" className="relative w-full max-w-[25rem]">
        <div className="rise rise-1 mb-7 flex flex-col items-center text-center">
          <Logo variant="wordmark" height={34} className="mb-5" />
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
            {isSignUp ? 'Criar conta' : 'Entrar'}
          </h1>
          <p className="mx-auto mt-2 max-w-[21rem] text-[13px] leading-relaxed text-fg-muted">
            {isSignUp
              ? 'A seguir pedimos o nome da empresa, o logótipo e as cores — e geras a primeira arte.'
              : 'Entra para continuar as tuas publicações.'}
          </p>
        </div>

        <div className="rise rise-2 edge-top rounded-[18px] bg-ink-900/90 p-5 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.95)] ring-1 ring-line backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
            {isSignUp ? (
              <Field label="O teu nome" htmlFor="campo-nome">
                <Input
                  id="campo-nome"
                  name="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Ana Francisco"
                />
              </Field>
            ) : null}

            <Field label="E-mail" htmlFor="campo-email">
              <Input
                id="campo-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.ao"
              />
            </Field>

            <Field
              label="Palavra-passe"
              htmlFor="campo-password"
              hint={isSignUp ? 'Pelo menos 8 caracteres.' : undefined}
            >
              <Input
                id="campo-password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={isSignUp ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            {pending ? (
              <Callout tone="neon" title="Confirma o e-mail">
                {pending}
              </Callout>
            ) : null}

            {error ? <Callout tone="danger">{error}</Callout> : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={submitting}
              className="mt-1"
            >
              {isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          {storage === 'local' ? (
            <>
              <div className="my-4 flex items-center gap-3">
                <span aria-hidden className="h-px flex-1 bg-line" />
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-fg-faint">ou</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </div>

              <Button variant="outline" block loading={seeding} onClick={handleDemo}>
                <PlayCircle className="size-4" aria-hidden />
                Entrar com dados de exemplo
              </Button>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-fg-faint">
                Empresa fictícia com logótipo, fotografias e duas publicações. Tudo desenhado pela
                aplicação.
              </p>
            </>
          ) : null}
        </div>

        <p className="rise rise-3 mt-5 text-center text-[13px] text-fg-muted">
          {isSignUp ? 'Já tens conta? ' : 'Ainda não tens conta? '}
          <Link
            href={isSignUp ? '/entrar' : '/criar-conta'}
            className="font-medium text-neon underline-offset-4 hover:underline"
          >
            {isSignUp ? 'Entrar' : 'Criar conta'}
          </Link>
        </p>

        <div className="rise rise-4 mt-5">
          {storage === 'local' ? (
            <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-fg-faint">
              <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Modo de demonstração: sem Supabase configurado, a conta e os projectos ficam
                apenas neste browser e a palavra-passe é verificada localmente. Não uses dados
                sensíveis.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-fg-faint">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-neon" aria-hidden />
              <span>
                Autenticação e dados no Supabase, com isolamento por conta garantido no servidor.
              </span>
            </p>
          )}
        </div>
      </main>
    </SonarGrid>
  );
}

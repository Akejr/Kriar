import type { Metadata } from 'next';
import { APP } from '@/config/app';
import { BrandSystem } from '@/components/landing/BrandSystem';
import { Control } from '@/components/landing/Control';
import { DevDemoNotice } from '@/components/landing/DevDemoNotice';
import { Faq } from '@/components/landing/Faq';
import { FinalCta } from '@/components/landing/FinalCta';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader, type AnchorLink } from '@/components/landing/LandingHeader';
import { LandingMotion } from '@/components/landing/LandingMotion';
import { Plans } from '@/components/landing/Plans';
import { Problem } from '@/components/landing/Problem';
import { Showcase } from '@/components/landing/Showcase';
import { SocialProof } from '@/components/landing/SocialProof';
import { Hairline } from '@/components/landing/ui';
import { TESTIMONIALS } from '@/lib/landing/content';
import { demoById, hasImage, resolveDemos, type DemoMode } from '@/lib/landing/demos';
import '@/components/landing/landing.css';

/**
 * Página pública: a apresentação da Kriar.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Esta rota ENCAMINHAVA: sem sessão → /entrar, sem marca → /onboarding, com
 * marca → /inicio. Passou a ser a página de apresentação para toda a gente.
 * O encaminhamento continua onde sempre esteve também: o `AuthForm` manda
 * quem entra para /inicio ou /onboarding, o `AppShell` manda quem não tem
 * sessão para /entrar, e o fim de sessão vai para /entrar. Nenhum fluxo da
 * aplicação dependia de passar por aqui — excepto o link de confirmação de
 * e-mail do Supabase, que passou a apontar para /onboarding
 * (`src/lib/data/supabaseBackend.ts`). Quem já tem sessão e abre esta página
 * vê "Abrir a Kriar" na barra do topo.
 *
 * É um componente de SERVIDOR, estático. As ilhas de cliente são só as que
 * precisam do browser: as faixas de artes não (são CSS), mas a escultura, o
 * manifesto que se acende ao rolar, a revisão interactiva, os botões que
 * dependem da sessão, o menu estreito, as perguntas, o campo de pontos da
 * última chamada e o observador que liga as entradas ao rolar, sim.
 *
 * A ordem conta uma história: o resultado (artes), a marca (os dados
 * organizados num design system), o problema, os três passos, o controlo
 * antes de gerar, a prova (artes de uma marca desmontadas), os planos, as
 * perguntas e a última chamada — que acaba como a página começou.
 * ──────────────────────────────────────────────────────────────────────────
 */

const TITLE = `${APP.name} — artes à altura da tua marca`;
const DESCRIPTION =
  'Transforma uma ideia numa publicação profissional, com as cores, os produtos e a identidade da tua empresa. Sem precisares de dominar ferramentas de design.';

export const metadata: Metadata = {
  metadataBase: new URL(`https://${APP.domain}`),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  // O resto da aplicação é privado (`robots` no layout raiz); esta página é
  // a montra e deve ser encontrada.
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'pt_AO',
    siteName: APP.name,
    url: '/',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
};

const ROOT_ID = 'kriar-landing';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Desenvolvimento ou produção, para as regras das artes de demonstração.
 *
 * Em desenvolvimento, `/?vista=producao` aplica as regras de produção para
 * o dono ver o que um visitante vê antes de gerar as artes. Em produção o
 * parâmetro nem é lido: a condição é decidida na compilação, e a página
 * continua estática.
 */
async function resolveMode(searchParams: SearchParams): Promise<{ mode: DemoMode; preview: boolean }> {
  if (process.env.NODE_ENV === 'production') return { mode: 'production', preview: false };
  const params = await searchParams;
  const preview = params.vista === 'producao';
  return { mode: preview ? 'production' : 'development', preview };
}

export default async function LandingPage({ searchParams }: { searchParams: SearchParams }) {
  const { mode, preview } = await resolveMode(searchParams);
  const demos = resolveDemos(mode);

  /*
    "Exemplos" aponta para as artes da própria Kriar desmontadas
    (`Showcase`), que existem sempre — são as da primeira dobra.
  */
  const links: AnchorLink[] = [
    { href: '#como-funciona', label: 'Como funciona' },
    { href: '#exemplos', label: 'Exemplos' },
    { href: '#planos', label: 'Planos' },
    { href: '#perguntas', label: 'Perguntas' },
  ];

  /*
    O aviso de desenvolvimento só lista as artes de demonstração que a
    página MOSTRA. Depois da arrumação das secções finais, é só a miniatura
    da terceira vinheta de "Como funciona" (o exemplo completo, o trio da
    Perfumaria Kianda e a arte da última chamada saíram da página).
  */
  const reviewArt = demoById('beleza-kianda-fim-de-semana');
  const missing = [reviewArt].filter((entry) => !hasImage(entry));

  return (
    <div id={ROOT_ID} className="lp relative min-h-dvh bg-ink-950">
      <LandingMotion rootId={ROOT_ID} />
      <LandingHeader links={links} />

      <main id="conteudo">
        <Hero />
        <BrandSystem />
        <Hairline />
        <Problem />
        <HowItWorks reviewArt={reviewArt} />
        <Control />
        <Showcase />
        {TESTIMONIALS.length > 0 ? <SocialProof walkthrough={demos.walkthrough} mode={mode} /> : null}
        <Hairline />
        <Plans />
        <Faq />
        <FinalCta />
      </main>

      <LandingFooter links={links} />

      {mode === 'development' || preview ? (
        <DevDemoNotice missing={missing} preview={preview} />
      ) : null}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Database, HardDrive, Image as ImageIcon, PlayCircle, Trash2, Type } from 'lucide-react';
import { APP } from '@/config/app';
import { getBackend } from '@/lib/data';
import { idbClearAll } from '@/lib/data/idb';
import { seedDemoData } from '@/lib/data/seed';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Spinner,
} from '@/components/ui/primitives';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceBackdrop } from '@/components/ui/WorkspaceBackdrop';
import { useSession } from '@/store/session';
import { usePageHeader } from '@/store/shell';

export default function DefinicoesPage() {
  const router = useRouter();
  const { show } = useToast();
  const { account, brand, storage, integrations, signOut, reloadBrand } = useSession();
  usePageHeader(['Definições']);
  const [clearing, setClearing] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);

  async function loadSeed() {
    if (!account) return;
    setSeeding(true);
    try {
      // O exemplo entra como mais uma empresa da conta, e fica a activa.
      const seeded = await seedDemoData(getBackend(), account);
      await reloadBrand(seeded.brand.id);
      show({
        tone: 'sucesso',
        message: `Dados de exemplo carregados na empresa ${seeded.brand.company.name}.`,
      });
      router.push('/projectos');
    } catch (cause) {
      show({
        tone: 'erro',
        message:
          cause instanceof Error ? cause.message : 'Não foi possível carregar os dados de exemplo.',
      });
    } finally {
      setSeeding(false);
    }
  }

  async function clearLocal() {
    setClearing(true);
    try {
      await idbClearAll();
      localStorage.removeItem(`${APP.slug}.session`);
      show({ tone: 'sucesso', message: 'Dados locais eliminados.' });
      window.location.href = '/entrar';
    } catch (cause) {
      show({
        tone: 'erro',
        message: cause instanceof Error ? cause.message : 'Não foi possível limpar.',
      });
      setClearing(false);
    }
  }

  if (!account || !brand) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="A carregar…" />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      <WorkspaceBackdrop pingEvery={5.2} />
      <div className="relative h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-9">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Definições</h1>
      <p className="mt-1.5 text-[13.5px] text-fg-muted">
        Conta, persistência e estado das integrações.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <Card>
          <CardHeader title="Conta" />
          <dl className="grid gap-3 px-5 pb-5 pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
                Nome
              </dt>
              <dd className="mt-1 text-[13.5px] text-fg">{account.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
                E-mail
              </dt>
              <dd className="mt-1 break-all text-[13.5px] text-fg">{account.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
                Empresa
              </dt>
              <dd className="mt-1 text-[13.5px] text-fg">{brand.company.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
                Conta criada
              </dt>
              <dd className="mt-1 text-[13.5px] text-fg">
                {new Date(account.createdAt).toLocaleDateString('pt-PT')}
              </dd>
            </div>
          </dl>
          <div className="border-t border-line px-5 py-3.5">
            <Button variant="ghost" onClick={() => void signOut()}>
              Terminar sessão
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Integrações"
            description="O que está realmente ligado neste momento."
          />
          <ul className="flex flex-col gap-3 px-5 pb-5 pt-4">
            <IntegrationRow
              icon={storage === 'supabase' ? <Database className="size-4" /> : <HardDrive className="size-4" />}
              title="Persistência"
              value={
                storage === 'supabase'
                  ? 'Supabase: autenticação, base de dados e armazenamento'
                  : 'IndexedDB neste browser'
              }
              configured={storage === 'supabase'}
              hint={
                storage === 'supabase'
                  ? 'Isolamento entre contas garantido por políticas RLS no servidor.'
                  : 'Define NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ligar o Supabase.'
              }
            />
            <IntegrationRow
              icon={<Type className="size-4" />}
              title="Planeamento de texto"
              value={
                integrations?.text.configured
                  ? (integrations.text.provider ?? 'configurado')
                  : 'Regras locais determinísticas'
              }
              configured={Boolean(integrations?.text.configured)}
              hint={
                integrations?.text.configured
                  ? 'As respostas são validadas contra um esquema e passam pelos guardrails antes de chegar ao editor.'
                  : 'Define OPENROUTER_API_KEY e OPENROUTER_TEXT_MODEL para activar. Sem isso, os textos vêm do teu pedido reorganizado por regras — nunca inventados.'
              }
            />
            {/*
              Dizia "gera apenas o fundo" e "o logótipo fica numa camada da
              aplicação" — o desenho de há várias versões. A arte é inteira
              do gerador, logótipo e contactos incluídos, e é verificada
              depois de gerar.
            */}
            <IntegrationRow
              icon={<ImageIcon className="size-4" />}
              title="Geração da arte"
              value={
                integrations?.image.configured
                  ? (integrations.image.provider ?? 'configurado')
                  : 'Sem gerador de imagem'
              }
              configured={Boolean(integrations?.image.configured)}
              hint={
                integrations?.image.configured
                  ? 'Gera a publicação inteira: cena, produtos, textos, logótipo e contactos. Cada arte é verificada antes de ser mostrada, e corrigida uma vez se o logótipo, as margens ou o título saírem mal.'
                  : 'Define OPENROUTER_API_KEY e OPENROUTER_IMAGE_MODEL para activar. Sem isso não há arte final: ela é sempre gerada por IA.'
              }
            />
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados de exemplo"
            description="Uma empresa fictícia com logótipo, fotografias e duas publicações já compostas."
          />
          <div className="px-5 pb-5 pt-4">
            <Callout tone="info" className="mb-4">
              O logótipo e as fotografias são desenhados pela própria aplicação em canvas: são
              formas originais, sem imagens nem marcas de terceiros. Isto{' '}
              <strong className="text-fg">substitui</strong> o perfil da marca actual e acrescenta
              duas publicações.
            </Callout>
            <InlineConfirm
              label="Carregar dados de exemplo"
              icon={<PlayCircle className="size-4" aria-hidden />}
              confirmLabel="Carregar"
              loading={seeding}
              message="O perfil da marca vai ser substituído pela empresa fictícia. Os teus projectos não são apagados."
              onConfirm={loadSeed}
            />
          </div>
        </Card>

        {storage === 'local' ? (
          <Card>
            <CardHeader
              title="Dados locais"
              description="No modo de demonstração tudo vive neste browser."
            />
            <div className="px-5 pb-5 pt-4">
              <Callout tone="warn" className="mb-4">
                Limpar o armazenamento elimina a conta, a marca, os ficheiros carregados e todos
                os projectos deste browser. Não há como recuperar.
              </Callout>
              <InlineConfirm
                label="Limpar dados locais"
                icon={<Trash2 className="size-4" aria-hidden />}
                variant="danger"
                danger
                confirmLabel="Limpar tudo"
                loading={clearing}
                message="Vão ser eliminados a conta, a marca, os ficheiros e todos os projectos deste browser."
                onConfirm={clearLocal}
              />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
      </div>
    </div>
  );
}

function IntegrationRow({
  icon,
  title,
  value,
  configured,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  configured: boolean;
  hint: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[12px] border border-line bg-ink-950 px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-fg-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-fg">{title}</p>
          <Badge tone={configured ? 'neon' : 'warn'}>
            {configured ? 'integrado' : 'demonstração'}
          </Badge>
        </div>
        <p className="mt-0.5 break-words font-mono text-[11.5px] text-fg-muted">{value}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-fg-faint">{hint}</p>
      </div>
    </li>
  );
}

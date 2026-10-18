'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import type { ProjectStatus } from '@/lib/domain/types';
import { Button, Input, Segmented } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { ProjectsGrid } from '@/components/projects/ProjectsGrid';
import { WorkspaceBackdrop } from '@/components/ui/WorkspaceBackdrop';
import { useSession } from '@/store/session';
import { usePageHeader } from '@/store/shell';
import { useProjects } from '@/store/useProjects';

type Filter = 'todos' | ProjectStatus;

export default function ProjectosPage() {
  const router = useRouter();
  const { show } = useToast();
  const { account, brand } = useSession();
  usePageHeader(['Projectos']);
  const { projects, loading, error, create, duplicate, rename, remove } = useProjects(
    account?.id ?? null,
    brand,
  );

  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('todos');
  const [creating, setCreating] = React.useState(false);

  const filtered = projects.filter((project) => {
    const matchesStatus = filter === 'todos' || project.status === filter;
    const matchesQuery =
      !query.trim() ||
      project.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      project.brief.toLowerCase().includes(query.trim().toLowerCase());
    return matchesStatus && matchesQuery;
  });

  async function handleCreate() {
    setCreating(true);
    try {
      const project = await create();
      router.push(`/editor/${project.id}`);
    } catch (cause) {
      show({
        tone: 'erro',
        message: cause instanceof Error ? cause.message : 'Não foi possível criar.',
      });
      setCreating(false);
    }
  }

  return (
    // Moldura fixa com o fundo, rolagem por dentro: um fundo `absolute` num
    // contentor que rola mede-se pela altura do CONTEÚDO e deixa o resto da
    // página sem ele.
    <div className="relative h-full overflow-hidden">
      <WorkspaceBackdrop pingEvery={4.2} />
      <div className="relative h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Projectos</h1>
          <p className="mt-1.5 text-[13.5px] text-fg-muted">
            {projects.length} publicaç{projects.length === 1 ? 'ão' : 'ões'} guardada
            {projects.length === 1 ? '' : 's'}
            {brand?.company.name ? ` da ${brand.company.name}` : ''}.
          </p>
        </div>
        <Button variant="primary" loading={creating} onClick={handleCreate}>
          <Plus className="size-4" aria-hidden />
          Criar publicação
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar por nome ou pedido"
            aria-label="Procurar projectos"
            className="pl-9"
          />
        </div>
        <Segmented<Filter>
          label="Filtrar por estado"
          value={filter}
          onChange={setFilter}
          columns={2}
          className="w-full sm:w-72"
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'rascunho', label: 'Rascunhos' },
            { value: 'composicao', label: 'Composição' },
            { value: 'arte-final', label: 'Arte final' },
          ]}
        />
      </div>

      <div className="mt-6">
        <ProjectsGrid
          projects={filtered}
          loading={loading}
          error={error}
          onCreate={handleCreate}
          onDuplicate={duplicate}
          onRename={rename}
          onDelete={remove}
          emptyTitle={
            projects.length === 0 ? 'Ainda não tens publicações' : 'Nada corresponde a esta busca'
          }
          emptyDescription={
            projects.length === 0
              ? 'Cria a primeira: descreve o que queres anunciar e ajusta a composição.'
              : 'Experimenta outro termo ou limpa o filtro de estado.'
          }
        />
      </div>
    </div>
      </div>
    </div>
  );
}

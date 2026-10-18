'use client';

import { useRouter } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import type { Project } from '@/lib/domain/types';
import { Button, EmptyState, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { ProjectCard } from './ProjectCard';

export function ProjectsGrid({
  projects,
  loading,
  error,
  onDuplicate,
  onRename,
  onDelete,
  onCreate,
  emptyTitle = 'Ainda não tens publicações',
  emptyDescription = 'Cria a primeira: descreve o que queres anunciar e ajusta a composição.',
}: {
  projects: Project[];
  loading: boolean;
  error: string | null;
  onDuplicate: (project: Project) => Promise<Project>;
  onRename: (project: Project, name: string) => Promise<Project>;
  onDelete: (project: Project) => Promise<void>;
  onCreate?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const { show } = useToast();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="A carregar projectos…" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Não foi possível carregar"
        description={error}
        action={
          <Button variant="outline" onClick={() => router.refresh()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="size-6" aria-hidden />}
        title={emptyTitle}
        description={emptyDescription}
        action={
          onCreate ? (
            <Button variant="primary" onClick={onCreate}>
              Criar publicação
            </Button>
          ) : null
        }
      />
    );
  }

  /*
    Cartões maiores: 13,5 rem de largura mínima em vez de 10,5.

    Numa página de 72 rem isso dá quatro colunas em vez de cinco, e cada
    miniatura ganha cerca de um quarto de área — a diferença entre
    reconhecer uma arte na lista e ter de a abrir para saber qual é.
  */
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(13.5rem,1fr))]">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onRename={async (name) => {
            try {
              await onRename(project, name);
            } catch (cause) {
              show({
                tone: 'erro',
                message: cause instanceof Error ? cause.message : 'Não foi possível mudar o nome.',
              });
            }
          }}
          onDuplicate={async () => {
            try {
              const copy = await onDuplicate(project);
              show({ tone: 'sucesso', message: `"${copy.name}" criada.` });
            } catch (cause) {
              show({
                tone: 'erro',
                message: cause instanceof Error ? cause.message : 'Não foi possível duplicar.',
              });
            }
          }}
          onDelete={async () => {
            try {
              await onDelete(project);
              show({ tone: 'sucesso', message: 'Publicação eliminada.' });
            } catch (cause) {
              show({
                tone: 'erro',
                message: cause instanceof Error ? cause.message : 'Não foi possível eliminar.',
              });
            }
          }}
        />
      ))}
    </div>
  );
}

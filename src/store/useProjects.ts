'use client';

import * as React from 'react';
import { getBackend } from '@/lib/data';
import { createProject, duplicateProject } from '@/lib/domain/factories';
import type { Brand, FormatId, Project, StyleId } from '@/lib/domain/types';
import { useEditor } from './editor';
import { useSession } from './session';

/**
 * A publicação é desta empresa?
 *
 * Uma publicação cuja empresa já não existe — gravada antes de haver várias
 * empresas, com um identificador que mudou — fica com a PRIMEIRA empresa da
 * conta, que é a que existia quando ela foi feita. Esconder trabalho do
 * cliente por causa de um identificador não é opção.
 */
export function projectBelongsTo(project: Project, brand: Brand, brands: Brand[]): boolean {
  if (project.brandId === brand.id) return true;
  const known = brands.some((entry) => entry.id === project.brandId);
  return !known && brands[0]?.id === brand.id;
}

/**
 * Lista de projectos da EMPRESA activa.
 *
 * Mantém a lista em memória e recarrega quando é preciso — também quando se
 * muda de empresa. As acções devolvem o projecto afectado, para quem chama
 * poder navegar.
 */
export function useProjects(accountId: string | null, brand: Brand | null) {
  const { brands } = useSession();
  const [all, setAll] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      setAll(await getBackend().listProjects(accountId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível carregar os projectos.',
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  // A empresa entra nas dependências: mudar de empresa volta a ler a lista.
  const brandId = brand?.id ?? null;
  React.useEffect(() => {
    void reload();
  }, [reload, brandId]);

  const projects = React.useMemo(
    () => (brand ? all.filter((project) => projectBelongsTo(project, brand, brands)) : []),
    [all, brand, brands],
  );

  const create = React.useCallback(
    async (options: { name?: string; format?: FormatId; style?: StyleId } = {}) => {
      if (!accountId || !brand) throw new Error('Configura a marca antes de criar publicações.');
      const project = createProject(accountId, brand, options);
      const saved = await getBackend().saveProject(project);
      setAll((current) => [saved, ...current]);
      return saved;
    },
    [accountId, brand],
  );

  const duplicate = React.useCallback(async (project: Project) => {
    const copy = await getBackend().saveProject(duplicateProject(project));
    setAll((current) => [copy, ...current]);
    return copy;
  }, []);

  const rename = React.useCallback(async (project: Project, name: string) => {
    const saved = await getBackend().saveProject({ ...project, name: name.trim() || project.name });
    setAll((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    return saved;
  }, []);

  const remove = React.useCallback(async (project: Project) => {
    await getBackend().deleteProject(project.id);
    /*
      O editor deixa de ter o projecto apagado.

      Ficava na memória: "Criar" levava de volta a ele e dava "Este
      projecto já não existe". E uma gravação automática ainda pendente
      voltava a gravá-lo — o projecto apagado reaparecia na lista.
    */
    const editor = useEditor.getState();
    if (editor.project?.id === project.id) editor.teardown();
    setAll((current) => current.filter((item) => item.id !== project.id));
  }, []);

  return { projects, loading, error, reload, create, duplicate, rename, remove };
}

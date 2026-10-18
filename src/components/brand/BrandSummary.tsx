'use client';

import * as React from 'react';
import { getContactType, getSegment } from '@/lib/domain/catalog';
import { defaultContactsForComposition } from '@/lib/domain/factories';
import { getFont } from '@/lib/fontCatalog';
import type { Brand } from '@/lib/domain/types';
import { Badge } from '@/components/ui/primitives';

/**
 * Resumo da marca: os dados, em texto.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Tinha ao lado um "Exemplo" — uma publicação falsa desenhada pelo motor de
 * composição local, com um triângulo verde, dois círculos e as palavras
 * "Primeira", "Segunda" e "Terceira" por produtos.
 *
 * Saiu, e não por ser feio apenas. Era uma promessa falsa: aquele desenho é
 * do motor de formas geométricas, que deixou de ser o caminho das
 * publicações quando a arte passou a ser gerada por inteiro pela IA. O
 * cliente olhava para um triângulo verde a seguir a aprovar uma identidade
 * azul-marinho, e aquilo não se parecia com nada do que ia receber. O
 * verde nem era dele — era o verde da interface, a entrar numa peça onde
 * só podem estar as cores da empresa.
 *
 * Quem quer ver como a identidade fica aplicada tem a folha de identidade
 * visual na etapa da marca, que é uma fotografia real com o logótipo real.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function BrandSummary({ brand }: { brand: Brand }) {
  // Os mesmos que uma publicação nova recebe — o website incluído.
  const shown = defaultContactsForComposition(brand);
  const colors: Array<[string, string | null | undefined]> = [
    ['Principal', brand.identity.colors.primary],
    ['Secundária', brand.identity.colors.secondary],
    ['Terceira', brand.identity.colors.accent],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
            Empresa
          </p>
          <p className="mt-1 text-lg font-semibold text-fg">
            {brand.company.name || 'Sem nome'}
          </p>
          <p className="text-[13px] text-fg-muted">
            {getSegment(brand.company.segment).label}
            {brand.company.website ? ` · ${brand.company.website}` : ''}
          </p>
          {brand.company.description ? (
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              {brand.company.description}
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
            Cores
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map(([label, hex]) =>
              hex ? (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-[10px] border border-line bg-ink-950 py-1 pl-1 pr-2.5"
                >
                  <span
                    aria-hidden
                    className="size-6 rounded-[7px] border border-line-strong"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-[11.5px] text-fg-muted">{label}</span>
                  <span className="font-mono text-[11.5px] text-fg">{hex}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
              Tipografia
            </p>
            <p className="text-[13px] text-fg">
              {getFont(brand.identity.fontDisplay).label}{' '}
              <span className="text-fg-muted">em títulos</span>
            </p>
            <p className="text-[13px] text-fg">
              {getFont(brand.identity.fontBody).label}{' '}
              <span className="text-fg-muted">em texto</span>
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
              Nas artes por omissão
            </p>
            {shown.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-fg-muted">
                Nenhum contacto. Podes escolher em cada publicação.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {shown.map((contact) => (
                  <li key={contact.type}>
                    <Badge tone="neon">
                      {getContactType(contact.type).label}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {brand.identity.importReport ? (
          <p className="text-[12px] leading-relaxed text-fg-faint">
            Identidade importada de {brand.identity.importReport.files.join(', ')} ·{' '}
            {brand.identity.importReport.hints.filter((h) => h.source === 'explicito').length}{' '}
            indicações encontradas e{' '}
            {brand.identity.importReport.hints.filter((h) => h.source === 'inferido').length}{' '}
            inferidas.
          </p>
        ) : null}
      </div>
    </div>
  );
}

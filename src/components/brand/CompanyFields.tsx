'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CONTACT_TYPES, SEGMENTS, getContactType } from '@/lib/domain/catalog';
import { createContact, DEFAULT_CONTACT_LIMIT } from '@/lib/domain/factories';
import type { Brand, BrandContact, SegmentId } from '@/lib/domain/types';
import {
  Button,
  Callout,
  Field,
  IconButton,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';

/**
 * Dados da empresa e contactos.
 *
 * Cada contacto tem o seu próprio "Mostrar nas artes por omissão". Por
 * omissão nenhum está activo: pôr todas as redes sociais em todas as artes
 * enche a publicação e raramente é o que a empresa quer. O website é a
 * excepção — entra sempre (ver `defaultContactsForComposition`).
 */
export function CompanyFields({
  brand,
  onChange,
  errors,
}: {
  brand: Brand;
  onChange: (next: Brand) => void;
  errors?: Partial<Record<'name' | 'segment', string>>;
}) {
  const update = (patch: Partial<Brand['company']>) =>
    onChange({ ...brand, company: { ...brand.company, ...patch } });

  const setContacts = (contacts: BrandContact[]) => onChange({ ...brand, contacts });

  const updateContact = (id: string, patch: Partial<BrandContact>) =>
    setContacts(brand.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const usedTypes = new Set(brand.contacts.map((c) => c.type));
  const nextFreeType = CONTACT_TYPES.find((c) => !usedTypes.has(c.type))?.type;

  // O website não conta: entra sempre, fora do limite.
  const shownCount = brand.contacts.filter(
    (c) => c.type !== 'website' && c.showByDefault && c.value.trim(),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome da empresa"
          htmlFor="empresa-nome"
          error={errors?.name}
          className="sm:col-span-2"
        >
          <Input
            id="empresa-nome"
            required
            value={brand.company.name}
            invalid={Boolean(errors?.name)}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Ex.: Perfumaria Kianda"
          />
        </Field>

        <Field label="Segmento de actividade" htmlFor="empresa-segmento" error={errors?.segment}>
          <Select
            id="empresa-segmento"
            value={brand.company.segment}
            onChange={(event) => update({ segment: event.target.value as SegmentId })}
          >
            {SEGMENTS.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Website"
          htmlFor="empresa-website"
          optional
          hint="Entra sempre nas artes, junto aos contactos."
        >
          <Input
            id="empresa-website"
            type="url"
            inputMode="url"
            value={brand.company.website ?? ''}
            onChange={(event) => update({ website: event.target.value })}
            placeholder="www.aminhaempresa.ao"
          />
        </Field>

        <Field
          label="Breve descrição do negócio"
          htmlFor="empresa-descricao"
          className="sm:col-span-2"
          hint="Uma ou duas frases. Ajuda a propor textos adequados ao teu negócio."
        >
          <Textarea
            id="empresa-descricao"
            rows={3}
            maxLength={600}
            value={brand.company.description}
            onChange={(event) => update({ description: event.target.value })}
            placeholder="Ex.: Perfumaria em Luanda com marcas originais e entrega no mesmo dia."
          />
        </Field>

        <Field label="Endereço" htmlFor="empresa-endereco" optional className="sm:col-span-2">
          <Input
            id="empresa-endereco"
            value={brand.company.address ?? ''}
            onChange={(event) => update({ address: event.target.value })}
            placeholder="Ex.: Rua Comandante Che Guevara, Maianga, Luanda"
          />
        </Field>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-fg">Contactos</h3>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              Escolhe quais entram nas artes por omissão. Em cada publicação podes mudar.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {brand.contacts.map((contact) => {
            const spec = getContactType(contact.type);
            return (
              <div
                key={contact.id}
                className="rounded-[12px] border border-line bg-ink-950 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <Select
                    aria-label="Tipo de contacto"
                    value={contact.type}
                    onChange={(event) =>
                      updateContact(contact.id, {
                        type: event.target.value as BrandContact['type'],
                      })
                    }
                    className="w-[8.5rem] shrink-0"
                  >
                    {CONTACT_TYPES.map((option) => (
                      <option
                        key={option.type}
                        value={option.type}
                        disabled={option.type !== contact.type && usedTypes.has(option.type)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={`Valor do contacto ${spec.label}`}
                    value={contact.value}
                    inputMode={spec.inputMode}
                    onChange={(event) => updateContact(contact.id, { value: event.target.value })}
                    placeholder={spec.placeholder}
                  />
                  <IconButton
                    label={`Remover ${spec.label}`}
                    tone="danger"
                    onClick={() => setContacts(brand.contacts.filter((c) => c.id !== contact.id))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </div>

                {/*
                  O website não tem caixa: entra sempre.

                  É o sítio onde o cliente compra ou fala com a empresa, e
                  uma arte de subscrições da DOT saiu sem ele. Em cada
                  publicação continua a poder tirar-se, na revisão.
                */}
                {contact.type === 'website' ? (
                  <p className="mt-2 pl-1 text-[12px] text-fg-muted">
                    Entra sempre nas artes. Podes tirá-lo numa publicação concreta, na revisão.
                  </p>
                ) : (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 pl-1 text-[12px] text-fg-muted">
                    <input
                      type="checkbox"
                      checked={contact.showByDefault}
                      onChange={(event) =>
                        updateContact(contact.id, { showByDefault: event.target.checked })
                      }
                      className="size-3.5 accent-[var(--color-neon)]"
                    />
                    Mostrar nas artes por omissão
                  </label>
                )}
              </div>
            );
          })}

          <Button
            variant="outline"
            onClick={() =>
              setContacts([...brand.contacts, createContact({ type: nextFreeType })])
            }
            disabled={!nextFreeType}
            className="self-start"
          >
            <Plus className="size-4" aria-hidden />
            Adicionar contacto
          </Button>
        </div>

        {shownCount > DEFAULT_CONTACT_LIMIT ? (
          <Callout tone="warn" className="mt-3">
            Tens {shownCount} contactos marcados para aparecer por omissão. Além do website, nas
            artes usamos no máximo {DEFAULT_CONTACT_LIMIT}, para não sobrecarregar a publicação.
          </Callout>
        ) : null}
      </div>
    </div>
  );
}

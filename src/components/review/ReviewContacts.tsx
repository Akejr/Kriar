'use client';

import * as React from 'react';
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { CONTACT_TYPES } from '@/lib/domain/catalog';
import type { Brand, ContactType } from '@/lib/domain/types';
import { Switch } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

const ICONS: Record<ContactType, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  telefone: Phone,
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
  endereco: MapPin,
};

const PLACEHOLDERS: Partial<Record<ContactType, string>> = {
  whatsapp: '+244 923 000 000',
  telefone: '+244 222 000 000',
  instagram: '@aminhaempresa',
  website: 'www.aminhaempresa.ao',
  endereco: 'Rua, bairro, cidade',
};

/**
 * Contactos desta publicação.
 *
 * Mostra os tipos que a empresa tem guardados mais os que fazem sentido
 * acrescentar aqui. Nada entra na arte sem o interruptor ligado — é o mesmo
 * princípio do resto da aplicação: nenhum contacto aparece por omissão.
 *
 * O aviso no fim não é decoração. Um modelo de imagem erra dígitos de
 * telefone e nomes de perfis com frequência, e um número errado numa
 * publicidade é um dano real para a empresa.
 */
const OFFERED: ContactType[] = ['whatsapp', 'telefone', 'instagram', 'website', 'endereco'];

export function ReviewContacts({
  brand,
  active,
  onToggle,
  onValue,
}: {
  brand: Brand;
  active: Array<{ type: ContactType; value: string }>;
  onToggle: (contact: { type: ContactType; value: string }, enabled: boolean) => void;
  onValue: (type: ContactType, value: string) => void;
}) {
  const activeMap = new Map(active.map((contact) => [contact.type, contact.value]));
  const saved = new Map(
    brand.contacts
      .filter((contact) => contact.value.trim())
      .map((contact) => [contact.type, contact.value.trim()]),
  );

  /*
    O website vive em dois sítios, e isto é a ponte entre eles.

    ──────────────────────────────────────────────────────────────────────────
    "Cadastrei o website mas na revisão não aparece." O endereço estava
    guardado — em `company.website`, o campo dos dados da empresa — e este
    ecrã só olhava para `brand.contacts`, que é a lista de canais de
    contacto. Dois campos para a mesma informação, e o ecrã a ler só um.

    Não duplico o dado nem o migro: preencho a linha do website a partir dos
    dados da empresa quando não existe um contacto de website. O cliente
    escreveu-o uma vez e espera vê-lo, sem ter de saber que a aplicação tem
    dois lugares para a mesma coisa.
    ──────────────────────────────────────────────────────────────────────────
  */
  const companyWebsite = brand.company.website?.trim();
  if (companyWebsite && !saved.has('website')) saved.set('website', companyWebsite);

  const rows = OFFERED;

  return (
    <div className="flex flex-col gap-2.5">
      {/*
        Uma coluna, uma linha por canal.

        ────────────────────────────────────────────────────────────────────────
        Era uma grelha de dois cartões por linha, com cada interruptor a
        mostrar "Mostrar WhatsApp na arte" ao lado. Quando a revisão passou a
        ter uma coluna lateral de 20 rem, esse texto deixou de caber: os
        rótulos transbordavam para fora do cartão e sobrepunham-se uns aos
        outros.

        O rótulo do interruptor passou a ser acessível mas invisível — a linha
        já começa com o nome do canal, e repeti-lo ao lado era redundante
        mesmo quando caberia.
        ────────────────────────────────────────────────────────────────────────
      */}
      <div className="flex flex-col gap-1.5">
        {rows.map((type) => {
          const Icon = ICONS[type];
          const label = CONTACT_TYPES.find((entry) => entry.type === type)?.label ?? type;
          const enabled = activeMap.has(type);
          const value = activeMap.get(type) ?? saved.get(type) ?? '';

          return (
            <div
              key={type}
              className={cn(
                'flex items-center gap-2 rounded-[10px] border bg-ink-950/60 px-2.5 py-2 transition-colors',
                enabled ? 'border-line-strong' : 'border-line',
              )}
            >
              <Icon
                className={cn('size-3.5 shrink-0', enabled ? 'text-neon' : 'text-fg-faint')}
                aria-hidden
              />

              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    'text-[10.5px] font-medium leading-none',
                    enabled ? 'text-fg-muted' : 'text-fg-faint',
                  )}
                >
                  {label}
                </span>
                <input
                  value={value}
                  aria-label={`Valor de ${label}`}
                  placeholder={PLACEHOLDERS[type] ?? `Adicionar ${label.toLowerCase()}`}
                  onChange={(event) => onValue(type, event.target.value)}
                  className="mt-1 w-full min-w-0 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-faint"
                />
              </div>

              <Switch
                checked={enabled}
                labelHidden
                label={`Mostrar ${label} na arte`}
                onChange={(next) => onToggle({ type, value }, next)}
              />
            </div>
          );
        })}
      </div>

      {/*
        Os contactos vão dentro da arte, escritos pela IA, e são conferidos
        na verificação depois de gerar. O interruptor "colar por cima" saiu:
        punha o endereço numa etiqueta colada sobre a composição.
      */}
      <p className="flex items-center gap-1.5 px-0.5 text-[10.5px] leading-snug text-fg-faint">
        <ShieldCheck className="size-3 shrink-0 text-neon/80" aria-hidden />
        Conferidos depois de gerar. A posição escolhe-se na planta.
      </p>
    </div>
  );
}

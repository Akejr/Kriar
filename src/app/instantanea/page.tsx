'use client';

import * as React from 'react';
import Link from 'next/link';
import { InstantScreen } from '@/components/instant/InstantScreen';
import { Button, Callout, Spinner } from '@/components/ui/primitives';
import { ANON_ACCOUNT_ID, anonymousBrand } from '@/lib/domain/instant';
import { useSession } from '@/store/session';

/**
 * Arte instantânea.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SEM CADASTRO E SEM CONTA. O visitante chega, preenche, gera, descarrega.
 *
 * Fica fora de `(painel)` por isso mesmo: a casca do painel exige sessão e
 * uma marca pronta, e manda quem não as tem para `/entrar` ou
 * `/onboarding` — exactamente os dois passos que este ecrã existe para
 * saltar.
 *
 * Quem TEM sessão entra aqui com a empresa activa já preenchida, e a marca
 * é gravada ao gerar. Quem não tem trabalha sobre uma marca em memória e
 * uma gaveta anónima (`ANON_ACCOUNT_ID`): o trabalho fica no armazenamento
 * local deste browser e não há conta nenhuma a criar.
 *
 * A excepção declarada é o Supabase. Lá as escritas exigem um utilizador
 * autenticado (`requireUserId`, mais as políticas RLS no servidor), e sem
 * sessão o anexo e a gravação da arte falhariam — depois de a geração já
 * estar paga. Nesse caso, e só nesse, pede-se conta ANTES de começar.
 * ──────────────────────────────────────────────────────────────────────────
 */
export default function InstantaneaPage() {
  const { status, account, brand, storage, saveBrand } = useSession();

  /*
    Uma marca anónima por montagem, não por render.

    Sem o `useRef` ela era refabricada a cada render — identificador novo,
    rascunho novo — e o ecrã reiniciava-se a cada tecla escrita.
  */
  const anon = React.useRef<ReturnType<typeof anonymousBrand> | null>(null);
  if (!anon.current) anon.current = anonymousBrand();

  // Esperar a sessão evita abrir como anónimo e trocar logo a seguir.
  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner label="A preparar…" />
      </main>
    );
  }

  const authed = status === 'authed' && Boolean(account) && Boolean(brand);

  if (!authed && storage === 'supabase') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col justify-center px-5">
        <Callout tone="info" title="Entra primeiro">
          Esta instalação guarda as artes numa base de dados que exige sessão. Cria conta — leva
          um minuto — e voltas directamente para aqui.
        </Callout>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href="/criar-conta">
            <Button variant="primary">Criar conta</Button>
          </Link>
          <Link href="/entrar">
            <Button variant="ghost">Já tenho conta</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <InstantScreen
      // Trocar de empresa recomeça o ecrã: os campos são os dela.
      key={authed && brand ? brand.id : 'anonimo'}
      accountId={authed && account ? account.id : ANON_ACCOUNT_ID}
      baseBrand={authed && brand ? brand : anon.current}
      // Sem conta não há onde gravar a marca, e não se finge que há.
      onSaveBrand={authed ? saveBrand : null}
      authed={authed}
    />
  );
}

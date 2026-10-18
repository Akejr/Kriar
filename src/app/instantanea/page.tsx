'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { InstantScreen } from '@/components/instant/InstantScreen';
import { Spinner } from '@/components/ui/primitives';
import { useSession } from '@/store/session';

/**
 * Arte instantânea.
 *
 * Fora de `(painel)`, como `/entrar` e `/onboarding`: a casca do painel
 * exige uma marca pronta, e é precisamente isso que este ecrã dispensa.
 *
 * Precisa de conta, e isto é uma decisão, não uma limitação herdada. A arte
 * é um ficheiro que fica guardado em algum lugar, e a geração custa dinheiro
 * de verdade por cada clique — sem conta não há onde guardar a arte nem a
 * quem atribuir o custo. Quem chega aqui sem sessão vai criar conta e volta.
 */
export default function InstantaneaPage() {
  const router = useRouter();
  const { status, account, brand, saveBrand } = useSession();

  React.useEffect(() => {
    if (status === 'anon') router.replace('/criar-conta');
  }, [status, router]);

  if (status !== 'authed' || !account || !brand) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner label="A preparar…" />
      </main>
    );
  }

  return (
    <InstantScreen
      // Trocar de empresa recomeça o ecrã: os campos são os dela.
      key={brand.id}
      account={account}
      brand={brand}
      onSaveBrand={saveBrand}
    />
  );
}

import { NextResponse } from 'next/server';
import { integrationStatus } from '@/lib/server/integrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Estado das integrações.
 *
 * A interface usa isto para mostrar o aviso de modo de demonstração. Só
 * devolve se cada integração está configurada e qual o modelo — nunca
 * qualquer parte das credenciais.
 */
export async function GET() {
  return NextResponse.json(integrationStatus(), {
    headers: { 'cache-control': 'no-store' },
  });
}

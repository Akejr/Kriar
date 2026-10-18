import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reencaminhamento de imagens do armazenamento, para a exportação não falhar.
 *
 * Quando as fotografias vêm de outro domínio sem cabeçalhos CORS, o canvas
 * fica "contaminado" e `toBlob()` lança um erro de segurança. Esta rota serve
 * a imagem a partir do nosso próprio domínio, o que resolve o problema.
 *
 * Segurança: só são aceites endereços do domínio de armazenamento
 * configurado. Sem isso, esta rota seria um proxy aberto (SSRF). Em modo de
 * demonstração as imagens são `blob:`/`data:` locais e esta rota nunca é
 * usada.
 */
function allowedHosts(): string[] {
  const hosts: string[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      hosts.push(new URL(supabaseUrl).host);
    } catch {
      // Endereço mal formado: fica sem hosts permitidos.
    }
  }
  return hosts;
}

const MAX_BYTES = 12 * 1024 * 1024;

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return NextResponse.json({ error: 'Falta o parâmetro url.' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: 'Endereço inválido.' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Só são aceites endereços https.' }, { status: 400 });
  }

  const hosts = allowedHosts();
  if (!hosts.includes(parsed.host)) {
    return NextResponse.json(
      { error: 'Domínio não autorizado.' },
      { status: 403 },
    );
  }

  const upstream = await fetch(parsed.toString(), {
    headers: { accept: 'image/*' },
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    return NextResponse.json(
      { error: 'Não foi possível obter a imagem.' },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'O conteúdo não é uma imagem.' }, { status: 415 });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: 'A imagem é demasiado grande.' }, { status: 413 });
  }

  return new NextResponse(buffer, {
    headers: {
      'content-type': contentType,
      'cache-control': 'private, max-age=600',
      'content-length': String(buffer.length),
    },
  });
}

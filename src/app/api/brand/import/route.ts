import { NextResponse } from 'next/server';
import { extractPdfHints } from '@/lib/server/pdfHints';
import { validateUploadBytes } from '@/lib/server/validateUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Análise de um manual de marca em PDF.
 *
 * Faz inspecção directa do ficheiro, sem IA: lê os nomes das tipografias
 * embebidas e os códigos de cor presentes no documento. Distingue o que está
 * escrito explicitamente do que é deduzido dos operadores de pintura, e o
 * utilizador confirma tudo antes de guardar.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Não foi possível ler o ficheiro enviado.' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Falta o ficheiro.' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateUploadBytes(bytes, 'document');
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.reason }, { status: 400 });
  }

  try {
    const hints = extractPdfHints(Buffer.from(bytes));
    return NextResponse.json({ ok: true, fileName: file.name, hints, usedAi: false });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro desconhecido';
    return NextResponse.json(
      {
        ok: false,
        error: `Não conseguimos analisar este PDF (${reason}). Podes guardar o ficheiro e configurar a identidade manualmente.`,
      },
      { status: 422 },
    );
  }
}

import { FORMATS } from '@/lib/domain/catalog';
import type { IntegrationStatus } from '@/lib/domain/types';
import { resolveImageProvider } from '@/lib/ai/providers/image';
import { resolveTextProvider } from '@/lib/ai/providers/text';

/** Estado real das integrações. Usado pela interface para não prometer nada. */
export function integrationStatus(): IntegrationStatus {
  const text = resolveTextProvider();
  const image = resolveImageProvider();
  const supabaseReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return {
    storage: supabaseReady ? 'supabase' : 'local',
    text: { configured: Boolean(text), provider: text ? `${text.id}:${text.model}` : null },
    image: {
      configured: Boolean(image),
      provider: image ? `${image.id}:${image.model}` : null,
      /*
        A proporção que o gerador devolve em cada formato. O browser desenha
        o esboço nessa proporção, com a moldura da publicação ao centro: é a
        única forma de o conteúdo que o esboço põe dentro da moldura ficar
        dentro do que a moldura deixa ver.
      */
      ratios: image
        ? Object.fromEntries(FORMATS.map((format) => [format.id, image.outputRatio(format.id)]))
        : undefined,
    },
  };
}

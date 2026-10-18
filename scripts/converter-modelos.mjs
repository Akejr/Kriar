/**
 * Converte as referências dos modelos para WebP.
 *
 * As referências ficam em `src/modelos/`, fora de `public/`, de propósito:
 * contêm a identidade Kriar como conteúdo de demonstração e nunca devem ser
 * servidas ao browser nem aparecer nas artes dos clientes. São lidas do disco
 * no servidor e enviadas ao gerador de imagem como referência.
 *
 * Produz dois ficheiros por referência:
 *   · `<nome>.webp`       — qualidade alta, para inspecção e arquivo
 *   · `<nome>.ref.webp`   — reduzido, é o que viaja nas chamadas de geração
 *
 * Correr com:  node scripts/converter-modelos.mjs
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PASTA = path.join(process.cwd(), 'src', 'modelos');
const LARGURA_REFERENCIA = 768;

const ficheiros = (await readdir(PASTA)).filter((nome) => /\.(png|jpe?g)$/i.test(nome));

if (ficheiros.length === 0) {
  console.log('Nenhuma imagem para converter em src/modelos/.');
  process.exit(0);
}

for (const nome of ficheiros) {
  const origem = path.join(PASTA, nome);
  const base = nome.replace(/\.(png|jpe?g)$/i, '').replace(/_/g, '-');

  const completo = path.join(PASTA, `${base}.webp`);
  const referencia = path.join(PASTA, `${base}.ref.webp`);

  const meta = await sharp(origem).metadata();

  await sharp(origem).webp({ quality: 88, effort: 5 }).toFile(completo);
  await sharp(origem)
    .resize({ width: LARGURA_REFERENCIA, withoutEnlargement: true })
    .webp({ quality: 78, effort: 5 })
    .toFile(referencia);

  const antes = (await stat(origem)).size;
  const depois = (await stat(completo)).size;
  const refSize = (await stat(referencia)).size;

  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log(
    `${nome}\n` +
      `  original   ${meta.width}x${meta.height}  ${kb(antes)}\n` +
      `  webp       ${meta.width}x${meta.height}  ${kb(depois)}  -> ${base}.webp\n` +
      `  referencia ${LARGURA_REFERENCIA}px      ${kb(refSize)}  -> ${base}.ref.webp`,
  );
}

/**
 * Prepara as referências visuais para uso no servidor.
 *
 * Dois ficheiros por referência, com propósitos diferentes:
 *
 *  · `<base>.webp`  — versão de arquivo, para a área administrativa mostrar.
 *  · `<base>.ref.webp` — versão reduzida, a única que viaja nas chamadas de
 *    geração. Os PNG do primeiro lote têm 1,3 a 2,7 MB cada; enviar isso
 *    dentro do corpo de um pedido é latência paga sem ganho, porque o que a
 *    referência contribui é luz, hierarquia e acabamento — não detalhe ao
 *    píxel.
 *
 * Aceita originais em PNG, JPG e JPEG. O nome-base é o nome do ficheiro sem
 * a extensão: `ref10.jpg` dá `ref10.webp` e `ref10.ref.webp`.
 *
 * Por omissão converte APENAS os originais que ainda não têm `.ref.webp`:
 * acrescentar um lote novo não regenera os derivados das referências já
 * cadastradas. Para reconverter tudo — por exemplo, depois de mudar as
 * larguras ou as qualidades abaixo:
 *
 *    node scripts/converter-referencias.mjs --all
 *
 * Os originais ficam onde estão. Esta conversão não apaga nada.
 */
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'src', 'referencias');

/** Largura da versão de arquivo. */
const ARCHIVE_WIDTH = 1080;
/** Largura da versão enviada ao gerador. */
const PAYLOAD_WIDTH = 768;

/** Extensões aceites como original. Os `.webp` da pasta são derivados. */
const SOURCE_EXTENSION = /\.(png|jpe?g)$/i;

const ALL = process.argv.slice(2).includes('--all');

const baseOf = (name) => name.replace(SOURCE_EXTENSION, '');

// Ordem natural (ref2 antes de ref10), só para a saída se ler bem.
const sources = (await readdir(DIR))
  .filter((name) => SOURCE_EXTENSION.test(name))
  .sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));

if (sources.length === 0) {
  console.error(`Nenhum original (PNG, JPG ou JPEG) em ${DIR}`);
  process.exit(1);
}

/*
  Dois originais com o mesmo nome-base (`ref1.png` e `ref1.jpg`) escreveriam
  os mesmos derivados, e o último a ser convertido ganhava sem aviso.
*/
const byBase = new Map();
for (const name of sources) byBase.set(baseOf(name), [...(byBase.get(baseOf(name)) ?? []), name]);
const clashes = [...byBase.values()].filter((names) => names.length > 1);
if (clashes.length > 0) {
  console.error('Originais com o mesmo nome-base — renomeia ou remove um deles:');
  for (const names of clashes) console.error(`  ${names.join(', ')}`);
  process.exit(1);
}

const pending = ALL
  ? sources
  : sources.filter((name) => !existsSync(path.join(DIR, `${baseOf(name)}.ref.webp`)));

if (pending.length === 0) {
  console.log('Nada a converter: todos os originais já têm `.ref.webp`. Usa --all para reconverter tudo.');
  process.exit(0);
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

for (const name of pending) {
  const base = baseOf(name);
  const source = path.join(DIR, name);

  const archive = path.join(DIR, `${base}.webp`);
  const payload = path.join(DIR, `${base}.ref.webp`);

  await sharp(source)
    .resize({ width: ARCHIVE_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(archive);

  await sharp(source)
    .resize({ width: PAYLOAD_WIDTH, withoutEnlargement: true })
    .webp({ quality: 76 })
    .toFile(payload);

  const [original, arq, pay] = await Promise.all([
    stat(source),
    stat(archive),
    stat(payload),
  ]);

  console.log(
    `${base}  original ${kb(original.size)}  arquivo ${kb(arq.size)}  envio ${kb(pay.size)}`,
  );
}

const skipped = sources.length - pending.length;
console.log(
  `\n${pending.length} referências convertidas` +
    (skipped > 0 ? `; ${skipped} já tinham versão reduzida e ficaram como estavam.` : '.'),
);

/**
 * Converte as artes da primeira dobra para WebP.
 *
 * Lê os PNG, JPG e JPEG de `src/hero arts/` e escreve, ao lado de cada um,
 * `<nome>.webp` com no máximo 900 px de largura. É mais do que as faixas
 * pedem (cerca de 170 px, o dobro nos ecrãs de alta densidade) e deixa
 * folga: o `next/image` serve a cada ecrã a versão de que ele precisa.
 *
 * Só converte o que ainda não tem `.webp`; para reconverter tudo:
 *
 *    node scripts/converter-hero.mjs --all
 *
 * Os originais ficam onde estão. Depois de converter, acrescenta a arte em
 * `src/lib/landing/heroArts.ts`, com o texto alternativo.
 */
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'src', 'hero arts');
const MAX_WIDTH = 900;
const SOURCE = /\.(png|jpe?g)$/i;
const ALL = process.argv.slice(2).includes('--all');

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const baseOf = (name) => name.replace(SOURCE, '');

const sources = (await readdir(DIR))
  .filter((name) => SOURCE.test(name))
  .sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));

if (sources.length === 0) {
  console.log(`Nada a converter: não há PNG nem JPG em ${DIR}.`);
  process.exit(0);
}

const pending = ALL
  ? sources
  : sources.filter((name) => !existsSync(path.join(DIR, `${baseOf(name)}.webp`)));

if (pending.length === 0) {
  console.log('Nada a converter: todas as artes já têm `.webp`. Usa --all para reconverter.');
  process.exit(0);
}

for (const name of pending) {
  const source = path.join(DIR, name);
  const target = path.join(DIR, `${baseOf(name)}.webp`);
  // `rotate()` aplica a orientação EXIF antes de a deitar fora.
  const info = await sharp(source)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(target);
  const [before, after] = await Promise.all([stat(source), stat(target)]);
  console.log(`${baseOf(name)}.webp  ${info.width} × ${info.height}  ${kb(before.size)} → ${kb(after.size)}`);
}

console.log(`\n${pending.length} ${pending.length === 1 ? 'arte convertida' : 'artes convertidas'}.`);

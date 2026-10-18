import { ScrollLit } from './ScrollLit';
import { SectionField } from './SectionField';
import { Container, IndexTag, reveal } from './ui';

/**
 * O problema, dito como um manifesto.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Uma frase grande que se acende palavra a palavra à medida que a página
 * rola (`ScrollLit`), a terminar na promessa a néon; por baixo, as três
 * dores, numeradas como os pontos da escultura da secção da marca. Sem
 * cartões nem ícones: depois de duas secções com imagem, uma secção só de
 * texto, forte, muda o ritmo da leitura.
 *
 * Continua sem números: não há poupanças calculadas nem comparações com o
 * preço de um designer. Não temos dados que as sustentem, e um número
 * inventado na secção que descreve a dor do cliente estragava a confiança em
 * tudo o que vem a seguir.
 * ──────────────────────────────────────────────────────────────────────────
 */

const HEADING = 'A tua empresa não pode esperar dias por cada publicação.';
const BODY =
  'Há uma promoção para anunciar, um produto que acabou de chegar e clientes à espera de novidades.';
/** A promessa, uma frase por linha: corridas, partiam-se em "Mais / espaço". */
const PROMISE = ['Menos trabalho para publicar.', 'Mais espaço para cuidar do negócio.'] as const;

const PAINS = [
  {
    title: 'Fazer tudo sozinho',
    text: 'O teu tempo já tem trabalho suficiente. Não precisas de passar a tarde a ajustar fontes e alinhamentos.',
  },
  {
    title: 'Pedir cada alteração',
    text: 'Uma mudança pequena não devia travar uma campanha. Ajustas o texto e os elementos da publicação no próprio sistema.',
  },
  {
    title: 'Manter a produção',
    text: 'Nem todas as empresas têm orçamento para uma equipa criativa. A tua marca passa a ter uma forma prática de produzir as artes do dia a dia.',
  },
] as const;

const count = (text: string) => text.split(' ').length;

/** As palavras de uma frase, cada uma com o seu número na contagem do manifesto. */
function Words({ text, from }: { text: string; from: number }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <span key={index} className="lp-lit-word" style={{ ['--i' as string]: from + index }}>
          {word}{' '}
        </span>
      ))}
    </>
  );
}

export function Problem() {
  const headingWords = count(HEADING);
  const bodyWords = count(BODY);
  const firstPromise = count(PROMISE[0]);
  const total = headingWords + bodyWords + firstPromise + count(PROMISE[1]);

  return (
    <section aria-labelledby="problema-titulo" className="relative isolate py-28 sm:py-36 lg:py-44">
      {/* O campo de pontos da primeira dobra, secção sim, secção não. Os pulsos nascem à direita, longe do início das frases. */}
      <SectionField pingArea={[0.55, 0.12, 0.95, 0.88]} />
      <Container>
        {/*
          O título e o texto correm como uma só frase (os dois em linha); a
          promessa vai para a linha de baixo, a néon. Para um leitor de ecrã
          continuam a ser um título e dois parágrafos.
        */}
        <ScrollLit
          count={total}
          className="max-w-[66rem] text-[clamp(1.75rem,3.8vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-fg"
        >
          <h2 id="problema-titulo" className="inline">
            <Words text={HEADING} from={0} />
          </h2>
          <p className="inline">
            <Words text={BODY} from={headingWords} />
          </p>
          {/* `text-balance`: no telemóvel, cada frase parte-se ao meio, sem deixar uma palavra sozinha. */}
          <p className="mt-[0.45em] text-neon">
            <span className="block text-balance">
              <Words text={PROMISE[0]} from={headingWords + bodyWords} />
            </span>
            <span className="block text-balance">
              <Words text={PROMISE[1]} from={headingWords + bodyWords + firstPromise} />
            </span>
          </p>
        </ScrollLit>

        <ul className="mt-20 grid grid-cols-1 gap-x-10 gap-y-10 border-t border-line pt-10 sm:mt-24 md:grid-cols-3">
          {PAINS.map((pain, index) => (
            <li key={pain.title} {...reveal(index * 90)} className="min-w-0">
              <IndexTag index={index + 1}>{pain.title}</IndexTag>
              <p className="mt-5 max-w-[24rem] text-pretty text-[15px] leading-relaxed text-fg-muted">{pain.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

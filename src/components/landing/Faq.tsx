import { buildFaq } from '@/lib/landing/content';
import { FaqAccordion } from './FaqAccordion';
import { Container, Lead, SectionTitle, reveal } from './ui';

/**
 * Perguntas frequentes.
 *
 * As respostas são montadas em `buildFaq` a partir do catálogo e da
 * configuração dos planos: a lista de formatos é a do editor, e a pergunta
 * sobre pagamento só existe quando o pagamento estiver definido.
 *
 * O título fica à esquerda, preso ao rolar, e as perguntas numeradas à
 * direita, como os nomes da secção da marca.
 */
export function Faq() {
  const items = buildFaq();
  return (
    <section id="perguntas" aria-labelledby="perguntas-titulo" className="relative py-24 sm:py-32">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div {...reveal()}>
              <SectionTitle id="perguntas-titulo" lines={['Perguntas', 'frequentes.']} />
            </div>
            <div {...reveal(80)}>
              <Lead className="mt-6 max-w-[22rem]">Respostas directas sobre o que a Kriar faz hoje.</Lead>
            </div>
          </div>
          <div {...reveal(100)} className="min-w-0">
            <FaqAccordion items={items} />
          </div>
        </div>
      </Container>
    </section>
  );
}

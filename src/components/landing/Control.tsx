import { ControlDemo } from './ControlDemo';
import { SectionField } from './SectionField';
import { Container, Hint, Lead, SectionIntro, reveal } from './ui';

/**
 * Controlo: a resposta à desconfiança em relação à IA.
 *
 * A secção é uma demonstração que se usa, não uma lista de promessas: o
 * visitante muda o título, o produto, o logótipo e os contactos e vê a
 * disposição responder. O texto à volta é curto de propósito; a indicação
 * por baixo dele é a mesma da escultura ("Passa o cursor pelos dados"), a
 * dizer que aqui também se mexe — e a pedir o clique em "Gerar arte", que
 * mostra a arte que a Kriar gerou com estes dados.
 */
export function Control() {
  return (
    // `overflow-x-clip` e não `overflow-hidden`: o brilho por trás do esboço
    // passava da largura do telemóvel, e `hidden` partiria o `sticky` dele.
    <section aria-labelledby="controlo-titulo" className="relative isolate overflow-x-clip py-24 sm:py-32">
      {/* O campo de pontos da primeira dobra; os pulsos nascem do lado do esboço. */}
      <SectionField pingArea={[0.55, 0.15, 0.98, 0.85]} />
      <Container>
        <SectionIntro id="controlo-titulo" title={['A IA propõe.', 'Tu decides.']}>
          <Lead>
            Antes de gerar, confirmas o que a publicação vai dizer e destacar: o título, o produto, o
            sítio do logótipo e os contactos. Não precisas de aceitar a primeira sugestão.
          </Lead>
          <Hint className="mt-6">Experimenta: muda os dados e clica em Gerar arte</Hint>
        </SectionIntro>

        <div {...reveal(120)} className="mt-14 sm:mt-16">
          <ControlDemo />
        </div>
      </Container>
    </section>
  );
}

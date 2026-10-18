/**
 * Tipografia — definições de `next/font`.
 *
 * Este módulo só pode ser importado por componentes de servidor (o layout
 * raiz). O catálogo utilizável no cliente está em `src/lib/fontCatalog.ts`,
 * que contém apenas identificadores e nomes de variáveis CSS.
 *
 * Os ficheiros são auto-alojados pelo Next: não há pedidos ao Google em
 * runtime, e o canvas de exportação consegue usar as mesmas fontes sem
 * problemas de origem.
 */
import {
  Inter,
  Manrope,
  Plus_Jakarta_Sans,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
} from 'next/font/google';

/** Fonte da interface da aplicação (não disponível para as artes). */
export const uiSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-sans',
});

// --- Fontes disponíveis para a identidade das marcas -----------------------
// Fontes variáveis: não declaramos `weight` (o Next gera o eixo completo).
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-brand-inter' });
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-brand-manrope' });
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brand-jakarta',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brand-grotesk',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brand-playfair',
});
// Poppins não é variável no Google Fonts: os pesos são obrigatórios.
const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-poppins',
});

const loaded = [uiSans, inter, manrope, jakarta, spaceGrotesk, playfair, poppins];

/** Classes a aplicar no elemento <html> para expor todas as variáveis CSS. */
export const fontVariableClassName = loaded.map((f) => f.variable).join(' ');

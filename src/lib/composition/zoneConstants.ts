/**
 * Constantes das zonas de edição, sem dependências.
 *
 * Separadas de `zones.ts` porque a rota do servidor também as usa, e
 * `zones.ts` traz consigo o desenho em canvas — código de browser que não
 * tem nada a fazer dentro de uma rota.
 */

/**
 * Quatro zonas por edição, no máximo.
 *
 * Cada alteração a mais divide a atenção do gerador. Quatro já cobre uma
 * ronda de revisão normal ("troca o fundo, aumenta o preço, tira a
 * chávena"); para mais do que isso, uma arte nova sai melhor.
 */
export const ZONE_LIMIT = 4;

/**
 * Cores das zonas no MAPA que segue para a IA.
 *
 * No ecrã as zonas são todas verdes, a cor da aplicação. No mapa têm cores
 * diferentes, saturadas e raras numa publicação, para o gerador saber sem
 * ambiguidade qual pedido pertence a qual zona — e são nomeadas no prompt
 * pela mesma palavra.
 */
export const ZONE_MAP_COLORS = [
  { hex: '#FF2BD6', name: 'magenta' },
  { hex: '#00D5FF', name: 'ciano' },
  { hex: '#FF8A00', name: 'laranja' },
  { hex: '#8F5BFF', name: 'violeta' },
] as const;

/**
 * Os pontos assinalados da escultura, a acompanhar as partículas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O ponto vai exactamente com a sua partícula — o motor devolve, a cada
 * fotograma, quanto ela se afastou do sítio (`LiquidEngine.onAnchors`). O
 * nome vai atrás, preso por uma mola, e a linha estica entre os dois, como
 * uma etiqueta presa por um fio: o cursor desfaz a escultura e os nomes
 * balançam com ela; quando ela assenta, voltam ao sítio.
 *
 * Tudo por `transform`, sem voltar a dispor a página a cada fotograma. Com
 * menos movimento pedido pelo sistema, o nome vai com o ponto, sem mola.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { clamp } from './engine';

/** Onde fica um ponto assinalado em repouso, em px da secção. */
export type CalloutRest = {
  /** Fora do ecrã: não se pinta. */
  hidden: boolean;
  /** A partícula. */
  ax: number;
  ay: number;
  /** Onde a linha toca o nome. */
  lx: number;
  ly: number;
  /** O canto de cima à esquerda do nome, e o tamanho dele. */
  left: number;
  top: number;
  width: number;
  height: number;
};

/** A largura da linha no CSS: esticada por `scaleX`, o degradê não se perde. */
export const LINE_BASE = 100;

/** A mola do nome, por fotograma a 60 Hz: um pouco de balanço, sem tremer. */
const STIFFNESS = 0.1;
const DAMPING = 0.24;
/** O nome afasta-se no máximo isto do seu sítio (px): por mais que a partícula voe, continua legível. */
const REACH = 80;
/** Distância mínima às margens da secção. */
const MARGIN = 8;

type Parts = { dot: HTMLElement; line: HTMLElement; label: HTMLElement };

export class CalloutMotion {
  /** Com menos movimento pedido: o nome vai com o ponto, sem mola. */
  calm = false;

  private parts: Parts[];
  private rest: CalloutRest[] = [];
  private width = 0;
  /** Quanto cada partícula se afastou: [dx0, dy0, dx1, dy1, …]. */
  private target: Float32Array;
  /** Onde vai cada nome, e a que velocidade, em relação ao seu sítio. */
  private pos: Float32Array;
  private vel: Float32Array;
  private raf = 0;
  private last = 0;

  /** `elements`: um por ponto, com três filhos — o ponto, a linha e o nome. */
  constructor(elements: HTMLElement[]) {
    this.parts = elements.map((element) => {
      const [dot, line, label] = Array.from(element.children) as HTMLElement[];
      return { dot, line, label };
    });
    const n = this.parts.length * 2;
    this.target = new Float32Array(n);
    this.pos = new Float32Array(n);
    this.vel = new Float32Array(n);
  }

  /** O sítio de cada ponto em repouso — a cada mudança de tamanho da secção. */
  place(rest: CalloutRest[], width: number) {
    this.rest = rest;
    this.width = width;
    for (let i = 0; i < this.parts.length; i++) this.paint(i);
  }

  /** O que o motor devolve: os pontos vão já; os nomes, no fotograma seguinte. */
  follow(offsets: Float32Array) {
    const n = Math.min(offsets.length, this.target.length);
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (this.target[i] === offsets[i]) continue;
      this.target[i] = offsets[i];
      changed = true;
    }
    if (!changed) return;
    for (let i = 0; i < this.parts.length; i++) this.paint(i);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number) => {
    const dt = clamp((now - this.last) / 16.6667, 0.25, 3);
    this.last = now;
    const damping = Math.pow(1 - DAMPING, dt);
    let moving = false;

    for (let i = 0; i < this.parts.length; i++) {
      // O alvo do nome: o deslocamento da partícula, com um alcance que amacia ao chegar a `REACH`.
      let tx = this.target[i * 2];
      let ty = this.target[i * 2 + 1];
      const r = Math.hypot(tx, ty);
      if (r > 0.001) {
        const k = (REACH * Math.tanh(r / REACH)) / r;
        tx *= k;
        ty *= k;
      }
      for (const [j, goal] of [
        [i * 2, tx],
        [i * 2 + 1, ty],
      ] as const) {
        if (this.calm) {
          this.pos[j] = goal;
          this.vel[j] = 0;
          continue;
        }
        this.vel[j] += (goal - this.pos[j]) * STIFFNESS * dt;
        this.vel[j] *= damping;
        this.pos[j] += this.vel[j] * dt;
        if (Math.abs(goal - this.pos[j]) > 0.05 || Math.abs(this.vel[j]) > 0.05) moving = true;
        else {
          this.pos[j] = goal;
          this.vel[j] = 0;
        }
      }
      this.paint(i);
    }

    this.raf = moving ? requestAnimationFrame(this.tick) : 0;
  };

  private paint(i: number) {
    const rest = this.rest[i];
    const part = this.parts[i];
    if (!rest || !part || rest.hidden) return;

    const ax = rest.ax + this.target[i * 2];
    const ay = rest.ay + this.target[i * 2 + 1];
    const left = clamp(rest.left + this.pos[i * 2], MARGIN, Math.max(MARGIN, this.width - rest.width - MARGIN));
    const top = rest.top + this.pos[i * 2 + 1];
    // A ponta da linha fica sempre no nome, mesmo com ele encostado a uma margem.
    const lx =
      rest.width > 24 ? clamp(rest.lx + this.pos[i * 2], left + 12, left + rest.width - 12) : left + rest.width / 2;
    const ly = rest.ly + this.pos[i * 2 + 1];
    const length = Math.hypot(lx - ax, ly - ay);
    const angle = Math.atan2(ly - ay, lx - ax);

    part.dot.style.transform = `translate3d(${ax.toFixed(2)}px, ${ay.toFixed(2)}px, 0)`;
    part.line.style.transform = `translate3d(${ax.toFixed(2)}px, ${ay.toFixed(2)}px, 0) rotate(${angle.toFixed(4)}rad) scaleX(${(length / LINE_BASE).toFixed(4)})`;
    part.label.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0)`;
  }
}

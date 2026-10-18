/**
 * Motor de partículas líquidas (WebGL2, simulação no GPU).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Adaptado do "Sculpture Hero" de guglielmogiannattasio.it. A imagem é
 * refeita a partir de dezenas de milhares de partículas, tiradas dos
 * próprios píxeis: o cursor torna o material líquido, e ele volta a assentar
 * na imagem nítida. Sem WebGL2, quem usa o motor mostra a imagem parada.
 *
 * O motor é o do original, com estas mudanças: a cor do fundo da secção é
 * a da página; não há tema claro; a imagem pode trazer as pontas
 * prolongadas para lá do assunto (`span`), sem mudar a densidade das
 * partículas nem o raio do cursor; e há partículas seguidas pelo CPU
 * (`anchors`), para os pontos assinalados da página irem com elas.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type Rect = { x: number; y: number; w: number; h: number };

/** Um sítio da imagem, em fracções da largura e da altura. */
export type Anchor = { u: number; v: number };

export interface ImageSettings {
  /**
   * Quantas vezes a imagem é mais larga do que o assunto. A escultura
   * deitada traz as pontas prolongadas até às margens do ecrã; a densidade
   * das partículas, o raio do cursor e a montagem medem-se pela escultura,
   * não pelo prolongamento. 1 = a imagem é toda o assunto.
   */
  span?: number;
  /**
   * Partículas seguidas pelo CPU, em fracções da imagem: a cada fotograma
   * em que o material se mexe, `onAnchors` recebe quanto cada uma se
   * afastou do seu sítio.
   */
  anchors?: Anchor[];
}

export interface EngineOptions {
  interactive: boolean;
  strength: number;
  radius: number;
  density: number;
  dotSize: number;
  spread: number;
  turbulence: number;
  returnSpeed: number;
  streaks: boolean;
  restStyle: 'image' | 'particles';
  ambient: boolean;
  ambientIntensity: number;
  speed: number;
  intro: boolean;
  reducedMotion: boolean;
  bg: [number, number, number];
  /** `null` = lido nos cantos da imagem. */
  imgBg: [number, number, number] | null;
  /** 0 – 2: quanto a imagem inteira escorre com o cursor por cima. */
  liquid: number;
}

export function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

/* ── shaders ─────────────────────────────────────────────────────────── */

const NOISE = `
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y); }
vec2 ambientField(vec2 uv, float t){
  vec2 q = uv*vec2(3.2,1.7);
  vec2 a = vec2(vnoise(q+vec2(t*0.11,0.0))-0.5, vnoise(q+vec2(5.2,t*0.08)+3.1)-0.5);
  vec2 q2 = uv*vec2(7.5,4.0) + vec2(-t*0.19, t*0.13);
  vec2 b = vec2(vnoise(q2+1.7)-0.5, vnoise(q2+9.3)-0.5);
  return a + b*0.45;
}
`;

/* A energia do material num ponto: partilhada pela imagem e pelas
   partículas, para a transição entre as duas ser exactamente complementar. */
const ENERGY = `
float energyAt(vec2 rectPx, vec2 mouse, float radius, float presence, float wakeEnergy){
  vec2 d = rectPx - mouse;
  float f = exp(-dot(d,d)/(radius*radius))*presence;
  return smoothstep(0.06, 0.5, f*1.15 + wakeEnergy*1.7);
}
`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }
`;

/* Mapa do rasto do cursor. RGBA8: velocidade codificada à volta de 128, energia em B. */
const FLOW_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uMouse;
uniform vec2 uVel;
uniform vec2 uSize;
uniform float uRadius;
uniform float uPresence;
uniform float uDecay;
vec2 decV(vec4 c){ return (c.rg*255.0-128.0)/127.0; }
void main(){
  vec2 v0 = decV(texture(uPrev, vUv));
  vec2 uv = vUv - v0*uTexel*2.5;
  vec4 c = texture(uPrev, uv)*0.52
    + 0.12*(texture(uPrev, uv+vec2(uTexel.x,0.0)) + texture(uPrev, uv-vec2(uTexel.x,0.0))
          + texture(uPrev, uv+vec2(0.0,uTexel.y)) + texture(uPrev, uv-vec2(0.0,uTexel.y)));
  vec2 v = decV(c);
  float p = c.b;
  vec2 d = (vUv-uMouse)*uSize;
  float f = exp(-dot(d,d)/(uRadius*uRadius))*uPresence;
  float sp = clamp(length(uVel)*2.5, 0.0, 1.0);
  v += uVel*f*0.22;
  p = max(p, f*sp);
  v *= uDecay;
  p *= uDecay;
  v = sign(v)*max(abs(v)-1.2/127.0, 0.0);
  p = max(p-1.2/255.0, 0.0);
  v = clamp(v, -1.0, 1.0);
  o = vec4((v*127.0+128.0)/255.0, p, 1.0);
}
`;

/* Passo da simulação: estado = (deslocamento.xy, velocidade.xy) em px CSS. */
const SIM_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uState;
uniform sampler2D uHome;
uniform sampler2D uFlow;
uniform vec2 uSize;
uniform vec2 uMouse;
uniform float uRadius;
uniform float uPresence;
uniform float uStrength;
uniform float uSpread;
uniform float uTurb;
uniform float uReturn;
uniform float uTime;
uniform float uDt;
uniform float uIntro;
${NOISE}
vec2 curl(vec2 p){
  const float e = 0.35;
  float a = vnoise(p+vec2(0.0,e)) - vnoise(p-vec2(0.0,e));
  float b = vnoise(p+vec2(e,0.0)) - vnoise(p-vec2(e,0.0));
  return vec2(a, -b)/(2.0*e);
}
void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec4 hm = texelFetch(uHome, ij, 0);
  if(hm.w <= 0.0){ o = vec4(0.0); return; }
  vec4 st = texelFetch(uState, ij, 0);
  vec2 off = st.xy;
  vec2 vel = st.zw;
  float sd = hm.z;
  float light = 0.45 + sd*1.1;
  vec2 p = hm.xy*uSize + off;
  vec4 fl = texture(uFlow, clamp(p/uSize, 0.0, 1.0));
  vec2 wake = (fl.rg*255.0-128.0)/127.0;
  float pr = fl.b;
  vec2 toM = p - uMouse;
  float r2 = dot(toM,toM);
  float f = exp(-r2/(uRadius*uRadius))*uPresence;
  vec2 n = toM*inversesqrt(r2+1.0);
  float e = clamp(pr*2.0 + f, 0.0, 1.0);
  vec2 acc = vec2(0.0);
  acc += n*f*1.25*uStrength*uSpread*light;
  acc += vec2(-n.y, n.x)*f*1.45*uStrength*uSpread*(0.4+sd);
  acc += (wake*42.0*uSpread*light - vel)*e*0.08;
  vec2 q = p*0.0095 + vec2(uTime*0.35, -uTime*0.2);
  vec2 c = curl(q) + 0.5*curl(q*2.3 + 7.1);
  acc += c*(e*1.2*uSpread + uIntro*1.5)*uTurb*light;
  float k = (0.006 + 0.02*uReturn)*(0.65+sd*0.7)*(1.0 - uIntro*0.75);
  acc -= off*k;
  vel += acc*uDt;
  vel *= pow(mix(0.93, 0.955, e), uDt);
  off += vel*uDt;
  if(dot(off,off) < 0.0004 && dot(vel,vel) < 0.0004){ off = vec2(0.0); vel = vec2(0.0); }
  o = vec4(off, vel);
}
`;

/* Partículas: um quadrado por partícula, uma cápsula esticada pela velocidade. */
const PART_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
uniform sampler2D uState;
uniform sampler2D uHome;
uniform sampler2D uCol;
uniform sampler2D uFlow;
uniform int uTexW;
uniform vec4 uRect;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uRadius;
uniform float uPresence;
uniform float uDot;
uniform float uTime;
uniform float uAmbient;
uniform float uStreak;
uniform float uIntroVis;
uniform float uRest;
uniform vec3 uTint;
out vec2 vLocal;
out float vHalfLen;
out float vR;
out vec3 vCol;
out float vA;
${NOISE}
${ENERGY}
void main(){
  int id = gl_InstanceID;
  ivec2 ij = ivec2(id % uTexW, id / uTexW);
  vec4 hm = texelFetch(uHome, ij, 0);
  vec4 st = texelFetch(uState, ij, 0);
  vec4 cl = texelFetch(uCol, ij, 0);
  float wakeE = texture(uFlow, hm.xy).b;
  float E = energyAt(hm.xy*uRect.zw, uMouse, uRadius, uPresence, wakeE);
  float lift = smoothstep(0.35, 2.5, length(st.xy));
  float a = max(max(E, lift), max(uRest, 1.0-uIntroVis));
  if(a < 0.01 || hm.w <= 0.0){ gl_Position = vec4(2.0,2.0,2.0,1.0); return; }
  vec2 base = uRect.xy + hm.xy*uRect.zw + st.xy;
  base -= ambientField(hm.xy, uTime)*10.0*uAmbient;
  vec2 v = st.zw;
  float sp = length(v);
  vec2 dir = sp > 0.001 ? v/sp : vec2(1.0,0.0);
  float r = uDot*hm.w*0.5;
  float len = min(sp*1.25, 18.0)*uStreak;
  vec2 lc = aCorner*vec2(r + len*0.5 + 1.0, r + 1.0);
  vec2 center = base - dir*len*0.5;
  vec2 world = center + dir*lc.x + vec2(-dir.y, dir.x)*lc.y;
  vec2 clip = world/uRes*2.0-1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vLocal = lc;
  vHalfLen = len*0.5;
  vR = r;
  vec3 col = cl.rgb*uTint;
  float glint = smoothstep(2.0, 16.0, sp);
  col = mix(col, min(col*1.18 + vec3(0.07,0.075,0.085), vec3(1.0)), glint*0.75);
  vCol = col;
  vA = a;
}
`;

const PART_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vHalfLen;
in float vR;
in vec3 vCol;
in float vA;
uniform float uDpr;
out vec4 o;
void main(){
  vec2 q = vec2(max(abs(vLocal.x)-vHalfLen, 0.0), vLocal.y);
  float d = length(q) - vR;
  float a = clamp(0.5 - d*uDpr, 0.0, 1.0);
  float tail = vHalfLen > 0.0 ? clamp(0.5 - vLocal.x/(2.0*(vHalfLen+vR)), 0.0, 1.0) : 0.0;
  a *= 1.0 - tail*0.55;
  a *= vA;
  if(a < 0.004) discard;
  o = vec4(vCol*a, a);
}
`;

/* A imagem nítida, ligeiramente deformada, a desaparecer onde o material ficou líquido. */
const IMAGE_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uImg;
uniform sampler2D uFlow;
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uRect;
uniform vec3 uBg;
uniform vec3 uImgBg;
uniform vec2 uMouse;
uniform float uPresence;
uniform float uRadius;
uniform float uStrength;
uniform float uTime;
uniform float uAmbient;
uniform float uIntroVis;
uniform float uRest;
uniform float uAlphaMode;
${NOISE}
${ENERGY}
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y*uDpr - gl_FragCoord.y)/uDpr;
  vec2 size = uRect.zw;
  vec2 uv = (px-uRect.xy)/size;
  if(uv.x < -0.05 || uv.x > 1.05 || uv.y < -0.12 || uv.y > 1.12){ o = vec4(0.0); return; }
  vec4 fl = texture(uFlow, clamp(uv,0.0,1.0));
  vec2 vel = (fl.rg*255.0-128.0)/127.0;
  vec2 rp = uv*size;
  vec2 toM = rp - uMouse;
  float fall = exp(-dot(toM,toM)/(uRadius*uRadius))*uPresence;
  vec2 disp = -toM*0.22*uStrength*fall - vel*10.0*uStrength;
  disp += ambientField(uv, uTime)*10.0*uAmbient;
  vec2 suv = uv + disp/size;
  vec4 tx = texture(uImg, suv);
  vec3 col = tx.rgb;
  vec2 e = smoothstep(vec2(0.0), vec2(0.004,0.01), suv) * smoothstep(vec2(1.0), vec2(0.996,0.99), suv);
  float key = uAlphaMode > 0.5 ? tx.a : smoothstep(0.012, 0.05, length(col-uImgBg));
  float k = key*e.x*e.y;
  float E = energyAt(rp, uMouse, uRadius, uPresence, fl.b);
  float show = (1.0 - max(E, uRest))*uIntroVis;
  vec3 mat = uAlphaMode > 0.5 ? col : col*(uBg/max(uImgBg, vec3(0.001)));
  float A = k*show;
  o = vec4(mat*A, A);
}
`;

/* ── auxiliares ──────────────────────────────────────────────────────── */

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): Prog {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('Shader: ' + log);
    }
    return sh;
  };
  const p = gl.createProgram()!;
  const v = make(gl.VERTEX_SHADER, vs);
  const f = make(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (info) u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

/*
  O mesmo `ambientField` dos shaders, no CPU: o desvio "líquido" que o
  desenho das partículas soma ao deslocamento simulado, e que as partículas
  seguidas também têm de levar.
*/
const fract = (x: number) => x - Math.floor(x);

function hash(x: number, y: number) {
  let px = fract(x * 123.34);
  let py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d;
  py += d;
  return fract(px * py);
}

function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  return top + (c + (d - c) * ux - top) * uy;
}

function ambientFieldAt(u: number, v: number, t: number): [number, number] {
  const qx = u * 3.2;
  const qy = v * 1.7;
  const ax = vnoise(qx + t * 0.11, qy) - 0.5;
  const ay = vnoise(qx + 8.3, qy + t * 0.08 + 3.1) - 0.5;
  const q2x = u * 7.5 - t * 0.19;
  const q2y = v * 4 + t * 0.13;
  const bx = vnoise(q2x + 1.7, q2y + 1.7) - 0.5;
  const by = vnoise(q2x + 9.3, q2y + 9.3) - 0.5;
  return [ax + bx * 0.45, ay + by * 0.45];
}

function halfToFloat(h: number) {
  const sign = h & 0x8000 ? -1 : 1;
  const exponent = (h >> 10) & 0x1f;
  const fraction = h & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

/** Uma leitura do estado das partículas seguidas, a caminho do CPU. */
type AnchorRead = { buffer: WebGLBuffer; fence: WebGLSync | null; seq: number; clock: number };

/* ── motor ───────────────────────────────────────────────────────────── */

const TEX_W = 1024;
const SETTLE_FRAMES = 270;
/** Leituras em voo ao mesmo tempo: uma nova a cada fotograma, sem esperar pelo GPU. */
const ANCHOR_READS = 3;

export class LiquidEngine {
  lastImage: HTMLImageElement | null = null;
  /** Chamado uma vez, depois de o primeiro fotograma ser desenhado. */
  onFirstFrame: (() => void) | null = null;
  /**
   * Quanto cada partícula seguida (`ImageSettings.anchors`) se afastou do
   * seu sítio, em px CSS: [dx0, dy0, dx1, dy1, …]. Chamado nos fotogramas em
   * que o material se mexe, e uma última vez com zeros quando assenta.
   */
  onAnchors: ((offsets: Float32Array) => void) | null = null;

  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private opts: EngineOptions;
  private onFail: () => void;
  private lowPower = false;
  private floatRead = false;
  private stateFormat: { internal: number; type: number } = { internal: 0, type: 0 };

  private span = 1;
  private anchors: Anchor[] = [];
  private anchorReads: AnchorRead[] = [];
  private readKind: 'float' | 'half' | 'off' = 'off';
  private anchorRaw: Float32Array | Uint16Array = new Float32Array(0);
  private anchorOut = new Float32Array(0);
  private readSeq = 0;
  private simClock = 0;

  private pFlow!: Prog;
  private pSim!: Prog;
  private pPart!: Prog;
  private pImg!: Prog;
  private vao!: WebGLVertexArrayObject;
  private quad!: WebGLBuffer;

  private imgTex: WebGLTexture | null = null;
  private flowTex: WebGLTexture[] = [];
  private flowFb: WebGLFramebuffer[] = [];
  private flowW = 256;
  private flowH = 104;
  private flowIdx = 0;
  private flowDirty = false;

  private homeTex: WebGLTexture | null = null;
  private colTex: WebGLTexture | null = null;
  private stateTex: WebGLTexture[] = [];
  private stateFb: WebGLFramebuffer[] = [];
  private stateIdx = 0;
  private texH = 1;
  private n = 0;
  private gridW = 1;
  private stateDirty = false;
  private homeData: Float32Array | null = null;

  private alphaMode = false;
  private imgBg: [number, number, number] = [0.918, 0.914, 0.906];
  private flowing = 0;

  private aspect = 2.5;
  private rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private cssW = 1;
  private cssH = 1;

  private target = { x: -9999, y: -9999 };
  private mouse = { x: -9999, y: -9999 };
  private prevMouse = { x: -9999, y: -9999 };
  private mvel = { x: 0, y: 0 };
  private presence = 0;
  private presenceTarget = 0;
  private burst = 0;
  private settle = 1e9;
  private touchRelease = 0;
  private time = 0;
  private introT = 1;

  private raf = 0;
  private running = false;
  private last = 0;
  private skip = 0;
  private visible = true;
  private ready = false;
  private destroyed = false;
  private lost = false;

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions, onFail: () => void) {
    this.canvas = canvas;
    this.opts = opts;
    this.onFail = onFail;
    // alpha: um canvas por apresentar fica transparente, e a imagem parada por baixo vê-se
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;

    const nav = navigator as Navigator & { deviceMemory?: number };
    this.lowPower =
      (nav.hardwareConcurrency || 8) <= 4 ||
      (nav.deviceMemory || 8) <= 4 ||
      window.matchMedia('(pointer: coarse)').matches;

    this.initGL();
    canvas.addEventListener('webglcontextlost', this.onLost, false);
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.stop();
    this.onFail();
  };

  private initGL() {
    const gl = this.gl;
    const full = gl.getExtension('EXT_color_buffer_float');
    const half = full ? null : gl.getExtension('EXT_color_buffer_half_float');
    if (!full && !half) throw new Error('No float render targets');
    this.floatRead = Boolean(full);
    this.stateFormat = { internal: gl.RGBA16F, type: gl.HALF_FLOAT };

    this.pFlow = compile(gl, QUAD_VS, FLOW_FS);
    this.pSim = compile(gl, QUAD_VS, SIM_FS);
    this.pPart = compile(gl, PART_VS, PART_FS);
    this.pImg = compile(gl, QUAD_VS, IMAGE_FS);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    for (let i = 0; i < 2; i++) {
      const t = this.makeTex(gl.RGBA8, this.flowW, this.flowH, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      this.flowTex.push(t);
      this.flowFb.push(fb);
    }
    this.clearFlow();
  }

  private makeTex(
    internal: number,
    w: number,
    h: number,
    format: number,
    type: number,
    data: ArrayBufferView | null,
    filter: number,
  ) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private clearFlow() {
    const gl = this.gl;
    for (const fb of this.flowFb) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, this.flowW, this.flowH);
      gl.clearColor(128 / 255, 128 / 255, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.flowDirty = false;
  }

  private clearState() {
    const gl = this.gl;
    for (const fb of this.stateFb) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, TEX_W, this.texH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.stateDirty = false;
  }

  setImage(img: HTMLImageElement, settings: ImageSettings = {}) {
    if (this.destroyed || this.lost) return;
    const gl = this.gl;
    this.lastImage = img;
    this.span = clamp(settings.span ?? 1, 1, 4);
    this.anchors = (settings.anchors ?? []).slice(0, TEX_W);
    this.aspect = img.naturalWidth / img.naturalHeight || 2.5;
    // O rasto do cursor com a mesma resolução por píxel, seja qual for o prolongamento.
    this.flowW = Math.round(256 * this.span);
    this.flowH = Math.max(32, Math.round(this.flowW / this.aspect));
    for (const t of this.flowTex) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.flowW, this.flowH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    this.clearFlow();

    // A escultura prolongada tem ~4100 px de largura: num GPU que não aceite tanto, sobe reduzida.
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    let source: TexImageSource = img;
    if (img.naturalWidth > maxSize || img.naturalHeight > maxSize) {
      const k = maxSize / Math.max(img.naturalWidth, img.naturalHeight);
      const reduced = document.createElement('canvas');
      reduced.width = Math.floor(img.naturalWidth * k);
      reduced.height = Math.floor(img.naturalHeight * k);
      reduced.getContext('2d')?.drawImage(img, 0, 0, reduced.width, reduced.height);
      source = reduced;
    }

    if (this.imgTex) gl.deleteTexture(this.imgTex);
    this.imgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.buildParticles(img);
    this.ready = true;
    if (this.opts.intro && !this.opts.reducedMotion) this.startIntro();
    this.wake();
  }

  /** Uma partícula por píxel de material de uma grelha posta sobre a imagem. */
  private buildParticles(img: HTMLImageElement) {
    const gl = this.gl;
    const baseGrid = this.lowPower ? 640 : 1000;
    // A grelha mede-se pelo assunto: o prolongamento acrescenta colunas, não as espalha.
    const gw = Math.round(baseGrid * Math.sqrt(clamp(this.opts.density, 0.15, 2)) * this.span);
    const gh = Math.max(1, Math.round(gw / this.aspect));
    this.gridW = gw;

    let data: Uint8ClampedArray;
    try {
      const c = document.createElement('canvas');
      c.width = gw;
      c.height = gh;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, gw, gh);
      data = ctx.getImageData(0, 0, gw, gh).data;
    } catch {
      throw new Error('Image is not CORS-readable');
    }

    // uma imagem recortada (transparente) lê-se pelo alfa; uma de fundo liso, pela distância à cor
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) transparent++;
    this.alphaMode = transparent > data.length / (4 * 7) / 20;

    if (this.opts.imgBg) this.imgBg = this.opts.imgBg;
    else if (!this.alphaMode) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const pw = Math.max(2, Math.round(gw * 0.012));
      for (const [cx, cy] of [
        [0, 0],
        [gw - pw, 0],
        [0, gh - pw],
        [gw - pw, gh - pw],
      ]) {
        for (let y = cy; y < cy + pw; y++)
          for (let x = cx; x < cx + pw; x++) {
            const i = (y * gw + x) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
      }
      this.imgBg = [r / n / 255, g / n / 255, b / n / 255];
    }

    const home: number[] = [];
    const col: number[] = [];
    // As seguidas primeiro: ficam no começo da primeira linha do estado, lidas de uma vez.
    for (const anchor of this.anchors) {
      const x = clamp(Math.floor(anchor.u * gw), 0, gw - 1);
      const y = clamp(Math.floor(anchor.v * gh), 0, gh - 1);
      const i = (y * gw + x) * 4;
      home.push(anchor.u, anchor.v, 0.5, 1);
      col.push(data[i], data[i + 1], data[i + 2], 255);
    }
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const i = (y * gw + x) * 4;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        if (this.alphaMode) {
          const a = data[i + 3] / 255;
          if (a < 0.12) continue;
          if (a < 0.5 && Math.random() > a * 2) continue;
        } else {
          const dev = Math.hypot(r - this.imgBg[0], g - this.imgBg[1], b - this.imgBg[2]);
          if (dev < 0.03) continue;
          if (dev < 0.07 && Math.random() > (dev - 0.03) / 0.04) continue;
        }
        const jx = (Math.random() - 0.5) * 0.6;
        const jy = (Math.random() - 0.5) * 0.6;
        home.push((x + 0.5 + jx) / gw, (y + 0.5 + jy) / gh, Math.random(), 0.85 + Math.random() * 0.3);
        col.push(data[i], data[i + 1], data[i + 2], 255);
      }
    }

    const n = home.length / 4;
    this.n = n;
    this.texH = Math.max(1, Math.ceil(n / TEX_W));
    const total = TEX_W * this.texH;
    const homeArr = new Float32Array(total * 4);
    homeArr.set(home);
    const colArr = new Uint8Array(total * 4);
    colArr.set(col);

    for (const t of [this.homeTex, this.colTex, ...this.stateTex]) if (t) gl.deleteTexture(t);
    for (const f of this.stateFb) gl.deleteFramebuffer(f);
    this.stateTex = [];
    this.stateFb = [];

    this.homeTex = this.makeTex(gl.RGBA32F, TEX_W, this.texH, gl.RGBA, gl.FLOAT, homeArr, gl.NEAREST);
    this.colTex = this.makeTex(gl.RGBA8, TEX_W, this.texH, gl.RGBA, gl.UNSIGNED_BYTE, colArr, gl.NEAREST);
    for (let i = 0; i < 2; i++) {
      const t = this.makeTex(this.stateFormat.internal, TEX_W, this.texH, gl.RGBA, this.stateFormat.type, null, gl.NEAREST);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Float FBO incomplete');
      }
      this.stateTex.push(t);
      this.stateFb.push(fb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.homeData = homeArr;
    this.clearState();
    this.setupAnchorReads();
    this.emitAnchors(null);
  }

  /*
    As partículas seguidas: o estado delas (deslocamento e velocidade) é lido
    do GPU sem o fazer esperar — cada leitura vai para um buffer próprio e só
    é aberta quando o GPU avisa que acabou, um ou dois fotogramas depois. A
    velocidade, lida com o deslocamento, compensa esse atraso.
  */
  private setupAnchorReads() {
    const gl = this.gl;
    this.dropAnchorReads();
    for (const read of this.anchorReads) gl.deleteBuffer(read.buffer);
    this.anchorReads = [];
    const k = this.anchors.length;
    this.anchorOut = new Float32Array(k * 2);
    this.readKind = 'off';
    if (!k) return;
    if (this.floatRead) this.readKind = 'float';
    else {
      // Só com meios-floats: lê-se no formato que o GPU disser que aceita.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.stateFb[0]);
      const format = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
      const type = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      if (format === gl.RGBA && type === gl.HALF_FLOAT) this.readKind = 'half';
    }
    if (this.readKind === 'off') return;
    const half = this.readKind === 'half';
    this.anchorRaw = half ? new Uint16Array(k * 4) : new Float32Array(k * 4);
    for (let i = 0; i < ANCHOR_READS; i++) {
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, this.anchorRaw.byteLength, gl.STREAM_READ);
      this.anchorReads.push({ buffer, fence: null, seq: 0, clock: 0 });
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  private dropAnchorReads() {
    for (const read of this.anchorReads) {
      if (read.fence) this.gl.deleteSync(read.fence);
      read.fence = null;
    }
  }

  /** Abre a leitura mais recente que já chegou e pede outra. */
  private trackAnchors() {
    if (this.readKind === 'off' || !this.onAnchors || !this.anchorReads.length) return;
    const gl = this.gl;
    let newest: AnchorRead | null = null;
    for (const read of this.anchorReads) {
      if (!read.fence) continue;
      const status = gl.clientWaitSync(read.fence, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) continue;
      gl.deleteSync(read.fence);
      read.fence = null;
      if (status !== gl.WAIT_FAILED && (!newest || read.seq > newest.seq)) newest = read;
    }
    if (newest) {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, newest.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.anchorRaw);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      this.emitAnchors(newest);
    }

    const free = this.anchorReads.find((read) => !read.fence);
    if (!free) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.stateFb[this.stateIdx]);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, free.buffer);
    gl.readPixels(0, 0, this.anchors.length, 1, gl.RGBA, this.readKind === 'half' ? gl.HALF_FLOAT : gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    free.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    free.seq = ++this.readSeq;
    free.clock = this.simClock;
  }

  /** `read` = a leitura acabada de abrir; `null` = tudo no sítio (zeros). */
  private emitAnchors(read: AnchorRead | null) {
    const k = this.anchors.length;
    if (!k || !this.onAnchors) return;
    const out = this.anchorOut;
    if (!read) out.fill(0);
    else {
      const raw = this.anchorRaw;
      const value = this.readKind === 'half' ? (i: number) => halfToFloat(raw[i]) : (i: number) => raw[i];
      // A partícula andou desde a leitura: o deslocamento lido, mais a velocidade por esse tempo.
      const lag = clamp(this.simClock - read.clock, 0, 4);
      const liquid = this.liquidAmount() * 10;
      for (let i = 0; i < k; i++) {
        let x = value(i * 4) + value(i * 4 + 2) * lag;
        let y = value(i * 4 + 1) + value(i * 4 + 3) * lag;
        if (liquid > 0.001) {
          const [fx, fy] = ambientFieldAt(this.anchors[i].u, this.anchors[i].v, this.time);
          x -= fx * liquid;
          y -= fy * liquid;
        }
        out[i * 2] = Number.isFinite(x) ? x : 0;
        out[i * 2 + 1] = Number.isFinite(y) ? y : 0;
      }
    }
    this.onAnchors(out);
  }

  private startIntro() {
    const gl = this.gl;
    const home = this.homeData;
    if (!home) return;
    // Medida pela escultura: o prolongamento das pontas chega de mais longe, não espalha o resto.
    const w = this.rect.w > 10 ? this.rect.w / this.span : 1300;
    const total = TEX_W * this.texH;
    const st = new Float32Array(total * 4);
    for (let i = 0; i < this.n; i++) {
      const hx = (home[i * 4] - 0.5) * this.span;
      const hy = home[i * 4 + 1] - 0.5;
      const sd = home[i * 4 + 2];
      const ang = (Math.random() - 0.5) * 0.9 + (hx > 0 ? 0 : Math.PI);
      const dist = w * (0.04 + Math.random() * 0.14) * (0.5 + Math.abs(hx) * 1.4);
      st[i * 4] = Math.cos(ang) * dist + hx * w * 0.25 * sd;
      st[i * 4 + 1] = Math.sin(ang) * dist * 0.55 + hy * 120 * (Math.random() - 0.5);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex[this.stateIdx]);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.stateFormat.internal, TEX_W, this.texH, 0, gl.RGBA, gl.FLOAT, st);
    this.introT = 0;
    this.stateDirty = true;
  }

  setOptions(o: Partial<EngineOptions>) {
    const rebuild =
      (o.density !== undefined && o.density !== this.opts.density) ||
      (o.imgBg !== undefined && String(o.imgBg) !== String(this.opts.imgBg));
    this.opts = { ...this.opts, ...o };
    if (rebuild && this.ready && this.lastImage) {
      try {
        this.buildParticles(this.lastImage);
      } catch {
        this.onFail();
      }
    }
    this.wake();
  }

  resize(cssW: number, cssH: number, rect: Rect) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.rect = rect;
    let dpr = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2);
    const px = this.cssW * this.cssH * dpr * dpr;
    if (px > 4.5e6) dpr = Math.max(1, Math.sqrt(4.5e6 / (this.cssW * this.cssH)));
    const w = Math.round(this.cssW * dpr);
    const h = Math.round(this.cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.draw();
  }

  setVisible(v: boolean) {
    this.visible = v;
    if (v) this.wake();
    else this.stop();
  }

  pointer(type: 'move' | 'down' | 'up' | 'leave', x: number, y: number, touch: boolean) {
    if (!this.opts.interactive || this.lost) return;
    const now = performance.now();
    if (type === 'leave' || type === 'up') {
      if (touch) this.touchRelease = now + 260;
      else this.presenceTarget = 0;
      this.wake();
      return;
    }
    if (this.mouse.x < -9000 || type === 'down') {
      this.mouse.x = this.prevMouse.x = x;
      this.mouse.y = this.prevMouse.y = y;
    }
    this.target.x = x;
    this.target.y = y;
    this.presenceTarget = 1;
    this.settle = 0;
    if (type === 'down') {
      this.burst = 1;
      this.touchRelease = 0;
    }
    this.wake();
  }

  private wake() {
    if (!this.ready || this.running || !this.visible || this.destroyed || this.lost) {
      if (this.ready && !this.running) this.draw();
      return;
    }
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private radiusPx() {
    return this.opts.radius * clamp(this.rect.w / this.span / 1400, 0.6, 1.25);
  }

  private strength() {
    return this.opts.strength * (this.opts.reducedMotion ? 0.5 : 1);
  }

  /** Quanto o material inteiro escorre agora (o campo `ambientField`, em unidades de 10 px). */
  private liquidAmount() {
    const o = this.opts;
    const rm = o.reducedMotion;
    const base = o.ambient && !rm ? clamp(o.ambientIntensity, 0, 2) : 0;
    return base + this.flowing * 0.85 * clamp(o.liquid, 0, 2) * (rm ? 0.3 : 1);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const rawMs = now - this.last;
    const dt = clamp(rawMs / 16.6667, 0.25, 3);
    this.last = now;
    const o = this.opts;
    const ambientOn = o.ambient && !o.reducedMotion;

    if (this.touchRelease && now > this.touchRelease) {
      this.presenceTarget = 0;
      this.touchRelease = 0;
    }

    const ease = 1 - Math.pow(1 - 0.22, dt);
    this.mouse.x += (this.target.x - this.mouse.x) * ease;
    this.mouse.y += (this.target.y - this.mouse.y) * ease;
    const vx = (this.mouse.x - this.prevMouse.x) / dt;
    const vy = (this.mouse.y - this.prevMouse.y) / dt;
    this.prevMouse.x = this.mouse.x;
    this.prevMouse.y = this.mouse.y;
    this.mvel.x += (clamp(vx, -60, 60) - this.mvel.x) * 0.5;
    this.mvel.y += (clamp(vy, -60, 60) - this.mvel.y) * 0.5;

    const pk = this.presenceTarget > this.presence ? 0.1 : 0.035;
    this.presence += (this.presenceTarget - this.presence) * (1 - Math.pow(1 - pk, dt));
    if (this.presence < 0.001 && this.presenceTarget === 0) this.presence = 0;
    const fk = this.presenceTarget > this.flowing ? 0.05 : 0.018;
    this.flowing += (this.presenceTarget - this.flowing) * (1 - Math.pow(1 - fk, dt));
    if (this.flowing < 0.002 && this.presenceTarget === 0) this.flowing = 0;

    if (this.introT < 1) this.introT = Math.min(1, this.introT + Math.min(rawMs, 100) / 3200);

    const interacting = this.presence > 0.001 || this.burst > 0;
    // contado em fotogramas simulados: um aparelho lento nunca salta a meio do regresso
    this.settle = interacting ? 0 : this.settle + dt;
    const active = interacting || this.settle < SETTLE_FRAMES || this.introT < 1;

    if (!active) {
      if (this.flowDirty) this.clearFlow();
      if (this.stateDirty) {
        this.clearState();
        // Assentou: as seguidas estão no sítio.
        this.dropAnchorReads();
        this.emitAnchors(null);
      }
      if (!ambientOn) {
        this.draw();
        this.firstFrame();
        this.stop();
        return;
      }
      this.raf = requestAnimationFrame(this.frame);
      if (this.skip++ % 2) return;
      this.time += (dt * 2 * o.speed) / 60;
      this.draw();
      this.firstFrame();
      return;
    }

    this.raf = requestAnimationFrame(this.frame);
    this.time += (dt * o.speed * (1 + this.flowing * 1.6)) / 60;
    this.stepFlow(dt);
    this.stepSim(dt);
    this.trackAnchors();
    this.burst = Math.max(0, this.burst - 0.1 * dt);
    this.draw();
    this.firstFrame();
  };

  private firstFrame() {
    if (this.onFirstFrame) {
      const cb = this.onFirstFrame;
      this.onFirstFrame = null;
      // mais um fotograma, para o compositor já ter apresentado o canvas
      requestAnimationFrame(() => cb());
    }
  }

  private stepFlow(dt: number) {
    const gl = this.gl;
    const P = this.pFlow;
    const dst = 1 - this.flowIdx;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.flowFb[dst]);
    gl.viewport(0, 0, this.flowW, this.flowH);
    gl.disable(gl.BLEND);
    gl.useProgram(P.p);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.flowTex[this.flowIdx]);
    gl.uniform1i(P.u.uPrev, 0);
    gl.uniform2f(P.u.uTexel, 1 / this.flowW, 1 / this.flowH);
    const r = this.rect;
    gl.uniform2f(P.u.uMouse, (this.mouse.x - r.x) / r.w, (this.mouse.y - r.y) / r.h);
    gl.uniform2f(P.u.uVel, clamp(this.mvel.x / 40, -1, 1), clamp(this.mvel.y / 40, -1, 1));
    gl.uniform2f(P.u.uSize, r.w, r.h);
    gl.uniform1f(P.u.uRadius, this.radiusPx());
    gl.uniform1f(P.u.uPresence, Math.max(this.presence, this.burst));
    gl.uniform1f(P.u.uDecay, Math.pow(0.968, dt));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.flowIdx = dst;
    this.flowDirty = true;
  }

  private stepSim(dt: number) {
    if (!this.n) return;
    const gl = this.gl;
    const P = this.pSim;
    const o = this.opts;
    const r = this.rect;
    const dst = 1 - this.stateIdx;
    const intro = o.reducedMotion || !o.intro ? 0 : Math.pow(1 - this.introT, 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.stateFb[dst]);
    gl.viewport(0, 0, TEX_W, this.texH);
    gl.disable(gl.BLEND);
    gl.useProgram(P.p);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex[this.stateIdx]);
    gl.uniform1i(P.u.uState, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.homeTex);
    gl.uniform1i(P.u.uHome, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.flowTex[this.flowIdx]);
    gl.uniform1i(P.u.uFlow, 2);
    gl.uniform2f(P.u.uSize, r.w, r.h);
    gl.uniform2f(P.u.uMouse, this.mouse.x - r.x, this.mouse.y - r.y);
    gl.uniform1f(P.u.uRadius, this.radiusPx());
    gl.uniform1f(P.u.uPresence, Math.max(this.presence, this.burst));
    gl.uniform1f(P.u.uStrength, this.strength() * (1 + this.burst * 1.5));
    gl.uniform1f(P.u.uSpread, clamp(o.spread, 0, 2));
    gl.uniform1f(P.u.uTurb, clamp(o.turbulence, 0, 2) * (o.reducedMotion ? 0.3 : 1));
    gl.uniform1f(P.u.uReturn, clamp(o.returnSpeed, 0, 2));
    gl.uniform1f(P.u.uTime, this.time);
    gl.uniform1f(P.u.uDt, dt);
    gl.uniform1f(P.u.uIntro, intro);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stateIdx = dst;
    this.stateDirty = true;
    // Em fotogramas simulados, a unidade da velocidade das partículas.
    this.simClock += dt;
  }

  private draw() {
    if (!this.ready || this.lost || this.destroyed) return;
    const gl = this.gl;
    const o = this.opts;
    const r = this.rect;
    const rm = o.reducedMotion;
    const introVis = rm || !o.intro ? 1 : Math.pow(this.introT, 2.2);
    const amb = this.liquidAmount();
    const rest = o.restStyle === 'particles' ? 1 : 0;
    const [br, bg, bb] = o.bg;
    const [ir, ig, ib] = this.imgBg;
    const dpr = this.canvas.width / this.cssW;
    const pres = Math.max(this.presence, this.burst);
    const mx = this.mouse.x - r.x;
    const my = this.mouse.y - r.y;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    const I = this.pImg;
    gl.useProgram(I.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.uniform1i(I.u.uImg, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.flowTex[this.flowIdx]);
    gl.uniform1i(I.u.uFlow, 1);
    gl.uniform2f(I.u.uRes, this.cssW, this.cssH);
    gl.uniform1f(I.u.uDpr, dpr);
    gl.uniform4f(I.u.uRect, r.x, r.y, r.w, r.h);
    gl.uniform3f(I.u.uBg, br, bg, bb);
    gl.uniform3f(I.u.uImgBg, ir, ig, ib);
    gl.uniform2f(I.u.uMouse, mx, my);
    gl.uniform1f(I.u.uPresence, pres);
    gl.uniform1f(I.u.uRadius, this.radiusPx());
    gl.uniform1f(I.u.uStrength, this.strength());
    gl.uniform1f(I.u.uTime, this.time);
    gl.uniform1f(I.u.uAmbient, amb);
    gl.uniform1f(I.u.uIntroVis, introVis);
    gl.uniform1f(I.u.uRest, rest);
    gl.uniform1f(I.u.uAlphaMode, this.alphaMode ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // em repouso, no modo "image", as partículas não se vêem: nem se desenham
    if (!this.n || (!this.stateDirty && rest === 0 && introVis >= 1)) return;

    const P = this.pPart;
    gl.useProgram(P.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex[this.stateIdx]);
    gl.uniform1i(P.u.uState, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.homeTex);
    gl.uniform1i(P.u.uHome, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.colTex);
    gl.uniform1i(P.u.uCol, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.flowTex[this.flowIdx]);
    gl.uniform1i(P.u.uFlow, 3);
    gl.uniform1i(P.u.uTexW, TEX_W);
    gl.uniform4f(P.u.uRect, r.x, r.y, r.w, r.h);
    gl.uniform2f(P.u.uRes, this.cssW, this.cssH);
    gl.uniform2f(P.u.uMouse, mx, my);
    gl.uniform1f(P.u.uRadius, this.radiusPx());
    gl.uniform1f(P.u.uPresence, pres);
    const spacing = r.w / this.gridW;
    gl.uniform1f(P.u.uDot, spacing * 1.45 * clamp(o.dotSize, 0.2, 3));
    gl.uniform1f(P.u.uTime, this.time);
    gl.uniform1f(P.u.uAmbient, amb);
    gl.uniform1f(P.u.uStreak, (o.streaks ? 1 : 0) * (0.45 + 0.55 * introVis));
    gl.uniform1f(P.u.uIntroVis, introVis);
    gl.uniform1f(P.u.uRest, rest);
    gl.uniform1f(P.u.uDpr, dpr);
    if (this.alphaMode) gl.uniform3f(P.u.uTint, 1, 1, 1);
    else gl.uniform3f(P.u.uTint, br / Math.max(ir, 0.001), bg / Math.max(ig, 0.001), bb / Math.max(ib, 0.001));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    gl.disable(gl.BLEND);
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    const gl = this.gl;
    this.onAnchors = null;
    if (!this.lost) {
      this.dropAnchorReads();
      for (const read of this.anchorReads) gl.deleteBuffer(read.buffer);
      this.anchorReads = [];
      gl.deleteBuffer(this.quad);
      gl.deleteVertexArray(this.vao);
      for (const t of [...this.flowTex, ...this.stateTex, this.imgTex, this.homeTex, this.colTex]) {
        if (t) gl.deleteTexture(t);
      }
      for (const f of [...this.flowFb, ...this.stateFb]) gl.deleteFramebuffer(f);
      for (const p of [this.pFlow, this.pSim, this.pPart, this.pImg]) if (p) gl.deleteProgram(p.p);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/* ── disposição ──────────────────────────────────────────────────────── */

/**
 * A escultura fica centrada na faixa entre o topo e o texto, tão larga como
 * a secção (pode sair pelos lados em ecrãs pequenos).
 */
export function computeRect(
  w: number,
  h: number,
  aspect: number,
  band: { top: number; bottom: number },
  p: { scale: number; mobileScale: number; x: number; y: number },
): Rect {
  const bandH = Math.max(80, band.bottom - band.top);
  let rw: number;
  let maxH: number;
  if (w >= 1024) {
    rw = w * 1.02 * p.scale;
    maxH = bandH * 1.1 * p.scale;
  } else if (w >= 640) {
    rw = w * 1.3 * p.scale;
    maxH = bandH * 1.15 * p.scale;
  } else if (aspect < 1.3) {
    // imagem ao alto nos telemóveis: ocupa a largura, pode entrar por baixo do título
    rw = w * 1.0 * p.mobileScale;
    maxH = bandH * 1.0 * p.mobileScale;
  } else {
    rw = w * 1.9 * p.mobileScale;
    maxH = bandH * 1.2 * p.mobileScale;
  }
  if (rw / aspect > maxH) rw = maxH * aspect;
  const rh = rw / aspect;
  const cx = w * (0.5 + p.x / 100);
  const cy = (band.top + band.bottom) / 2 + h * (p.y / 100);
  return { x: cx - rw / 2, y: cy - rh / 2, w: rw, h: rh };
}

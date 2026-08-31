/* =========================================================================
   Globo WebGL — sem dependências.
   Três passes: disco/atmosfera, pontos de terra, corredores (fitas) e hubs.
   Projeção ortográfica; oclusão resolvida na mão (nada de depth buffer).
   ========================================================================= */

const DEG = Math.PI / 180;

const vecOf = (lon, lat) => {
  const la = lat * DEG;
  const lo = lon * DEG;
  const c = Math.cos(la);
  return [c * Math.sin(lo), Math.sin(la), c * Math.cos(lo)];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'shader');
  }
  return shader;
};

const program = (gl, vs, fs, attribs, uniforms) => {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  const handle = { program: p, a: {}, u: {} };
  attribs.forEach((name) => { handle.a[name] = gl.getAttribLocation(p, name); });
  uniforms.forEach((name) => { handle.u[name] = gl.getUniformLocation(p, name); });
  return handle;
};

const buffer = (gl, data, target = gl.ARRAY_BUFFER) => {
  const b = gl.createBuffer();
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return b;
};

/* ---------- shaders comuns ---------- */
const PROJECT = `
  uniform mat3 uRot;
  uniform float uScale;
  uniform vec2 uCenter;
  uniform float uAspect;
  vec3 rotate(vec3 p){ return uRot * p; }
  vec2 project(vec3 r){ return vec2(r.x * uScale / uAspect + uCenter.x, r.y * uScale + uCenter.y); }
`;

const DOT_VS = `
  precision highp float;
  attribute vec3 aPos;
  uniform float uSize;
  varying float vFade;
  varying float vLight;
  ${PROJECT}
  void main(){
    vec3 r = rotate(aPos);
    vLight = 0.6 + 0.4 * smoothstep(-0.6, 0.7, dot(normalize(r), normalize(vec3(-0.42, 0.44, 0.62))));
    vFade = smoothstep(-0.02, 0.32, r.z);
    if (r.z < -0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
    gl_Position = vec4(project(r), 0.0, 1.0);
    gl_PointSize = uSize * (0.62 + 0.38 * r.z);
  }
`;

const DOT_FS = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vLight;
  void main(){
    float d = length(gl_PointCoord - vec2(0.5));
    float mask = 1.0 - smoothstep(0.40, 0.5, d);
    gl_FragColor = vec4(mix(uColor * 0.9, vec3(1.0), vLight * 0.25), mask * vFade * uOpacity * vLight);
  }
`;

const ARC_VS = `
  precision highp float;
  attribute vec3 aPos;
  attribute vec3 aNext;
  attribute float aSide;
  attribute float aT;
  attribute float aFront;
  attribute float aArc;
  uniform float uWidth;
  uniform float uFilter;
  uniform float uActive;
  varying float vT;
  varying float vPhase;
  varying float vDim;
  varying float vHidden;
  varying float vActive;
  ${PROJECT}
  void main(){
    vec3 r = rotate(aPos);
    vec3 rn = rotate(aNext);
    vec2 p = project(r);
    vec2 pn = project(rn);
    vec2 dir = normalize((pn - p) * vec2(uAspect, 1.0) + vec2(1e-6));
    vec2 perp = vec2(-dir.y, dir.x);

    float active = step(0.5, 1.0 - abs(aArc - uActive));
    float inFront = step(0.5, 1.0 - abs(aFront - uFilter)) + step(uFilter, -0.5);
    inFront = clamp(inFront, 0.0, 1.0);
    vActive = active;
    vDim = mix(0.16, 1.0, inFront);
    vDim = max(vDim, active);

    float w = uWidth * mix(1.0, 1.9, active);
    vec2 offset = perp * w;
    p += vec2(offset.x / uAspect, offset.y) * aSide;

    float radial = length(r.xy);
    vHidden = 1.0 - (1.0 - (1.0 - smoothstep(0.99, 1.03, radial)) * (1.0 - smoothstep(-0.03, 0.05, r.z)))
                  * smoothstep(-0.42, 0.06, r.z);
    vT = aT;
    vPhase = fract(aArc * 0.293);
    gl_Position = vec4(p, 0.0, 1.0);
  }
`;

const ARC_FS = `
  precision highp float;
  uniform vec3 uLine;
  uniform vec3 uGlow;
  uniform float uTime;
  uniform float uOpacity;
  varying float vT;
  varying float vPhase;
  varying float vDim;
  varying float vHidden;
  varying float vActive;
  void main(){
    float taper = smoothstep(0.0, 0.05, vT) * (1.0 - smoothstep(0.95, 1.0, vT));
    float u = fract(vT - uTime * 0.17 - vPhase);
    float comet = smoothstep(0.82, 0.995, u) * (1.0 - smoothstep(0.995, 1.0, u));
    float base = 0.38 + 0.34 * vActive;
    float alpha = (base + comet * (0.85 + 0.15 * vActive)) * taper * vDim;
    alpha *= 1.0 - vHidden * 0.94;
    vec3 color = mix(uLine, uGlow, clamp(comet * 1.2 + vActive * 0.55, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

const HUB_VS = `
  precision highp float;
  attribute vec3 aPos;
  attribute float aHi;
  uniform float uSize;
  varying float vFade;
  varying float vHi;
  ${PROJECT}
  void main(){
    vec3 r = rotate(aPos);
    vFade = smoothstep(-0.02, 0.22, r.z);
    if (r.z < -0.04) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
    vHi = aHi;
    gl_Position = vec4(project(r), 0.0, 1.0);
    gl_PointSize = uSize * mix(1.0, 1.55, aHi);
  }
`;

const HUB_FS = `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uGlow;
  uniform float uOpacity;
  uniform float uTime;
  varying float vFade;
  varying float vHi;
  void main(){
    float d = length(gl_PointCoord - vec2(0.5));
    float core = 1.0 - smoothstep(0.12, 0.2, d);
    float ringR = mix(0.30, 0.30 + 0.12 * (0.5 + 0.5 * sin(uTime * 2.0)), vHi);
    float ring = (1.0 - smoothstep(0.02, 0.05, abs(d - ringR))) * mix(0.28, 0.9, vHi);
    vec3 color = mix(uColor, uGlow, vHi);
    float alpha = (core + ring) * vFade * uOpacity;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

const DISC_VS = `
  precision highp float;
  attribute vec2 aQuad;
  uniform float uScale;
  uniform vec2 uCenter;
  uniform float uAspect;
  varying vec2 vLocal;
  void main(){
    vLocal = aQuad;
    vec2 p = vec2(aQuad.x * uScale * 1.7 / uAspect + uCenter.x, aQuad.y * uScale * 1.7 + uCenter.y);
    gl_Position = vec4(p, 0.0, 1.0);
  }
`;

/* Limbo iluminado + halo externo: a "borda acesa" do planeta. */
const DISC_FS = `
  precision highp float;
  uniform float uOpacity;
  uniform vec3 uGlow;
  varying vec2 vLocal;
  void main(){
    float d = length(vLocal) * 1.7;
    vec2 dir = d > 0.0001 ? vLocal / length(vLocal) : vec2(0.0, 1.0);
    float lit = 0.28 + 0.72 * pow(clamp(dot(dir, normalize(vec2(-0.5, 0.62))) * 0.5 + 0.5, 0.0, 1.0), 1.6);

    float inside = 1.0 - smoothstep(0.994, 1.001, d);
    float body = inside * (0.028 + 0.055 * pow(smoothstep(0.2, 1.0, d), 3.0));
    float limb = inside * pow(smoothstep(0.72, 1.0, d), 5.0) * 0.9 * lit;
    float halo = step(1.0, d) * exp(-pow((d - 1.0) * 7.5, 1.5)) * 0.55 * lit;
    float edge = (1.0 - smoothstep(0.0, 0.006, abs(d - 1.0))) * 0.35 * lit;

    vec3 cool = vec3(0.72, 0.83, 0.88);
    vec3 color = mix(cool, uGlow, 0.25);
    float alpha = (body + limb + halo + edge) * uOpacity;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

/* Campo de estrelas com parallax leve, preso ao giro do globo. */
const STAR_VS = `
  precision highp float;
  attribute vec3 aStar;
  uniform float uShift;
  uniform float uPixel;
  varying float vSeed;
  void main(){
    float x = fract((aStar.x + 1.0) * 0.5 + uShift) * 2.0 - 1.0;
    vSeed = aStar.z;
    gl_Position = vec4(x, aStar.y, 0.0, 1.0);
    gl_PointSize = uPixel * (0.7 + aStar.z * 1.6);
  }
`;

const STAR_FS = `
  precision highp float;
  uniform float uOpacity;
  uniform float uTime;
  varying float vSeed;
  void main(){
    float d = length(gl_PointCoord - vec2(0.5));
    float mask = 1.0 - smoothstep(0.1, 0.5, d);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + vSeed) + vSeed * 30.0);
    gl_FragColor = vec4(vec3(0.85, 0.9, 0.96), mask * twinkle * (0.16 + vSeed * 0.5) * uOpacity);
  }
`;

const ARC_SAMPLES = 72;

export function createGlobe(canvas, { dots, hubs, routes, colors = {} }) {
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255);
  const cLand = hexToRgb(colors.land || '#8B9096');
  const cLine = hexToRgb(colors.line || '#7C838B');
  const cGlow = hexToRgb(colors.glow || '#3ED89C');
  const cHub = hexToRgb(colors.hub || '#E6E7E4');

  const progDot = program(gl, DOT_VS, DOT_FS, ['aPos'], ['uRot', 'uScale', 'uCenter', 'uAspect', 'uSize', 'uColor', 'uOpacity']);
  const progArc = program(gl, ARC_VS, ARC_FS,
    ['aPos', 'aNext', 'aSide', 'aT', 'aFront', 'aArc'],
    ['uRot', 'uScale', 'uCenter', 'uAspect', 'uWidth', 'uFilter', 'uActive', 'uLine', 'uGlow', 'uTime', 'uOpacity']);
  const progHub = program(gl, HUB_VS, HUB_FS, ['aPos', 'aHi'], ['uRot', 'uScale', 'uCenter', 'uAspect', 'uSize', 'uColor', 'uGlow', 'uOpacity', 'uTime']);
  const progDisc = program(gl, DISC_VS, DISC_FS, ['aQuad'], ['uScale', 'uCenter', 'uAspect', 'uOpacity', 'uGlow']);
  const progStar = program(gl, STAR_VS, STAR_FS, ['aStar'], ['uShift', 'uPixel', 'uOpacity', 'uTime']);

  /* ---------- geometria ---------- */
  const dotData = new Float32Array(dots.length * 3);
  dots.forEach(([lon, lat], i) => {
    const v = vecOf(lon, lat);
    dotData.set(v, i * 3);
  });
  const dotBuffer = buffer(gl, dotData);

  const hubVectors = hubs.map((h) => vecOf(h.lon, h.lat));
  const hubPos = new Float32Array(hubVectors.flat());
  const hubHi = new Float32Array(hubs.length);
  const hubPosBuffer = buffer(gl, hubPos);
  const hubHiBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, hubHiBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, hubHi, gl.DYNAMIC_DRAW);

  const quadBuffer = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));

  const STAR_COUNT = 340;
  const stars = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = (a, b) => a + Math.random() * (b - a);
    stars[i * 3] = r(-1, 1);
    stars[i * 3 + 1] = r(-1, 1);
    stars[i * 3 + 2] = Math.pow(Math.random(), 2.2);
  }
  const starBuffer = buffer(gl, stars);

  // Fitas de arco: cada segmento vira dois triângulos, largura resolvida em tela.
  const STRIDE = 10;
  const verts = [];
  const indices = [];
  routes.forEach((route, arcIndex) => {
    const a = hubVectors[route.from];
    const b = hubVectors[route.to];
    const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const omega = Math.acos(dot);
    const sin = Math.sin(omega) || 1e-6;
    const lift = 0.06 + 0.2 * (omega / Math.PI);
    const path = [];
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      const t = i / ARC_SAMPLES;
      const s0 = Math.sin((1 - t) * omega) / sin;
      const s1 = Math.sin(t * omega) / sin;
      const r = 1 + lift * Math.sin(Math.PI * t);
      path.push([(a[0] * s0 + b[0] * s1) * r, (a[1] * s0 + b[1] * s1) * r, (a[2] * s0 + b[2] * s1) * r]);
    }
    const base = verts.length / STRIDE;
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      const p = path[i];
      const n = path[Math.min(i + 1, ARC_SAMPLES)];
      const next = i === ARC_SAMPLES
        ? [p[0] * 2 - path[i - 1][0], p[1] * 2 - path[i - 1][1], p[2] * 2 - path[i - 1][2]]
        : n;
      const t = i / ARC_SAMPLES;
      verts.push(p[0], p[1], p[2], next[0], next[1], next[2], 1, t, route.front, arcIndex);
      verts.push(p[0], p[1], p[2], next[0], next[1], next[2], -1, t, route.front, arcIndex);
      if (i < ARC_SAMPLES) {
        const v = base + i * 2;
        indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
  });
  const arcBuffer = buffer(gl, new Float32Array(verts));
  const arcIndexBuffer = buffer(gl, new Uint16Array(indices), gl.ELEMENT_ARRAY_BUFFER);
  const arcCount = indices.length;

  /* ---------- estado ---------- */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    yaw: -0.82, pitch: 0.16,
    targetYaw: null, targetPitch: null,
    velocity: 0, velocityY: 0,
    scale: 2.2, cx: 0, cy: -2.36,
    targetScale: 2.2, targetCx: 0, targetCy: -2.36,
    opacity: 0, targetOpacity: 1,
    filter: -1, active: -1,
    idle: 0, dragging: false, time: 0,
  };
  let width = 1;
  let height = 1;
  let dpr = 1;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const rot = new Float32Array(9);
  const setRotation = () => {
    const cy = Math.cos(state.yaw);
    const sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    // Rx(pitch) * Ry(yaw), em ordem column-major.
    rot[0] = cy;         rot[1] = sy * sp;        rot[2] = -sy * cp;
    rot[3] = 0;          rot[4] = cp;             rot[5] = sp;
    rot[6] = sy;         rot[7] = -cy * sp;       rot[8] = cy * cp;
  };

  const applyCommon = (prog) => {
    gl.uniformMatrix3fv(prog.u.uRot, false, rot);
    gl.uniform1f(prog.u.uScale, state.scale);
    gl.uniform2f(prog.u.uCenter, state.cx, state.cy);
    gl.uniform1f(prog.u.uAspect, width / height);
  };

  const bindAttrib = (loc, buf, size, stride = 0, offset = 0) => {
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  };

  const rotatePoint = (v) => [
    rot[0] * v[0] + rot[3] * v[1] + rot[6] * v[2],
    rot[1] * v[0] + rot[4] * v[1] + rot[7] * v[2],
    rot[2] * v[0] + rot[5] * v[1] + rot[8] * v[2],
  ];

  /** Projeta um vetor unitário em coordenadas CSS do canvas. */
  const screenOf = (v) => {
    const r = rotatePoint(v);
    const aspect = width / height;
    const ndcX = (r[0] * state.scale) / aspect + state.cx;
    const ndcY = r[1] * state.scale + state.cy;
    return {
      x: ((ndcX + 1) / 2) * (width / dpr),
      y: ((1 - ndcY) / 2) * (height / dpr),
      z: r[2],
    };
  };

  const shortest = (from, to) => {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return from + delta;
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  let raf = 0;
  let last = performance.now();
  let visible = true;

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    state.time += dt;

    if (state.targetYaw !== null) {
      state.yaw = lerp(state.yaw, state.targetYaw, 1 - Math.pow(0.002, dt));
      state.pitch = lerp(state.pitch, state.targetPitch, 1 - Math.pow(0.002, dt));
      if (Math.abs(state.yaw - state.targetYaw) < 0.002) { state.targetYaw = null; state.targetPitch = null; }
    } else if (!state.dragging) {
      state.yaw += state.velocity * dt;
      state.pitch = Math.max(-1.05, Math.min(1.05, state.pitch + state.velocityY * dt));
      state.velocity *= Math.pow(0.02, dt);
      state.velocityY *= Math.pow(0.02, dt);
      state.idle += dt;
      if (!reduced && state.idle > 1.2) state.yaw += 0.055 * dt * Math.min(1, (state.idle - 1.2) * 1.5);
    }

    const ease = 1 - Math.pow(0.006, dt);
    state.scale = lerp(state.scale, state.targetScale, ease);
    state.cx = lerp(state.cx, state.targetCx, ease);
    state.cy = lerp(state.cy, state.targetCy, ease);
    state.opacity = lerp(state.opacity, state.targetOpacity, 1 - Math.pow(0.08, dt));
    setRotation();

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // estrelas
    gl.useProgram(progStar.program);
    bindAttrib(progStar.a.aStar, starBuffer, 3);
    gl.uniform1f(progStar.u.uShift, state.yaw * 0.012);
    gl.uniform1f(progStar.u.uPixel, 2.1 * dpr);
    gl.uniform1f(progStar.u.uOpacity, state.opacity);
    gl.uniform1f(progStar.u.uTime, reduced ? 1.0 : state.time);
    gl.drawArrays(gl.POINTS, 0, STAR_COUNT);

    // atmosfera
    gl.useProgram(progDisc.program);
    bindAttrib(progDisc.a.aQuad, quadBuffer, 2);
    gl.uniform1f(progDisc.u.uScale, state.scale);
    gl.uniform2f(progDisc.u.uCenter, state.cx, state.cy);
    gl.uniform1f(progDisc.u.uAspect, width / height);
    gl.uniform1f(progDisc.u.uOpacity, state.opacity);
    gl.uniform3fv(progDisc.u.uGlow, cGlow);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // pontos de terra
    gl.useProgram(progDot.program);
    bindAttrib(progDot.a.aPos, dotBuffer, 3);
    applyCommon(progDot);
    gl.uniform1f(progDot.u.uSize, Math.min(3.4 * dpr, Math.max(1.75 * dpr, state.scale * height * 0.0028)));
    gl.uniform3fv(progDot.u.uColor, cLand);
    gl.uniform1f(progDot.u.uOpacity, 0.92 * state.opacity);
    gl.drawArrays(gl.POINTS, 0, dots.length);

    // corredores
    gl.useProgram(progArc.program);
    const f = Float32Array.BYTES_PER_ELEMENT;
    bindAttrib(progArc.a.aPos, arcBuffer, 3, STRIDE * f, 0);
    bindAttrib(progArc.a.aNext, arcBuffer, 3, STRIDE * f, 3 * f);
    bindAttrib(progArc.a.aSide, arcBuffer, 1, STRIDE * f, 6 * f);
    bindAttrib(progArc.a.aT, arcBuffer, 1, STRIDE * f, 7 * f);
    bindAttrib(progArc.a.aFront, arcBuffer, 1, STRIDE * f, 8 * f);
    bindAttrib(progArc.a.aArc, arcBuffer, 1, STRIDE * f, 9 * f);
    applyCommon(progArc);
    gl.uniform1f(progArc.u.uWidth, (1.35 * dpr) / height * 2);
    gl.uniform1f(progArc.u.uFilter, state.filter);
    gl.uniform1f(progArc.u.uActive, state.active);
    gl.uniform3fv(progArc.u.uLine, cLine);
    gl.uniform3fv(progArc.u.uGlow, cGlow);
    gl.uniform1f(progArc.u.uTime, reduced ? 0.4 : state.time);
    gl.uniform1f(progArc.u.uOpacity, state.opacity);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arcIndexBuffer);
    gl.drawElements(gl.TRIANGLES, arcCount, gl.UNSIGNED_SHORT, 0);

    // hubs
    gl.useProgram(progHub.program);
    bindAttrib(progHub.a.aPos, hubPosBuffer, 3);
    bindAttrib(progHub.a.aHi, hubHiBuffer, 1);
    applyCommon(progHub);
    gl.uniform1f(progHub.u.uSize, Math.min(13 * dpr, Math.max(7 * dpr, state.scale * height * 0.0075)));
    gl.uniform3fv(progHub.u.uColor, cHub);
    gl.uniform3fv(progHub.u.uGlow, cGlow);
    gl.uniform1f(progHub.u.uOpacity, state.opacity);
    gl.uniform1f(progHub.u.uTime, state.time);
    gl.drawArrays(gl.POINTS, 0, hubs.length);

    raf = visible ? requestAnimationFrame(frame) : 0;
  };
  raf = requestAnimationFrame(frame);

  /* ---------- interação de ponteiro ---------- */
  let pointer = null;
  const onDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    pointer = { x: event.clientX, y: event.clientY, moved: 0 };
    state.dragging = true;
    state.targetYaw = null;
    state.idle = 0;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (event) => {
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    const k = 2.2 / (state.scale * (height / dpr));
    state.yaw += dx * k;
    state.pitch = Math.max(-1.05, Math.min(1.05, state.pitch - dy * k));
    state.velocity = (dx * k) / 0.016;
    state.velocityY = (-dy * k) / 0.016;
    if (event.cancelable) event.preventDefault();
  };
  const onUp = () => {
    if (!pointer) return;
    pointer = null;
    state.dragging = false;
    state.idle = 0;
    canvas.style.cursor = '';
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  return {
    /** Enquadramento animado, dirigido pelo scroll. */
    setLayout({ scale, cx, cy, opacity }) {
      if (scale !== undefined) state.targetScale = scale;
      if (cx !== undefined) state.targetCx = cx;
      if (cy !== undefined) state.targetCy = cy;
      if (opacity !== undefined) state.targetOpacity = opacity;
    },
    setFilter(front) { state.filter = front === null || front === undefined ? -1 : front; },
    setActive(index) {
      state.active = index === null || index === undefined ? -1 : index;
      hubHi.fill(0);
      if (index >= 0 && routes[index]) {
        hubHi[routes[index].from] = 1;
        hubHi[routes[index].to] = 1;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, hubHiBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, hubHi);
    },
    /** Gira até o ponto médio do corredor ficar de frente. */
    focusRoute(index) {
      const route = routes[index];
      if (!route) return;
      const a = hubVectors[route.from];
      const b = hubVectors[route.to];
      const mid = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
      const len = Math.hypot(...mid) || 1;
      const lat = Math.asin(mid[1] / len);
      const lon = Math.atan2(mid[0] / len, mid[2] / len);
      state.targetYaw = shortest(state.yaw, -lon);
      state.targetPitch = Math.max(-0.9, Math.min(0.9, lat));
      state.idle = -6;
    },
    /** Hub sob o ponteiro, em coordenadas CSS relativas ao canvas. */
    hubAt(x, y) {
      let best = null;
      hubVectors.forEach((v, i) => {
        const p = screenOf(v);
        if (p.z < 0.02) return;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < 20 && (!best || d < best.d)) best = { index: i, d, x: p.x, y: p.y };
      });
      return best;
    },
    projectHub(index) { return screenOf(hubVectors[index]); },
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
  };
}

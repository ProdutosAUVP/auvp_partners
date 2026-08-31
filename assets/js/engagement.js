/* =========================================================================
   Peso da taxa de setup na operação.
   Um número-herói e uma curva: a taxa é fixa (R$ 20.000), então o seu peso
   cai conforme a operação cresce. Nada aqui inventa o percentual do success
   fee — ele é definido em contrato e não é simulado.
   ========================================================================= */

import { t, locale } from './i18n.js';

const SETUP = 20000;
const MIN = 1e6;        // R$ 1 milhão
const MAX = 1e9;        // R$ 1 bilhão
const TOP = 2;          // topo do eixo y, em % (o peso em uma operação de R$ 1 mi)

// O viewBox acompanha o tamanho real em pixels: assim fontes, espessuras e o raio
// do marcador saem no tamanho pedido, em qualquer largura de tela.
const box = { w: 720, h: 210, L: 50, R: 716, T: 14, B: 180 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const logPos = (value) => (Math.log10(value) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN));
const valueAt = (t) => MIN * (MAX / MIN) ** t;
const weightOf = (value) => (SETUP / value) * 100;

const x = (value) => box.L + logPos(value) * (box.R - box.L);
const y = (weight) => box.B - clamp(weight / TOP, 0, 1) * (box.B - box.T);

const numero = (v, casas, agrupar = true) =>
  v.toLocaleString(locale(), { maximumFractionDigits: casas, useGrouping: agrupar });

const money = (value) => {
  // Chinês conta em 万 (10^4) e 亿 (10^8); as demais línguas, em milhões e bilhões.
  if (locale().startsWith('zh')) {
    return value >= 1e8
      ? `R$ ${numero(value / 1e8, 2, false)}${t('unit.yi')}`
      : `R$ ${numero(value / 1e4, 0, false)}${t('unit.wan')}`;
  }
  if (value >= 1e9) {
    const bi = value / 1e9;
    return `R$ ${numero(bi, 2)} ${bi >= 2 ? t('unit.billions') : t('unit.billion')}`;
  }
  const mi = value / 1e6;
  return `R$ ${numero(mi, mi < 10 ? 1 : 0)} ${mi >= 2 ? t('unit.millions') : t('unit.million')}`;
};

/** Marcas do eixo: a notação compacta do Intl já resolve mi/bi, M/B e 万/亿. */
const moneyCurto = (value) =>
  `R$ ${value.toLocaleString(locale(), { notation: 'compact', maximumFractionDigits: 1 })}`;

/** Duas casas significativas: 2,0 · 0,48 · 0,034 · 0,0020. */
const percent = (weight) => {
  const casas = weight >= 1 ? 1 : Math.min(5, 1 + Math.ceil(-Math.log10(weight)));
  return weight.toLocaleString(locale(), { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

export function initEngagement(root) {
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const range = $('[data-gauge-range]');
  const weightEl = $('[data-gauge-weight]');
  const marker = $('[data-gauge-marker]');
  const guide = $('[data-gauge-guide]');
  const plot = $('.gauge__plot');
  if (!range || !marker) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = root.querySelector('.gauge__plot svg');
  const grade = $('[data-gauge-grid]');
  const ticks = $('[data-gauge-ticks]');
  const svgNS = 'http://www.w3.org/2000/svg';
  const nodo = (tag, attrs, text) => {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== undefined) el.textContent = text;
    return el;
  };

  const desenhar = () => {
    const rect = plot.getBoundingClientRect();
    box.w = Math.max(280, Math.round(rect.width));
    box.h = Math.max(130, Math.round(rect.height));
    box.L = 50;
    box.R = box.w - 4;
    box.T = 14;
    box.B = box.h - 30;
    svg.setAttribute('viewBox', `0 0 ${box.w} ${box.h}`);

    const pontos = [];
    for (let i = 0; i <= 180; i++) {
      const v = valueAt(i / 180);
      pontos.push(`${x(v).toFixed(1)},${y(weightOf(v)).toFixed(1)}`);
    }
    $('[data-gauge-curve]').setAttribute('d', `M${pontos.join('L')}`);
    $('[data-gauge-area]').setAttribute('d', `M${pontos.join('L')}L${box.R},${box.B}L${box.L},${box.B}Z`);

    grade.textContent = '';
    ticks.textContent = '';
    [2, 1, 0.5, 0].forEach((w) => {
      const py = y(w);
      grade.append(nodo('line', { x1: box.L, x2: box.R, y1: py, y2: py, class: w === 0 ? 'is-axis' : '' }));
      ticks.append(nodo('text', {
        x: box.L - 12, y: py, dy: '0.32em', class: 'gauge__tick', 'text-anchor': 'end',
      }, w === 0 ? '0%' : `${w.toLocaleString(locale())}%`));
    });
    const marcas = [1e6, 1e7, 1e8, 1e9].map((v) => [v, moneyCurto(v)]);
    marcas.forEach(([v, rotulo], i) => {
      const px = x(v);
      if (i > 0 && i < marcas.length - 1) {
        grade.append(nodo('line', { x1: px, x2: px, y1: box.T, y2: box.B, class: 'is-soft' }));
      }
      if (box.w < 400 && i === 1) return; // estreito demais para quatro rótulos
      ticks.append(nodo('text', {
        x: px, y: box.B + 20, class: 'gauge__tick',
        'text-anchor': i === 0 ? 'start' : i === marcas.length - 1 ? 'end' : 'middle',
      }, rotulo));
    });
  };

  let atual = valueAt(Number(range.value) / 1000);
  let alvo = atual;
  let raf = 0;

  const paint = (value) => {
    const w = weightOf(value);
    const px = x(value);
    const py = y(w);
    marker.setAttribute('cx', px.toFixed(1));
    marker.setAttribute('cy', py.toFixed(1));
    guide.setAttribute('x1', px.toFixed(1));
    guide.setAttribute('x2', px.toFixed(1));
    guide.setAttribute('y1', (py + 6).toFixed(1));
    guide.setAttribute('y2', box.B);
    weightEl.textContent = percent(w);
    // Reconsultado a cada pintura: a troca de idioma recria este nó.
    const amountEl = $('[data-gauge-amount]');
    if (amountEl) amountEl.textContent = money(value);
    range.setAttribute('aria-valuetext',
      t('gauge.aria').replace('{amount}', money(value)).replace('{pct}', percent(w)));
  };

  const tick = () => {
    atual += (alvo - atual) * 0.22;
    if (Math.abs(alvo - atual) / alvo < 0.002) { atual = alvo; raf = 0; paint(atual); return; }
    paint(atual);
    raf = requestAnimationFrame(tick);
  };

  const setFromRange = () => {
    alvo = valueAt(Number(range.value) / 1000);
    if (reduced) { atual = alvo; paint(atual); return; }
    if (!raf) raf = requestAnimationFrame(tick);
  };
  range.addEventListener('input', setFromRange);

  // Arrastar sobre o gráfico também move o valor — o range segue sendo o
  // controle acessível, por teclado.
  const fromPointer = (event) => {
    const rect = plot.getBoundingClientRect();
    const t = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    range.value = String(Math.round(t * 1000));
    setFromRange();
  };
  let arrastando = false;
  plot.addEventListener('pointerdown', (event) => {
    arrastando = true;
    plot.setPointerCapture?.(event.pointerId);
    fromPointer(event);
  });
  plot.addEventListener('pointermove', (event) => { if (arrastando) fromPointer(event); });
  const soltar = () => { arrastando = false; };
  plot.addEventListener('pointerup', soltar);
  plot.addEventListener('pointercancel', soltar);

  const repintar = () => { desenhar(); paint(atual); };
  repintar();
  new ResizeObserver(repintar).observe(plot);
  return repintar;
}

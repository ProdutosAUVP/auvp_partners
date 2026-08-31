/* =========================================================================
   AUVP Partners — comportamento da página.
   Um único canvas WebGL atravessa o hero e a seção da rede; o resto são
   micro-interações discretas (revelação, acordeão, etapas, formulário).
   ========================================================================= */

import { LAND_DOTS } from './land-dots.js';
import { createGlobe } from './globe.js';
import { FRONTS, HUBS, ROUTES, distanceKm } from './network.js';
import { initEngagement } from './engagement.js';

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- máscara de terra (Int16 lon/lat em centésimos de grau) ---------- */
function decodeDots(encoded) {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const values = new Int16Array(bytes.buffer);
  const out = new Array(values.length / 2);
  for (let i = 0; i < values.length; i += 2) out[i / 2] = [values[i] / 100, values[i + 1] / 100];
  return out;
}

/* =========================================================================
   Globo + rede
   ========================================================================= */
function initNetwork() {
  const canvas = $('[data-globe]');
  const stage = $('[data-stage]');
  if (!canvas || !stage) return;

  const globe = createGlobe(canvas, {
    dots: decodeDots(LAND_DOTS),
    hubs: HUBS,
    routes: ROUTES,
    colors: { land: '#9AA0A6', line: '#828A92', glow: '#3FD99B', hub: '#EFF1F0' },
  });
  if (!globe) { canvas.parentElement?.setAttribute('data-fallback', ''); return; }

  /* ---------- enquadramento dirigido pelo scroll ---------- */
  const framing = () => (window.innerWidth <= 820
    ? { hero: { scale: 1.95, cx: 0, cy: -2.02, opacity: 1 }, net: { scale: 0.44, cx: 0, cy: 0.5, opacity: 1 } }
    : { hero: { scale: 2.2, cx: 0, cy: -2.36, opacity: 1 }, net: { scale: 0.85, cx: 0.41, cy: 0.02, opacity: 1 } });

  const hint = $('[data-globe-hint]');
  let progress = -1;

  const onScroll = () => {
    const top = stage.getBoundingClientRect().top + window.scrollY;
    const vh = window.innerHeight;
    const p = clamp((window.scrollY - top - vh * 0.08) / (vh * 0.78), 0, 1);
    const eased = p * p * (3 - 2 * p);
    if (Math.abs(eased - progress) < 0.001) return;
    progress = eased;
    const { hero, net } = framing();
    globe.setLayout({
      scale: lerp(hero.scale, net.scale, eased),
      cx: lerp(hero.cx, net.cx, eased),
      cy: lerp(hero.cy, net.cy, eased),
      opacity: lerp(hero.opacity, net.opacity, eased),
    });
    hint?.classList.toggle('is-on', eased > 0.55);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { progress = -1; onScroll(); });
  onScroll();

  /* ---------- filtros e lista de corredores ---------- */
  const frontsEl = $('[data-fronts]');
  const routesEl = $('[data-routes]');
  let selectedFront = 0;   // 0 = todos; 1..3 = frente + 1
  let selectedRoute = -1;

  FRONTS.forEach((front, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'front';
    button.setAttribute('aria-pressed', String(i === 0));
    button.textContent = front.label;
    button.addEventListener('click', () => selectFront(i));
    frontsEl.append(button);
  });

  const renderRoutes = () => {
    routesEl.textContent = '';
    ROUTES.forEach((route, index) => {
      if (selectedFront > 0 && route.front !== selectedFront - 1) return;
      const from = HUBS[route.from];
      const to = HUBS[route.to];
      const li = document.createElement('li');
      li.className = 'route';
      li.dataset.index = String(index);
      li.classList.toggle('is-active', index === selectedRoute);
      li.innerHTML = `
        <button type="button" class="route__btn" aria-pressed="${index === selectedRoute}">
          <span class="route__pair">${from.name}<i aria-hidden="true"></i>${to.name}</span>
          <span class="route__km">${distanceKm(from, to).toLocaleString('pt-BR')} km</span>
          <span class="route__what">${route.what}</span>
        </button>`;
      const button = $('button', li);
      button.addEventListener('pointerenter', () => globe.setActive(index));
      button.addEventListener('pointerleave', () => globe.setActive(selectedRoute));
      button.addEventListener('focus', () => globe.setActive(index));
      button.addEventListener('click', () => selectRoute(index));
      routesEl.append(li);
    });
  };

  function selectFront(i) {
    selectedFront = i;
    selectedRoute = -1;
    $$('.front', frontsEl).forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    globe.setFilter(i === 0 ? -1 : i - 1);
    globe.setActive(-1);
    renderRoutes();
  }

  function selectRoute(index) {
    selectedRoute = selectedRoute === index ? -1 : index;
    globe.setActive(selectedRoute);
    if (selectedRoute >= 0) globe.focusRoute(selectedRoute);
    $$('.route', routesEl).forEach((li) => {
      const on = Number(li.dataset.index) === selectedRoute;
      li.classList.toggle('is-active', on);
      $('button', li).setAttribute('aria-pressed', String(on));
    });
  }

  renderRoutes();

  /* ---------- rótulo do hub sob o ponteiro ---------- */
  const tip = $('[data-globe-tip]');
  let hovered = -1;

  const paintTip = () => {
    if (hovered < 0) return;
    const p = globe.projectHub(hovered);
    if (p.z < 0.02) { hovered = -1; tip.hidden = true; return; }
    tip.style.left = `${p.x}px`;
    tip.style.top = `${p.y}px`;
  };

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const hit = globe.hubAt(event.clientX - rect.left, event.clientY - rect.top);
    canvas.style.cursor = hit ? 'pointer' : 'grab';
    if (!hit) { hovered = -1; tip.hidden = true; return; }
    if (hit.index !== hovered) {
      hovered = hit.index;
      tip.innerHTML = `<b>${HUBS[hit.index].name}</b><span>${HUBS[hit.index].role}</span>`;
      tip.hidden = false;
    }
    paintTip();
  });
  canvas.addEventListener('pointerleave', () => { hovered = -1; tip.hidden = true; });
  const followTip = () => { paintTip(); requestAnimationFrame(followTip); };
  requestAnimationFrame(followTip);

  const hubsFact = $('[data-fact-hubs]');
  if (hubsFact) hubsFact.textContent = `${HUBS.length} cidades`;
}

/* =========================================================================
   Navegação
   ========================================================================= */
function initNav() {
  const nav = $('[data-nav]');
  const toggle = $('[data-menu-toggle]');
  const sheet = $('[data-menu-sheet]');
  const hero = $('.hero');
  let pillAt = 0;

  const measure = () => { pillAt = Math.max(120, (hero?.offsetHeight || window.innerHeight) - 96); };
  // O menu não se esconde: fora da hero ele só troca de forma e segue fixo no topo.
  const onScroll = () => { nav.classList.toggle('is-pill', window.scrollY > pillAt); };
  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); onScroll(); });
  onScroll();

  const closeMenu = () => {
    nav.removeAttribute('data-open');
    toggle.setAttribute('aria-expanded', 'false');
    sheet.hidden = true;
  };
  toggle?.addEventListener('click', () => {
    const open = nav.hasAttribute('data-open');
    if (open) return closeMenu();
    nav.setAttribute('data-open', '');
    toggle.setAttribute('aria-expanded', 'true');
    sheet.hidden = false;
  });
  $$('a', sheet).forEach((a) => a.addEventListener('click', closeMenu));

  const links = $$('.nav__links a');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));
}

/* =========================================================================
   Revelação, acordeão e etapas
   ========================================================================= */
function initReveal() {
  const items = $$('.reveal');
  if (reduced) return items.forEach((el) => el.classList.add('is-in'));
  const show = (el, i) => {
    el.style.transitionDelay = `${Math.min(i, 6) * 80}ms`;
    el.classList.add('is-in');
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const siblings = $$('.reveal', entry.target.parentElement);
      show(entry.target, Math.max(0, siblings.indexOf(entry.target)));
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

  // O que já está na primeira dobra entra em cascata, sem depender de scroll.
  let above = 0;
  items.forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.98) {
      const i = above++;
      requestAnimationFrame(() => show(el, i));
    } else io.observe(el);
  });
}

function initAccordion() {
  $$('[data-acc-item]').forEach((item) => {
    const head = $('.acc__head', item);
    const panel = $('.acc__panel', item);
    head.addEventListener('click', () => {
      const open = item.hasAttribute('data-open');
      if (open) {
        const height = panel.scrollHeight;
        panel.animate({ height: [`${height}px`, '0px'], opacity: [1, 0] },
          { duration: reduced ? 0 : 420, easing: 'cubic-bezier(.22,.68,.24,1)' })
          .finished.then(() => { panel.hidden = true; }).catch(() => {});
        item.removeAttribute('data-open');
        head.setAttribute('aria-expanded', 'false');
        return;
      }
      panel.hidden = false;
      item.setAttribute('data-open', '');
      head.setAttribute('aria-expanded', 'true');
      panel.animate({ height: ['0px', `${panel.scrollHeight}px`], opacity: [0, 1] },
        { duration: reduced ? 0 : 520, easing: 'cubic-bezier(.22,.68,.24,1)' });
    });
  });
}

function initSteps() {
  const steps = $$('[data-step]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('is-on', entry.isIntersecting));
  }, { rootMargin: '-25% 0px -35% 0px' });
  steps.forEach((s) => io.observe(s));
}

/* =========================================================================
   Botões magnéticos
   ========================================================================= */
function initMagnetic() {
  if (reduced || matchMedia('(hover: none)').matches) return;
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (event) => {
      const r = el.getBoundingClientRect();
      const x = (event.clientX - r.left - r.width / 2) / r.width;
      const y = (event.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = `translate(${x * 7}px, ${y * 5}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* =========================================================================
   Formulário de aplicação
   ========================================================================= */
function initForm() {
  const form = $('[data-form]');
  if (!form) return;
  const steps = $$('[data-form-fieldset]', form);
  const bar = $('[data-form-bar]', form);
  const label = $('[data-form-step-label]', form);
  const counter = $('[data-form-step-count]', form);
  const back = $('[data-form-back]', form);
  const next = $('[data-form-next]', form);
  const submit = $('[data-form-submit]', form);
  const done = $('[data-form-done]', form);
  const names = ['Empresa', 'Demanda', 'Contato'];
  let current = 0;

  const paint = () => {
    steps.forEach((step, i) => { step.hidden = i !== current; });
    bar.style.width = `${((current + 1) / steps.length) * 100}%`;
    label.textContent = names[current];
    counter.textContent = `${current + 1} / ${steps.length}`;
    back.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    submit.hidden = current !== steps.length - 1;
  };

  const fieldOf = (input) => input.closest('.field');
  const setError = (input, message) => {
    const field = fieldOf(input);
    if (!field) return;
    field.toggleAttribute('data-invalid', Boolean(message));
    let error = $('.field__error', field);
    if (message) {
      if (!error) { error = document.createElement('p'); error.className = 'field__error'; field.append(error); }
      error.textContent = message;
    } else if (error) error.remove();
  };

  const validate = (step) => {
    let ok = true;
    const radios = new Set();
    $$('input, select, textarea', step).forEach((input) => {
      if (!input.required) return;
      if (input.type === 'radio') {
        if (radios.has(input.name)) return;
        radios.add(input.name);
        const checked = form.querySelector(`input[name="${input.name}"]:checked`);
        if (!checked) { setError(input, 'Selecione uma opção.'); ok = false; } else setError(input, '');
        return;
      }
      const value = input.value.trim();
      if (!value) { setError(input, 'Campo obrigatório.'); ok = false; return; }
      if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        setError(input, 'Informe um e-mail válido.'); ok = false; return;
      }
      setError(input, '');
    });
    if (!ok) $('.field[data-invalid] input, .field[data-invalid] select, .field[data-invalid] textarea', step)?.focus();
    return ok;
  };

  next.addEventListener('click', () => {
    if (!validate(steps[current])) return;
    current = Math.min(current + 1, steps.length - 1);
    paint();
  });
  back.addEventListener('click', () => { current = Math.max(current - 1, 0); paint(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate(steps[current])) return;
    const payload = Object.fromEntries(new FormData(form).entries());
    const endpoint = form.dataset.endpoint;
    submit.disabled = true;
    try {
      if (endpoint) {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      done.hidden = false;
    } catch (error) {
      submit.disabled = false;
      setError($('#email', form), 'Não foi possível enviar agora. Tente novamente.');
    }
  });

  paint();
}

/* ---------- bootstrap ---------- */
initNav();
initReveal();
initAccordion();
initSteps();
initMagnetic();
initForm();
initNetwork();
initEngagement($('[data-gauge]'));

const year = $('[data-year]');
if (year) year.textContent = `© ${new Date().getFullYear()}`;

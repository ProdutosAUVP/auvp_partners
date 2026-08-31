/* =========================================================================
   Idiomas.
   O português é a fonte: os textos vivem no próprio index.html e são
   fotografados na inicialização. Os demais idiomas chegam em módulos sob
   demanda, então quem lê em português não baixa tradução nenhuma.
   ========================================================================= */

export const LANGS = [
  { code: 'pt', label: 'Português', short: 'PT', locale: 'pt-BR', html: 'pt-BR', og: 'pt_BR' },
  { code: 'en', label: 'English', short: 'EN', locale: 'en-US', html: 'en', og: 'en_US' },
  { code: 'es', label: 'Español', short: 'ES', locale: 'es-ES', html: 'es', og: 'es_ES' },
  { code: 'zh', label: '中文', short: '中文', locale: 'zh-CN', html: 'zh-Hans', og: 'zh_CN' },
];

const CHAVE = 'auvp-partners:lang';
const dicionarios = {};
const base = { text: new Map(), html: new Map(), attr: new Map() };
let atual = 'pt';
let ouvinte = null;

const guardar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* modo privado */ } };
const ler = (chave) => { try { return localStorage.getItem(chave); } catch { return null; } };

/** Fotografa o português direto do DOM, para poder voltar a ele sem duplicar texto. */
function fotografar() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    if (!base.text.has(el)) base.text.set(el, el.textContent);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    if (!base.html.has(el)) base.html.set(el, el.innerHTML);
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    if (base.attr.has(el)) return;
    const guardados = {};
    el.dataset.i18nAttr.split(',').forEach((par) => {
      const [attr] = par.split(':');
      guardados[attr.trim()] = el.getAttribute(attr.trim());
    });
    base.attr.set(el, guardados);
  });
}

function aplicarDOM(dic) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const valor = dic ? dic[el.dataset.i18n] : base.text.get(el);
    if (valor !== undefined) el.textContent = valor;
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const valor = dic ? dic[el.dataset.i18nHtml] : base.html.get(el);
    if (valor !== undefined) el.innerHTML = valor;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((par) => {
      const [attr, chave] = par.split(':').map((s) => s.trim());
      const valor = dic ? dic[chave] : base.attr.get(el)?.[attr];
      if (valor !== undefined) el.setAttribute(attr, valor);
    });
  });
}

function aplicarCabecalho(idioma, dic) {
  document.documentElement.lang = idioma.html;
  const meta = (seletor, valor) => {
    const el = document.querySelector(seletor);
    if (el && valor) el.setAttribute('content', valor);
  };
  if (dic) {
    document.title = dic['meta.title'];
    meta('meta[name="description"]', dic['meta.desc']);
    meta('meta[property="og:title"]', dic['meta.title']);
    meta('meta[property="og:description"]', dic['meta.ogDesc']);
  } else {
    document.title = base.meta.title;
    meta('meta[name="description"]', base.meta.desc);
    meta('meta[property="og:title"]', base.meta.ogTitle);
    meta('meta[property="og:description"]', base.meta.ogDesc);
  }
  meta('meta[property="og:locale"]', idioma.og);
}

/** Texto de dados (fora do DOM): rótulos gerados por JS. */
export function t(chave) {
  const dic = dicionarios[atual] || {};
  return dic[chave] ?? dicionarios.pt?.[chave] ?? chave;
}

export const idiomaAtual = () => LANGS.find((l) => l.code === atual);
export const locale = () => idiomaAtual().locale;

export async function setLang(code, { salvar = true } = {}) {
  const idioma = LANGS.find((l) => l.code === code);
  if (!idioma) return;
  if (!dicionarios[code]) {
    dicionarios[code] = (await import(`./i18n/${code}.js`)).default;
  }
  atual = code;
  const dic = code === 'pt' ? null : dicionarios[code];
  aplicarDOM(dic);
  aplicarCabecalho(idioma, dic);
  if (salvar) guardar(CHAVE, code);
  document.documentElement.dataset.lang = code;
  ouvinte?.(code);
}

function preferido() {
  const salvo = ler(CHAVE);
  if (salvo && LANGS.some((l) => l.code === salvo)) return salvo;
  const nav = (navigator.languages || [navigator.language || 'pt']).map((s) => s.toLowerCase());
  for (const tag of nav) {
    if (tag.startsWith('pt')) return 'pt';
    if (tag.startsWith('en')) return 'en';
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('zh')) return 'zh';
  }
  return 'pt';
}

/** Monta o seletor e aplica o idioma inicial. */
export async function initI18n({ onChange } = {}) {
  ouvinte = onChange;
  fotografar();
  base.meta = {
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    ogDesc: document.querySelector('meta[property="og:description"]')?.content,
  };
  dicionarios.pt = (await import('./i18n/pt.js')).default;

  const raiz = document.querySelector('[data-lang]');
  const botao = raiz?.querySelector('[data-lang-toggle]');
  const menu = raiz?.querySelector('[data-lang-menu]');
  const rotulo = raiz?.querySelector('[data-lang-current]');

  const pintar = () => {
    if (rotulo) rotulo.textContent = idiomaAtual().short;
    menu?.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-current', String(b.dataset.code === atual));
    });
  };

  if (menu) {
    LANGS.forEach((idioma) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.code = idioma.code;
      b.lang = idioma.html;
      b.innerHTML = `<span>${idioma.label}</span><span class="lang__code">${idioma.short}</span>`;
      b.addEventListener('click', async () => {
        await setLang(idioma.code);
        pintar();
        fechar();
        botao?.focus();
      });
      li.append(b);
      menu.append(li);
    });
  }

  const fechar = () => {
    raiz?.removeAttribute('data-open');
    botao?.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  };
  botao?.addEventListener('click', () => {
    const aberto = raiz.hasAttribute('data-open');
    if (aberto) return fechar();
    raiz.setAttribute('data-open', '');
    botao.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
  });
  document.addEventListener('click', (e) => { if (raiz && !raiz.contains(e.target)) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

  await setLang(preferido(), { salvar: false });
  pintar();
}

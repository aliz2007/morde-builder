/* ============================================================
   MATCHUP — detail render, scroll-spy TOC, entity chips.
   The writeup is rendered byte-identical. Every intervention
   is structural: never edit the author's sentences.
   ============================================================ */

import { DIFF_WORD, diffVar, sectionMeta, img } from './data.js';
import { escapeHtml } from './search.js';

/* ——— entity chips: first mention per paragraph, max three ——— */
let ENTITY_RE = null;
export function buildEntityMatcher(matchups) {
  const names = new Set();
  for (const m of matchups) {
    names.add(m.name);
    for (const b of m.builds) {
      for (const ic of b.icons) if (ic.name) names.add(ic.name);
      for (const s of b.steps) {
        for (const part of String(s.item).split(/\s*(?:\/|->)\s*/)) {
          const p = part.trim().replace(/\s+Rush$/i, '');
          if (p.length >= 4 && p.length <= 28 && !/^(if|go|start|can go)\b/i.test(p)) names.add(p);
        }
      }
    }
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sorted = [...names].sort((a, b) => b.length - a.length).map(esc);
  ENTITY_RE = new RegExp(`(?<![\\w'’])(?:${sorted.join('|')})(?![\\w'’])|\\b(?:Q|W|E|R)\\b|\\bpassive\\b`, 'g');
}

function chipify(text) {
  if (!ENTITY_RE) return escapeHtml(text);
  ENTITY_RE.lastIndex = 0;
  const seen = new Set();
  const spans = [];
  let mm;
  while ((mm = ENTITY_RE.exec(text)) !== null) {
    const key = mm[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    spans.push([mm.index, mm.index + mm[0].length]);
    if (spans.length > 3) return escapeHtml(text); // too dense — chip none of it
  }
  if (!spans.length) return escapeHtml(text);
  let out = '', cur = 0;
  for (const [a, b] of spans) {
    out += escapeHtml(text.slice(cur, a));
    out += `<span class="chip">${escapeHtml(text.slice(a, b))}</span>`;
    cur = b;
  }
  return out + escapeHtml(text.slice(cur));
}

/* ——— pieces ——— */
const spineRow = (label, v) => {
  const n = v || 0;
  const segs = Array.from({ length: 5 }, (_, i) =>
    `<span class="spine__seg${i < n ? ' is-on' : ''}" style="--i:${i}"></span>`).join('');
  return `<div class="spine__row" style="--seg:${diffVar(n)}">
    <span class="spine__label">${label}</span>
    <span class="spine__segs" role="img" aria-label="${label} ${n} out of 5, ${DIFF_WORD[n] || 'unrated'}">${segs}</span>
    <span class="spine__val">${n}/5</span></div>`;
};

function runesBlock(m) {
  const { primary = [], secondary = [], shards = [], raw = '' } = m.runes || {};
  const chips = (arr, lead) => arr.map((r, i) =>
    `<li class="chip${lead && i === 0 ? ' chip--lead' : ''}">${escapeHtml(r)}</li>`).join('');
  return `<div class="runes">
    <div class="runes__head">
      ${m.keystoneIcon ? `<img class="runes__key" src="${img(m.keystoneIcon)}" alt="" width="52" height="52">` : ''}
      <span class="runes__keyname">${escapeHtml(m.keystone || 'Runes')}</span>
    </div>
    ${primary.length ? `<ul class="chips runes__tree runes__tree--primary">${chips(primary, true)}</ul>` : ''}
    ${secondary.length ? `<ul class="chips runes__tree">${chips(secondary)}</ul>` : ''}
    ${shards.length ? `<ul class="chips runes__tree runes__tree--shards">${chips(shards)}</ul>` : ''}
    <p class="mono-micro runes__raw">${escapeHtml(raw.replace(/\s*\n\s*/g, ' / '))}</p>
    <button class="btn btn--ghost" type="button" data-copy="${escapeHtml(raw.replace(/\s*\n\s*/g, ' '))}">Copy rune page</button>
  </div>`;
}

function buildBlock(b, i, total) {
  const slots = b.icons.map((ic, k) => {
    const label = ic.placeholder || ic.name || `Item ${k + 1}`;
    return `<span class="build__slot${k === 2 ? ' build__slot--core' : ''}">
      <img class="build__icon" src="${img(ic.file)}" alt="${escapeHtml(label)}" width="42" height="42" loading="lazy">
      <span class="build__step">${String(k + 1).padStart(2, '0')}</span></span>`;
  }).join('');
  const notes = b.steps.map(s =>
    `<li><span class="build__item">${escapeHtml(s.item)}</span>${
      s.note ? `<span class="build__note">${escapeHtml(s.note)}</span>` : ''}</li>`).join('');
  return `<div class="build">
    ${b.condition ? `<p class="build__cond">${escapeHtml(b.condition.replace(/:$/, ''))}</p>`
      : (total > 1 ? `<p class="build__cond">Path ${i + 1}</p>` : '')}
    ${b.prelude && b.prelude.length ? `<p class="build__pre mono-micro">${escapeHtml(b.prelude.join(' · '))}</p>` : ''}
    <div class="build__strip">${slots}</div>
    ${notes ? `<ol class="build__notes">${notes}</ol>` : ''}
  </div>`;
}

function writeup(m) {
  if (!m.hasWriteup) {
    return `<div class="sect sect--early"><p>No writeup for this matchup yet.</p></div>`;
  }
  return m.sections.map((s, i) => {
    const meta = sectionMeta(s.heading);
    const paras = (s.items && s.items.length ? s.items : String(s.body || '').split(/\n{2,}/))
      .filter(Boolean).map(t => `<p>${chipify(t)}</p>`).join('');
    const head = s.heading ? `<header class="sect__head">
        <span class="sect__n">${String(i + 1).padStart(2, '0')}</span>
        <h2 class="sect__h t-engraved" id="${meta.slug}">${escapeHtml(s.heading)}</h2>
        <a class="sect__anchor" href="#${meta.slug}" aria-label="Link to ${escapeHtml(s.heading)}">#</a>
      </header><hr class="seam seam--tight">` : '';
    return `<section class="sect sect--${meta.variant}" data-slug="${meta.slug}">${head}
      <div class="sect__body">${paras}</div></section>`;
  }).join('');
}

/* ——— public render ——— */
export function renderDetail(m) {
  const builds = m.builds.map((b, i) => buildBlock(b, i, m.builds.length)).join('');
  const toc = m.sections.filter(s => s.heading).map(s => {
    const meta = sectionMeta(s.heading);
    return `<li><a href="#${meta.slug}" data-spy="${meta.slug}">${escapeHtml(s.heading)}</a></li>`;
  }).join('');

  return `
  <div class="mini" data-mini>
    <div class="container w-wide" style="display:flex;align-items:center;gap:var(--s-4);width:100%">
      <img class="mini__img" src="${img(m.portrait)}" alt="" width="32" height="32">
      <span class="mini__name">${escapeHtml(m.name)}</span>
      <span class="mini__pill opt__pill" style="--pill:${diffVar(m.overall)}">
        <span class="opt__val" style="color:${diffVar(m.overall)}">${m.overall}/5</span>
        <span class="opt__word">${m.overallWord}</span></span>
    </div>
  </div>

  <div class="container w-wide overlay__panel">
    <button class="btn overlay__close" type="button" data-close>Close</button>

    <header class="hero" style="position:relative">
      <svg class="crown crown--ghost" viewBox="0 0 64 40" aria-hidden="true"><path fill-rule="evenodd" d="M2 40 L2 22 L9 30 L14 8 L21 24 L27 2 L32 0 L37 2 L43 24 L50 8 L55 30 L62 22 L62 40 Z M14 31 L50 31 L50 35 L14 35 Z"/></svg>
      <img class="hero__portrait arch overlay__portrait" src="${img(m.portrait)}" alt=""
           width="96" height="96">
      <div>
        <p class="eyebrow">Matchup</p>
        <h1 class="monument hero__name t-engraved">${escapeHtml(m.name)}</h1>
      </div>
    </header>
    <hr class="seam">

    <div class="matchup is-orchestrated">
      <div class="rail">
        <div class="overall">
          <div><span class="overall__num t-emitted">${m.overall}</span>
               <span class="overall__den num">/5</span></div>
          <div><span class="overall__word">${m.overallWord}</span>
               <span class="overall__cap mono-micro" style="display:block">Overall difficulty</span></div>
        </div>
        <div class="spine">
          ${spineRow('Early', m.ratings.early)}
          ${spineRow('Mid', m.ratings.mid)}
          ${spineRow('Late', m.ratings.late)}
        </div>
        <hr class="seam seam--tight">
        ${m.summoners.length ? `<p class="plate__label">Summoners</p>
          <div class="summs">${m.summoners.filter(s => s.file).map(s =>
            `<img src="${img(s.file)}" alt="${escapeHtml(s.name || 'Summoner spell')}" width="30" height="30">`
          ).join('')}</div><hr class="seam seam--tight">` : ''}
        <p class="plate__label">Runes</p>
        ${runesBlock(m)}
        ${m.tldr.length ? `<hr class="seam seam--tight"><p class="plate__label">TL;DR</p>
          <ul class="stack">${m.tldr.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
      </div>

      <div class="loadout">
        <p class="eyebrow">Items</p>
        <div class="builds${m.builds.length > 1 ? ' builds--dual' : ''}">${builds}</div>
        <hr class="seam">
      </div>

      <div class="writeup bracketed">
        <p class="eyebrow">The writeup</p>
        ${writeup(m)}
        <div class="writeup__foot">
          <button class="btn btn--ghost" type="button" data-collapse aria-pressed="false">Collapse all</button>
          ${m.video ? `<span class="mono-micro">${escapeHtml(m.video)}</span>` : ''}
        </div>
      </div>

      ${toc ? `<nav class="toc" aria-label="Sections">
        <p class="eyebrow" style="margin-bottom:var(--s-3)">Sections</p>
        <ul class="toc__list">${toc}</ul></nav>` : '<div></div>'}
    </div>
  </div>`;
}

/* ——— behaviour ——— */
export function wireDetail(root, scroller) {
  const spy = root.querySelectorAll('[data-spy]');
  const sections = root.querySelectorAll('.sect[data-slug]');
  let io;
  if (spy.length && sections.length && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const slug = en.target.dataset.slug;
        spy.forEach(a => a.classList.toggle('is-active', a.dataset.spy === slug));
      }
    }, { root: scroller || null, rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(s => io.observe(s));
  }

  root.addEventListener('click', e => {
    const jump = e.target.closest('[data-spy]');
    if (jump) {
      e.preventDefault();
      const t = root.querySelector(`.sect[data-slug="${jump.dataset.spy}"]`);
      if (t) t.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      return;
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.copy).then(() => {
        const was = copy.textContent;
        copy.textContent = 'Copied';
        copy.classList.add('is-done');
        setTimeout(() => { copy.textContent = was; copy.classList.remove('is-done'); }, 1400);
      }).catch(() => { /* clipboard blocked — the raw string is on screen already */ });
      return;
    }
    const col = e.target.closest('[data-collapse]');
    if (col) {
      const w = root.querySelector('.writeup');
      const on = w.classList.toggle('is-collapsed');
      col.setAttribute('aria-pressed', String(on));
      col.textContent = on ? 'Expand all' : 'Collapse all';
      try { localStorage.setItem('morde.collapsed', on ? '1' : '0'); } catch { /* private mode */ }
    }
  });

  const mini = root.querySelector('[data-mini]');
  const onScroll = () => {
    const y = scroller ? scroller.scrollTop : window.scrollY;
    mini?.classList.toggle('is-on', y > 220);
  };
  (scroller || window).addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return () => { io?.disconnect(); (scroller || window).removeEventListener('scroll', onScroll); };
}

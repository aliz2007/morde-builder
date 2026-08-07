/* ============================================================
   MAIN — page chrome on every page; search + routing on MATCHUPS.
   ============================================================ */

import { load, bySlug, DIFF_WORD, diffVar, img } from './data.js';
import {
  buildIndex, rank, highlight, norm, ALIASES, knownChampion, closest,
  recents, pushRecent, optionRow, escapeHtml,
} from './search.js';
import { renderDetail, wireDetail, buildEntityMatcher } from './matchup.js';

const CROWN = `<svg class="crown" viewBox="0 0 64 40" aria-hidden="true"><path fill-rule="evenodd" d="M2 40 L2 22 L9 30 L14 8 L21 24 L27 2 L32 0 L37 2 L43 24 L50 8 L55 30 L62 22 L62 40 Z M14 31 L50 31 L50 35 L14 35 Z"/></svg>`;

/* ——— chrome mounted on every page ——— */
function mountChrome() {
  const frag = document.createElement('div');
  frag.innerHTML =
    `<div class="grain" aria-hidden="true"></div>
     <div class="vignette" aria-hidden="true"></div>
     <div class="realm-ring" data-ring aria-hidden="true"></div>
     <svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="corrode">
       <feTurbulence type="fractalNoise" baseFrequency="0.03 0.06" numOctaves="3" result="t"/>
       <feDisplacementMap in="SourceGraphic" in2="t" scale="7" xChannelSelector="R" yChannelSelector="G"/>
     </filter></svg>`;
  while (frag.firstChild) document.body.appendChild(frag.firstChild);
  document.querySelectorAll('[data-crown]').forEach(el => { el.innerHTML = CROWN; });
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
}

/* ============================================================
   MATCHUPS page
   ============================================================ */
function mountMatchups({ matchups }) {
  const input   = document.getElementById('q');
  const pop     = document.getElementById('results');
  const gridEl  = document.getElementById('grid');
  const overlay = document.getElementById('overlay');
  const ring    = document.querySelector('[data-ring]');
  if (!input) return;

  buildEntityMatcher(matchups);
  const index = buildIndex(matchups);
  const slugs = new Map(matchups.map(m => [m.slug, m]));
  let active = -1, rows = [], unwire = null, lastFocus = null;

  /* ——— browse grid ——— */
  gridEl.innerHTML = matchups.map(m =>
    `<li><a class="card" href="#/vs/${m.slug}" style="--card:${diffVar(m.overall)}">
      <img class="card__img" src="${img(m.portrait)}" alt="" width="38" height="38" loading="lazy">
      <span><span class="card__name">${escapeHtml(m.name)}</span>
      <span class="card__val">${m.overall}/5 ${DIFF_WORD[m.overall]}</span></span></a></li>`).join('');

  /* ——— dropdown ——— */
  function setActive(i) {
    active = i;
    rows.forEach((r, k) => {
      const on = k === i;
      r.classList.toggle('is-active', on);
      r.setAttribute('aria-selected', String(on));
      if (on) { input.setAttribute('aria-activedescendant', r.id); r.scrollIntoView({ block: 'nearest' }); }
    });
    if (i < 0) input.removeAttribute('aria-activedescendant');
  }

  function open(html) {
    pop.innerHTML = html;
    pop.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    rows = [...pop.querySelectorAll('.opt')];
    setActive(-1);
  }
  function close() {
    pop.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    rows = []; active = -1;
  }

  function preQuery() {
    const rec = recents().map(s => slugs.get(s)).filter(Boolean);
    const hardest = matchups.filter(m => m.overall >= 4)
      .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name)).slice(0, 6);
    let html = '', n = 0;
    if (rec.length) {
      html += `<p class="search__group">Recent</p>` +
        rec.map(m => optionRow(m, `opt-${n++}`, false)).join('');
    }
    html += `<p class="search__group">Hardest</p>` +
      hardest.map(m => optionRow(m, `opt-${n++}`, false)).join('');
    html += `<p class="search__group"><a href="#browse">Browse all ${matchups.length}</a></p>`;
    open(html);
  }

  function query(v) {
    if (!v.trim()) return preQuery();
    const hits = rank(index, v);
    if (hits.length) {
      open(hits.slice(0, 40).map((h, i) =>
        optionRow(h.e.m, `opt-${i}`, false, highlight(h.e, v, h.at))).join(''));
      return;
    }
    const real = knownChampion(v, matchups);
    if (real) {
      open(`<div class="search__empty"><p><strong>${escapeHtml(real)}</strong> — no writeup yet.</p>
        <p><a href="#browse">Browse all ${matchups.length}</a></p></div>`);
      return;
    }
    const near = closest(index, v, 3);
    open(`<div class="search__empty">
      <p>No champion matches “${escapeHtml(v)}”.</p>
      <p class="search__group" style="padding-left:0">Did you mean</p>
      ${near.map((m, i) => optionRow(m, `opt-${i}`, false)).join('')}
      <p style="margin-top:var(--s-3)"><a href="#browse">Browse all ${matchups.length}</a></p></div>`);
  }

  input.addEventListener('input', () => query(input.value));
  input.addEventListener('focus', () => { if (pop.hidden) query(input.value); });

  input.addEventListener('keydown', e => {
    const max = rows.length - 1;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (max >= 0) setActive(active >= max ? 0 : active + 1); break;
      case 'ArrowUp':   e.preventDefault(); if (max >= 0) setActive(active <= 0 ? max : active - 1); break;
      case 'Home':      if (max >= 0) { e.preventDefault(); setActive(0); } break;
      case 'End':       if (max >= 0) { e.preventDefault(); setActive(max); } break;
      case 'PageDown':  if (max >= 0) { e.preventDefault(); setActive(Math.min(max, active + 5)); } break;
      case 'PageUp':    if (max >= 0) { e.preventDefault(); setActive(Math.max(0, active - 5)); } break;
      case 'Enter': {
        const target = active >= 0 ? rows[active] : rows[0];
        if (target) { e.preventDefault(); location.hash = target.getAttribute('href').slice(1); close(); }
        break;
      }
      case 'Escape':
        if (input.value) { input.value = ''; query(''); }
        else { close(); input.blur(); }
        break;
    }
  });

  document.addEventListener('click', e => {
    if (!pop.hidden && !pop.contains(e.target) && e.target !== input) close();
  });

  document.addEventListener('keydown', e => {
    if (overlay && !overlay.hidden && e.key === 'Escape') { history.pushState('', '', '#browse'); route(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault(); input.focus(); input.select();
    }
  });

  /* ——— routing ——— */
  function resolveSlug(raw) {
    if (slugs.has(raw)) return raw;
    const n = norm(raw);
    const direct = matchups.find(m => norm(m.name) === n);
    if (direct) return direct.slug;
    const alias = ALIASES[n];
    if (alias) {
      const t = matchups.find(m => norm(m.name) === norm(alias));
      if (t) return t.slug;
    }
    return null;
  }

  function route() {
    const h = location.hash.replace(/^#/, '');
    const mm = h.match(/^\/vs\/(.+)$/);
    if (!mm) return closeOverlay();
    const slug = resolveSlug(decodeURIComponent(mm[1]));
    if (!slug) return closeOverlay();
    if (slug !== mm[1]) history.replaceState(null, '', `#/vs/${slug}`);
    openOverlay(slugs.get(slug));
  }

  function openOverlay(m) {
    lastFocus = document.activeElement;
    overlay.innerHTML = renderDetail(m);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    ring?.classList.add('is-open');
    unwire?.();
    unwire = wireDetail(overlay, overlay);
    try {
      if (localStorage.getItem('morde.collapsed') === '1') {
        overlay.querySelector('[data-collapse]')?.click();
      }
    } catch { /* private mode */ }
    pushRecent(m.slug);
    close();
    overlay.scrollTop = 0;
    overlay.querySelector('[data-close]')?.focus();
    document.title = `${m.name} — The Mordekaiser Bible`;
  }

  function closeOverlay() {
    if (!overlay || overlay.hidden) return;
    unwire?.(); unwire = null;
    overlay.hidden = true;
    overlay.innerHTML = '';
    document.body.style.overflow = '';
    ring?.classList.remove('is-open');
    document.title = 'Matchups — The Mordekaiser Bible';
    (lastFocus === input ? input : input).focus({ preventScroll: true });
  }

  overlay?.addEventListener('click', e => {
    if (e.target.closest('[data-close]') || e.target === overlay) {
      history.pushState('', '', '#browse'); route();
    }
  });

  /* focus trap while the overlay is open */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !overlay || overlay.hidden) return;
    const f = overlay.querySelectorAll('a[href],button,input,[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  window.addEventListener('hashchange', route);
  route();
}

/* ——— boot ——— */
mountChrome();
load().then(data => {
  mountMatchups(data);
  document.dispatchEvent(new CustomEvent('bible:ready', { detail: data }));
}).catch(err => {
  console.error(err);
  const el = document.getElementById('grid');
  if (el) el.innerHTML = `<li class="search__empty"><p>Could not load the matchup data.</p></li>`;
});

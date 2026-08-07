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
  const main = document.getElementById('main');
  if (main) {
    const pat = document.createElement('div');
    pat.className = 'patina'; pat.setAttribute('aria-hidden', 'true');
    main.prepend(pat);
  }
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
  const status  = document.querySelector('[data-status]');
  if (!input) return;

  buildEntityMatcher(matchups);
  const index = buildIndex(matchups);
  const slugs = new Map(matchups.map(m => [m.slug, m]));
  let active = -1, rows = [], unwire = null, lastFocus = null;
  let hasResults = false;   // Enter only auto-navigates over real matches

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

  function announce(msg) { if (status) status.textContent = msg; }

  const searchEl = input.closest('.search');

  function open(html, real) {
    hasResults = !!real;
    pop.innerHTML = html;
    pop.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    // On phones the popup is a sheet running to the bottom of the viewport, not
    // a 352px dropdown; its top edge follows the input.
    searchEl?.classList.add('is-open');
    pop.style.setProperty('--pop-top', Math.round(input.getBoundingClientRect().bottom + 6) + 'px');
    rows = [...pop.querySelectorAll('.opt')];
    setActive(-1);
  }
  function close() {
    pop.hidden = true;
    searchEl?.classList.remove('is-open');
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
    open(html, false);
  }

  function query(v) {
    if (!v.trim()) return preQuery();
    const hits = rank(index, v);
    const strong = hits.some(h => h.tier <= 4);
    const aliased = ALIASES[norm(v)];
    const aliasCovered = aliased && matchups.some(m => norm(m.name) === norm(aliased));
    if (aliased && !aliasCovered && !strong) {
      open(`<div class="search__empty"><p><strong>${escapeHtml(aliased)}</strong> — no writeup yet.</p>
        <p><a href="#browse">Browse all ${matchups.length}</a></p></div>`, false);
      announce(`${aliased} has no writeup yet.`);
      return;
    }
    if (hits.length) {
      const shown = hits.slice(0, 40);
      open(shown.map((h, i) =>
        optionRow(h.e.m, `opt-${i}`, false, highlight(h.e, v, h.at))).join(''), true);
      announce(`${hits.length} ${hits.length === 1 ? 'match' : 'matches'}. ` +
               `Top result ${shown[0].e.m.name}.`);
      return;
    }
    const real = knownChampion(v, matchups);
    if (real) {
      open(`<div class="search__empty"><p><strong>${escapeHtml(real)}</strong> — no writeup yet.</p>
        <p><a href="#browse">Browse all ${matchups.length}</a></p></div>`, false);
      announce(`${real} has no writeup yet.`);
      return;
    }
    const near = closest(index, v, 3);
    open(`<div class="search__empty">
      <p>No champion matches “${escapeHtml(v)}”.</p>
      <p class="search__group" style="padding-left:0">Did you mean</p>
      ${near.map((m, i) => optionRow(m, `opt-${i}`, false)).join('')}
      <p style="margin-top:var(--s-3)"><a href="#browse">Browse all ${matchups.length}</a></p></div>`, false);
    announce(`No champion matches ${v}. ${near.length} suggestions.`);
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
        // With no active option, Enter takes the top-ranked match — but never a
        // "Did you mean" suggestion, which the user did not ask for.
        const target = active >= 0 ? rows[active] : (hasResults ? rows[0] : null);
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

  let openSlug = null;

  function route() {
    const h = location.hash.replace(/^#/, '');
    // #/vs/<champion> and #/vs/<champion>/<section> — the section form makes the
    // per-heading anchors real deep links instead of bare fragments, which the
    // router would otherwise read as "not a matchup" and close the overlay.
    const mm = h.match(/^\/vs\/([^/]+)(?:\/([^/]+))?$/);
    if (!mm) { openSlug = null; return closeOverlay(); }
    let raw; try { raw = decodeURIComponent(mm[1]); } catch { raw = mm[1]; }
    const slug = resolveSlug(raw);
    if (!slug) { openSlug = null; return closeOverlay(); }
    const section = mm[2] || '';
    if (slug !== mm[1]) {
      history.replaceState(null, '', `#/vs/${slug}${section ? '/' + section : ''}`);
    }
    if (openSlug === slug) return scrollToSection(section);   // already open: just move
    openSlug = slug;
    openOverlay(slugs.get(slug));
    if (section) scrollToSection(section);
  }

  function scrollToSection(section) {
    if (!section) return;
    const t = overlay.querySelector(`.sect[data-slug="${section}"]`);
    if (t) t.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
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
    openSlug = null;
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

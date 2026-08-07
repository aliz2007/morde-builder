/* ============================================================
   PAGES — renders HOME and GUIDES from guides.json, plus the
   shared footer. Listens for the ready event fired by main.js.
   ============================================================ */

import { img } from './data.js';
import { escapeHtml } from './search.js';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
const txt = (sel, s) => { const el = $(sel); if (el) el.textContent = s || ''; };

/* Newlines inside a spreadsheet cell are column-width wrapping, not authored
   line breaks — only blank lines are a real paragraph boundary. Rendering every
   \n as <br> shreds the prose into ragged fragments. */
const prose = t => String(t || '').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim())
  .filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join('');
const oneline = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();

/* Tenor: the official embed script is the only reliable way to resolve a post id.
   We keep its chrome out of sight by arch-masking and desaturating the frame. */
function mountRelics() {
  const relics = $$('[data-relic]');
  if (!relics.length) return;
  for (const fig of relics) {
    const id = fig.dataset.relic;
    fig.innerHTML =
      `<div class="relic__stage">
         <div class="relic__frame arch">
           <div class="tenor-gif-embed" data-postid="${escapeHtml(id)}"
                data-share-method="host" data-aspect-ratio="1" data-width="100%"></div>
         </div>
         <span class="relic__wash" aria-hidden="true"></span>
       </div>
       <figcaption class="relic__cap">${escapeHtml(fig.dataset.cap || '')}</figcaption>`;
  }
  const s = document.createElement('script');
  s.async = true; s.type = 'text/javascript'; s.src = 'https://tenor.com/embed.js';
  document.body.appendChild(s);
}

function renderHome({ guides }) {
  const g = guides.intro;
  if (!$('[data-intro-sub]')) return;
  txt('[data-intro-title]', g.title || 'The Mordekaiser Bible');
  txt('[data-intro-sub]', g.subtitle);
  txt('[data-intro-beta]', g.betaNote);
  txt('[data-intro-bug]', g.buglist);
  txt('[data-intro-skin]', g.skinNote);

  const todo = String(g.todo || '').split('\n').filter(Boolean);
  set('[data-intro-todo]', todo.map((t, i) =>
    i === 0 ? `<p>${escapeHtml(t)}</p>` : `<p>${escapeHtml(t.replace(/^-\s*/, ''))}</p>`).join(''));

  const LINK = {
    'Matchup Sheet': 'matchups.html', 'Itemization Guide': 'guides.html#items',
    'Rune Guide': 'guides.html#runes', 'Alternate Mordekaiser Setups': 'guides.html#setups',
    'Mordekaiser Content': 'guides.html#creators',
  };
  set('[data-toc]', (g.toc || []).map(t => {
    const label = t.replace(/^-\s*/, '');
    const bare = label.replace(/\s*\(WIP\)\s*$/, '').trim();
    const href = LINK[bare];
    const wip = /\(WIP\)/.test(label);
    return `<div><dt>${href ? `<a href="${href}">${escapeHtml(bare)}</a>` : escapeHtml(bare)}</dt>
      <dd>${wip ? 'Still being written.' : 'Ready.'}</dd></div>`;
  }).join(''));

  set('[data-patches]', (g.patches || []).map(p => `
    <article class="plate plate--aged">
      <div class="plate__body">
        <p class="plate__label">Patch</p>
        <p class="num" style="font-size:var(--fs-700);margin:0 0 var(--s-3)">${escapeHtml(p.version)}</p>
        ${p.changes.map(c => `<p style="margin:0 0 var(--s-3)">
          <span style="color:var(--c-bone);font-weight:600">${escapeHtml(c.ability)}</span>
          ${c.text ? `<span style="display:block;color:var(--c-ash);font-size:var(--fs-400)">${escapeHtml(c.text)}</span>` : ''}
        </p>`).join('')}
      </div>
    </article>`).join(''));

  set('[data-credits]', (guides.credits || []).map(c =>
    `<p><span style="color:var(--c-bone);font-weight:600">${escapeHtml(c.name)}</span>
     — ${escapeHtml(c.role)}</p>`).join('') +
    `<p style="color:var(--c-ash)">Everything on this site is Meowdekaiser&rsquo;s writing, reformatted.
     Nothing has been rewritten or summarised.</p>`);
}

function renderGuides({ guides }) {
  const it = $('[data-itemguide]');
  if (it) {
    const COLS = ['First', 'Second', 'Third', 'Fourth+'];
    let html = `<caption>Every item by the slot you buy it in</caption>
      <colgroup><col class="c-cat"><col><col><col><col></colgroup>
      <thead><tr><th scope="col">Item</th>${COLS.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead>`;
    for (const sec of guides.itemguide) {
      html += `<tbody><tr><th scope="rowgroup" colspan="5" class="tbl__row-h"
                style="padding-top:var(--s-5)">${escapeHtml(sec.title)}</th></tr>`;
      for (const entry of sec.entries) {
        const by = Object.fromEntries(entry.slots.map(s => [s.slot, s]));
        const icon = entry.slots.find(s => s.icon)?.icon;
        html += `<tr><td>${icon
          ? `<img class="tbl__icon" src="${img(icon)}" alt="" width="42" height="42" loading="lazy">`
          : ''}</td>` +
          COLS.map(c => `<td>${by[c] && by[c].text ? prose(by[c].text) : '<span class="mono-micro">—</span>'}</td>`).join('') +
          `</tr>`;
      }
      html += `</tbody>`;
    }
    it.className = 'tbl tbl--items';
    it.innerHTML = html;
  }

  const rg = $('[data-runeguide]');
  if (rg) {
    rg.innerHTML = guides.runeguide.map((grp, i) => `
      <section style="margin-bottom:var(--s-7)">
        <p class="eyebrow" style="margin-bottom:var(--s-4)">Tree ${String(i + 1).padStart(2, '0')}</p>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(268px,1fr))">
          ${grp.entries.filter(e => e.text || e.icon).map(e => `
            <article class="plate"><div class="plate__body">
              ${e.icon ? `<img class="tbl__icon" src="${img(e.icon)}" alt="" width="42" height="42" loading="lazy">` : ''}
              <div class="rune-card__body">${prose(e.text)}</div>
            </div></article>`).join('')}
        </div>
      </section>`).join('');
  }

  const al = $('[data-alts]');
  if (al) {
    al.innerHTML = guides.alts.map(a => `
      <div><dt>${escapeHtml(oneline(a.name))}
        ${a.group ? `<span class="mono-micro" style="display:block">${escapeHtml(a.group)}</span>` : ''}</dt>
        <dd>
          <p class="plate__label">Runes</p>
          <p style="margin:0 0 var(--s-4)">${escapeHtml(oneline(a.runes).replace(/\s*->\s*/g, ' \u2192 '))}</p>
          <p class="plate__label">Items</p>
          ${prose(a.items)}
          ${a.example ? `<p class="mono-micro">${escapeHtml(oneline(a.example))}</p>` : ''}
          ${a.comments ? `<p class="mono-micro">${escapeHtml(oneline(a.comments))}</p>` : ''}
        </dd></div>`).join('');
  }

  const cr = $('[data-creators]');
  if (cr) {
    const rows = guides.creators.filter(c => c.name && c.name !== 'Name');
    const cell = v => (!v || v === '---') ? '<span class="mono-micro">—</span>' : escapeHtml(v);
    cr.innerHTML = `<caption>Mordekaiser players worth watching</caption>
      <thead><tr><th scope="col">Region</th><th scope="col">Name</th><th scope="col">Peak</th>
      <th scope="col">Twitch</th><th scope="col">YouTube</th><th scope="col">Twitter</th></tr></thead>
      <tbody>${rows.map(c => `<tr>
        <td><span class="num" style="font-size:var(--fs-100)">${cell(c.region)}</span></td>
        <td class="tbl__row-h">${cell(c.name)}</td>
        <td>${cell(c.peak)}</td><td>${cell(c.twitch)}</td>
        <td>${cell(c.youtube)}</td><td>${cell(c.twitter)}</td></tr>`).join('')}</tbody>`;
  }
}

function renderFooter({ guides }) {
  set('[data-foot-credits]', (guides.credits || []).map(c =>
    `<li>${escapeHtml(c.name)} — ${escapeHtml(c.role)}</li>`).join(''));
  const names = guides.creators.filter(c => c.name && c.name !== 'Name').slice(0, 8);
  set('[data-foot-creators]', names.map(c =>
    `<li>${escapeHtml(c.name)}${c.region && c.region !== '---' ? ` <span class="mono-micro">${escapeHtml(c.region)}</span>` : ''}</li>`).join(''));
}

document.addEventListener('bible:ready', e => {
  try { renderHome(e.detail); renderGuides(e.detail); renderFooter(e.detail); }
  catch (err) { console.error(err); }
  mountRelics();
});

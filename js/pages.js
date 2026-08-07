import { img } from './data.js';
import { escapeHtml, norm } from './search.js';

let ICONS = null;
function buildIconIndex(matchups) {
  const m2 = new Map();
  for (const m of matchups) {
    if (m.keystone && m.keystoneIcon && !m2.has(norm(m.keystone))) {
      m2.set(norm(m.keystone), { file: m.keystoneIcon, kind: 'rune', name: m.keystone });
    }
    for (const b of m.builds) {
      for (const ic of b.icons) {
        if (ic.name && !m2.has(norm(ic.name))) {
          m2.set(norm(ic.name), { file: ic.file, kind: 'item', name: ic.name });
        }
      }
    }
  }
  ICONS = m2;
}

function iconsFor(text, kind) {
  if (!ICONS) return [];
  const seen = new Set(), out = [];
  for (const part of String(text || '').split(/[\n\/+,]|->|→/)) {
    const key = norm(part.replace(/\(.*?\)/g, ''));
    if (!key || seen.has(key)) continue;
    const hit = ICONS.get(key);
    if (hit && (!kind || hit.kind === kind)) { seen.add(key); out.push(hit); }
  }
  return out;
}
const iconStrip = text => {
  const list = iconsFor(text, 'item');
  return list.length
    ? `<ul class="iconstrip">${list.map(i =>
        `<li><img src="${img(i.file)}" alt="${escapeHtml(i.name)}" title="" width="40" height="40" loading="lazy">
         <span class="vh">${escapeHtml(i.name)}</span></li>`).join('')}</ul>`
    : '';
};

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
const txt = (sel, s) => { const el = $(sel); if (el) el.textContent = s || ''; };

const prose = t => String(t || '').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim())
  .filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join('');
const oneline = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();

const ext = (label, url, cls) => url
  ? `<a${cls ? ` class="${cls}"` : ''} href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  : escapeHtml(label);

function mountRelics() {
  const relics = $$('[data-relic]');
  if (!relics.length) return;
  for (const fig of relics) {
    const id = fig.dataset.relic;
    fig.innerHTML =
      `<div class="relic__stage">
         <div class="relic__frame">
           <div class="tenor-gif-embed" data-postid="${escapeHtml(id)}"
                data-share-method="host" data-aspect-ratio="1" data-width="100%"></div>
         </div>
       </div>
       <figcaption class="relic__cap">${escapeHtml(fig.dataset.cap || '')}</figcaption>`;
  }
  const s = document.createElement('script');
  s.async = true; s.type = 'text/javascript'; s.src = 'https://tenor.com/embed.js';
  document.body.appendChild(s);
}

function renderHome({ guides, matchups }) {
  const g = guides.intro;
  if (!$('[data-intro-sub]')) return;

  const morde = matchups.find(m => m.slug === 'mordekaiser');
  const port = $('[data-morde-portrait]');
  if (morde && port) {
    port.src = img(morde.portrait);
    const wash = $('.banner__wash');
    if (wash) wash.style.backgroundImage = `url('${img(morde.portrait)}')`;
  }

  set('[data-roster]', matchups.map(m =>
    `<img src="${img(m.portrait)}" alt="" width="34" height="34" loading="lazy">`).join(''));
  txt('[data-intro-title]', g.title || 'The Mordekaiser Bible');
  set('[data-intro-sub]', g.subtitleUrl
    ? ext(g.subtitle, g.subtitleUrl) : escapeHtml(g.subtitle));
  txt('[data-intro-beta]', g.betaNote);
  set('[data-intro-bug]', ext(g.buglist, g.buglistUrl));
  set('[data-intro-skin]', ext(g.skinNote, g.skinUrl));
  set('[data-intro-wiki]', ext(g.wikiLabel, g.wikiUrl));

  const todo = String(g.todo || '').split('\n').filter(Boolean);
  set('[data-intro-todo]', todo.map((t, i) =>
    i === 0 ? `<p>${escapeHtml(t)}</p>` : `<p>${escapeHtml(t.replace(/^-\s*/, ''))}</p>`).join(''));

  const LINK = {
    'Matchup Sheet': 'matchups.html', 'Itemization Guide': 'guides.html#items',
    'Rune Guide': 'guides.html#runes', 'Alternate Mordekaiser Setups': 'guides.html#setups',
    'Mordekaiser Content': 'guides.html#creators',
  };

  set('[data-toc]', (g.toc || []).map(t => {
    const label = String(t.label || t).replace(/^-\s*/, '');
    const bare = label.replace(/\s*\(WIP\)\s*$/, '').trim();
    const href = LINK[bare];
    const wip = /\(WIP\)/.test(label);
    return `<div><dt>${href ? `<a href="${href}">${escapeHtml(bare)}</a>` : escapeHtml(bare)}</dt>
      <dd>${wip ? '<span class="mono-micro">Work in progress</span>' : ''}</dd></div>`;
  }).join(''));

  set('[data-patches]', (g.patches || []).map((p, i) => `
    <article class="plate${i < 2 ? ' plate--aged' : ''}">
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
    `<p style="color:var(--c-ash)">Every writeup on this site is Meowdekaiser&rsquo;s, reproduced
     as written. This site only changes how it is laid out.</p>` +
    (guides.notes || []).filter(n => n.url).map(n =>
      `<p>${ext(n.text, n.url)}</p>`).join(''));
}

function renderGuides({ guides }) {
  const it = $('[data-itemguide]');
  if (it) {
    const COLS = ['First', 'Second', 'Third', 'Fourth+'];
    let html = `<caption>Every item by the slot you buy it in</caption>
      <colgroup><col><col><col><col></colgroup>
      <thead><tr>${COLS.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead>`;
    for (const sec of guides.itemguide) {
      html += `<tbody><tr><th scope="rowgroup" colspan="4" class="tbl__row-h"
                style="padding-top:var(--s-5)">${escapeHtml(sec.title)}</th></tr>`;
      for (const entry of sec.entries) {
        const by = Object.fromEntries(entry.slots.map(s => [s.slot, s]));

        html += `<tr>` +
          COLS.map(c => {
            const cellData = by[c];
            if (!cellData || (!cellData.text && !cellData.icon)) return '<td><span class="mono-micro">—</span></td>';
            return `<td>${cellData.icon
              ? `<img class="tbl__icon" src="${img(cellData.icon)}" alt="" width="42" height="42" loading="lazy">`
              : ''}${cellData.text ? prose(cellData.text) : ''}</td>`;
          }).join('') + `</tr>`;
      }
      html += `</tbody>`;
    }
    it.className = 'tbl tbl--items';
    it.innerHTML = html;
  }

  const rg = $('[data-runeguide]');
  if (rg) {
    const TREE = ['Resolve', 'Precision', 'Sorcery', 'Inspiration', 'Shards'];
    rg.innerHTML = guides.runeguide.map((grp, i) => `
      <section class="runes-tree">
        <h3 class="runes-tree__h monument--sec t-engraved">${escapeHtml(TREE[i] || 'Tree ' + (i + 1))}</h3>
        ${(() => {
          const noted = grp.entries.filter(e => e.text);

          const bare = grp.entries.filter(e => e.icon && !e.text);
          return `${noted.length ? `<ul class="runerows">${noted.map(e => `
              <li class="runerow">
                <span class="runerow__icon">${e.icon
                  ? `<img src="${img(e.icon)}" alt="" width="42" height="42" loading="lazy">` : ''}</span>
                <div class="runerow__body">${prose(e.text)}</div>
              </li>`).join('')}</ul>` : ''}
            ${bare.length ? `<p class="plate__label" style="margin-top:var(--s-5)">No note yet</p>
              <ul class="runestrip">${bare.map(e =>
                `<li><img src="${img(e.icon)}" alt="" width="42" height="42" loading="lazy"></li>`).join('')}</ul>` : ''}`;
        })()}
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
          ${iconStrip(a.items)}
          ${prose(a.items)}
          ${a.example ? `<p class="mono-micro">${ext(oneline(a.example), a.exampleUrl)}</p>` : ''}
          ${a.comments ? `<p class="mono-micro">${escapeHtml(oneline(a.comments))}</p>` : ''}
        </dd></div>`).join('');
  }

  const cr = $('[data-creators]');
  if (cr) {
    const dash = '<span class="mono-micro">—</span>';
    const cel = (v, url) => (!v || v === '---') ? dash : ext(v, url);
    cr.innerHTML = (guides.referenceSections || []).map(sec => sec.kind === 'resources'
      ? `<div class="tbl-scroll"><table class="tbl">
          <caption>${escapeHtml(sec.title.replace(/:$/, ''))}</caption>
          <thead><tr><th scope="col">Region</th><th scope="col">By</th><th scope="col">Peak</th>
          <th scope="col">Resource</th><th scope="col">Posted</th></tr></thead>
          <tbody>${sec.rows.map(r => `<tr>
            <td><span class="num" style="font-size:var(--fs-100)">${escapeHtml(r.region || '')}</span></td>
            <td class="tbl__row-h">${escapeHtml(r.name || '')}</td>
            <td>${escapeHtml(r.peak || '')}</td>
            <td>${cel(r.title, r.url)}</td>
            <td><span class="mono-micro">${escapeHtml(r.date || '')}</span></td></tr>`).join('')}</tbody>
        </table></div>`
      : `<div class="tbl-scroll"><table class="tbl">
          <caption>${escapeHtml(sec.title.replace(/:$/, ''))}</caption>
          <thead><tr><th scope="col">Region</th><th scope="col">Name</th><th scope="col">Peak</th>
          <th scope="col">Twitch</th><th scope="col">YouTube</th><th scope="col">Twitter</th>
          <th scope="col">Profile</th></tr></thead>
          <tbody>${sec.rows.map(c => `<tr>
            <td><span class="num" style="font-size:var(--fs-100)">${escapeHtml(c.region || '')}</span></td>
            <td class="tbl__row-h">${escapeHtml(c.name || '')}</td>
            <td>${escapeHtml(c.peak || '')}</td>
            <td>${cel(c.twitch, c.twitchUrl)}</td>
            <td>${cel(c.youtube, c.youtubeUrl)}</td>
            <td>${cel(c.twitter, c.twitterUrl)}</td>
            <td>${cel(c.opgg, c.opggUrl)}</td></tr>`).join('')}</tbody>
        </table></div>`).join('<hr class="seam">');
  }
}

function renderFooter({ guides }) {
  set('[data-foot-credits]', (guides.credits || []).map(c =>
    `<li>${escapeHtml(c.name)} — ${escapeHtml(c.role)}</li>`).join(''));
  const first = (guides.referenceSections || [])[0];
  const names = ((first && first.rows) || []).slice(0, 8);
  set('[data-foot-creators]', names.map(c =>
    `<li>${escapeHtml(c.name)}${c.region && c.region !== '---' ? ` <span class="mono-micro">${escapeHtml(c.region)}</span>` : ''}</li>`).join(''));
}

document.addEventListener('bible:ready', e => {
  try { buildIconIndex(e.detail.matchups); renderHome(e.detail); renderGuides(e.detail); renderFooter(e.detail); }
  catch (err) { console.error(err); }
  mountRelics();
});

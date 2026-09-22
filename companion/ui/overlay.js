const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let expanded = false;
let pinned = false;
let last = null;
let lastFocus = 'all';
let lastAdvice = null;

const WORD = { 1: 'free', 2: 'favourable', 3: 'even', 4: 'hard', 5: 'nightmare' };

// selector value -> Bible section heading (TL;DR and the four writeup sections)
const TIP_SECTIONS = [
  ['early', 'Early Game'],
  ['trade', 'How to trade'],
  ['watch', 'What to watch out for'],
  ['tips', 'Tips'],
];

let lastName = null;

function render(state) {
  const m = state.overlay;
  const focus = state.overlayFocus || 'all';
  last = m;
  lastFocus = focus;
  const show = key => focus === 'all' || focus === key;
  if ($('#focus').value !== focus) $('#focus').value = focus;

  // gold diff badge: your items + pocket gold vs your lane opponent's items
  const g = $('#gold');
  const gd = state.advice?.goldDiff;
  if (gd == null) {
    g.classList.add('hidden');
  } else {
    const abs = Math.abs(gd);
    g.textContent = (gd >= 0 ? '+' : '-') + (abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : Math.round(abs));
    g.classList.remove('hidden');
    g.classList.toggle('pos', gd >= 0);
    g.classList.toggle('neg', gd < 0);
    g.title = `gold vs ${state.advice.goldVs || 'opponent'} (your items + pocket gold vs their items)`;
  }

  if (m && m.name !== lastName) {
    lastName = m.name;
    const card = document.querySelector('#card');
    const flash = document.querySelector('#flash');
    const aura = document.querySelector('#aura');
    card.classList.remove('arrive'); flash.classList.remove('go'); aura.classList.remove('pulse');
    void card.offsetWidth;
    card.classList.add('arrive'); flash.classList.add('go'); aura.classList.add('pulse');
  }
  $('#empty').classList.toggle('hidden', !!m);
  $('#content').classList.toggle('hidden', !m);
  if (!m) { $('#champ').textContent = '—'; $('#diff').textContent = ''; return; }

  $('#champ').textContent = m.name;
  const d = m.overall;
  const diff = $('#diff');
  diff.textContent = d ? `${d}/5 ${WORD[d]}` : '';
  diff.className = 'pill' + (d ? ` pill--d${d}` : '');
  const portrait = $('#portrait');
  if (m.portrait) { portrait.src = window.mb.assetUrl(m.portrait); portrait.classList.remove('hidden'); }
  else portrait.classList.add('hidden');

  $('#summsWrap').classList.toggle('hidden', !show('summoners'));
  $('#summs').innerHTML = m.summoners.map(s => `<span>${esc(s)}</span>`).join('<span>·</span>') || '—';

  $('#builds').classList.toggle('hidden', !show('builds'));
  $('#builds').innerHTML = show('builds') ? m.builds.map(b => `
    <section>
      ${b.condition ? `<p class="cond">${esc(b.condition.replace(/:$/, ''))}</p>` : '<p class="eyebrow">Items</p>'}
      <div class="strip">${b.icons.map(i =>
        `<img src="${window.mb.assetUrl(i.file)}" alt="${esc(i.name)}" title="${esc(i.name)}">`).join('')}</div>
      <ol>${b.steps.slice(0, expanded ? 99 : 4).map(s =>
        `<li><span class="item">${esc(s.item)}</span>${s.note ? ` <span class="note">— ${esc(s.note)}</span>` : ''}</li>`).join('')}
      </ol>
    </section>`).join('') : '';

  const source = [];
  if (show('tldr') && m.tldr.length) source.push({ heading: 'TL;DR', items: m.tldr });
  for (const [key, heading] of TIP_SECTIONS) {
    if (!show(key)) continue;
    const t = m.tips.find(t => t.heading === heading);
    if (t) source.push(t);
  }
  const shown = expanded ? source : source.slice(0, 1);
  $('#tipsWrap').innerHTML = shown.map(t => `
    <section>
      <p class="eyebrow">${esc(t.heading)}</p>
      <ul>${t.items.slice(0, expanded ? 99 : 4).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </section>`).join('');

  $('#more').textContent = expanded ? 'show less' : 'show everything';
  $('#more').classList.toggle('hidden', (source.length <= 1 && !expanded) || focus !== 'all');

  // live situational advice (only exists while in game with the advisor on)
  const a = state.advice;
  lastAdvice = a || null;
  const lw = $('#liveWrap');
  lw.classList.toggle('hidden', !show('live') || !a);
  if (show('live') && a) {
    if (!a.coreDone) {
      $('#live').innerHTML = `<p class="hintline">Finish your core first: <b>${esc(a.missingCore.join(' → '))}</b></p>`;
    } else {
      const parts = [];
      if (a.recommendations.length) {
        parts.push(a.recommendations.map(r => `
          <div class="pick">
            <span class="item">${esc(r.name)}</span>
            <span class="note">${r.reasons.map(esc).join(' · ')}</span>
          </div>`).join(''));
      } else {
        parts.push('<p class="hintline">No strong read yet — their builds are still taking shape.</p>');
      }
      if (a.boots) parts.push(`<p class="hintline">Boots: <b>${esc(a.boots.name)}</b> — ${esc(a.boots.why)}</p>`);
      for (const n of a.notes || []) parts.push(`<p class="hintline warnline">${esc(n)}</p>`);
      $('#live').innerHTML = parts.join('');
    }
  }
}

$('#focus').addEventListener('change', e => window.mb.setSection(e.target.value));
$('#more').addEventListener('click', () => { expanded = !expanded; if (last) render({ overlay: last, overlayFocus: lastFocus, advice: lastAdvice }); });
$('#hide').addEventListener('click', () => window.mb.overlayHide());
$('#pin').addEventListener('click', () => {
  pinned = !pinned;
  $('#pin').classList.toggle('lit', pinned);
  window.mb.overlayClickThrough(pinned);
});

const bar = $('#bar');
bar.addEventListener('mouseenter', () => { if (pinned) window.mb.overlaySolid(); });
bar.addEventListener('mouseleave', () => { if (pinned) window.mb.overlayClickThrough(true); });

// free resize: drag ANY edge or corner, window follows the cursor.
// The renderer reports the edge + absolute cursor position; the main process
// owns the bounds math (anchoring the opposite side on n/w drags).
let drag = null;
for (const h of document.querySelectorAll('.rz')) {
  h.addEventListener('pointerdown', e => {
    drag = { edge: h.dataset.edge };
    try { h.setPointerCapture(e.pointerId); } catch {}
    window.mb.overlayResizeStart();
    e.preventDefault();
  });
  h.addEventListener('pointermove', e => {
    if (!drag) return;
    window.mb.overlayResizeTo(drag.edge, Math.round(e.screenX), Math.round(e.screenY));
  });
  const endDrag = () => { drag = null; };
  h.addEventListener('pointerup', endDrag);
  h.addEventListener('pointercancel', endDrag);
}

window.mb.onState(render);
window.mb.ready();

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let expanded = false;
let pinned = false;
let last = null;
let lastSections = null;

const WORD = { 1: 'free', 2: 'favourable', 3: 'even', 4: 'hard', 5: 'nightmare' };

// key -> Bible section heading (TL;DR and the four writeup sections)
const TIP_SECTIONS = [
  ['early', 'Early Game'],
  ['trade', 'How to trade'],
  ['watch', 'What to watch out for'],
  ['tips', 'Tips'],
];
const MENU = [
  ['tldr', 'TL;DR'],
  ['early', 'Early game'],
  ['trade', 'How to trade'],
  ['watch', 'Watch out for'],
  ['tips', 'Tips'],
  ['builds', 'Items'],
  ['summoners', 'Summoners'],
];

let lastName = null;

function render(state) {
  const m = state.overlay;
  const sec = state.sections || {};
  last = m;
  lastSections = sec;
  renderMenu(sec);
  if (m && m.name !== lastName) {
    lastName = m.name;
    const card = document.querySelector('#card');
    const flash = document.querySelector('#flash');
    card.classList.remove('arrive'); flash.classList.remove('go');
    void card.offsetWidth;
    card.classList.add('arrive'); flash.classList.add('go');
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

  $('#summsWrap').classList.toggle('hidden', sec.summoners === false);
  $('#summs').innerHTML = m.summoners.map(s => `<span>${esc(s)}</span>`).join('<span>·</span>') || '—';

  $('#builds').classList.toggle('hidden', sec.builds === false);
  $('#builds').innerHTML = m.builds.map(b => `
    <section>
      ${b.condition ? `<p class="cond">${esc(b.condition.replace(/:$/, ''))}</p>` : '<p class="eyebrow">Items</p>'}
      <div class="strip">${b.icons.map(i =>
        `<img src="${window.mb.assetUrl(i.file)}" alt="${esc(i.name)}" title="${esc(i.name)}">`).join('')}</div>
      <ol>${b.steps.slice(0, expanded ? 99 : 4).map(s =>
        `<li><span class="item">${esc(s.item)}</span>${s.note ? ` <span class="note">— ${esc(s.note)}</span>` : ''}</li>`).join('')}
      </ol>
    </section>`).join('');

  const source = [];
  if (sec.tldr !== false && m.tldr.length) source.push({ heading: 'TL;DR', items: m.tldr });
  for (const [key, heading] of TIP_SECTIONS) {
    if (sec[key] === false) continue;
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
  $('#more').classList.toggle('hidden', source.length <= 1 && !expanded);
}

function renderMenu(sec) {
  const menu = $('#viewMenu');
  menu.innerHTML = MENU.map(([key, label]) => `
    <label><input type="checkbox" data-key="${key}" ${sec[key] === false ? '' : 'checked'}>${label}</label>
  `).join('');
  for (const input of menu.querySelectorAll('input')) {
    input.addEventListener('change', () => window.mb.setSection(input.dataset.key, input.checked));
  }
}

$('#view').addEventListener('click', () => $('#viewMenu').classList.toggle('hidden'));
$('#more').addEventListener('click', () => { expanded = !expanded; if (last) render({ overlay: last, sections: lastSections }); });
$('#hide').addEventListener('click', () => window.mb.overlayHide());
$('#pin').addEventListener('click', () => {
  pinned = !pinned;
  $('#pin').classList.toggle('lit', pinned);
  window.mb.overlayClickThrough(pinned);
});

const bar = $('#bar');
bar.addEventListener('mouseenter', () => { if (pinned) window.mb.overlaySolid(); });
bar.addEventListener('mouseleave', () => { if (pinned) window.mb.overlayClickThrough(true); });

// free resize: drag the bottom-right grip, window follows the cursor
const grip = $('#grip');
let drag = null;
grip.addEventListener('pointerdown', e => {
  drag = { x: e.screenX, y: e.screenY };
  grip.setPointerCapture(e.pointerId);
  e.preventDefault();
});
grip.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.screenX - drag.x, dy = e.screenY - drag.y;
  if (dx || dy) {
    window.mb.overlayResize(dx, dy);
    drag = { x: e.screenX, y: e.screenY };
  }
});
const endDrag = () => { drag = null; };
grip.addEventListener('pointerup', endDrag);
grip.addEventListener('pointercancel', endDrag);

window.mb.onState(render);
window.mb.ready();

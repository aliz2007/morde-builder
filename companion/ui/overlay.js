const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let expanded = false;
let pinned = false;
let last = null;

const WORD = { 1: 'free', 2: 'favourable', 3: 'even', 4: 'hard', 5: 'nightmare' };

let lastName = null;

function render(state) {
  const m = state.overlay;
  last = m;
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

  $('#summs').innerHTML = m.summoners.map(s => `<span>${esc(s)}</span>`).join('<span>·</span>') || '—';

  $('#builds').innerHTML = m.builds.map(b => `
    <section>
      ${b.condition ? `<p class="cond">${esc(b.condition.replace(/:$/, ''))}</p>` : '<p class="eyebrow">Items</p>'}
      <div class="strip">${b.icons.map(i =>
        `<img src="${window.mb.assetUrl(i.file)}" alt="${esc(i.name)}" title="${esc(i.name)}">`).join('')}</div>
      <ol>${b.steps.slice(0, expanded ? 99 : 4).map(s =>
        `<li><span class="item">${esc(s.item)}</span>${s.note ? ` <span class="note">— ${esc(s.note)}</span>` : ''}</li>`).join('')}
      </ol>
    </section>`).join('');

  const source = m.tldr.length ? [{ heading: 'TL;DR', items: m.tldr }, ...m.tips] : m.tips;
  const shown = expanded ? source : source.slice(0, 1);
  $('#tipsHead').textContent = shown.map(t => t.heading).join(' · ') || 'Tips';
  $('#tips').innerHTML = shown.flatMap(t => t.items.slice(0, expanded ? 99 : 4))
    .map(t => `<li>${esc(t)}</li>`).join('');

  $('#more').textContent = expanded ? 'show less' : 'show everything';
}

$('#more').addEventListener('click', () => { expanded = !expanded; if (last) render({ overlay: last }); });
$('#hide').addEventListener('click', () => window.mb.overlayHide());
$('#pin').addEventListener('click', () => {
  pinned = !pinned;
  $('#pin').classList.toggle('lit', pinned);
  window.mb.overlayClickThrough(pinned);
});

const bar = $('#bar');
bar.addEventListener('mouseenter', () => { if (pinned) window.mb.overlaySolid(); });
bar.addEventListener('mouseleave', () => { if (pinned) window.mb.overlayClickThrough(true); });

window.mb.onState(render);
window.mb.ready();

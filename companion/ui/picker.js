const $ = s => document.querySelector(s);

const CROWN = '<svg class="crown" viewBox="0 0 64 40" aria-hidden="true"><path fill-rule="evenodd" d="M2 40 L2 22 L9 30 L14 8 L21 24 L27 2 L32 0 L37 2 L43 24 L50 8 L55 30 L62 22 L62 40 Z M14 31 L50 31 L50 35 L14 35 Z"/></svg>';

function spawnSouls(n = 16) {
  const box = $('#souls');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
    s.style.setProperty('--size', (2 + Math.random() * 2.4).toFixed(1) + 'px');
    s.style.setProperty('--dur', (9 + Math.random() * 11).toFixed(1) + 's');
    s.style.setProperty('--delay', (-Math.random() * 18).toFixed(1) + 's');
    s.style.setProperty('--drift', ((Math.random() - 0.5) * 70).toFixed(0) + 'px');
    s.style.setProperty('--o', (0.35 + Math.random() * 0.5).toFixed(2));
    box.appendChild(s);
  }
}

function burst(row) {
  const ring = document.createElement('span');
  ring.className = 'ring-burst';
  row.appendChild(ring);
  ring.addEventListener('animationend', () => ring.remove());
}

function render(state) {
  const text = $('#statusText');
  text.textContent = state.connected
    ? (state.phase === 'ChampSelect' ? 'champ select' : `connected · ${state.phase || 'lobby'}`)
    : 'waiting for client…';
  $('#status').classList.toggle('on', state.connected);

  const box = $('#enemies');
  if (!state.enemies.length) {
    box.innerHTML = `<div class="empty">${CROWN}Nothing yet — enemies appear here during champ select.</div>`;
  } else {
    box.innerHTML = '';
    for (const e of state.enemies) {
      const b = document.createElement('button');
      b.className = 'enemy' + (state.picked === e.name ? ' picked' : '');
      const img = e.portrait
        ? `<img src="${window.mb.assetUrl(e.portrait)}" alt="">`
        : `<span class="no-img">?</span>`;
      b.innerHTML = `${img}<span>${e.name}${e.hasWriteup ? '' : '<span class="sub">no writeup</span>'}</span>
        <span class="pill">${state.picked === e.name ? 'picked' : 'pick'}</span>`;
      b.addEventListener('click', () => { burst(b); window.mb.pick(e.name); });
      box.appendChild(b);
    }
  }

  for (const input of document.querySelectorAll('[data-toggle]')) {
    input.checked = !!state.toggles[input.dataset.toggle];
  }

  const log = $('#log');
  log.innerHTML = state.log.slice(-30).map(l =>
    `<div class="${l.level}">${new Date(l.t).toLocaleTimeString()}  ${l.message}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

for (const input of document.querySelectorAll('[data-toggle]')) {
  input.addEventListener('change', () => window.mb.setToggle(input.dataset.toggle, input.checked));
}
$('#minimize').addEventListener('click', () => window.mb.pickerMin());
$('#close').addEventListener('click', () => window.mb.pickerClose());

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) spawnSouls();
window.mb.onState(render);
window.mb.ready();

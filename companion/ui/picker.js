const $ = s => document.querySelector(s);

function render(state) {
  const status = $('#status');
  status.textContent = state.connected
    ? (state.phase === 'ChampSelect' ? 'champ select' : `connected · ${state.phase || 'lobby'}`)
    : 'waiting for the League client…';
  status.classList.toggle('on', state.connected);

  const box = $('#enemies');
  if (!state.enemies.length) {
    box.innerHTML = '<div class="empty">Nothing yet — enemies appear here during champ select.</div>';
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
      b.addEventListener('click', () => window.mb.pick(e.name));
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

window.mb.onState(render);
window.mb.ready();

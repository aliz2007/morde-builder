/* Password gate: covers the page until the password is entered.
   Runs on every load and refresh — nothing is remembered. */
(function () {
  var PASSWORD = 'IHATEOLAF';

  function build() {
    document.documentElement.classList.add('mb-locked');

    var style = document.createElement('style');
    style.textContent = [
      'html.mb-locked body{ visibility:hidden; }',
      '#mb-gate{ position:fixed; inset:0; z-index:2147483647; visibility:visible;',
      '  display:flex; align-items:center; justify-content:center;',
      '  background:#0A0B09; font-family:Georgia,serif; }',
      '#mb-gate .box{ text-align:center; padding:32px; max-width:340px; }',
      '#mb-gate h1{ color:#8FBF3A; font-size:22px; letter-spacing:.12em;',
      '  text-transform:uppercase; margin:0 0 8px; }',
      '#mb-gate p{ color:#7d8577; font-size:13px; margin:0 0 20px; }',
      '#mb-gate input{ width:100%; box-sizing:border-box; padding:10px 12px;',
      '  font-size:15px; letter-spacing:.1em; text-align:center;',
      '  background:#12140f; color:#e6ead9; border:1px solid #3a4433;',
      '  border-radius:3px; outline:none; }',
      '#mb-gate input:focus{ border-color:#8FBF3A; }',
      '#mb-gate button{ margin-top:12px; width:100%; padding:10px;',
      '  font-size:13px; letter-spacing:.15em; text-transform:uppercase;',
      '  background:#8FBF3A; color:#0A0B09; border:0; border-radius:3px;',
      '  cursor:pointer; font-weight:700; }',
      '#mb-gate button:hover{ filter:brightness(1.1); }',
      '#mb-gate .err{ color:#d96a4a; font-size:12px; min-height:16px;',
      '  margin:10px 0 0; }',
      '#mb-gate.shake .box{ animation:mb-shake .3s; }',
      '@keyframes mb-shake{ 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }',
    ].join('\n');
    document.head.appendChild(style);

    var gate = document.createElement('div');
    gate.id = 'mb-gate';
    gate.innerHTML =
      '<div class="box">' +
      '<h1>The Mordekaiser Bible</h1>' +
      '<p>This tome is sealed. Speak the word.</p>' +
      '<form id="mb-gate-form">' +
      '<input id="mb-gate-input" type="password" autocomplete="off" placeholder="password" autofocus>' +
      '<button type="submit">Enter</button>' +
      '<div class="err" id="mb-gate-err"></div>' +
      '</form>' +
      '</div>';
    document.body.appendChild(gate);

    var input = gate.querySelector('#mb-gate-input');
    var err = gate.querySelector('#mb-gate-err');
    input.focus();

    gate.querySelector('#mb-gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value.trim().toUpperCase() === PASSWORD) {
        gate.remove();
        document.documentElement.classList.remove('mb-locked');
      } else {
        err.textContent = 'Wrong word. The metal does not bend.';
        input.value = '';
        input.focus();
        gate.classList.remove('shake');
        void gate.offsetWidth;
        gate.classList.add('shake');
      }
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();

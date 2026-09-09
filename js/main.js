/* Home page: show the donor list read from data/donors.xlsx.
   Linked Excel handle first, http fetch fallback. No browser storage. */
(function () {
  'use strict';

  var rowsEl  = document.getElementById('donorRows');
  var totalEl = document.getElementById('grandTotal');

  function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(list) {
    if (!list || !list.length) {
      rowsEl.innerHTML = '<tr><td colspan="3" class="loading">இன்னும் நன்கொடைகள் இல்லை</td></tr>';
      totalEl.textContent = '0';
      return;
    }
    var total = 0;
    rowsEl.innerHTML = list.map(function (d, i) {
      total += Number(d.amount) || 0;
      return '<tr>' +
        '<td class="col-serial">' + (i + 1) + '</td>' +
        '<td class="donor-name">' + esc(d.name) + '</td>' +
        '<td class="col-amt">' + fmt(d.amount) + '</td>' +
      '</tr>';
    }).join('');
    totalEl.textContent = fmt(total);
  }

  function refresh() {
    VGStore.load(function (list, status) {
      if (status === 'excel' || status === 'file') { render(list); return; }
      /* no linked handle and no http fetch (e.g. opened via file://) */
      rowsEl.innerHTML =
        '<tr><td colspan="3" class="loading">பட்டியலைக் காட்ட ' +
        '<button id="homeLinkBtn" class="btn btn-sm btn-fest">📂 donors.xlsx இணை</button>' +
        '</td></tr>';
      totalEl.textContent = '0';
    });
  }

  /* link button injected into the empty-state row */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'homeLinkBtn') {
      VGStore.pick(function (ok) { if (ok) refresh(); });
    }
  });

  /* re-attach a previously linked file silently, then render */
  VGStore.restore(false, function () { refresh(); });
  setInterval(refresh, 25000);
})();

/* Admin context: login + add / update / delete donors.
   The ONLY store is your local data/donors.xlsx — written on every
   change once the file is linked (one-time picker at login).        */
(function () {
  'use strict';

  var CFG = window.VG_CONFIG || { ADMIN_USER: 'admin', ADMIN_PASS: 'admin123' };
  var SESSION_KEY = 'vg_admin_session'; /* login flag only — never donor data */

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var list = [];

  /* ---------- toast ---------- */
  var toastInstance = null;
  function toast(msg, ok) {
    if (ok === undefined) ok = true;
    if (!toastInstance) toastInstance = new bootstrap.Toast($('appToast'), { delay: 2600 });
    $('toastMsg').textContent = msg;
    $('appToast').classList.toggle('text-bg-success', ok);
    $('appToast').classList.toggle('text-bg-danger', !ok);
    toastInstance.show();
  }

  /* ---------- Excel status line ---------- */
  function setStatus(kind) {
    var el = $('excelStatus');
    if (kind === 'linked') {
      el.textContent = '✅ இணைக்கப்பட்டது: data/donors.xlsx — ஒவ்வொரு மாற்றமும் நேரடியாக Excel கோப்பில் எழுதப்படும்.';
      el.className = 'excel-status text-success small mt-2 mb-0';
    } else if (kind === 'locked') {
      el.textContent = '⚠️ Excel கோப்பை எழுத முடியவில்லை — donors.xlsx எக்செல்-ல் திறந்திருந்தால் அதை மூடிவிட்டு மீண்டும் முயற்சிக்கவும்.';
      el.className = 'excel-status text-danger small mt-2 mb-0';
    } else if (kind === 'unsupported') {
      el.textContent = '⚠️ இந்த உலாவி நேரடி Excel எழுத்தை ஆதரிக்கவில்லை (Chrome/Edge பயன்படுத்தவும்). மாற்றங்களை ⬇ பதிவிறக்கு மூலம் data/donors.xlsx ஆகச் சேமிக்கவும்.';
      el.className = 'excel-status text-danger small mt-2 mb-0';
    } else {
      el.textContent = '🔗 Browser பாதுகாப்பு விதிப்படி முதல் முறை மட்டும் கோப்பைத் தேர்வு செய்ய வேண்டும் — அதன் பிறகு எப்போதும் தானியங்கு. “Excel இணை” அழுத்தி data/donors.xlsx உடன் ஒரு முறை இணைக்கவும்.';
      el.className = 'excel-status text-secondary small mt-2 mb-0';
    }
  }

  /* ---------- view switching ---------- */
  function showLogin() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    $('dashView').classList.add('d-none');
    $('loginView').classList.remove('d-none');
    $('logoutBtn').classList.add('d-none');
  }
  function showDash() {
    $('loginView').classList.add('d-none');
    $('dashView').classList.remove('d-none');
    $('logoutBtn').classList.remove('d-none');
  }

  /* ---------- login / logout ---------- */
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('loginUser').value.trim();
    var p = $('loginPass').value;
    if (u === CFG.ADMIN_USER && p === CFG.ADMIN_PASS) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) {}
      $('loginError').classList.add('d-none');
      $('loginForm').reset();
      showDash();
      toast('உள்நுழைவு வெற்றி 🙏');
      acquire(); /* user gesture → may open the one-time file picker */
    } else {
      $('loginError').classList.remove('d-none');
    }
  });

  $('logoutBtn').addEventListener('click', showLogin);

  /* attach the Excel file: remembered handle first; if never linked,
     connect the EXISTING data/donors.xlsx (or create it when missing).
     The picker step happens at most ONCE, merged into a user click.   */
  function connectOnce() {
    VGStore.fileExists(function (exists) {
      var go = exists ? VGStore.pick : VGStore.create;
      go(function (ok2, reason) {
        if (ok2) {
          setStatus('linked'); load();
          toast(exists ? 'donors.xlsx இணைக்கப்பட்டது — இனி எல்லாம் தானியங்கு ✅'
                       : 'donors.xlsx உருவாக்கப்பட்டு இணைக்கப்பட்டது ✅');
        } else if (reason === 'cancelled') {
          setStatus('unlinked'); load();
        } else {
          setStatus('unlinked'); load();
          toast('உலாவி அனுமதி கிடைக்கவில்லை — மீண்டும் முயற்சிக்கவும்', false);
        }
      });
    });
  }

  function acquire() {
    if (!VGStore.supported()) { setStatus('unsupported'); load(); return; }
    VGStore.restore(true, function (ok) {
      if (ok) { setStatus('linked'); load(); return; } /* silent auto re-attach */
      connectOnce(); /* one-time only */
    });
  }

  /* silent attach for page reloads (no user gesture available) */
  function silentAttach() {
    if (!VGStore.supported()) { setStatus('unsupported'); load(); return; }
    VGStore.restore(false, function (ok) {
      if (ok) { setStatus('linked'); } else { setStatus('unlinked'); }
      load();
    });
  }

  $('linkExcelBtn').addEventListener('click', connectOnce);

  /* ---------- list ---------- */
  function load() {
    VGStore.load(function (l, status) {
      if (status === 'none' || status === 'error') {
        if (!VGStore.linked()) setStatus('unlinked');
        list = [];
      } else {
        list = l || [];
      }
      render();
    });
  }

  function render() {
    var tbody = $('adminRows');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading">பட்டியல் காலியாக உள்ளது</td></tr>';
    } else {
      tbody.innerHTML = list.map(function (d, i) {
        return '<tr>' +
          '<td class="col-serial">' + (i + 1) + '</td>' +
          '<td class="donor-name">' + esc(d.name) + '</td>' +
          '<td class="col-amt">' + fmt(d.amount) + '</td>' +
          '<td class="text-end" style="white-space:nowrap">' +
            '<button class="btn btn-sm btn-outline-primary action-btn" data-act="edit" data-serial="' + (i + 1) + '" data-name="' + esc(d.name) + '" data-amount="' + d.amount + '" title="திருத்து">✏️</button> ' +
            '<button class="btn btn-sm btn-outline-danger action-btn" data-act="del" data-serial="' + (i + 1) + '" data-name="' + esc(d.name) + '" title="நீக்கு">🗑️</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }
    var total = list.reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);
    $('adminTotal').textContent = fmt(total);
  }

  /* write the new list into the .xlsx, then re-render */
  function persist(msg) {
    render();
    VGStore.save(list, function (ok, err) {
      if (ok) { setStatus('linked'); toast(msg + ' (Excel ✅)'); }
      else if (err === 'locked') { setStatus('locked'); toast('Excel-ல் சேமிக்க முடியவில்லை — கோப்பை மூடிவிட்டு மீண்டும் முயற்சிக்கவும்', false); }
      else { setStatus('unsupported'); toast('இணைக்கப்படவில்லை — ⬇ பதிவிறக்கு பயன்படுத்தவும்', false); }
    });
  }

  /* ---------- add ---------- */
  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('addName').value.trim();
    var amount = Math.round(Number($('addAmount').value));
    if (!name) { toast('பெயர் தேவை', false); return; }
    if (!isFinite(amount) || amount <= 0) { toast('சரியான தொகையை உள்ளிடவும்', false); return; }
    list.push({ name: name, amount: amount });
    $('addForm').reset();
    persist('நன்கொடை சேர்க்கப்பட்டது');
  });

  /* ---------- edit / delete via modals ---------- */
  function editModal()   { return bootstrap.Modal.getOrCreateInstance($('editModal')); }
  function deleteModal() { return bootstrap.Modal.getOrCreateInstance($('deleteModal')); }

  $('adminRows').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.getAttribute('data-act') === 'edit') {
      $('editSerial').value = btn.getAttribute('data-serial');
      $('editName').value   = btn.getAttribute('data-name');
      $('editAmount').value = btn.getAttribute('data-amount');
      editModal().show();
    } else {
      $('deleteSerial').value = btn.getAttribute('data-serial');
      $('deleteName').textContent = btn.getAttribute('data-name');
      deleteModal().show();
    }
  });

  $('editForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var serial = Number($('editSerial').value);
    var name = $('editName').value.trim();
    var amount = Math.round(Number($('editAmount').value));
    if (!name || !isFinite(amount) || amount <= 0) { toast('சரியான தரவை உள்ளிடவும்', false); return; }
    if (serial >= 1 && serial <= list.length) {
      list[serial - 1] = { name: name, amount: amount };
      editModal().hide();
      persist('மாற்றம் சேமிக்கப்பட்டது');
    }
  });

  $('deleteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var serial = Number($('deleteSerial').value);
    if (serial >= 1 && serial <= list.length) {
      list.splice(serial - 1, 1);
      deleteModal().hide();
      persist('நன்கொடை நீக்கப்பட்டது');
    }
  });

  /* ---------- manual backup download ---------- */
  $('downloadExcelBtn').addEventListener('click', function () {
    if (!list.length) { toast('பட்டியல் காலியாக உள்ளது', false); return; }
    VGStore.download(list);
    toast('donors.xlsx பதிவிறக்கப்பட்டது — data/ அடைவில் வைக்கவும் ⬇');
  });

  /* ---------- boot ---------- */
  var session = null;
  try { session = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
  if (session) { showDash(); silentAttach(); } else { showLogin(); }
})();

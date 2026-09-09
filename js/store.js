/* ============================================================
   Data layer — your LOCAL Excel file (data/donors.xlsx) is the
   ONLY store. No localStorage / sessionStorage for donor data.

   How it works (Chrome / Edge):
   - pick()    : one-time file chooser → keeps the file handle,
                 remembers it in IndexedDB for future visits
   - restore() : silently re-attach the remembered handle
   - load()    : read rows from the .xlsx on disk
                 (falls back to fetching data/donors.xlsx when the
                 site is served over http and no handle is linked)
   - save()    : write the workbook straight into the .xlsx on disk
   ============================================================ */
(function () {
  'use strict';

  var COL = { serial: 'வரிசை எண்', name: 'கொடுத்தவர் பெயர்', amount: 'அமௌன்ட் (₹)' };
  var SEED = [{ name: 'பூபதி இபி', amount: 1000 }];
  var IDB_NAME = 'vg-donors';
  var IDB_KEY = 'donors-xlsx';
  var handle = null;

  function supported() { return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'; }

  /* ---------- IndexedDB: remember the file handle between visits ---------- */
  function idbOpen() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open(IDB_NAME, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('handles'); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
  }
  function idbGetHandle() {
    return idbOpen().then(function (db) {
      return new Promise(function (res) {
        var rq = db.transaction('handles', 'readonly').objectStore('handles').get(IDB_KEY);
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function idbSetHandle(h) {
    return idbOpen().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction('handles', 'readwrite').objectStore('handles').put(h, IDB_KEY);
        tx.onsuccess = function () { res(); };
        tx.onerror = function () { res(); };
      });
    }).catch(function () {});
  }

  /* ---------- Excel parse / build (SheetJS) ---------- */
  function fromSheet(buf) {
    var wb = XLSX.read(buf, { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows.map(function (r) {
      return {
        name: String(r[COL.name] !== undefined ? r[COL.name] : '').trim(),
        amount: Number(r[COL.amount]) || 0
      };
    }).filter(function (d) { return d.name || d.amount > 0; });
  }

  function toBlob(list) {
    var rows = list.map(function (d, i) {
      var o = {};
      o[COL.serial] = i + 1;
      o[COL.name] = d.name;
      o[COL.amount] = d.amount;
      return o;
    });
    var ws = XLSX.utils.json_to_sheet(rows, { header: [COL.serial, COL.name, COL.amount] });
    ws['!cols'] = [{ wch: 10 }, { wch: 32 }, { wch: 14 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Donors');
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function readFile() {
    return handle.getFile()
      .then(function (f) { return f.arrayBuffer(); })
      .then(fromSheet);
  }

  /* ---------- silently re-attach remembered handle (no prompt if granted) ---------- */
  function restore(requestPermission, cb) {
    if (!supported()) { cb(false); return; }
    idbGetHandle().then(function (h) {
      if (!h) { cb(false); return; }
      handle = h;
      var q = handle.queryPermission ? handle.queryPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
      q.then(function (state) {
        if (state === 'granted') { cb(true); return; }
        if (requestPermission && handle.requestPermission) {
          handle.requestPermission({ mode: 'readwrite' }).then(function (s2) { cb(s2 === 'granted'); })
            .catch(function () { cb(false); });
        } else {
          cb(false);
        }
      }).catch(function () { cb(false); });
    });
  }

  /* ---------- one-time picker (must be called from a user gesture) ---------- */
  function pick(cb) {
    if (!supported()) { cb(false, 'unsupported'); return; }
    window.showOpenFilePicker({
      multiple: false,
      mode: 'readwrite',
      types: [{
        description: 'Excel workbook',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      }]
    }).then(function (hs) {
      handle = hs[0];
      return idbSetHandle(handle);
    }).then(function () { cb(true); })
      .catch(function (e) {
        cb(false, (e && e.name === 'AbortError') ? 'cancelled' : 'error');
      });
  }

  /* ---------- create the file when it does not exist ---------- */
  function create(cb) {
    if (typeof window.showSaveFilePicker !== 'function') { cb(false, 'unsupported'); return; }
    window.showSaveFilePicker({
      suggestedName: 'donors.xlsx',
      types: [{
        description: 'Excel workbook',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      }]
    }).then(function (h) {
      handle = h;
      return idbSetHandle(h);
    }).then(function () { cb(true); })
      .catch(function (e) {
        cb(false, (e && e.name === 'AbortError') ? 'cancelled' : 'error');
      });
  }

  /* ---------- does data/donors.xlsx already exist? (http only) ---------- */
  function fileExists(cb) {
    fetch('data/donors.xlsx', { method: 'HEAD', cache: 'no-store' })
      .then(function (r) { cb(r.ok); })
      .catch(function () { cb(false); });
  }

  /* ---------- read rows: linked file first, then http fetch ---------- */
  function load(cb) {
    if (handle) {
      readFile()
        .then(function (list) { cb(list, 'excel'); })
        .catch(function () { cb(null, 'error'); });
      return;
    }
    fetch('data/donors.xlsx', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) {
        var list;
        try { list = fromSheet(buf); } catch (e) { list = SEED.slice(); }
        cb(list, 'file');
      })
      .catch(function () { cb(null, 'none'); });
  }

  /* ---------- write rows into the .xlsx on disk ---------- */
  function save(list, cb) {
    if (!handle) { if (cb) cb(false, 'nolink'); return; }
    handle.createWritable()
      .then(function (w) { return w.write(toBlob(list)).then(function () { return w.close(); }); })
      .then(function () { if (cb) cb(true); })
      .catch(function () { if (cb) cb(false, 'locked'); }); /* e.g. Excel has the file open */
  }

  function linked() { return !!handle; }

  /* ---------- manual backup download (any browser) ---------- */
  function download(list) {
    var blob = toBlob(list);
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'donors.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }
  }

  window.VGStore = {
    COL: COL,
    supported: supported,
    restore: restore,
    pick: pick,
    create: create,
    fileExists: fileExists,
    load: load,
    save: save,
    linked: linked,
    download: download,
    toBlob: toBlob
  };
})();

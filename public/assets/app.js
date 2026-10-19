'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'tesla-cost-v1';
  var rowSeq = 0;
  var lastSummary = '';
  var lastResult = null, lastRows = [];
  var editingId = null, confirmId = null, detailId = null;
  var trips = [], storeMode = 'loading', fb = null, uid = null, unsubTrips = null, prefTimer = null;
  var MAX_IMGS = 8, MAX_IMG_CHARS = 190000;
  var imgs = [], imgsRemoved = [], imgsOwner = null, imgsLoading = false, proofConfirm = null;

  function num(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function fmt(n, d) {
    return n.toLocaleString('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function eur(n) { return fmt(n, 2) + ' €'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Càrregues ---------- */
  function addRow(d) {
    d = d || {};
    var n = ++rowSeq;
    var el = document.createElement('div');
    el.className = 'charge';
    el.innerHTML =
      '<div class="name"><label for="cn' + n + '">Lloc (opcional)</label>' +
      '<div class="inp"><input id="cn' + n + '" class="r-name" type="text" list="places" autocomplete="off" placeholder="Nom del carregador" value="' + esc(d.name || '') + '"></div></div>' +
      '<div><label for="ck' + n + '">Energia</label>' +
      '<div class="inp"><input id="ck' + n + '" class="r-kwh" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(d.kwh || '') + '"><span class="unit">kWh</span></div></div>' +
      '<div><label for="cp' + n + '">Preu</label>' +
      '<div class="inp"><input id="cp' + n + '" class="r-price" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(d.price || '') + '"><span class="unit">€/kWh</span></div></div>' +
      '<div class="charge-foot"><span class="charge-total"></span>' +
      '<button type="button" class="link r-del" aria-label="Treure aquesta càrrega">Treure</button></div>' +
      '<div class="charge-ask" hidden><span>Treure aquesta càrrega?</span>' +
      '<span class="ask-btns"><button type="button" class="danger r-yes">Sí, treure</button><button type="button" class="r-no">Cancel·lar</button></span></div>';
    $('charges').appendChild(el);
    return el;
  }
  function readRows() {
    return Array.prototype.map.call(document.querySelectorAll('#charges .charge'), function (el) {
      return {
        el: el,
        name: el.querySelector('.r-name').value.trim(),
        kwh: num(el.querySelector('.r-kwh').value),
        price: num(el.querySelector('.r-price').value)
      };
    });
  }

  /* ---------- Càlcul ---------- */
  function calc() {
    var method = $('method').value;
    var km = num($('km').value);
    var cons = num($('cons').value);
    var pHome = num($('home').value);
    var loss = num($('loss').value);
    if (isNaN(loss) || loss < 0) loss = 0;
    if (loss > 60) loss = 60;
    var soc0 = num($('soc0').value), soc1 = num($('soc1').value), cap = num($('cap').value);

    var meterKwhKm = method === 'bateria' ? NaN : cons / 1000;   // consum del comptador (només al mètode del consum)
    var rows = readRows();
    lastRows = rows;

    var away = 0, awayCost = 0, missingPrice = false;
    rows.forEach(function (r) {
      var t = r.el.querySelector('.charge-total');
      if (!isNaN(r.kwh) && r.kwh > 0) {
        if (isNaN(r.price)) {
          missingPrice = true;
          t.innerHTML = '<span class="miss">Falta el preu</span>';
          away += r.kwh;
        } else {
          var c = r.kwh * r.price;
          away += r.kwh; awayCost += c;
          t.innerHTML = 'Cost: <b>' + eur(c) + '</b>';
        }
      } else {
        t.textContent = '';
      }
    });

    var notes = [];
    if (missingPrice) notes.push('Hi ha càrregues sense preu. De moment no s\'han comptat al cost.');

    var miss = [];
    if (!(km > 0)) miss.push('quilòmetres');
    if (method === 'bateria') {
      if (isNaN(soc0) || soc0 < 0 || soc0 > 100) miss.push('bateria en sortir');
      if (isNaN(soc1) || soc1 < 0 || soc1 > 100) miss.push('bateria en arribar');
      if (!(cap > 0)) miss.push('capacitat');
    } else if (!(meterKwhKm > 0)) {
      miss.push('consum');
    }
    if (isNaN(pHome)) miss.push('preu de casa');
    if (miss.length) { render(null, notes, miss); return; }

    var energy, homeBat, consKwhKm;
    if (method === 'bateria') {
      var net = (soc0 - soc1) / 100 * cap;     // el que cal recuperar a casa per tornar al % de sortida
      energy = net + away;                     // tot el que ha gastat el cotxe
      homeBat = Math.max(0, net);
      if (net < 0) notes.push('Has arribat amb més bateria de la que tenies en sortir. A casa es compta 0 kWh.');
      if (!(energy > 0)) {
        notes.push('Amb aquestes dades l\'energia gastada no surt positiva. Revisa els % de bateria i les càrregues.');
        render(null, notes, ['dades de bateria coherents']);
        return;
      }
      consKwhKm = energy / km;
    } else {
      energy = km * meterKwhKm;                // kWh que ha gastat el cotxe (costat bateria)
      homeBat = Math.max(0, energy - away);
      consKwhKm = meterKwhKm;
      if (away > energy) {
        notes.push('Has carregat fora ' + fmt(away - energy, 1) + ' kWh més dels que has gastat. A casa es compta 0 kWh.');
      }
    }
    var homeWall = homeBat / (1 - loss / 100);     // kWh que paga el comptador de casa
    var homeCost = homeWall * pHome;
    var total = homeCost + awayCost;
    var allHome = (energy / (1 - loss / 100)) * pHome;

    render({
      method: method, km: km, consKwhKm: consKwhKm, meterKwhKm: meterKwhKm, cons: cons, energy: energy,
      soc0: method === 'bateria' ? soc0 : NaN, soc1: method === 'bateria' ? soc1 : NaN, cap: method === 'bateria' ? cap : NaN,
      homeWall: homeWall, homeCost: homeCost, pHome: pHome, loss: loss,
      away: away, awayCost: awayCost, total: total, allHome: allHome,
      shareHome: homeBat, shareAway: Math.min(away, energy)
    }, notes);
  }

  function render(r, notes, missing) {
    renderTripTag();
    var N = $('notes');
    N.innerHTML = notes.map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join('');

    if (!r) {
      $('total').textContent = '—';
      $('per100').textContent = '—'; $('perkm').textContent = '—';
      $('home-cost').textContent = '—'; $('away-cost').textContent = '—';
      $('home-detail').textContent = 'Falta: ' + (missing && missing.length ? missing.join(', ') : 'dades');
      $('away-detail').textContent = 'Afegeix les càrregues de fora, si n\'hi ha.';
      $('f-energy').textContent = '—'; $('f-allhome').textContent = '—'; $('f-diff').textContent = '—';
      $('b-home').style.width = '100%'; $('b-away').style.width = '0%';
      $('bar').setAttribute('aria-label', 'Sense dades');
      lastSummary = '';
      lastResult = null;
      updateSaveState();
      return;
    }

    $('total').textContent = eur(r.total);
    $('per100').textContent = eur(r.total / r.km * 100);
    $('perkm').textContent = fmt(r.total / r.km, 3) + ' €';

    var denom = r.shareHome + r.shareAway;
    var pa = denom > 0 ? r.shareAway / denom * 100 : 0;
    $('b-home').style.width = (100 - pa) + '%';
    $('b-away').style.width = pa + '%';
    $('bar').setAttribute('aria-label', 'Energia: ' + fmt(100 - pa, 0) + ' % de casa i ' + fmt(pa, 0) + ' % de fora');

    $('home-cost').textContent = eur(r.homeCost);
    $('home-detail').textContent = fmt(r.homeWall, 1) + ' kWh × ' + fmt(r.pHome, 3) + ' €/kWh' + (r.loss > 0 ? ' (amb ' + fmt(r.loss, 0) + ' % de pèrdues)' : '');
    $('away-cost').textContent = eur(r.awayCost);
    $('away-detail').textContent = r.away > 0
      ? fmt(r.away, 1) + ' kWh · mitjana ' + fmt(r.awayCost / r.away, 3) + ' €/kWh'
      : 'Cap càrrega fora';

    $('f-energy').textContent = fmt(r.energy, 1) + ' kWh (' + fmt(r.consKwhKm * 1000, 0) + ' Wh/km)';
    $('f-allhome').textContent = eur(r.allHome);
    var diff = r.total - r.allHome;
    $('f-diff').textContent = (diff > 0.005 ? '+' : diff < -0.005 ? '−' : '') + eur(Math.abs(diff));

    lastResult = r;
    lastSummary = summaryText(buildTrip());
    updateSaveState();
  }

  // Nom i data del viatge al resultat, perquè qualsevol captura digui de quin viatge es tracta.
  function renderTripTag() {
    var name = $('t-name').value.trim();
    var date = $('t-date').value;
    $('r-trip').hidden = !name;
    $('r-trip').textContent = name ? name + (date ? ' · ' + fmtDate(date) : '') : '';
  }

  /* ---------- Preferències ---------- */
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        home: $('home').value, loss: $('loss').value, unit: 'wh', cons: $('cons').value,
        method: $('method').value, cap: $('cap').value
      }));
    } catch { /* sense emmagatzematge local */ }
    pushPrefs();
  }
  // Les dades antigues es guardaven en kWh per cada 100 km; ara sempre són Wh/km.
  function consFromPrefs(c, unit) {
    var v = num(c);
    if (isNaN(v)) return '';
    if (unit !== 'wh') v *= 10;
    return plain(v, 1);
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
  }

  function applyMethodUI() {
    var bat = $('method').value === 'bateria';
    Array.prototype.forEach.call(document.querySelectorAll('.bat'), function (el) { el.hidden = !bat; });
    $('cons-wrap').hidden = bat;
  }

  /* ---------- Esdeveniments ---------- */
  document.addEventListener('input', function (e) {
    if (e.target.closest('.example')) return;
    calc();
    if (['home', 'loss', 'cons', 'cap'].indexOf(e.target.id) > -1) save();
  });
  $('method').addEventListener('change', function () { applyMethodUI(); calc(); save(); });
  $('add').addEventListener('click', function () {
    var el = addRow();
    el.querySelector('.r-kwh').focus();
    calc();
  });
  $('charges').addEventListener('click', function (e) {
    var row = e.target.closest('.charge');
    if (!row) return;
    var foot = row.querySelector('.charge-foot');
    var ask = row.querySelector('.charge-ask');
    if (e.target.closest('.r-del')) {
      var empty = !row.querySelector('.r-kwh').value.trim() && !row.querySelector('.r-price').value.trim() && !row.querySelector('.r-name').value.trim();
      if (empty) { row.remove(); calc(); return; }
      foot.hidden = true; ask.hidden = false;
      row.querySelector('.r-no').focus();
    } else if (e.target.closest('.r-yes')) {
      row.remove();
      calc();
    } else if (e.target.closest('.r-no')) {
      ask.hidden = true; foot.hidden = false;
      row.querySelector('.r-del').focus();
    }
  });
  $('reset').addEventListener('click', function () {
    var hasData = $('km').value.trim() !== '' || document.querySelectorAll('#charges .charge').length > 0;
    if (!$('example').hidden || !hasData) { resetTrip(); return; }
    $('reset-ask').hidden = false;
    $('reset').hidden = true;
    $('reset-no').focus();
  });
  $('reset-yes').addEventListener('click', function () {
    $('reset-ask').hidden = true;
    $('reset').hidden = false;
    resetTrip();
  });
  $('reset-no').addEventListener('click', function () {
    $('reset-ask').hidden = true;
    $('reset').hidden = false;
    $('reset').focus();
  });
  $('clear-example').addEventListener('click', function () { resetTrip(); });
  $('copy').addEventListener('click', function () {
    var st = $('status');
    if (!lastSummary) { st.textContent = 'Encara no hi ha cap resultat per copiar.'; return; }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = lastSummary; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      document.body.removeChild(ta);
      st.textContent = ok ? 'Resum copiat.' : 'No s\'ha pogut copiar.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastSummary).then(function () { st.textContent = 'Resum copiat.'; }, fallback);
    } else { fallback(); }
    setTimeout(function () { st.textContent = ''; }, 2500);
  });

  function resetTrip() {
    editingId = null;
    clearProofs();
    $('t-name').value = '';
    $('t-date').value = today();
    $('km').value = '';
    $('soc0').value = ''; $('soc1').value = '';
    $('charges').innerHTML = '';
    $('example').hidden = true;
    if ($('cons').dataset.example) {
      $('cons').value = ''; $('home').value = ''; $('loss').value = '';
      delete $('cons').dataset.example;
    }
    calc();
    $('km').focus();
  }

  /* ---------- Inici ---------- */
  var saved = load();
  if (saved) {
    $('home').value = saved.home || '';
    $('loss').value = saved.loss || '';
    $('cons').value = consFromPrefs(saved.cons, saved.unit);
    $('method').value = saved.method === 'bateria' ? 'bateria' : 'consum';
    $('cap').value = saved.cap || '';
  } else {
    // Primera visita: dades d'exemple perquè es vegi què fa l'eina.
    $('km').value = '420';
    $('cons').value = '168';
    $('cons').dataset.example = '1';
    $('home').value = '0,14';
    $('loss').value = '0';
    addRow({ name: 'Electrolinera (exemple)', kwh: '28', price: '0,45' });
    $('example').hidden = false;
  }
  $('t-date').value = today();
  applyMethodUI();
  calc();
  initStore();

  /* ---------- Historial ---------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmtDate(s) {
    var p = String(s || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(s || '');
  }
  function plain(n, d) {
    var k = Math.pow(10, d);
    return String(Math.round(n * k) / k).replace('.', ',');
  }
  function nn(x) { return (x == null || isNaN(x)) ? null : x; }

  function sortedTrips() {
    return trips.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  function updateSaveState() {
    var exampleOn = !$('example').hidden;
    var can = !!lastResult && !exampleOn && storeMode === 'db';
    $('save').disabled = !can;
    $('save-new').disabled = !can;
    $('save').textContent = editingId ? 'Actualitzar viatge' : 'Desar viatge';
    $('save-new').hidden = !editingId;
    var h = '';
    if (exampleOn) h = 'Esborra l\'exemple per poder desar un viatge.';
    else if (storeMode === 'loading') h = 'Carregant l\'historial…';
    else if (storeMode === 'out') h = 'Entra amb Google per poder desar el viatge.';
    else if (storeMode === 'unconfigured') h = 'El servei de dades no està disponible en aquesta instal·lació.';
    else if (storeMode === 'error') h = 'No hi ha connexió amb el servei de dades.';
    else if (!lastResult) h = 'Omple el viatge perquè es pugui desar.';
    else if (editingId) h = 'Estàs editant un viatge de l\'historial. Pots actualitzar-lo o desar-ne una còpia.';
    $('save-hint').textContent = h;
  }

  function buildTrip() {
    var r = lastResult;
    return {
      date: $('t-date').value || today(),
      name: $('t-name').value.trim(),
      km: r.km, cons100: r.consKwhKm * 100, pHome: r.pHome, loss: r.loss, imgCount: imgs.length,
      method: r.method, soc0: nn(r.soc0), soc1: nn(r.soc1), cap: nn(r.cap),
      charges: lastRows.filter(function (x) { return x.kwh > 0; }).map(function (x) {
        return { name: x.name, kwh: x.kwh, price: isNaN(x.price) ? null : x.price };
      }),
      energy: r.energy, homeKwh: r.homeWall, homeCost: r.homeCost,
      awayKwh: r.away, awayCost: r.awayCost,
      total: r.total, per100: r.total / r.km * 100,
      updatedAt: Date.now()
    };
  }

  function tripDoc(id) { return fb.doc(fb.db, 'users', uid, 'trips', id); }
  function persist(id, body) { return fb.setDoc(tripDoc(id), body); }
  function removeTrip(id) { return fb.deleteDoc(tripDoc(id)); }

  function saveTrip(asNew) {
    if (!lastResult) return;
    var st = $('save-status');
    if (imgsLoading) { st.textContent = 'Espera que es carreguin les imatges.'; return; }
    var id = (!asNew && editingId) ? editingId : newId();
    $('save').disabled = true; $('save-new').disabled = true;
    persist(id, buildTrip()).then(function () { return persistImages(id); }).then(function () {
      editingId = id;
      st.textContent = 'Viatge desat.';
    }, function (e) {
      st.textContent = e && e.code === 'permission-denied' ? 'Sense permís per desar. Revisa les regles de Firestore.' : 'No s\'ha pogut desar. Torna-ho a provar.';
    }).then(function () {
      updateSaveState();
      renderHistory();
      setTimeout(function () { st.textContent = ''; }, 3000);
    });
  }

  /* IMG-STORE-BEGIN */
  function imgCol(tripId) { return fb.collection(fb.db, 'users', uid, 'trips', tripId, 'images'); }
  function imgLoad(tripId) {
    return fb.getDocs(imgCol(tripId)).then(function (snap) {
      return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    });
  }
  function imgPut(tripId, im) { return fb.setDoc(fb.doc(imgCol(tripId), im.id), { data: im.data, name: im.name || '', addedAt: im.addedAt || Date.now() }); }
  function imgDel(tripId, id) { return fb.deleteDoc(fb.doc(imgCol(tripId), id)); }
  /* IMG-STORE-END */

  function deleteTripImages(id) {
    var t = trips.find(function (x) { return x.id === id; });
    if (storeMode !== 'db' || !t || !t.imgCount) return Promise.resolve();
    return imgLoad(id).then(function (list) {
      return list.reduce(function (p, d) { return p.then(function () { return imgDel(id, d.id); }); }, Promise.resolve());
    });
  }

  function persistImages(id) {
    var same = id === imgsOwner;
    var jobs = [];
    imgs.forEach(function (im) { if (!same || !im.saved) jobs.push(function () { return imgPut(id, im); }); });
    if (same) imgsRemoved.forEach(function (rid) { jobs.push(function () { return imgDel(id, rid); }); });
    return jobs.reduce(function (p, j) { return p.then(j); }, Promise.resolve()).then(function () {
      imgs.forEach(function (im) { im.saved = true; });
      imgsRemoved = [];
      imgsOwner = id;
    });
  }

  function clearProofs() {
    imgs = []; imgsRemoved = []; imgsOwner = null; imgsLoading = false; proofConfirm = null;
    renderProofs();
    updateProofUI();
  }

  function canAddImages() { return storeMode === 'db' && imgs.length < MAX_IMGS; }

  function updateProofUI() {
    var ok = storeMode === 'db';
    $('proof-add').disabled = !canAddImages();
    $('proof-empty').hidden = imgs.length > 0;
    var h;
    if (!ok) h = storeMode === 'out' ? 'Entra amb Google per poder afegir i desar imatges.' : storeMode === 'loading' ? '' : 'Les imatges necessiten el servei de dades.';
    else if (imgs.length >= MAX_IMGS) h = 'Has arribat al màxim de ' + MAX_IMGS + ' imatges per viatge.';
    else h = 'Màxim ' + MAX_IMGS + '. També les pots arrossegar o enganxar (Ctrl+V).';
    $('proof-hint').textContent = h;
  }

  function renderProofs() {
    var box = $('proofs');
    box.innerHTML = '';
    imgs.forEach(function (im, i) {
      var item = document.createElement('div');
      item.className = 'proof';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'thumb';
      b.setAttribute('data-act', 'view'); b.setAttribute('data-i', String(i));
      b.setAttribute('aria-label', 'Ampliar la imatge ' + (i + 1) + (im.name ? ' (' + im.name + ')' : ''));
      var img = document.createElement('img');
      img.src = im.data; img.alt = '';
      b.appendChild(img);
      item.appendChild(b);
      if (proofConfirm === im.id) {
        var ask = document.createElement('div');
        ask.className = 'proof-ask';
        var q = document.createElement('span'); q.textContent = 'Treure-la?';
        var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'danger'; yes.textContent = 'Sí, treure';
        yes.setAttribute('data-act', 'rm-yes'); yes.setAttribute('data-id', im.id);
        var no = document.createElement('button'); no.type = 'button'; no.textContent = 'Cancel·lar';
        no.setAttribute('data-act', 'rm-no');
        ask.appendChild(q); ask.appendChild(yes); ask.appendChild(no);
        item.appendChild(ask);
      } else {
        var rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'link'; rm.textContent = 'Treure';
        rm.setAttribute('data-act', 'rm'); rm.setAttribute('data-id', im.id);
        rm.setAttribute('aria-label', 'Treure la imatge ' + (i + 1));
        item.appendChild(rm);
      }
      box.appendChild(item);
    });
    var f = proofConfirm ? box.querySelector('[data-act="rm-no"]') : null;
    if (f) f.focus();
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight));
        var w = Math.max(1, Math.round(im.naturalWidth * scale)), h = Math.max(1, Math.round(im.naturalHeight * scale));
        var q = 0.8;
        for (var k = 0; k < 10; k++) {
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var cx = c.getContext('2d');
          cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h);
          cx.drawImage(im, 0, 0, w, h);
          var out = c.toDataURL('image/jpeg', q);
          if (out.length <= MAX_IMG_CHARS) { resolve(out); return; }
          if (q > 0.5) q -= 0.1; else { w = Math.round(w * 0.85); h = Math.round(h * 0.85); }
        }
        reject(new Error('too_big'));
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      im.src = url;
    });
  }

  function addFiles(list) {
    var st = $('proof-status');
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    if (storeMode !== 'db') { st.textContent = 'Entra amb Google per poder afegir imatges.'; return; }
    var notImg = files.filter(function (f) { return !/^image\//.test(f.type); }).length;
    files = files.filter(function (f) { return /^image\//.test(f.type); });
    var room = MAX_IMGS - imgs.length;
    var cut = files.length > room;
    files = files.slice(0, Math.max(0, room));
    st.textContent = files.length ? 'Preparant les imatges…' : '';
    var msgs = [];
    files.reduce(function (p, f) {
      return p.then(function () {
        return compressImage(f).then(function (data) {
          imgs.push({ id: newId(), data: data, name: f.name || '', addedAt: Date.now(), saved: false });
        }, function () { msgs.push('No s\'ha pogut llegir ' + (f.name || 'una imatge') + '.'); });
      });
    }, Promise.resolve()).then(function () {
      if (notImg) msgs.push('Només s\'accepten imatges.');
      if (cut) msgs.push('Màxim ' + MAX_IMGS + ' imatges per viatge.');
      st.textContent = msgs.join(' ');
      renderProofs(); updateProofUI();
      setTimeout(function () { if (st.textContent === msgs.join(' ')) st.textContent = ''; }, 6000);
    });
  }

  function openLightbox(i) {
    var im = imgs[i];
    if (!im) return;
    $('lb-img').src = im.data;
    $('lightbox').hidden = false;
    $('lb-close').focus();
  }
  function closeLightbox() { $('lightbox').hidden = true; $('lb-img').removeAttribute('src'); }
  $('lb-close').addEventListener('click', closeLightbox);
  $('lightbox').addEventListener('click', function (e) { if (e.target === $('lightbox')) closeLightbox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('lightbox').hidden) closeLightbox(); });

  $('proof-add').addEventListener('click', function () { $('proof-file').click(); });
  $('proof-file').addEventListener('change', function () { addFiles($('proof-file').files); $('proof-file').value = ''; });
  $('proofs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    var id = b.getAttribute('data-id');
    if (act === 'view') openLightbox(Number(b.getAttribute('data-i')));
    else if (act === 'rm') { proofConfirm = id; renderProofs(); }
    else if (act === 'rm-no') { proofConfirm = null; renderProofs(); }
    else if (act === 'rm-yes') {
      var k = imgs.findIndex(function (x) { return x.id === id; });
      if (k > -1) {
        if (imgs[k].saved && imgsOwner) imgsRemoved.push(id);
        imgs.splice(k, 1);
      }
      proofConfirm = null;
      renderProofs(); updateProofUI();
    }
  });
  var pblock = $('proof-block');
  ['dragenter', 'dragover'].forEach(function (ev) {
    pblock.addEventListener(ev, function (e) { e.preventDefault(); if (canAddImages()) pblock.classList.add('dropping'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    pblock.addEventListener(ev, function (e) { e.preventDefault(); pblock.classList.remove('dropping'); });
  });
  pblock.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.files) ? e.clipboardData.files : [];
    if (items.length) addFiles(items);
  });

  function openTrip(t) {
    $('km').value = plain(t.km, 1);
    $('method').value = t.method === 'bateria' ? 'bateria' : 'consum';
    $('soc0').value = t.soc0 == null ? '' : plain(t.soc0, 1);
    $('soc1').value = t.soc1 == null ? '' : plain(t.soc1, 1);
    if (t.cap > 0) $('cap').value = plain(t.cap, 1);
    if (t.method !== 'bateria') $('cons').value = plain(t.cons100 * 10, 1);
    applyMethodUI();
    delete $('cons').dataset.example;
    $('home').value = plain(t.pHome, 4);
    $('loss').value = plain(t.loss || 0, 1);
    $('charges').innerHTML = '';
    (t.charges || []).forEach(function (c) {
      addRow({ name: c.name, kwh: plain(c.kwh, 2), price: c.price == null ? '' : plain(c.price, 4) });
    });
    $('t-name').value = t.name || '';
    $('t-date').value = t.date || today();
    $('example').hidden = true;
    editingId = t.id;
    clearProofs();
    imgsOwner = t.id;
    if (t.imgCount > 0 && storeMode === 'db') {
      var want = t.id;
      imgsLoading = true;
      imgLoad(want).then(function (list) {
        if (imgsOwner !== want) return;
        imgs = list.sort(function (a, b) { return (a.addedAt || 0) - (b.addedAt || 0); }).map(function (d) {
          return { id: d.id, data: d.data, name: d.name || '', addedAt: d.addedAt || 0, saved: true };
        });
      }, function () {
        if (imgsOwner === want) $('proof-status').textContent = 'No s\'han pogut carregar les imatges.';
      }).then(function () {
        if (imgsOwner !== want) return;
        imgsLoading = false; renderProofs(); updateProofUI();
      });
    }
    calc();
    renderHistory();
    window.scrollTo(0, 0);
  }

  /* Text pas a pas que copia el botó «Copiar resum». */
  function summaryText(d) {
    function g(n, m) { return Number(n).toLocaleString('ca-ES', { maximumFractionDigits: m }); }
    var ch = d.charges || [];
    var bat = d.method === 'bateria' && d.soc0 != null && d.soc1 != null && d.cap > 0;
    var net = bat ? (d.soc0 - d.soc1) / 100 * d.cap : 0;
    var homeBat = bat ? Math.max(0, net) : Math.max(0, d.energy - d.awayKwh);
    var n = 0;
    var t = '';
    if (bat) {
      t += (++n) + '. Bateria: de ' + g(d.soc0, 1) + ' % a ' + g(d.soc1, 1) + ' % amb ' + g(d.cap, 1) + ' kWh de capacitat = ' + g(net, 2) + ' kWh per recuperar a casa.\n';
      t += (++n) + '. Energia total gastada: ' + g(net, 2) + ' kWh + ' + g(d.awayKwh, 2) + ' kWh carregats fora = ' + g(d.energy, 2) + ' kWh (' + g(d.energy / d.km * 1000, 0) + ' Wh/km).\n';
    } else {
      t += (++n) + '. Energia gastada: ' + g(d.km, 1) + ' km × ' + g(d.cons100 * 10, 1) + ' Wh/km = ' + g(d.energy, 2) + ' kWh.\n';
    }
    if (ch.length) {
      t += (++n) + '. Càrregues fora de casa, ' + g(d.awayKwh, 2) + ' kWh en total:\n';
      ch.forEach(function (c) {
        t += '   * ' + (c.name ? c.name + ': ' : '') + g(c.kwh, 2) + ' kWh' +
          (c.price != null ? ' × ' + g(c.price, 4) + ' €/kWh = ' + eur(c.kwh * c.price) : ' (sense preu, no es compta al cost)') + '\n';
      });
      t += '   Cost de fora: ' + eur(d.awayCost) + '.\n';
    } else {
      t += (++n) + '. No hi ha càrregues fora de casa.\n';
    }
    var lossTxt = d.loss > 0 ? '. Amb un ' + g(d.loss, 1) + ' % de pèrdues, el comptador de casa marca ' + g(d.homeKwh, 2) + ' kWh' : '';
    if (bat) {
      if (net < 0) t += (++n) + '. Has arribat amb més bateria de la que tenies en sortir, per això a casa es compten 0 kWh.\n';
      else t += (++n) + '. Energia de casa: ' + g(homeBat, 2) + ' kWh, el que cal per tornar al ' + g(d.soc0, 1) + ' %' + lossTxt + '.\n';
    } else if (d.awayKwh > d.energy) {
      t += (++n) + '. Has carregat fora més kWh dels que has gastat, per això a casa es compten 0 kWh.\n';
    } else {
      t += (++n) + '. Energia de casa: ' + g(d.energy, 2) + ' − ' + g(d.awayKwh, 2) + ' = ' + g(homeBat, 2) + ' kWh' + lossTxt + '.\n';
    }
    t += (++n) + '. Cost de casa: ' + g(d.homeKwh, 2) + ' kWh × ' + g(d.pHome, 4) + ' €/kWh = ' + eur(d.homeCost) + '.\n';
    t += (n + 1) + '. Total: ' + eur(d.homeCost) + ' + ' + eur(d.awayCost) + ' = ' + eur(d.total) + '. Dividit entre ' + g(d.km, 1) + ' km, són ' + eur(d.per100) + ' cada 100 km.';
    return t;
  }

  /* Llocs de càrrega ja fets: el nom ofereix el darrer preu que hi vas posar. */
  var placePrice = {};
  function refreshPlaces() {
    placePrice = {};
    var opts = '';
    sortedTrips().forEach(function (t) {
      (t.charges || []).forEach(function (c) {
        var n = (c.name || '').trim();
        if (n && c.price != null && !(n in placePrice)) {
          placePrice[n] = c.price;
          opts += '<option value="' + esc(n) + '" label="' + esc(plain(c.price, 4) + ' €/kWh') + '"></option>';
        }
      });
    });
    $('places').innerHTML = opts;
  }
  $('charges').addEventListener('change', function (e) {
    if (!e.target.classList.contains('r-name')) return;
    var n = e.target.value.trim();
    var priceEl = e.target.closest('.charge').querySelector('.r-price');
    if (n in placePrice && priceEl.value.trim() === '') {
      priceEl.value = plain(placePrice[n], 4);
      calc();
    }
  });

  function renderHistory() {
    refreshPlaces();
    updateProofUI();
    var list = $('hist-list');
    $('hist-mode').textContent = storeMode === 'db' ? 'Només tu el veus, des de qualsevol dispositiu.' : '';
    $('export').hidden = !(storeMode === 'db' && trips.length);
    if (storeMode !== 'db') {
      var msgs = {
        loading: 'Carregant l\'historial…',
        out: 'Entra amb Google per desar els viatges i veure\'ls des de qualsevol dispositiu.',
        unconfigured: 'L\'historial no està disponible en aquesta instal·lació.',
        error: 'No s\'ha pogut connectar amb el servei de dades. Torna-ho a provar més tard.'
      };
      $('hist-summary').innerHTML = '';
      list.innerHTML = '<p class="empty">' + esc(msgs[storeMode] || '') + '</p>';
      return;
    }
    var rows = sortedTrips();
    if (!rows.length) {
      $('hist-summary').innerHTML = '';
      list.innerHTML = '<p class="empty">Encara no has desat cap viatge. Calcula\'n un i prem «Desar viatge».</p>';
      return;
    }
    var km = 0, cost = 0;
    rows.forEach(function (t) { km += t.km || 0; cost += t.total || 0; });
    $('hist-summary').innerHTML =
      '<div><dt>Viatges</dt><dd>' + rows.length + '</dd></div>' +
      '<div><dt>Quilòmetres</dt><dd>' + fmt(km, 0) + ' km</dd></div>' +
      '<div><dt>Cost total</dt><dd>' + eur(cost) + '</dd></div>' +
      '<div><dt>Mitjana</dt><dd>' + (km > 0 ? eur(cost / km * 100) : '—') + ' /100 km</dd></div>';

    var html = '<table><thead><tr><th>Data</th><th>Viatge</th><th class="n">km</th>' +
      '<th class="n">Casa</th><th class="n">Fora</th><th class="n">Total</th><th class="n">€/100 km</th><th></th></tr></thead><tbody>';
    rows.forEach(function (t) {
      var confirming = confirmId === t.id;
      html += '<tr' + (t.id === editingId ? ' class="active"' : '') + '>' +
        '<td>' + esc(fmtDate(t.date)) + '</td>' +
        '<td class="nm">' + (t.name ? esc(t.name) : '<span class="hint">Sense nom</span>') + (t.imgCount ? ' <span class="hint">· ' + t.imgCount + (t.imgCount === 1 ? ' imatge' : ' imatges') + '</span>' : '') + '</td>' +
        '<td class="n">' + fmt(t.km || 0, 0) + '</td>' +
        '<td class="n"><span class="swatch home" aria-hidden="true"></span>' + eur(t.homeCost || 0) + '</td>' +
        '<td class="n"><span class="swatch away" aria-hidden="true"></span>' + eur(t.awayCost || 0) + '</td>' +
        '<td class="n"><b>' + eur(t.total || 0) + '</b></td>' +
        '<td class="n">' + eur(t.per100 || 0) + '</td>' +
        '<td class="acts">' + (confirming
          ? '<span class="ask">Esborrar aquest viatge? No es pot desfer.</span><button type="button" class="danger" data-act="del-yes" data-id="' + esc(t.id) + '">Sí, esborrar</button><button type="button" data-act="del-no" data-id="' + esc(t.id) + '">Cancel·lar</button>'
          : '<button type="button" data-act="open" data-id="' + esc(t.id) + '">Obrir</button><button type="button" data-act="detail" data-id="' + esc(t.id) + '" aria-expanded="' + (detailId === t.id) + '">Detall</button><button type="button" class="link" data-act="del" data-id="' + esc(t.id) + '" aria-label="Esborrar el viatge del ' + esc(fmtDate(t.date)) + '">Esborrar</button>') +
        '</td></tr>' +
        (detailId === t.id
          ? '<tr class="detail"><td colspan="8"><pre class="detail-text">' + esc(summaryText(t)) + '</pre></td></tr>'
          : '');
    });
    list.innerHTML = html + '</tbody></table>';
    var firstNo = confirmId ? list.querySelector('[data-act="del-no"]') : null;
    if (firstNo) firstNo.focus();
  }

  $('hist-list').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var id = b.getAttribute('data-id');
    var act = b.getAttribute('data-act');
    var t = trips.find(function (x) { return x.id === id; });
    if (act === 'open' && t) { openTrip(t); }
    else if (act === 'detail') { detailId = detailId === id ? null : id; renderHistory(); }
    else if (act === 'del') { confirmId = id; renderHistory(); }
    else if (act === 'del-no') { confirmId = null; renderHistory(); }
    else if (act === 'del-yes') {
      confirmId = null;
      if (editingId === id) { editingId = null; updateSaveState(); }
      var gone = id;
      deleteTripImages(gone).then(function () { return removeTrip(gone); }).then(function () {
        if (imgsOwner === gone) clearProofs();
      }, function () { $('hist-status').textContent = 'No s\'ha pogut esborrar.'; });
    }
  });
  $('save').addEventListener('click', function () { saveTrip(false); });
  $('save-new').addEventListener('click', function () { saveTrip(true); });

  function csvNum(n, d) { return (n == null || isNaN(n)) ? '' : Number(n).toFixed(d).replace('.', ','); }
  function csvText(s) {
    s = String(s || '');
    if (/^[=+\-@]/.test(s)) s = '\'' + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $('export').addEventListener('click', function () {
    var st = $('hist-status');
    var lines = [['data', 'viatge', 'km', 'consum_kWh_100km', 'energia_kWh', 'casa_kWh', 'preu_casa_eur_kWh', 'casa_eur', 'fora_kWh', 'fora_eur', 'total_eur', 'eur_100km'].join(';')];
    sortedTrips().forEach(function (t) {
      lines.push([t.date, csvText(t.name), csvNum(t.km, 1), csvNum(t.cons100, 1), csvNum(t.energy, 1),
        csvNum(t.homeKwh, 1), csvNum(t.pHome, 4), csvNum(t.homeCost, 2), csvNum(t.awayKwh, 1),
        csvNum(t.awayCost, 2), csvNum(t.total, 2), csvNum(t.per100, 2)].join(';'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'historial-viatges.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    st.textContent = 'Fitxer baixat.';
    setTimeout(function () { st.textContent = ''; }, 3000);
  });

  /* ---------- Sessió i dades (Firebase) ---------- */
  var FB_VERSION = '10.14.1';

  function refresh() { renderHistory(); updateSaveState(); }

  function setAuthUI(user) {
    $('login').hidden = !!user;
    $('user').hidden = !user;
    if (user) {
      $('uname').textContent = user.displayName || user.email || '';
      $('avatar').src = user.photoURL || '';
      $('avatar').hidden = !user.photoURL;
    }
  }

  function prefsDoc() { return fb.doc(fb.db, 'users', uid, 'prefs', 'main'); }
  function pushPrefs() {
    if (!fb || !uid) return;
    clearTimeout(prefTimer);
    prefTimer = setTimeout(function () {
      fb.setDoc(prefsDoc(), { home: $('home').value, loss: $('loss').value, unit: 'wh', cons: $('cons').value, method: $('method').value, cap: $('cap').value }).catch(function () {});
    }, 700);
  }
  function loadPrefs() {
    fb.getDoc(prefsDoc()).then(function (snap) {
      if (!snap.exists()) { if ($('home').value.trim() && $('example').hidden) pushPrefs(); return; }
      var p = snap.data();
      if (!$('example').hidden) {
        // Dispositiu nou: fora l'exemple, ara hi ha les teves dades.
        $('example').hidden = true;
        $('km').value = '';
        $('charges').innerHTML = '';
        delete $('cons').dataset.example;
      }
      $('home').value = p.home || '';
      $('loss').value = p.loss || '';
      $('cons').value = consFromPrefs(p.cons, p.unit);
      $('method').value = p.method === 'bateria' ? 'bateria' : 'consum';
      $('cap').value = p.cap || '';
      applyMethodUI();
      calc();
    }).catch(function () {});
  }

  function onUser(user) {
    if (unsubTrips) { unsubTrips(); unsubTrips = null; }
    uid = user ? user.uid : null;
    setAuthUI(user);
    trips = []; editingId = null; detailId = null; confirmId = null;
    clearProofs();
    if (!user) { storeMode = 'out'; refresh(); return; }
    storeMode = 'loading';
    refresh();
    unsubTrips = fb.onSnapshot(fb.collection(fb.db, 'users', uid, 'trips'), function (snap) {
      trips = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      storeMode = 'db';
      refresh();
    }, function () { storeMode = 'error'; refresh(); });
    loadPrefs();
  }

  function hist(msg, ms) {
    $('hist-status').textContent = msg;
    setTimeout(function () { $('hist-status').textContent = ''; }, ms || 5000);
  }
  $('login').addEventListener('click', function () {
    if (!fb) return;
    fb.signIn().catch(function (e) {
      var c = e && e.code;
      if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
      hist(c === 'auth/popup-blocked'
        ? 'El navegador ha bloquejat la finestra d\'inici de sessió. Permet-la i torna-ho a provar.'
        : c === 'auth/unauthorized-domain'
          ? 'Aquest domini no està autoritzat per iniciar la sessió.'
          : 'No s\'ha pogut iniciar la sessió.');
    });
  });
  $('logout').addEventListener('click', function () { if (fb) fb.signOut(fb.auth); });

  function initStore() {
    import(new URL('firebase-config.js', document.baseURI).href).then(function (m) { return m.firebaseConfig; }, function () { return null; }).then(function (cfg) {
      if (!cfg || !cfg.apiKey || /^PEGA/.test(cfg.apiKey)) {
        storeMode = 'unconfigured'; setAuthUI(null); $('login').hidden = true; refresh(); return;
      }
      var base = 'https://www.gstatic.com/firebasejs/' + FB_VERSION + '/';
      var loads = [import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')];
      if (cfg.appCheckSiteKey) loads.push(import(base + 'firebase-app-check.js'));
      return Promise.all(loads).then(function (mods) {
        var App = mods[0], Au = mods[1], Fs = mods[2], Ac = mods[3];
        var app = App.initializeApp(cfg);
        // App Check: Firestore i Auth només accepten peticions d'aquesta web (Fraud Defense / reCAPTCHA Enterprise).
        if (Ac) Ac.initializeAppCheck(app, { provider: new Ac.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
        var auth = Au.getAuth(app);
        fb = {
          auth: auth, db: Fs.getFirestore(app),
          doc: Fs.doc, collection: Fs.collection, setDoc: Fs.setDoc, deleteDoc: Fs.deleteDoc,
          getDoc: Fs.getDoc, getDocs: Fs.getDocs, onSnapshot: Fs.onSnapshot, signOut: Au.signOut,
          signIn: function () { return Au.signInWithPopup(auth, new Au.GoogleAuthProvider()); }
        };
        Au.onAuthStateChanged(auth, onUser, function () { storeMode = 'error'; refresh(); });
      });
    }).catch(function () { storeMode = 'error'; refresh(); });
  }
})();

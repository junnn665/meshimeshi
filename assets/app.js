(function () {
  'use strict';

  var CATEGORIES = [
    { id: 'all', label: 'すべて', color: '#2B2118' },
    { id: 'deka', label: 'デカ盛り', color: '#C2410C' },
    { id: 'wadai', label: '話題・行列', color: '#B91C1C' },
    { id: 'shinten', label: '新店', color: '#3F6212' },
    { id: 'chain', label: 'チェーン新作', color: '#1D4ED8' },
    { id: 'conbini', label: 'コンビニ', color: '#86198F' },
    { id: 'yasuuma', label: '安うま', color: '#A16207' }
  ];
  var CAT = {};
  CATEGORIES.forEach(function (c) { CAT[c.id] = c; });

  // エリア（愛知には名古屋も含める）
  var AREAS = [
    { id: 'all', label: '全エリア', match: null },
    { id: 'nagoya', label: '名古屋', match: ['名古屋'] },
    { id: 'aichi', label: '愛知', match: ['愛知', '名古屋'] },
    { id: 'gifu', label: '岐阜', match: ['岐阜'] },
    { id: 'mie', label: '三重', match: ['三重'] }
  ];
  var AREA = {};
  AREAS.forEach(function (a) { AREA[a.id] = a; });

  // 線画アイコン
  var ICONS = {
    all: '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M9 8c0-1.5 1-2 1-3.5M14 8c0-1.5 1-2 1-3.5"/>',
    deka: '<path d="M3 13h18a9 9 0 0 1-18 0z"/><path d="M6 13c0-4.5 2.7-8 6-8s6 3.5 6 8"/><path d="M10 9.5h.01M14 8.5h.01M12.5 11h.01"/>',
    wadai: '<path d="M12 3c.8 3.6 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2.6 1.4-3.8 2-5.7.9 1 1.6 1.7 2.6 2C11.9 7.6 11.2 5.3 12 3z"/>',
    shinten: '<path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>',
    chain: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M19 3v3M17.5 4.5h3"/>',
    conbini: '<path d="M12 4C10 4 4 13.5 4 17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3c0-3.5-6-13-8-13z"/><path d="M9 15h6v5H9z"/>',
    yasuuma: '<circle cx="12" cy="12" r="9"/><path d="M9 7l3 4 3-4M12 11v6M9 12.5h6M9 15h6"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'
  };
  function svg(id, cls) {
    var s = document.createElement('span');
    s.className = cls || 'tab-icon';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[id] + '</svg>';
    return s;
  }
  var icon = function (id) { return svg(id, 'tab-icon'); };

  // ブラウザ保存（使えない環境でも動くように）
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても続ける */ } }
  };
  function sessionGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* noop */ } }

  // NEWマーク：前回見た時刻（同じ訪問中はリロードしても変えない）
  var prevVisit = (function () {
    var s = sessionGet('meshi.prevVisit');
    if (s !== null) return s ? Number(s) : 0;
    var last = store.get('meshi.lastVisit', 0) || 0;
    sessionSet('meshi.prevVisit', String(last));
    store.set('meshi.lastVisit', Date.now());
    return last;
  })();

  var PAGE_SIZE = 24;
  var state = {
    items: [],
    tab: 'all', area: store.get('meshi.area', 'all'), query: '', saved: false,
    shown: PAGE_SIZE,
    savedItems: store.get('meshi.saved', [])
  };
  if (!AREA[state.area]) state.area = 'all';
  if (!Array.isArray(state.savedItems)) state.savedItems = [];

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  var hash = location.hash.replace('#', '');
  if (CAT[hash]) state.tab = hash;
  if (hash === 'saved') state.saved = true;

  function relTime(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var diff = (Date.now() - t) / 1000;
    if (diff < 60) return 'たった今';
    if (diff < 3600) return Math.floor(diff / 60) + '分前';
    if (diff < 86400) return Math.floor(diff / 3600) + '時間前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + '日前';
    var d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function isNew(it) {
    return prevVisit > 0 && it.added && Date.parse(it.added) > prevVisit;
  }

  // ---------- 行きたい保存 ----------
  function isSaved(id) {
    return state.savedItems.some(function (s) { return s.id === id; });
  }
  function toggleSaved(it) {
    if (isSaved(it.id)) {
      state.savedItems = state.savedItems.filter(function (s) { return s.id !== it.id; });
    } else {
      state.savedItems.unshift({
        id: it.id, title: it.title, link: it.link, source: it.source, image: it.image,
        category: it.category, genre: it.genre, area: it.area, published: it.published,
        savedAt: new Date().toISOString()
      });
    }
    store.set('meshi.saved', state.savedItems);
    updateSavedButton();
  }

  // ---------- 絞り込み ----------
  function norm(s) {
    return (s || '').normalize('NFKC').toLowerCase();
  }
  function baseList() {
    var list = state.saved ? state.savedItems : state.items;
    var area = AREA[state.area];
    if (area.match) {
      list = list.filter(function (it) { return area.match.indexOf(it.area) >= 0; });
    }
    var words = norm(state.query).split(/\s+/).filter(Boolean);
    if (words.length) {
      list = list.filter(function (it) {
        var hay = norm([it.title, it.source, it.area, (CAT[it.category] || {}).label].join(' '));
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
    }
    return list;
  }
  function filtered() {
    var list = baseList();
    if (state.tab === 'all') return list;
    return list.filter(function (it) { return it.category === state.tab; });
  }

  // ---------- カテゴリ札 ----------
  var countEls = {};
  function buildTabs() {
    var nav = $('tabs');
    nav.textContent = '';
    CATEGORIES.forEach(function (c) {
      var b = el('button', 'tab');
      b.type = 'button';
      b.dataset.id = c.id;
      b.style.setProperty('--cat', c.color);
      b.setAttribute('aria-pressed', String(state.tab === c.id));
      b.appendChild(icon(c.id));
      var lab = el('span', 'tab-label');
      lab.setAttribute('aria-label', c.label);
      Array.prototype.forEach.call(c.label, function (ch) {
        var s = el('span', ch === 'ー' ? 'ch chouon' : 'ch', ch);
        s.setAttribute('aria-hidden', 'true');
        lab.appendChild(s);
      });
      b.appendChild(lab);
      countEls[c.id] = b.appendChild(el('span', 'count', ''));
      b.addEventListener('click', function () {
        state.tab = c.id;
        state.shown = PAGE_SIZE;
        syncHash();
        Array.prototype.forEach.call(nav.children, function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        renderList();
        centerActive(true);
      });
      nav.appendChild(b);
    });
  }
  function updateCounts() {
    var list = baseList();
    var ready = state.items.length || state.saved;
    CATEGORIES.forEach(function (c) {
      var n = c.id === 'all' ? list.length
        : list.filter(function (it) { return it.category === c.id; }).length;
      countEls[c.id].textContent = ready ? String(n) : '';
    });
  }
  function centerActive(smooth) {
    var nav = $('tabs');
    var act = nav.querySelector('[aria-pressed="true"]');
    if (!act || nav.scrollWidth <= nav.clientWidth) return;
    var left = act.offsetLeft - (nav.clientWidth - act.offsetWidth) / 2;
    nav.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' });
  }
  function syncHash() {
    var h = state.saved ? '#saved' : (state.tab === 'all' ? '' : '#' + state.tab);
    history.replaceState(null, '', location.pathname + location.search + h);
  }

  // ---------- 道具（検索・エリア・行きたい） ----------
  function buildTools() {
    var group = $('areas');
    AREAS.forEach(function (a) {
      var b = el('button', 'area', a.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.area === a.id));
      b.addEventListener('click', function () {
        state.area = a.id;
        store.set('meshi.area', a.id);
        state.shown = PAGE_SIZE;
        Array.prototype.forEach.call(group.children, function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        refreshView();
      });
      group.appendChild(b);
    });

    var q = $('q');
    var timer = null;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.query = q.value.trim();
        state.shown = PAGE_SIZE;
        refreshView();
      }, 150);
    });
    $('search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      q.blur(); // スマホのキーボードを閉じる
    });

    var sb = $('saved-toggle');
    sb.insertBefore(svg('heart', 'heart'), sb.firstChild);
    sb.addEventListener('click', function () {
      state.saved = !state.saved;
      state.shown = PAGE_SIZE;
      syncHash();
      refreshView();
    });
    updateSavedButton();
  }
  function updateSavedButton() {
    var sb = $('saved-toggle');
    if (!sb) return; // ガチャのページにはない
    sb.setAttribute('aria-pressed', String(state.saved));
    $('saved-count').textContent = String(state.savedItems.length);
  }

  // ---------- 写真 ----------
  function photo(it, cat, big) {
    var box = el('span', 'photo');
    var fallback = function () {
      box.textContent = '';
      box.classList.add('no-photo');
      box.style.setProperty('--cat', cat.color);
      var tag = el('span', 'photo-fallback');
      tag.appendChild(icon(it.category in ICONS ? it.category : 'all'));
      tag.appendChild(el('span', 'fb-label', cat.label));
      tag.appendChild(el('span', 'fb-source', it.source || ''));
      box.appendChild(tag);
    };
    if (it.image) {
      var img = document.createElement('img');
      img.alt = '';
      if (!big) img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      var relay = 'https://wsrv.nl/?url=' + encodeURIComponent(it.image) +
        (big ? '&w=1200&h=680' : '&w=720&h=400') + '&fit=cover&a=attention&output=webp';
      var tried = false;
      img.addEventListener('error', function () {
        if (!tried) { tried = true; img.src = relay; }
        else fallback();
      });
      img.addEventListener('load', function () {
        if (img.naturalWidth < 40) fallback();
      });
      if (/^http:/.test(it.image)) { tried = true; img.src = relay; }
      else img.src = it.image;
      box.appendChild(img);
    } else {
      fallback();
    }
    return box;
  }

  function saveButton(it) {
    var b = el('button', 'save-btn');
    b.type = 'button';
    b.appendChild(svg('heart', 'heart'));
    var sync = function () {
      var on = isSaved(it.id);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? '行きたいから外す' : '行きたいに保存');
    };
    sync();
    b.addEventListener('click', function (e) {
      e.preventDefault();
      toggleSaved(it);
      sync();
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      // 行きたい一覧で外したら、その場で一覧から消す
      if (state.saved && !isSaved(it.id)) refreshView();
      // 日替わりと一覧で同じ記事のボタンをそろえる
      document.querySelectorAll('.save-btn[data-id="' + it.id + '"]').forEach(function (x) {
        if (x !== b) x.setAttribute('aria-pressed', String(isSaved(it.id)));
      });
    });
    b.dataset.id = it.id;
    return b;
  }

  // ---------- カード ----------
  function card(it) {
    // ガチャで保存したお店はジャンル名を札にする
    var cat = CAT[it.category] || { label: it.genre || 'お店', color: '#B42318' };
    var art = el('article', 'card');
    var a = el('a', 'card-link');
    a.href = it.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(photo(it, cat, false));
    // 写真の上に重ねる（写真が差し替わっても消えないようにカード側に置く）
    if (isNew(it)) a.appendChild(el('span', 'new-badge', 'NEW'));

    var body = el('span', 'card-body');
    var meta = el('span', 'meta');
    var chip = el('span', 'chip', cat.label);
    chip.style.background = cat.color;
    meta.appendChild(chip);
    var when = [it.area, relTime(it.published)].filter(Boolean).join(' ・ ');
    meta.appendChild(el('span', 'when', when));
    body.appendChild(meta);
    body.appendChild(el('span', 'title', it.title));
    body.appendChild(el('span', 'source', '出典：' + (it.source || '不明')));
    a.appendChild(body);
    art.appendChild(a);
    art.appendChild(saveButton(it));
    return art;
  }

  // ---------- 飯ガチャ（ホットペッパーのお店から選ぶ） ----------
  var BUDGETS = [
    { id: 'any', label: 'こだわらない', codes: null },
    { id: '1000', label: '〜1000円', codes: ['B009', 'B010'] },
    { id: '2000', label: '〜2000円', codes: ['B009', 'B010', 'B011', 'B001'] },
    { id: '3000', label: '〜3000円', codes: ['B009', 'B010', 'B011', 'B001', 'B002'] },
    { id: 'over', label: '3000円〜', codes: 'over' }
  ];
  var CHEAP = ['B009', 'B010', 'B011', 'B001', 'B002'];
  var CAP_COLORS = ['#C2410C', '#1D4ED8', '#3F6212', '#86198F', '#A16207', '#B91C1C', '#0E7490', '#9D174D', '#4D7C0F', '#7C2D12', '#5B21B6'];

  var gacha = {
    meta: null,
    shops: {},          // エリアごとに読み込んだお店
    area: store.get('meshi.gArea2', 'nagoya'),
    genre: store.get('meshi.gGenre2', 'all'),
    budget: store.get('meshi.gBudget', 'any'),
    lastId: null,
    busy: false,
    pool: []
  };

  function areaFiles(id) {
    return id === 'all' ? ['aichi', 'gifu', 'mie'] : [id];
  }
  function loadShops(id) {
    var files = areaFiles(id);
    return Promise.all(files.map(function (f) {
      if (gacha.shops[f]) return gacha.shops[f];
      return fetch('data/shops/' + f + '.json?d=' + encodeURIComponent(gacha.meta.updated))
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (list) { gacha.shops[f] = list; return list; });
    })).then(function (lists) {
      var seen = {};
      var out = [];
      lists.forEach(function (l) {
        l.forEach(function (sh) { if (!seen[sh.id]) { seen[sh.id] = 1; out.push(sh); } });
      });
      return out;
    });
  }

  function matchBudget(sh) {
    var b = BUDGETS.filter(function (x) { return x.id === gacha.budget; })[0] || BUDGETS[0];
    if (!b.codes) return true;
    if (!sh.budget_code) return false;
    if (b.codes === 'over') return CHEAP.indexOf(sh.budget_code) < 0;
    return b.codes.indexOf(sh.budget_code) >= 0;
  }

  function pills(boxId, list, current, onPick) {
    var box = $(boxId);
    box.textContent = '';
    list.forEach(function (x) {
      var b = el('button', 'g-pill', x.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(current === x.id));
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(box.children, function (y) {
          y.setAttribute('aria-pressed', String(y === b));
        });
        onPick(x.id);
        updatePool();
      });
      box.appendChild(b);
    });
  }

  var poolSeq = 0;
  function updatePool() {
    var btn = $('g-spin');
    if (!gacha.meta) return;
    var seq = ++poolSeq;
    $('g-pool').textContent = 'お店を読み込み中…';
    btn.disabled = true;
    loadShops(gacha.area).then(function (list) {
      if (seq !== poolSeq) return;
      gacha.pool = list.filter(function (sh) {
        return (gacha.genre === 'all' || sh.genre === gacha.genre) && matchBudget(sh);
      });
      var n = gacha.pool.length;
      $('g-pool').textContent = n
        ? 'お店 ' + n + ' 軒から1軒選びます'
        : 'この条件のお店が見つかりませんでした。ジャンルか予算を変えてみてください。';
      btn.disabled = !n || gacha.busy;
    }).catch(function () {
      if (seq !== poolSeq) return;
      $('g-pool').textContent = 'お店を読み込めませんでした。少し時間をおいてお試しください。';
    });
  }

  function pickOne(pool) {
    var cands = pool.length > 1 ? pool.filter(function (sh) { return sh.id !== gacha.lastId; }) : pool;
    // 写真があるお店を少し出やすくする
    var weights = cands.map(function (sh) { return sh.photo ? 2 : 1; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < cands.length; i++) {
      r -= weights[i];
      if (r < 0) return cands[i];
    }
    return cands[cands.length - 1];
  }

  function genreColor(name) {
    var i = gacha.meta ? gacha.meta.genres.indexOf(name) : -1;
    return CAP_COLORS[(i < 0 ? 0 : i) % CAP_COLORS.length];
  }

  // 保存・表示用に、お店を記事と同じ形にそろえる
  function shopAsItem(sh) {
    var m = /(?:都|道|府|県)(.+?[市区町村郡])/.exec(sh.address || '');
    return {
      id: 'hp_' + sh.id, title: sh.name, link: sh.url, source: 'ホットペッパーグルメ',
      image: sh.photo || null, category: 'shop', genre: sh.genre,
      area: m ? m[1] : '', published: new Date().toISOString()
    };
  }

  function infoRow(label, text) {
    var row = el('span', 'g-info-row');
    row.appendChild(el('span', 'g-info-label', label));
    row.appendChild(el('span', 'g-info-text', text));
    return row;
  }

  function showResult(sh) {
    var color = genreColor(sh.genre);
    var item = shopAsItem(sh);
    var box = $('g-result');
    box.textContent = '';
    var head = el('p', 'g-hit');
    var chip = el('span', 'g-hit-chip', sh.genre);
    head.appendChild(chip);
    head.appendChild(document.createTextNode('のお店が出ました！'));
    box.appendChild(head);

    var art = el('article', 'g-card');
    var a = el('a', 'g-link');
    a.href = sh.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(photo(item, { label: sh.genre, color: color }, true));
    var body = el('span', 'g-card-body');
    if (sh.catch) body.appendChild(el('span', 'g-catch', sh.catch));
    body.appendChild(el('span', 'g-title', sh.name));
    var info = el('span', 'g-info');
    if (sh.budget) info.appendChild(infoRow('予算', sh.budget));
    if (sh.access) info.appendChild(infoRow('アクセス', sh.access));
    if (sh.open) info.appendChild(infoRow('営業', sh.open));
    body.appendChild(info);
    body.appendChild(el('span', 'g-cta', 'ホットペッパーで詳しく見る →'));
    a.appendChild(body);
    art.appendChild(a);
    art.appendChild(saveButton(item));
    box.appendChild(art);

    var actions = el('div', 'g-actions');
    var map = el('a', 'g-map', '地図で見る');
    map.href = 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(sh.name + ' ' + (sh.address || ''));
    map.target = '_blank';
    map.rel = 'noopener';
    actions.appendChild(map);
    var again = el('button', 'g-again', 'もう1回まわす');
    again.type = 'button';
    again.addEventListener('click', spin);
    actions.appendChild(again);
    box.appendChild(actions);

    $('machine').hidden = true;
    box.hidden = false;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  }

  function spin() {
    var pool = gacha.pool;
    if (gacha.busy || !pool.length) return;
    var sh = pickOne(pool);
    gacha.lastId = sh.id;
    gacha.busy = true;
    $('g-spin').disabled = true;

    var m = $('machine');
    var drop = $('drop');
    $('g-result').hidden = true;
    m.hidden = false;
    drop.style.setProperty('--c', genreColor(sh.genre));
    m.classList.remove('spinning', 'dropping', 'opening');

    var stage = document.querySelector('.gacha-stage');
    var r = stage.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* noop */ }
    var finish = function () {
      gacha.busy = false;
      m.classList.remove('spinning', 'dropping', 'opening');
      showResult(sh);
      $('g-spin').disabled = !gacha.pool.length;
    };
    if (reduce) { finish(); return; }

    void m.offsetWidth;
    m.classList.add('spinning');                                      // ハンドルが回る
    setTimeout(function () { m.classList.add('dropping'); }, 1000);  // カプセルが出る
    setTimeout(function () { m.classList.add('opening'); }, 1800);   // カプセルが開く
    setTimeout(finish, 2350);
  }

  function buildGacha() {
    $('g-spin').addEventListener('click', spin);
    $('g-spin').disabled = true;
    $('g-pool').textContent = 'お店データを読み込み中…';
    fetch('data/shops/meta.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (meta) {
        gacha.meta = meta;
        var areas = meta.areas.map(function (a) { return { id: a.id, label: a.label }; });
        areas.push({ id: 'all', label: '東海ぜんぶ' });
        if (!areas.some(function (a) { return a.id === gacha.area; })) gacha.area = areas[0].id;
        var genres = [{ id: 'all', label: 'おまかせ' }].concat(meta.genres.map(function (g) { return { id: g, label: g }; }));
        if (!genres.some(function (g) { return g.id === gacha.genre; })) gacha.genre = 'all';
        if (!BUDGETS.some(function (b) { return b.id === gacha.budget; })) gacha.budget = 'any';
        pills('g-area', areas, gacha.area, function (id) { gacha.area = id; store.set('meshi.gArea2', id); });
        pills('g-genre', genres, gacha.genre, function (id) { gacha.genre = id; store.set('meshi.gGenre2', id); });
        pills('g-budget', BUDGETS, gacha.budget, function (id) { gacha.budget = id; store.set('meshi.gBudget', id); });
        updatePool();
      })
      .catch(function () {
        $('gacha').classList.add('not-ready');
        $('g-pool').textContent = 'お店データを準備中です。もうしばらくお待ちください。';
      });
  }

  // ---------- 一覧 ----------
  function headingText() {
    var parts = [];
    if (state.area !== 'all') parts.push(AREA[state.area].label);
    if (state.tab !== 'all') parts.push(CAT[state.tab].label);
    var scope = parts.join('・');
    if (state.saved) return scope ? '行きたい（' + scope + '）' : '行きたいリスト';
    if (state.query) return '「' + state.query + '」の検索結果' + (scope ? '（' + scope + '）' : '');
    return scope ? scope + 'のニュース' : 'すべてのニュース';
  }

  function renderList() {
    var list = filtered();
    var grid = $('grid');
    grid.textContent = '';
    var frag = document.createDocumentFragment();
    list.slice(0, state.shown).forEach(function (it) { frag.appendChild(card(it)); });
    grid.appendChild(frag);
    $('more').hidden = list.length <= state.shown;
    $('heading').textContent = headingText();

    var newCount = state.saved ? 0 : list.filter(isNew).length;
    $('new-count').hidden = !newCount;
    $('new-count').textContent = 'NEW ' + newCount + '件';

    var msg = '';
    if (state.saved && !state.savedItems.length) {
      msg = 'まだ「行きたい」はありません。気になる記事のハートを押すと、ここに集まります。';
    } else if ((state.items.length || state.saved) && !list.length) {
      msg = state.query ? '「' + state.query + '」に合う記事は見つかりませんでした。'
        : '条件に合うニュースはまだありません。';
    }
    if (msg || state.items.length || state.saved) $('status').textContent = msg;
  }

  function refreshView() {
    updateSavedButton();
    updateCounts();
    renderList();
  }

  function renderTicker() {
    var top = state.items[0];
    var fresh = top && (Date.now() - Date.parse(top.published)) < 6 * 3600 * 1000;
    $('ticker').hidden = !fresh;
    if (fresh) {
      $('ticker-text').textContent = top.title;
      $('ticker-text').href = top.link;
    }
  }

  function load() {
    var btn = $('refresh');
    btn.disabled = true;
    return fetch('data/news.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (data) {
        state.items = (data.items || []).slice().sort(function (a, b) {
          return Date.parse(b.published) - Date.parse(a.published);
        });
        if (!state.items.length) {
          $('status').textContent = 'まだニュースがありません。次の自動更新をお待ちください。';
        }
        if (data.updated) {
          var d = new Date(data.updated);
          $('updated').textContent = '最終更新：' + d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        }
        renderTicker();
        refreshView();
        centerActive(false);
      })
      .catch(function () {
        $('status').textContent = 'ニュースを読み込めませんでした。時間をおいて「最新に更新」を押してください。';
      })
      .then(function () { btn.disabled = false; });
  }

  // トップページ（記事一覧）
  if ($('grid')) {
    $('refresh').addEventListener('click', load);
    $('more').addEventListener('click', function () {
      state.shown += PAGE_SIZE;
      renderList();
    });
    buildTabs();
    buildTools();
    load();
  }
  // ガチャのページ
  if ($('gacha')) buildGacha();
})();

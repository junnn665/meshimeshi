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
        category: it.category, area: it.area, published: it.published, savedAt: new Date().toISOString()
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
    var cat = CAT[it.category] || CAT.wadai;
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

  // ---------- 飯ガチャ ----------
  var gacha = {
    area: store.get('meshi.gArea', 'all'),
    genre: store.get('meshi.gGenre', 'all'),
    lastId: null,
    busy: false
  };
  if (!AREA[gacha.area]) gacha.area = 'all';
  if (!CAT[gacha.genre]) gacha.genre = 'all';

  function gachaPool() {
    var area = AREA[gacha.area];
    return state.items.filter(function (it) {
      if (area.match && area.match.indexOf(it.area) < 0) return false;
      if (gacha.genre !== 'all' && it.category !== gacha.genre) return false;
      return true;
    });
  }

  function pills(boxId, list, current, onPick) {
    var box = $(boxId);
    box.textContent = '';
    list.forEach(function (x) {
      var b = el('button', 'g-pill', x.id === 'all' && boxId === 'g-genre' ? 'おまかせ' : x.label);
      b.type = 'button';
      if (x.color && x.id !== 'all') b.style.setProperty('--cat', x.color);
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

  function updatePool() {
    var n = gachaPool().length;
    var btn = $('g-spin');
    if (!state.items.length) {
      $('g-pool').textContent = 'ニュースを読み込み中…';
      btn.disabled = true;
    } else if (!n) {
      $('g-pool').textContent = 'この組み合わせの記事はまだありません。条件を変えてみてください。';
      btn.disabled = true;
    } else {
      $('g-pool').textContent = '候補 ' + n + ' 件から1つ選びます';
      btn.disabled = gacha.busy;
    }
  }

  // 新しい記事・写真付きの記事を少し出やすくする
  function pickOne(pool) {
    var now = Date.now();
    var weights = pool.map(function (it) {
      var days = (now - Date.parse(it.published)) / 86400000;
      var w = days < 3 ? 3 : days < 7 ? 2 : 1;
      if (it.image) w *= 2;
      if (it.id === gacha.lastId && pool.length > 1) w = 0; // 同じ記事が連続しない
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function showResult(it) {
    var cat = CAT[it.category] || CAT.wadai;
    var box = $('g-result');
    box.textContent = '';
    var head = el('p', 'g-hit');
    head.appendChild(el('span', 'g-hit-chip', cat.label));
    head.appendChild(document.createTextNode('が出ました！'));
    box.appendChild(head);

    var art = el('article', 'g-card');
    var a = el('a', 'g-link');
    a.href = it.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(photo(it, cat, true));
    var body = el('span', 'g-card-body');
    body.appendChild(el('span', 'when', [it.area, relTime(it.published)].filter(Boolean).join(' ・ ')));
    body.appendChild(el('span', 'g-title', it.title));
    body.appendChild(el('span', 'source', '出典：' + (it.source || '不明')));
    body.appendChild(el('span', 'g-cta', '記事を読む →'));
    a.appendChild(body);
    art.appendChild(a);
    art.appendChild(saveButton(it));
    box.appendChild(art);

    var again = el('button', 'g-again', 'もう1回まわす');
    again.type = 'button';
    again.addEventListener('click', spin);
    box.appendChild(again);

    $('machine').hidden = true;
    box.hidden = false;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  }

  function spin() {
    var pool = gachaPool();
    if (gacha.busy || !pool.length) return;
    var it = pickOne(pool);
    gacha.lastId = it.id;
    gacha.busy = true;
    updatePool();

    var m = $('machine');
    var drop = $('drop');
    $('g-result').hidden = true;
    m.hidden = false;
    drop.style.setProperty('--c', (CAT[it.category] || CAT.wadai).color);
    m.classList.remove('spinning', 'dropping', 'opening');

    // スマホでは機械が画面に見えるところまでスクロールする
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
      showResult(it);
      updatePool();
    };
    if (reduce) { finish(); return; }

    void m.offsetWidth;
    m.classList.add('spinning');                                      // ハンドルが回る
    setTimeout(function () { m.classList.add('dropping'); }, 1000);  // カプセルが出る
    setTimeout(function () { m.classList.add('opening'); }, 1800);   // カプセルが開く
    setTimeout(finish, 2350);
  }

  function buildGacha() {
    pills('g-area', AREAS, gacha.area, function (id) { gacha.area = id; store.set('meshi.gArea', id); });
    pills('g-genre', CATEGORIES, gacha.genre, function (id) { gacha.genre = id; store.set('meshi.gGenre', id); });
    $('g-spin').addEventListener('click', spin);
    updatePool();
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
        updatePool();
        refreshView();
        centerActive(false);
      })
      .catch(function () {
        $('status').textContent = 'ニュースを読み込めませんでした。時間をおいて「最新に更新」を押してください。';
      })
      .then(function () { btn.disabled = false; });
  }

  $('refresh').addEventListener('click', load);
  $('more').addEventListener('click', function () {
    state.shown += PAGE_SIZE;
    renderList();
  });

  buildTabs();
  buildTools();
  buildGacha();
  load();
})();

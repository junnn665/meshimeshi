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
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
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
  var RADII = [
    { id: '500', label: '500m', m: 500 },
    { id: '1000', label: '1km', m: 1000 },
    { id: '2000', label: '2km', m: 2000 },
    { id: '3000', label: '3km', m: 3000 }
  ];
  var CAP_COLORS = ['#C2410C', '#1D4ED8', '#3F6212', '#86198F', '#A16207', '#B91C1C', '#0E7490', '#9D174D', '#4D7C0F', '#7C2D12', '#5B21B6'];
  var NEWS_SHARE = 0.15; // 話題枠が出る確率（候補にあるとき）

  // ニュースのお店をジャンルに当てはめるための言葉
  var GENRE_WORDS = {
    'ラーメン': /ラーメン|らーめん|中華そば|つけ麺|まぜそば|油そば|担々麺|台湾/,
    '居酒屋': /居酒屋|酒場|大衆酒/,
    '和食': /寿司|すし|鮨|和食|定食|うどん|そば|きしめん|天ぷら|割烹|ひつまぶし|おむすび|おにぎり|干物/,
    '洋食': /洋食|オムライス|ハンバーグ|ナポリタン|喫茶|ステーキ/,
    'イタリアン': /イタリアン|パスタ|ピザ|フレンチ|ビストロ/,
    '中華': /中華|餃子|麻婆|飯店|チャーハン/,
    '焼肉': /焼肉|ホルモン/,
    '韓国料理': /韓国|サムギョプサル|チキン/,
    'エスニック': /タイ|インド|カレー|ベトナム|ネパール|エスニック|マーラー/,
    'お好み焼き': /お好み焼|たこ焼|もんじゃ/,
    'カフェ': /カフェ|喫茶|スイーツ|パン|ベーカリー|ドーナツ|かき氷|パフェ/
  };

  var gacha = {
    meta: null,
    shops: {},
    news: [],
    area: store.get('meshi.gArea2', 'nagoya'),
    genre: store.get('meshi.gGenre2', 'all'),
    budget: store.get('meshi.gBudget', 'any'),
    radius: store.get('meshi.gRadius', '1000'),
    lunch: !!store.get('meshi.gLunch', false),
    openNow: !!store.get('meshi.gOpen', false),
    mixNews: store.get('meshi.gNews', true) !== false,
    here: null,           // 現在地 {lat, lng}
    lastId: null,
    busy: false,
    pool: [],
    newsPool: []
  };
  if (!RADII.some(function (r) { return r.id === gacha.radius; })) gacha.radius = '1000';

  // ---- 営業時間の文章を読む（例: "月～金: 11:30～14:00 （L.O. 13:30）17:00～23:00 土、日: 11:00～22:00"）----
  var DAYS = '月火水木金土日';
  function expandDays(spec) {
    var out = {};
    spec.split(/[、,・]/).forEach(function (part) {
      part = part.trim();
      var m = /^([月火水木金土日])～([月火水木金土日])$/.exec(part);
      if (m) {
        var a = DAYS.indexOf(m[1]), b = DAYS.indexOf(m[2]);
        for (var i = 0; i < 7; i++) {
          var d = (a + i) % 7;
          out[d] = true;
          if (d === b) break;
        }
      } else if (part.length === 1 && DAYS.indexOf(part) >= 0) {
        out[DAYS.indexOf(part)] = true;
      }
    });
    return out;
  }
  // 曜日(0=月)ごとの営業時間 [[開始分, 終了分], ...] を返す。読めなければ null
  function parseHours(text) {
    if (!text) return null;
    var t = text.replace(/[（(][^）)]*[）)]/g, ' ')   // L.O. などの補足を消す
      .replace(/[〜~ー－-]/g, '～').replace(/：/g, ':').replace(/\s+/g, ' ');
    var re = /((?:(?:[月火水木金土日](?:～[月火水木金土日])?|祝日|祝前日|祝後日)[、,・]?\s*)+)\s*:\s*([^月火水木金土日祝]*)/g;
    var week = {};
    var found = false;
    var m;
    while ((m = re.exec(t))) {
      var days = expandDays(m[1]);
      var times = [];
      var tr = /(\d{1,2}):(\d{2})\s*～\s*(翌\s*)?(\d{1,2}):(\d{2})/g;
      var x;
      while ((x = tr.exec(m[2]))) {
        var s = +x[1] * 60 + +x[2];
        var e = +x[4] * 60 + +x[5];
        if (x[3] || e <= s) e += 1440; // 日をまたぐ
        times.push([s, e]);
      }
      if (!times.length) continue;
      found = true;
      Object.keys(days).forEach(function (d) { week[d] = (week[d] || []).concat(times); });
    }
    return found ? week : null;
  }
  function dayIndex(date) { return (date.getDay() + 6) % 7; } // 月=0
  // true: 営業中 / false: 営業時間外 / null: わからない
  function isOpenNow(sh, now) {
    var week = sh._hours !== undefined ? sh._hours : (sh._hours = parseHours(sh.open));
    if (!week) return null;
    now = now || new Date();
    var d = dayIndex(now);
    var min = now.getHours() * 60 + now.getMinutes();
    var today = week[d] || [];
    var yest = week[(d + 6) % 7] || [];
    return today.some(function (r) { return min >= r[0] && min < r[1]; }) ||
      yest.some(function (r) { return r[1] > 1440 && min + 1440 >= r[0] && min + 1440 < r[1]; });
  }
  function hasLunch(sh) {
    if (sh.lunch) return true;
    var week = sh._hours !== undefined ? sh._hours : (sh._hours = parseHours(sh.open));
    if (!week) return false;
    // どこかの曜日で 11:30〜13:30 ごろに開いていればランチありとみなす
    return Object.keys(week).some(function (d) {
      return week[d].some(function (r) { return r[0] <= 12 * 60 && r[1] >= 13 * 60; });
    });
  }

  // ---- 距離 ----
  function distance(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDistance(m) {
    return m < 1000 ? '約' + (Math.round(m / 10) * 10) + 'm' : '約' + (m / 1000).toFixed(1) + 'km';
  }

  // ---- お店データの読み込み ----
  function areaFiles(id) {
    if (id === 'near') return ['nagoya', 'aichi', 'gifu', 'mie'];
    return id === 'all' ? ['aichi', 'gifu', 'mie'] : [id];
  }
  function loadShops(id) {
    return Promise.all(areaFiles(id).map(function (f) {
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

  // 全国の「現在地から」：Cloudflare の中継（assets/config.js の nearbyApi）で周辺のお店を検索
  var NEARBY_API = ((window.MESHI_CONFIG || {}).nearbyApi || '').replace(/\/+$/, '');
  var nearbyCache = {};
  function loadNearby() {
    var radius = gacha.radius;
    var genre = gacha.genre === 'all' ? '' : gacha.genre;
    var q = 'lat=' + gacha.here.lat.toFixed(4) + '&lng=' + gacha.here.lng.toFixed(4) +
      '&range=' + radius + (genre ? '&genre=' + encodeURIComponent(genre) : '');
    if (nearbyCache[q]) return Promise.resolve(nearbyCache[q]);
    return fetch(NEARBY_API + '/nearby?' + q)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { nearbyCache[q] = data.shops || []; return nearbyCache[q]; });
  }

  function matchBudget(sh) {
    var b = BUDGETS.filter(function (x) { return x.id === gacha.budget; })[0] || BUDGETS[0];
    if (!b.codes) return true;
    if (!sh.budget_code) return false;
    if (b.codes === 'over') return CHEAP.indexOf(sh.budget_code) < 0;
    return b.codes.indexOf(sh.budget_code) >= 0;
  }

  // ニュースで話題のお店（話題枠）
  function newsCandidates() {
    if (!gacha.mixNews || gacha.area === 'near' || gacha.budget !== 'any' || gacha.lunch || gacha.openNow) return [];
    var area = { nagoya: ['名古屋'], aichi: ['愛知', '名古屋'], gifu: ['岐阜'], mie: ['三重'], all: ['名古屋', '愛知', '岐阜', '三重'] }[gacha.area] || [];
    return gacha.news.filter(function (it) {
      if (!it.shop || !it.shop_name || area.indexOf(it.area) < 0) return false;
      if (gacha.genre === 'all') return true;
      var re = GENRE_WORDS[gacha.genre];
      return re ? re.test(it.title) : false;
    });
  }

  function pills(boxId, list, current, onPick, multi) {
    var box = $(boxId);
    box.textContent = '';
    list.forEach(function (x) {
      var b = el('button', 'g-pill' + (x.cls ? ' ' + x.cls : ''));
      b.type = 'button';
      if (x.icon) b.appendChild(svg(x.icon, 'g-pill-icon'));
      b.appendChild(document.createTextNode(x.label));
      b.setAttribute('aria-pressed', String(multi ? !!x.on : current === x.id));
      b.addEventListener('click', function () {
        if (multi) {
          var on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on));
          onPick(x.id, on);
        } else {
          Array.prototype.forEach.call(box.children, function (y) {
            y.setAttribute('aria-pressed', String(y === b));
          });
          onPick(x.id);
        }
        updatePool();
      });
      box.appendChild(b);
    });
  }

  function setNearUI() {
    var near = gacha.area === 'near';
    $('g-near').hidden = !near;
  }

  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
    });
  }

  var poolSeq = 0;
  function updatePool() {
    var btn = $('g-spin');
    if (!gacha.meta) return;
    setNearUI();
    var seq = ++poolSeq;
    btn.disabled = true;
    var needHere = gacha.area === 'near' && !gacha.here;
    $('g-pool').textContent = needHere ? '現在地を確認しています…' : 'お店を読み込み中…';
    var hereP = needHere ? locate().then(function (h) { gacha.here = h; }) : Promise.resolve();
    hereP.then(function () {
      if (gacha.area === 'near' && NEARBY_API) {
        // 中継が使えないときは、手元の東海のお店データで代わりに探す
        return loadNearby().catch(function () { return loadShops('near'); });
      }
      return loadShops(gacha.area);
    }).then(function (list) {
      if (seq !== poolSeq) return;
      var radius = (RADII.filter(function (r) { return r.id === gacha.radius; })[0] || RADII[1]).m;
      var now = new Date();
      gacha.pool = list.filter(function (sh) {
        if (gacha.genre !== 'all' && sh.genre !== gacha.genre) return false;
        if (!matchBudget(sh)) return false;
        if (gacha.lunch && !hasLunch(sh)) return false;
        if (gacha.openNow && isOpenNow(sh, now) !== true) return false;
        if (gacha.area === 'near') {
          if (sh.lat == null || sh.lng == null) return false;
          sh._dist = distance(gacha.here, { lat: +sh.lat, lng: +sh.lng });
          if (sh._dist > radius) return false;
        }
        return true;
      });
      gacha.newsPool = newsCandidates();
      var n = gacha.pool.length, k = gacha.newsPool.length;
      var msg;
      // 中継が未設定のあいだ「現在地から」は東海のお店データだけで探すので、東海の外ではそう伝える
      var outside = gacha.area === 'near' && !NEARBY_API && gacha.here &&
        !(gacha.here.lat > 33.7 && gacha.here.lat < 36.5 && gacha.here.lng > 135.8 && gacha.here.lng < 138.9);
      if (!n && !k && outside) {
        msg = '「現在地から」は今のところ東海エリア（愛知・岐阜・三重）のみ対応です。エリアを選んで回してください。';
      } else if (!n && !k) {
        msg = gacha.area === 'near'
          ? '近くにこの条件のお店が見つかりませんでした。距離を広げるか条件を変えてみてください。'
          : 'この条件のお店が見つかりませんでした。条件を変えてみてください。';
      } else {
        msg = 'お店 ' + n + ' 軒' + (k ? '＋話題枠 ' + k + ' 軒' : '') + 'から1軒選びます';
        if (gacha.area === 'near') msg = '現在地から' + (RADII.filter(function (r) { return r.id === gacha.radius; })[0].label) + '以内の' + msg;
      }
      $('g-pool').textContent = msg;
      btn.disabled = (!n && !k) || gacha.busy;
    }).catch(function (err) {
      if (seq !== poolSeq) return;
      if (gacha.area === 'near' && !gacha.here) {
        var code = err && err.code;
        $('g-pool').textContent = code === 1
          ? '位置情報の利用が許可されていません。ブラウザの設定で許可するか、エリアを選んでください。'
          : '現在地を取得できませんでした。電波のよい場所でもう一度試すか、エリアを選んでください。';
      } else {
        $('g-pool').textContent = 'お店を読み込めませんでした。少し時間をおいてお試しください。';
      }
    });
  }

  function weightedPick(list, weightFn) {
    var cands = list.length > 1 ? list.filter(function (x) { return x.id !== gacha.lastId; }) : list;
    var weights = cands.map(weightFn);
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < cands.length; i++) {
      r -= weights[i];
      if (r < 0) return cands[i];
    }
    return cands[cands.length - 1];
  }
  function pickOne() {
    var useNews = gacha.newsPool.length && (!gacha.pool.length || Math.random() < NEWS_SHARE);
    if (useNews) return { news: weightedPick(gacha.newsPool, function (it) { return it.image ? 2 : 1; }) };
    return { shop: weightedPick(gacha.pool, function (sh) { return sh.photo ? 2 : 1; }) };
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

  // ---- シェア ----
  var GACHA_URL = new URL('gacha.html', location.href).href.split('?')[0].split('#')[0];
  function shareBox(name, sub, url) {
    var text = '今日は「' + name + '」に決めた！' + (sub ? '（' + sub + '）' : '') + '\n飯ガチャで決めました';
    var full = text + '\n' + url + '\n' + GACHA_URL;
    var wrap = el('div', 'g-share');
    wrap.appendChild(el('span', 'g-share-label', 'シェア'));
    var line = el('a', 'g-share-btn line', 'LINE');
    line.href = 'https://line.me/R/share?text=' + encodeURIComponent(full);
    line.target = '_blank';
    line.rel = 'noopener';
    var x = el('a', 'g-share-btn x', 'X');
    x.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text + '\n' + url) +
      '&url=' + encodeURIComponent(GACHA_URL) + '&hashtags=' + encodeURIComponent('飯ガチャ');
    x.target = '_blank';
    x.rel = 'noopener';
    wrap.appendChild(line);
    wrap.appendChild(x);
    var more = el('button', 'g-share-btn more', navigator.share ? 'ほかのアプリ' : 'コピー');
    more.type = 'button';
    more.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: '飯ガチャ', text: text, url: url }).catch(function () { /* キャンセル */ });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(full).then(function () {
          more.textContent = 'コピーしました';
          setTimeout(function () { more.textContent = 'コピー'; }, 1800);
        });
      }
    });
    wrap.appendChild(more);
    return wrap;
  }

  // ---- 履歴 ----
  var HISTORY_MAX = 30;
  function getHistory() {
    var h = store.get('meshi.gHistory', []);
    return Array.isArray(h) ? h : [];
  }
  function addHistory(entry) {
    var h = getHistory().filter(function (x) { return x.id !== entry.id; });
    h.unshift(entry);
    store.set('meshi.gHistory', h.slice(0, HISTORY_MAX));
    renderHistory();
  }
  function renderHistory() {
    var box = $('g-history');
    if (!box) return;
    var h = getHistory();
    var list = $('g-history-list');
    list.textContent = '';
    $('g-history-empty').hidden = h.length > 0;
    $('g-history-clear').hidden = !h.length;
    h.forEach(function (x) {
      var li = el('li', 'gh-item');
      var a = el('a', 'gh-link');
      a.href = x.url;
      a.target = '_blank';
      a.rel = 'noopener';
      var th = el('span', 'gh-thumb');
      th.style.setProperty('--c', x.color || '#2B2118');
      if (x.photo) {
        var img = document.createElement('img');
        img.src = x.photo; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { img.remove(); });
        th.appendChild(img);
      }
      a.appendChild(th);
      var tx = el('span', 'gh-text');
      tx.appendChild(el('span', 'gh-name', x.name));
      tx.appendChild(el('span', 'gh-meta', [x.genre, x.area, relTime(x.at)].filter(Boolean).join(' ・ ')));
      a.appendChild(tx);
      if (x.news) a.appendChild(el('span', 'gh-badge', '話題枠'));
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  // ---- 結果の表示 ----
  function showShop(sh) {
    var color = genreColor(sh.genre);
    var item = shopAsItem(sh);
    var box = $('g-result');
    box.textContent = '';
    var head = el('p', 'g-hit');
    head.appendChild(el('span', 'g-hit-chip', sh.genre));
    head.appendChild(document.createTextNode('のお店が出ました！'));
    box.appendChild(head);

    var art = el('article', 'g-card');
    var a = el('a', 'g-link');
    a.href = sh.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(photo(item, { label: sh.genre, color: color }, true));
    var body = el('span', 'g-card-body');
    var badges = el('span', 'g-badges');
    if (sh._dist != null && gacha.area === 'near') badges.appendChild(el('span', 'g-badge dist', 'ここから' + fmtDistance(sh._dist)));
    var open = isOpenNow(sh);
    if (open === true) badges.appendChild(el('span', 'g-badge open', '営業中（たぶん）'));
    else if (open === false) badges.appendChild(el('span', 'g-badge closed', '今は営業時間外かも'));
    if (hasLunch(sh)) badges.appendChild(el('span', 'g-badge', 'ランチあり'));
    if (badges.children.length) body.appendChild(badges);
    if (sh.catch) body.appendChild(el('span', 'g-catch', sh.catch));
    body.appendChild(el('span', 'g-title', sh.name));
    var info = el('span', 'g-info');
    if (sh.budget) info.appendChild(infoRow('予算', sh.budget));
    if (sh.access) info.appendChild(infoRow('アクセス', sh.access));
    if (sh.open) info.appendChild(infoRow('営業', sh.open));
    if (sh.close) info.appendChild(infoRow('定休日', sh.close));
    body.appendChild(info);
    body.appendChild(el('span', 'g-cta', 'ホットペッパーで詳しく見る →'));
    a.appendChild(body);
    art.appendChild(a);
    art.appendChild(saveButton(item));
    box.appendChild(art);

    var mapQ = sh.lat && sh.lng ? sh.name + ' ' + (sh.address || '') : sh.name;
    finishResult(box, 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapQ),
      shareBox(sh.name, sh.genre + (item.area ? '・' + item.area : ''), sh.url));
    addHistory({ id: item.id, name: sh.name, url: sh.url, photo: sh.photo, genre: sh.genre, area: item.area, color: color, at: new Date().toISOString() });
  }

  function showNews(it) {
    var cat = CAT[it.category] || CAT.wadai;
    var box = $('g-result');
    box.textContent = '';
    var head = el('p', 'g-hit');
    head.appendChild(el('span', 'g-hit-chip hot', '話題枠'));
    head.appendChild(document.createTextNode('ニュースのお店が出ました！'));
    box.appendChild(head);

    var art = el('article', 'g-card');
    var a = el('a', 'g-link');
    a.href = it.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(photo(it, cat, true));
    var body = el('span', 'g-card-body');
    var badges = el('span', 'g-badges');
    badges.appendChild(el('span', 'g-badge hot', 'ニュースで話題'));
    badges.appendChild(el('span', 'g-badge', [it.area, relTime(it.published)].filter(Boolean).join(' ・ ')));
    body.appendChild(badges);
    body.appendChild(el('span', 'g-title', it.shop_name));
    body.appendChild(el('span', 'g-news-title', it.title));
    body.appendChild(el('span', 'source', '出典：' + (it.source || '不明')));
    body.appendChild(el('span', 'g-cta', '記事を読む →'));
    a.appendChild(body);
    art.appendChild(a);
    art.appendChild(saveButton(it));
    box.appendChild(art);

    finishResult(box, 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(it.shop_name + ' ' + (it.area || '')),
      shareBox(it.shop_name, it.area, it.link));
    addHistory({ id: it.id, name: it.shop_name, url: it.link, photo: it.image, genre: '話題のお店', area: it.area, color: cat.color, news: true, at: new Date().toISOString() });
  }

  function finishResult(box, mapUrl, share) {
    var actions = el('div', 'g-actions');
    var map = el('a', 'g-map', '地図で見る');
    map.href = mapUrl;
    map.target = '_blank';
    map.rel = 'noopener';
    actions.appendChild(map);
    var again = el('button', 'g-again', 'もう1回まわす');
    again.type = 'button';
    again.addEventListener('click', spin);
    actions.appendChild(again);
    box.appendChild(actions);
    box.appendChild(share);
    $('machine').hidden = true;
    box.hidden = false;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  }

  function spin() {
    if (gacha.busy || (!gacha.pool.length && !gacha.newsPool.length)) return;
    var pick = pickOne();
    var color = pick.shop ? genreColor(pick.shop.genre) : '#FFC93C';
    gacha.lastId = (pick.shop || pick.news).id;
    gacha.busy = true;
    $('g-spin').disabled = true;

    var m = $('machine');
    var drop = $('drop');
    $('g-result').hidden = true;
    m.hidden = false;
    drop.style.setProperty('--c', color);
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
      if (pick.shop) showShop(pick.shop); else showNews(pick.news);
      $('g-spin').disabled = !gacha.pool.length && !gacha.newsPool.length;
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
    $('g-history-clear').addEventListener('click', function () {
      store.set('meshi.gHistory', []);
      renderHistory();
    });
    renderHistory();

    // 話題枠用にニュースも読む（失敗しても続ける）
    var newsP = fetch('data/news.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (d) { gacha.news = d.items || []; })
      .catch(function () { gacha.news = []; });

    var metaP = fetch('data/shops/meta.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });

    Promise.all([metaP, newsP]).then(function (res) {
      var meta = res[0];
      gacha.meta = meta;
      var areas = meta.areas.map(function (a) { return { id: a.id, label: a.label }; });
      areas.push({ id: 'all', label: '東海ぜんぶ' });
      if (navigator.geolocation) areas.unshift({ id: 'near', label: '現在地から', icon: 'pin', cls: 'near' });
      if (!areas.some(function (a) { return a.id === gacha.area; })) gacha.area = 'nagoya';
      var genres = [{ id: 'all', label: 'おまかせ' }].concat(meta.genres.map(function (g) { return { id: g, label: g }; }));
      if (!genres.some(function (g) { return g.id === gacha.genre; })) gacha.genre = 'all';
      if (!BUDGETS.some(function (b) { return b.id === gacha.budget; })) gacha.budget = 'any';
      pills('g-area', areas, gacha.area, function (id) {
        gacha.area = id;
        // 現在地は毎回取り直す
        if (id === 'near') gacha.here = null;
        store.set('meshi.gArea2', id);
      });
      pills('g-radius', RADII, gacha.radius, function (id) { gacha.radius = id; store.set('meshi.gRadius', id); });
      pills('g-genre', genres, gacha.genre, function (id) { gacha.genre = id; store.set('meshi.gGenre2', id); });
      pills('g-budget', BUDGETS, gacha.budget, function (id) { gacha.budget = id; store.set('meshi.gBudget', id); });
      pills('g-opts', [
        { id: 'lunch', label: 'ランチあり', on: gacha.lunch },
        { id: 'open', label: '今営業中', on: gacha.openNow },
        { id: 'news', label: '話題枠をまぜる', on: gacha.mixNews }
      ], null, function (id, on) {
        if (id === 'lunch') { gacha.lunch = on; store.set('meshi.gLunch', on); }
        if (id === 'open') { gacha.openNow = on; store.set('meshi.gOpen', on); }
        if (id === 'news') { gacha.mixNews = on; store.set('meshi.gNews', on); }
      }, true);
      updatePool();
    }).catch(function () {
      $('gacha').classList.add('not-ready');
      $('g-pool').textContent = 'お店データを準備中です。もうしばらくお待ちください。';
    });
  }

  // テスト用に営業時間の読み取りを外から使えるようにする
  window.__meshiHours = { parseHours: parseHours, isOpenNow: isOpenNow, hasLunch: hasLunch };

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

  // ---------- 更新ボタンの演出：炊きたてごはんをよそう ----------
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function reduceMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  var toastTimer = null;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.hidden = true; }, 300); }, 3200);
  }
  function serveRefresh() {
    var btn = $('refresh');
    if (btn.disabled) return;
    var before = {};
    state.items.forEach(function (it) { before[it.id] = 1; });
    var quiet = reduceMotion();
    var ov = $('serve');
    btn.classList.add('cooking');
    if (!quiet) {
      $('serve-text').innerHTML = '炊きたてのニュースを<br>よそっています…';
      ov.className = 'serve';
      ov.hidden = false;
      void ov.offsetWidth;
      ov.classList.add('open');                 // どんぶりが出てきて、ごはんが盛られる
    }
    var minTime = quiet ? Promise.resolve() : wait(1400);
    Promise.all([load({ animate: true }), minTime]).then(function (res) {
      var ok = res[0];
      var fresh = state.items.filter(function (it) { return !before[it.id]; }).length;
      var finish = function () {
        btn.classList.remove('cooking');
        if (!ok) return;
        renderListServed();
        toast(fresh ? 'ほかほかの新着 ' + fresh + ' 件、盛りました！' : 'できたての最新ニュースです（新着はありません）');
      };
      if (quiet) { finish(); return; }
      $('serve-text').textContent = ok ? (fresh ? '新着 ' + fresh + ' 件、できたて！' : 'できたてです！') : 'うまく炊けませんでした…';
      ov.classList.add(ok ? 'done' : 'fail');   // 梅干しがのって「できたて！」
      wait(ok ? 900 : 1300).then(function () {
        ov.classList.add('close');
        return wait(320);
      }).then(function () {
        ov.hidden = true;
        ov.className = 'serve';
        finish();
      });
    });
  }
  // 記事を上から順に「盛り付け」るように出す
  function renderListServed() {
    var grid = $('grid');
    Array.prototype.forEach.call(grid.children, function (c, i) {
      if (i < 12) {
        c.style.setProperty('--i', i);
        c.classList.add('served');
      }
    });
    var top = $('heading').getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight) $('heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function load(opts) {
    opts = opts || {};
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
        return true;
      })
      .catch(function () {
        $('status').textContent = 'ニュースを読み込めませんでした。時間をおいて「最新に更新」を押してください。';
        return false;
      })
      .then(function (ok) { btn.disabled = false; return ok; });
  }

  // トップページ（記事一覧）
  if ($('grid')) {
    $('refresh').addEventListener('click', serveRefresh);
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

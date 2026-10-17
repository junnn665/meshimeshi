(function () {
  'use strict';

  var CATEGORIES = [
    { id: 'all', label: 'すべて', color: '#2B2118' },
    { id: 'deka', label: 'デカ盛り', color: '#C2410C' },
    { id: 'wadai', label: '話題・行列', color: '#B91C1C' },
    { id: 'shinten', label: '新店', color: '#3F6212' },
    { id: 'chain', label: 'チェーン新作', color: '#1D4ED8' },
    { id: 'conbini', label: 'コンビニ', color: '#86198F' },
    { id: 'yasuuma', label: '安うま', color: '#A16207' },
    { id: 'event', label: 'イベント', color: '#0E7490' }
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
    event: '<path d="M3 20L12 4l9 16z"/><path d="M12 4v-1.5M12 2.5l4 1.5-4 1.5"/><path d="M9.5 20l2.5-5 2.5 5"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 0 4 0"/><path d="M12 3v0"/>'
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

  // ---- ごはんイベントの日付 ----
  var WD = '日月火水木金土';
  function todayJst() {
    var d = new Date(Date.now() + 9 * 3600000);
    return d.toISOString().slice(0, 10);
  }
  function fmtDay(iso) {
    var d = new Date(iso + 'T00:00:00+09:00');
    return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WD.charAt(d.getDay()) + '）';
  }
  function eventRange(it) {
    if (it.start && it.end && it.start !== it.end) return fmtDay(it.start) + '〜' + fmtDay(it.end);
    if (it.start) return fmtDay(it.start);
    if (it.end) return fmtDay(it.end) + 'まで';
    return '日程は記事で確認';
  }
  function dayDiff(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
  // 'now' 開催中 / 'soon' これから / 'past' 終了 / 'unknown' 日程不明
  function eventStatus(it) {
    var t = todayJst();
    if (it.end && it.end < t) return { id: 'past', label: '終了' };
    if (it.start && it.start > t) {
      var n = dayDiff(t, it.start);
      return { id: 'soon', label: n === 1 ? '明日から' : 'あと' + n + '日' };
    }
    if (it.start || it.end) {
      var left = it.end ? dayDiff(t, it.end) : null;
      return { id: 'now', label: left === 0 ? '今日まで' : '開催中' };
    }
    return { id: 'unknown', label: '日程不明' };
  }

  function addDays(iso, n) {
    var d = new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000);
    return d.toISOString().slice(0, 10);
  }
  // 今週末（土日）。土日に見ているときはその週末
  function weekendJst() {
    var t = todayJst();
    var dow = new Date(t + 'T00:00:00Z').getUTCDay();
    var sat = dow === 0 ? addDays(t, -1) : addDays(t, 6 - dow);
    return { sat: sat, sun: addDays(sat, 1) };
  }
  function onWeekend(it, wk) {
    if (!it.start && !it.end) return false;
    if (eventStatus(it).id === 'past') return false;
    var s = it.start || '0000-00-00', e = it.end || it.start;
    return s <= wk.sun && e >= wk.sat;
  }
  // 行きたいイベントのお知らせ（始まる日・最終日の前日など）
  function eventNotices() {
    var t = todayJst(), tm = addDays(t, 1);
    var out = [];
    state.savedItems.forEach(function (it) {
      if (it.category !== 'event') return;
      var oneDay = it.start && (!it.end || it.end === it.start);
      var msg = null, lv = 1;
      if (oneDay && it.start === t) { msg = '今日開催'; lv = 0; }
      else if (oneDay && it.start === tm) msg = '明日開催';
      else if (it.end === t) { msg = '今日が最終日'; lv = 0; }
      else if (it.start === t) { msg = '今日から開催'; lv = 0; }
      else if (it.end === tm) msg = '明日で終わり';
      else if (it.start === tm) msg = '明日から開催';
      if (msg) out.push({ it: it, msg: msg, lv: lv });
    });
    return out.sort(function (a, b) { return a.lv - b.lv; });
  }
  function renderNotices(target, before) {
    if (!target) return;
    var old = document.getElementById('ev-notice');
    if (old) old.remove();
    var list = eventNotices();
    if (!list.length) return;
    var key = todayJst() + ':' + list.map(function (n) { return n.it.id + n.msg; }).join('|');
    if (store.get('meshi.evNoticeHide', '') === key) return;
    var box = el('aside', 'ev-notice');
    box.id = 'ev-notice';
    box.setAttribute('role', 'status');
    var head = el('div', 'ev-notice-head');
    head.appendChild(el('b', null, '行きたいイベントのお知らせ'));
    var x = el('button', 'ev-notice-close', '×');
    x.type = 'button';
    x.setAttribute('aria-label', '今日はもう表示しない');
    x.addEventListener('click', function () { store.set('meshi.evNoticeHide', key); box.remove(); });
    head.appendChild(x);
    box.appendChild(head);
    list.forEach(function (n) {
      var row = el('a', 'ev-notice-row');
      row.href = n.it.link; row.target = '_blank'; row.rel = 'noopener';
      if (n.it.image) {
        var th = photo(n.it, CAT.event || { label: 'イベント', color: '#0E7490' }, false);
        th.classList.add('ev-notice-thumb');
        row.appendChild(th);
      }
      row.appendChild(el('span', 'ev-notice-tag' + (n.lv === 0 ? ' today' : ''), n.msg));
      row.appendChild(el('span', 'ev-notice-title', n.it.title));
      if (n.it.venue) row.appendChild(el('span', 'ev-notice-venue', n.it.venue));
      box.appendChild(row);
    });
    target.insertBefore(box, before || null);
  }

  // 同じイベント（group が同じ）の記事を1つにまとめる
  function groupEvents(list) {
    var map = {}, order = [];
    list.forEach(function (it) {
      var k = it.group || it.id;
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(it);
    });
    var score = function (x) { return (x.start ? 2 : 0) + (x.end ? 1 : 0) + (x.venue ? 2 : 0) + (x.image ? 1 : 0); };
    return order.map(function (k) {
      var arts = map[k].slice().sort(function (a, b) { return Date.parse(b.published) - Date.parse(a.published); });
      var best = arts.slice().sort(function (a, b) { return score(b) - score(a); })[0];
      var g = {};
      Object.keys(best).forEach(function (key) { g[key] = best[key]; });
      g.group = k;
      g.articles = arts;
      var starts = arts.map(function (x) { return x.start; }).filter(Boolean).sort();
      var ends = arts.map(function (x) { return x.end; }).filter(Boolean).sort();
      g.start = starts[0];
      g.end = ends.length ? ends[ends.length - 1] : undefined;
      arts.forEach(function (x) {
        if (!g.venue && x.venue) { g.venue = x.venue; g.lat = x.lat; g.lng = x.lng; }
        if (!g.place && x.place) g.place = x.place;
        if (!g.image && x.image) g.image = x.image;
      });
      return g;
    });
  }
  function eventName(it) {
    var m = /[「『]([^」』]{2,40})[」』]/.exec(it.title || '');
    return m ? m[1] : it.title;
  }
  function calDates(it) {
    var s = it.start || todayJst();
    var e = it.end || it.start || s;
    if (e < s) e = s;
    return { s: s.replace(/-/g, ''), e: addDays(e, 1).replace(/-/g, '') };
  }
  function googleCalUrl(it) {
    var d = calDates(it);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(eventName(it)) +
      '&dates=' + d.s + '/' + d.e +
      '&details=' + encodeURIComponent(it.title + '\n' + it.link + '\n（飯飯食堂より。日程は記事でご確認ください）') +
      (it.venue ? '&location=' + encodeURIComponent(it.venue) : '');
  }
  function icsDataUrl(it) {
    var d = calDates(it);
    var esc = function (t) { return String(t).replace(/\\/g, '\\\\').replace(/[;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//meshimeshi//events//JA', 'BEGIN:VEVENT',
      'UID:' + (it.group || it.id) + '@meshimeshi',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;VALUE=DATE:' + d.s, 'DTEND;VALUE=DATE:' + d.e,
      'SUMMARY:' + esc(eventName(it)),
      'DESCRIPTION:' + esc(it.title + '\n' + it.link),
      'URL:' + it.link];
    if (it.venue) lines.push('LOCATION:' + esc(it.venue));
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
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
        start: it.start, end: it.end, venue: it.venue, lat: it.lat, lng: it.lng, place: it.place, group: it.group,
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
    if (it.category === 'event') {
      var st = eventStatus(it);
      var evl = el('span', 'ev-line');
      evl.appendChild(el('span', 'ev-status ' + st.id, st.label));
      evl.appendChild(el('span', 'ev-when', eventRange(it) + (it.venue ? ' ・ ' + it.venue : '')));
      body.appendChild(evl);
    }
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

  var POPULAR_TOP = 30; // 「人気上位」= エリア×ジャンルごとのおすすめ順でこの順位まで
  var gacha = {
    meta: null,
    shops: {},
    news: [],
    area: store.get('meshi.gArea2', 'nagoya'),
    genre: store.get('meshi.gGenre2', 'all'),
    budget: store.get('meshi.gBudget', 'any'),
    radius: store.get('meshi.gRadius', '1000'),
    lunch: !!store.get('meshi.gLunch', false),
    popular: !!store.get('meshi.gPopular', false),   // 人気上位（ホットペッパーのおすすめ順）
    openNow: !!store.get('meshi.gOpen', false),
    mixNews: store.get('meshi.gNews', true) !== false,
    multi: !!store.get('meshi.gMulti', false),  // 3連ガチャ
    moodGenres: [], moodLabel: '',
    trio: null,
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
    var genre = (gacha.genre === 'all' || gacha.genre === 'mood') ? '' : gacha.genre;
    var q = 'lat=' + gacha.here.lat.toFixed(4) + '&lng=' + gacha.here.lng.toFixed(4) +
      '&range=' + radius + (genre ? '&genre=' + encodeURIComponent(genre) : '');
    if (nearbyCache[q]) return Promise.resolve(nearbyCache[q]);
    return fetch(NEARBY_API + '/nearby?' + q)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { nearbyCache[q] = data.shops || []; return nearbyCache[q]; });
  }

  // ---------- OpenStreetMap（無料・登録不要）で全国の近くのお店を探す ----------
  var OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  var osmCache = {};
  // OSM の料理の種類（cuisine）→ 画面のジャンル
  var OSM_GENRE = [
    [/ramen/, 'ラーメン'],
    [/izakaya/, '居酒屋'],
    [/yakiniku|bbq|barbecue|horumon/, '焼肉'],
    [/korean/, '韓国料理'],
    [/chinese|gyoza|dumpling|dim_sum|chuka/, '中華'],
    [/italian|pizza|pasta|french|spanish|mediterranean/, 'イタリアン'],
    [/okonomiyaki|takoyaki|teppanyaki/, 'お好み焼き'],
    [/thai|indian|nepal|vietnamese|asian|indonesian|turkish|mexican|curry_house/, 'エスニック'],
    [/coffee|cafe|cake|dessert|crepe|pancake|bakery|tea|ice_cream|donut/, 'カフェ'],
    [/sushi|japanese|udon|soba|noodle|tempura|tonkatsu|donburi|teishoku|kaiseki|unagi|yakitori|oden|onigiri|katsu|shabu|sukiyaki/, '和食'],
    [/burger|steak|western|american|hamburg|omurice|curry|chicken|sandwich|diner|grill|hot_dog|fish_and_chips|bistro/, '洋食']
  ];
  function osmGenre(tags) {
    var c = (tags.cuisine || '').toLowerCase();
    for (var i = 0; i < OSM_GENRE.length; i++) if (OSM_GENRE[i][0].test(c)) return OSM_GENRE[i][1];
    if (tags.amenity === 'cafe') return 'カフェ';
    if (tags.amenity === 'pub') return '居酒屋';
    var n = tags.name || '';
    if (/ラーメン|らーめん|麺|中華そば/.test(n)) return 'ラーメン';
    if (/寿司|鮨|すし|うどん|そば|蕎麦|定食|食堂|天ぷら|とんかつ|丼/.test(n)) return '和食';
    if (/焼肉|ホルモン/.test(n)) return '焼肉';
    if (/居酒屋|酒場/.test(n)) return '居酒屋';
    if (/カフェ|珈琲|コーヒー|喫茶|ベーカリー|パン/.test(n)) return 'カフェ';
    if (/ダイナー|バーガー|グリル|ステーキ|洋食|ハンバーグ|オムライス|チキン/.test(n)) return '洋食';
    if (/中華|餃子|飯店/.test(n)) return '中華';
    if (/カレー|インド|タイ料理|ベトナム/.test(n)) return 'エスニック';
    if (/ピザ|パスタ|イタリア|トラットリア|ビストロ/.test(n)) return 'イタリアン';
    return 'その他';
  }
  // OSM の営業時間（例 "Mo-Fr 11:00-14:00,17:00-22:00; Sa,Su 11:00-21:00"）→ 曜日ごとの時間帯
  var OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  function parseOsmHours(text) {
    if (!text) return null;
    var t = text.trim();
    if (t === '24/7') {
      var all = {};
      for (var d = 0; d < 7; d++) all[d] = [[0, 1440]];
      return all;
    }
    var week = {}, found = false;
    t.split(';').forEach(function (rule) {
      rule = rule.trim();
      var m = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$/.exec(rule);
      if (!m) return;
      var days = {};
      if (m[1]) {
        m[1].split(',').forEach(function (part) {
          var r = part.trim().split('-');
          var a = OSM_DAYS.indexOf(r[0].trim()), b = r[1] ? OSM_DAYS.indexOf(r[1].trim()) : a;
          if (a < 0 || b < 0) return;
          for (var i = 0; i < 7; i++) { var x = (a + i) % 7; days[x] = true; if (x === b) break; }
        });
      } else {
        for (var j = 0; j < 7; j++) days[j] = true;
      }
      if (/^off|^closed/i.test(m[2])) { Object.keys(days).forEach(function (k) { week[k] = []; }); return; }
      var times = [], tr = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g, x;
      while ((x = tr.exec(m[2]))) {
        var s1 = +x[1] * 60 + +x[2], e1 = +x[3] * 60 + +x[4];
        if (e1 <= s1) e1 += 1440;
        times.push([s1, e1]);
      }
      if (!times.length) return;
      found = true;
      Object.keys(days).forEach(function (k) { week[k] = times.slice(); });
    });
    return found ? week : null;
  }
  // 表示用に日本語へ（"Mo-Fr 11:00-14:00; Sa,Su off" → "月〜金 11:00〜14:00 / 土・日 休み"）
  function osmHoursJa(t) {
    if (t.trim() === '24/7') return '24時間営業';
    var ja = { Mo: '月', Tu: '火', We: '水', Th: '木', Fr: '金', Sa: '土', Su: '日', PH: '祝日' };
    return t.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, function (d) { return ja[d]; })
      .replace(/(\d)\s*-\s*(\d)/g, '$1〜$2').replace(/([月火水木金土日])\s*-\s*([月火水木金土日])/g, '$1〜$2')
      .replace(/,\s*(?=[月火水木金土日])/g, '・').replace(/,\s*/g, ', ')
      .replace(/\boff\b|\bclosed\b/gi, '休み').replace(/\s*;\s*/g, ' / ');
  }
  function osmAddress(tags) {
    if (tags['addr:full']) return tags['addr:full'];
    return [tags['addr:province'], tags['addr:city'], tags['addr:suburb'], tags['addr:quarter'],
      tags['addr:neighbourhood'], tags['addr:block_number'], tags['addr:housenumber']].filter(Boolean).join('');
  }
  function loadOsm() {
    var radius = (RADII.filter(function (r) { return r.id === gacha.radius; })[0] || RADII[1]).m;
    return loadOsmAt(gacha.here, radius);
  }
  function loadOsmAt(here, radius) {
    var lat = here.lat.toFixed(4), lng = here.lng.toFixed(4);
    var key = lat + ',' + lng + ',' + radius;
    if (osmCache[key]) return Promise.resolve(osmCache[key]);
    var q = '[out:json][timeout:20];nwr["amenity"~"^(restaurant|cafe|fast_food|pub)$"]["name"](around:' +
      radius + ',' + lat + ',' + lng + ');out center tags 400;';
    var tryAt = function (i) {
      return fetch(OVERPASS[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q)
      }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .catch(function (e) { if (i + 1 < OVERPASS.length) return tryAt(i + 1); throw e; });
    };
    return tryAt(0).then(function (data) {
      var list = (data.elements || []).map(function (e) {
        var tags = e.tags || {};
        var la = e.lat != null ? e.lat : e.center && e.center.lat;
        var lo = e.lon != null ? e.lon : e.center && e.center.lon;
        var name = tags['name:ja'] || tags.name;
        if (!name || la == null) return null;
        var address = osmAddress(tags);
        return {
          id: 'osm_' + e.type + e.id, name: name, genre: osmGenre(tags), catch: '',
          address: address, access: '', budget: '', budget_code: '',
          open: tags.opening_hours || '', _hours: parseOsmHours(tags.opening_hours),
          lunch: false, photo: null, rank: null, source: 'osm',
          url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + (address || la + ',' + lo)),
          lat: la, lng: lo
        };
      }).filter(Boolean);
      osmCache[key] = list;
      return list;
    });
  }
  // ホットペッパーと同じお店は、写真などがあるホットペッパーの方を残す
  function normName(n) { return (n || '').normalize('NFKC').replace(/[\s・\-ー（）()【】「」店]/g, '').toLowerCase(); }
  function mergeShops(hp, osm) {
    var out = hp.slice();
    osm.forEach(function (o) {
      var on = normName(o.name);
      var dup = on.length >= 2 && hp.some(function (h) {
        var hn = normName(h.name);
        if (!(hn.indexOf(on) >= 0 || on.indexOf(hn) >= 0)) return false;
        return h.lat == null || distance({ lat: +h.lat, lng: +h.lng }, { lat: o.lat, lng: o.lng }) < 150;
      });
      if (!dup) out.push(o);
    });
    return out;
  }

  function matchBudget(sh) {
    var b = BUDGETS.filter(function (x) { return x.id === gacha.budget; })[0] || BUDGETS[0];
    if (!b.codes) return true;
    if (!sh.budget_code) return false;
    if (b.codes === 'over') return CHEAP.indexOf(sh.budget_code) < 0;
    return b.codes.indexOf(sh.budget_code) >= 0;
  }

  // ニュースで話題のお店（話題枠）
  // ジャンルが合うか（「気分で選ぶ」のときは気分から決めた複数ジャンルのどれか）
  function genreOk(label) {
    if (gacha.genre === 'all') return true;
    if (gacha.genre === 'mood') return gacha.moodGenres.indexOf(label) >= 0;
    return label === gacha.genre;
  }

  function newsCandidates() {
    if (!gacha.mixNews || gacha.area === 'near' || gacha.budget !== 'any' || gacha.lunch || gacha.openNow || gacha.popular) return [];
    var area = { nagoya: ['名古屋'], aichi: ['愛知', '名古屋'], gifu: ['岐阜'], mie: ['三重'], all: ['名古屋', '愛知', '岐阜', '三重'] }[gacha.area] || [];
    return gacha.news.filter(function (it) {
      if (!it.shop || !it.shop_name || area.indexOf(it.area) < 0) return false;
      if (gacha.genre === 'all') return true;
      var gs = gacha.genre === 'mood' ? gacha.moodGenres : [gacha.genre];
      return gs.some(function (g) { var re = GENRE_WORDS[g]; return re ? re.test(it.title) : false; });
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
    return hereP.then(function () {
      if (gacha.area === 'near') {
        // ホットペッパー（中継があればそこから、なければ手元の東海のデータ）＋ OpenStreetMap
        var hpP = (NEARBY_API ? loadNearby().catch(function () { return loadShops('near'); }) : loadShops('near'))
          .catch(function () { return []; });
        var osmP = loadOsm().then(function (l) { gacha.osmFailed = false; return l; })
          .catch(function () { gacha.osmFailed = true; return []; });
        return Promise.all([hpP, osmP]).then(function (r) { return mergeShops(r[0], r[1]); });
      }
      return loadShops(gacha.area);
    }).then(function (list) {
      if (seq !== poolSeq) return;
      var radius = (RADII.filter(function (r) { return r.id === gacha.radius; })[0] || RADII[1]).m;
      var now = new Date();
      gacha.pool = list.filter(function (sh) {
        if (!genreOk(sh.genre)) return false;
        if (!matchBudget(sh)) return false;
        if (gacha.lunch && !hasLunch(sh)) return false;
        if (gacha.popular && !(sh.rank && sh.rank <= POPULAR_TOP)) return false;
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
      if (!n && !k && gacha.area === 'near' && gacha.osmFailed) {
        msg = '近くのお店を探せませんでした（地図データの読み込みに失敗）。少し時間をおくか、エリアを選んで回してください。';
      } else if (!n && !k) {
        msg = gacha.area === 'near'
          ? '近くにこの条件のお店が見つかりませんでした。距離を広げるか条件を変えてみてください。'
          : 'この条件のお店が見つかりませんでした。条件を変えてみてください。';
      } else {
        msg = 'お店 ' + n + ' 軒' + (k ? '＋話題枠 ' + k + ' 軒' : '') + 'から' +
          (gacha.multi ? Math.min(3, n + k) + '軒' : '1軒') + '選びます';
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

  function weightedPick(list, weightFn, exclude) {
    exclude = exclude || {};
    var cands = list.filter(function (x) { return !exclude[x.id]; });
    if (cands.length > 1) cands = cands.filter(function (x) { return x.id !== gacha.lastId; });
    if (!cands.length) return null;
    var weights = cands.map(weightFn);
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < cands.length; i++) {
      r -= weights[i];
      if (r < 0) return cands[i];
    }
    return cands[cands.length - 1];
  }
  function pickOne(exclude) {
    var useNews = gacha.newsPool.length && (!gacha.pool.length || Math.random() < NEWS_SHARE);
    var news = function () { var x = weightedPick(gacha.newsPool, function (it) { return it.image ? 2 : 1; }, exclude); return x && { news: x }; };
    var shop = function () { var x = weightedPick(gacha.pool, function (sh) { return sh.photo ? 2 : 1; }, exclude); return x && { shop: x }; };
    return useNews ? (news() || shop()) : (shop() || news());
  }
  // 3連ガチャ：重ならないように3軒（候補が少なければあるだけ）
  function pickMany(n) {
    var out = [], ex = {};
    for (var i = 0; i < n; i++) {
      var p = pickOne(ex);
      if (!p) break;
      ex[(p.shop || p.news).id] = 1;
      out.push(p);
    }
    return out;
  }

  function genreColor(name) {
    var i = gacha.meta ? gacha.meta.genres.indexOf(name) : -1;
    return CAP_COLORS[(i < 0 ? 0 : i) % CAP_COLORS.length];
  }

  // 保存・表示用に、お店を記事と同じ形にそろえる
  function shopAsItem(sh) {
    var m = /(?:都|道|府|県)(.+?[市区町村郡])/.exec(sh.address || '');
    return {
      id: 'hp_' + sh.id, title: sh.name, link: sh.url,
      source: sh.source === 'osm' ? 'OpenStreetMap' : 'ホットペッパーグルメ',
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

  // ---- 「行った！」記録とスタンプ帳 ----
  function getVisited() {
    var v = store.get('meshi.visited', []);
    return Array.isArray(v) ? v : [];
  }
  function isVisited(id) { return getVisited().some(function (x) { return x.id === id; }); }
  function setVisited(entry, on) {
    var v = getVisited().filter(function (x) { return x.id !== entry.id; });
    if (on) {
      v.unshift({ id: entry.id, name: entry.name, url: entry.url, photo: entry.photo || null,
        genre: entry.genre || 'その他', area: entry.area || '', color: entry.color || '#2B2118',
        news: !!entry.news, at: new Date().toISOString() });
    }
    store.set('meshi.visited', v.slice(0, 500));
    // 同じお店の「行った！」ボタンをすべてそろえる
    document.querySelectorAll('.visit-btn[data-id="' + entry.id + '"]').forEach(syncVisitBtn);
    renderStamps();
  }
  function syncVisitBtn(b) {
    var on = isVisited(b.dataset.id);
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('.visit-label').textContent = on ? '行った！' : (b.classList.contains('small') ? '行った？' : 'ここに行った！');
  }
  function visitButton(entry, size) {
    var b = el('button', 'visit-btn ' + size);
    b.type = 'button';
    b.dataset.id = entry.id;
    var stamp = el('span', 'visit-stamp', '済');
    stamp.setAttribute('aria-hidden', 'true');
    b.appendChild(stamp);
    b.appendChild(el('span', 'visit-label'));
    syncVisitBtn(b);
    b.addEventListener('click', function () {
      var on = !isVisited(entry.id);
      setVisited(entry, on);
      if (on) {
        b.classList.remove('pon'); void b.offsetWidth; b.classList.add('pon');
        var g = stampGenre(entry);
        var n = getVisited().filter(function (x) { return stampGenre(x) === g; }).length;
        gToast('スタンプゲット！ ' + g + ' ' + n + '個目');
      }
    });
    return b;
  }
  function stampGenre(x) { return x.news ? '話題のお店' : (x.genre || 'その他'); }
  function renderStamps() {
    var box = $('stamp-grid');
    if (!box) return;
    var v = getVisited();
    var genres = ((gacha.meta && gacha.meta.genres) || []).concat(['その他', '話題のお店']);
    var count = {};
    v.forEach(function (x) { var g = stampGenre(x); count[g] = (count[g] || 0) + 1; });
    box.textContent = '';
    var done = 0;
    genres.forEach(function (g, i) {
      var n = count[g] || 0;
      if (n) done++;
      var cell = el('div', 'stamp' + (n ? ' on' : ''));
      cell.style.setProperty('--c', g === '話題のお店' ? '#B42318' : genreColor(g));
      cell.style.setProperty('--r', ((i * 37) % 24 - 12) + 'deg');
      var ring = el('span', 'stamp-ring');
      ring.appendChild(el('span', 'stamp-name', g));
      if (n) ring.appendChild(el('span', 'stamp-count', '×' + n));
      cell.appendChild(ring);
      box.appendChild(cell);
    });
    $('stamp-summary').textContent = '行ったお店 ' + v.length + '軒 ・ ジャンル制覇 ' + done + ' / ' + genres.length;
    var list = $('stamp-list');
    list.textContent = '';
    $('stamp-empty').hidden = v.length > 0;
    v.forEach(function (x) {
      var li = el('li', 'sl-item');
      var a = el('a', 'sl-link');
      a.href = x.url; a.target = '_blank'; a.rel = 'noopener';
      var dot = el('span', 'sl-dot');
      dot.style.background = x.news ? '#B42318' : (x.color || '#2B2118');
      a.appendChild(dot);
      a.appendChild(el('span', 'sl-name', x.name));
      a.appendChild(el('span', 'sl-meta', [stampGenre(x), x.area, relTime(x.at)].filter(Boolean).join(' ・ ')));
      li.appendChild(a);
      var del = el('button', 'sl-del', '×');
      del.type = 'button';
      del.setAttribute('aria-label', x.name + ' の記録を消す');
      del.addEventListener('click', function () { setVisited(x, false); });
      li.appendChild(del);
      list.appendChild(li);
    });
  }
  // ガチャのページ用の小さなお知らせ
  var gToastTimer = null;
  function gToast(text) {
    var t = $('g-toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(gToastTimer);
    gToastTimer = setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.hidden = true; }, 300); }, 2600);
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
    renderStamps();
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
      li.appendChild(visitButton(x, 'small'));
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
    if (sh.rank && sh.rank <= POPULAR_TOP) badges.appendChild(el('span', 'g-badge popular', '人気' + sh.rank + '位（' + sh.genre + '）'));
    if (hasLunch(sh)) badges.appendChild(el('span', 'g-badge', 'ランチあり'));
    if (badges.children.length) body.appendChild(badges);
    if (sh.catch) body.appendChild(el('span', 'g-catch', sh.catch));
    body.appendChild(el('span', 'g-title', sh.name));
    var info = el('span', 'g-info');
    if (sh.budget) info.appendChild(infoRow('予算', sh.budget));
    if (sh.access) info.appendChild(infoRow('アクセス', sh.access));
    if (sh.open) info.appendChild(infoRow('営業', sh.source === 'osm' ? osmHoursJa(sh.open) : sh.open));
    if (sh.close) info.appendChild(infoRow('定休日', sh.close));
    body.appendChild(info);
    var isOsm = sh.source === 'osm';
    if (isOsm) body.appendChild(el('span', 'g-src', 'お店の情報：© OpenStreetMap contributors'));
    body.appendChild(el('span', 'g-cta', isOsm ? 'Googleマップで詳しく見る →' : 'ホットペッパーで詳しく見る →'));
    a.appendChild(body);
    art.appendChild(a);
    art.appendChild(saveButton(item));
    box.appendChild(art);

    var mapQ = sh.name + ' ' + (sh.address || (sh.lat && sh.lng ? sh.lat + ',' + sh.lng : ''));
    var entry = { id: item.id, name: sh.name, url: sh.url, photo: sh.photo, genre: sh.genre, area: item.area, color: color, at: new Date().toISOString() };
    if (isRare({ shop: sh })) markRare(box, art);
    finishResult(box, 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapQ),
      shareBox(sh.name, sh.genre + (item.area ? '・' + item.area : ''), sh.url), entry);
    addHistory(entry);
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

    var entry = { id: it.id, name: it.shop_name, url: it.link, photo: it.image, genre: '話題のお店', area: it.area, color: cat.color, news: true, at: new Date().toISOString() };
    markRare(box, art);
    finishResult(box, 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(it.shop_name + ' ' + (it.area || '')),
      shareBox(it.shop_name, it.area, it.link), entry);
    addHistory(entry);
  }

  // ---- レア：人気5位以内のお店・話題枠 ----
  var RARE_TOP = 5;
  function isRare(p) {
    return !!(p && (p.news || (p.shop && p.shop.rank && p.shop.rank <= RARE_TOP)));
  }
  function markRare(box, card) {
    var head = box.querySelector('.g-hit');
    if (head) head.insertBefore(el('span', 'rare-ribbon', '★レア'), head.firstChild);
    if (card) card.classList.add('rare');
  }

  // ---- みんなで投票（3連の3軒をLINEで送る）----
  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  var NUMS = ['①', '②', '③'];
  function voteUrl(picks) {
    var data = picks.map(function (p) {
      var sh = p.shop, it = p.news;
      var name = sh ? sh.name : it.shop_name;
      return {
        n: name, g: sh ? sh.genre : '話題のお店', u: sh ? sh.url : it.link, p: (sh ? sh.photo : it.image) || '',
        a: sh ? (shopAsItem(sh).area || '') : (it.area || ''),
        b: sh && sh.budget ? sh.budget.replace(/（.*$/, '') : '',
        m: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + (sh ? (sh.address || '') : (it.area || '')))
      };
    });
    return new URL('vote.html', location.href).href.split('#')[0] + '#d=' + b64urlEncode(JSON.stringify(data));
  }
  function voteBox(picks) {
    var url = voteUrl(picks);
    var names = picks.map(function (p, i) { return NUMS[i] + (p.shop ? p.shop.name : p.news.shop_name); }).join('\n');
    var text = '飯ガチャで3軒出たよ！どこに行きたい？投票して〜\n' + names + '\n投票はこちら👇\n' + url;
    var wrap = el('div', 'vote-box');
    wrap.appendChild(el('p', 'vote-lead', 'みんなで決める'));
    var line = el('a', 'vote-line', 'LINEで投票をお願いする');
    line.href = 'https://line.me/R/share?text=' + encodeURIComponent(text);
    line.target = '_blank';
    line.rel = 'noopener';
    wrap.appendChild(line);
    var more = el('button', 'vote-more', navigator.share ? 'ほかのアプリで送る' : '投票リンクをコピー');
    more.type = 'button';
    more.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: '飯ガチャ投票', text: '飯ガチャで3軒出たよ！どこに行きたい？\n' + names, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () { more.textContent = 'コピーしました'; });
      }
    });
    wrap.appendChild(more);
    return wrap;
  }

  function showTrio(picks) {
    gacha.trio = picks;
    var box = $('g-result');
    box.textContent = '';
    var head = el('p', 'g-hit');
    head.appendChild(document.createTextNode(picks.length + '軒出ました！ どれにする？'));
    box.appendChild(head);
    var list = el('div', 'g-trio');
    picks.forEach(function (p, i) {
      var sh = p.shop, it = p.news;
      var b = el('button', 'g-trio-card' + (isRare(p) ? ' rare' : ''));
      b.type = 'button';
      b.style.setProperty('--i', i);
      if (isRare(p)) b.appendChild(el('span', 'trio-rare', '★レア'));
      var color = sh ? genreColor(sh.genre) : (CAT[it.category] || CAT.wadai).color;
      var th = el('span', 'g-trio-thumb');
      th.style.setProperty('--c', color);
      var src = sh ? sh.photo : it.image;
      if (src) {
        var img = document.createElement('img');
        img.src = src; img.alt = ''; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { img.remove(); });
        th.appendChild(img);
      }
      th.appendChild(el('span', 'g-trio-num', String(i + 1)));
      b.appendChild(th);
      var tx = el('span', 'g-trio-text');
      var chip = el('span', 'g-trio-genre' + (it ? ' hot' : ''), sh ? sh.genre : '話題枠');
      if (sh) chip.style.background = color;
      tx.appendChild(chip);
      tx.appendChild(el('span', 'g-trio-name', sh ? sh.name : it.shop_name));
      var meta = [];
      if (sh) {
        if (sh._dist != null && gacha.area === 'near') meta.push('ここから' + fmtDistance(sh._dist));
        if (sh.rank && sh.rank <= POPULAR_TOP) meta.push('人気' + sh.rank + '位');
        if (sh.budget) meta.push(sh.budget.replace(/（.*$/, ''));
        var open = isOpenNow(sh);
        if (open === true) meta.push('営業中');
      } else {
        meta.push('ニュースで話題');
        if (it.area) meta.push(it.area);
      }
      tx.appendChild(el('span', 'g-trio-meta', meta.join(' ・ ')));
      b.appendChild(tx);
      b.appendChild(el('span', 'g-trio-go', 'ここにする'));
      b.addEventListener('click', function () {
        if (sh) showShop(sh); else showNews(it);
        $('g-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      list.appendChild(b);
    });
    box.appendChild(list);
    var actions = el('div', 'g-actions');
    if (picks.length > 1) box.appendChild(voteBox(picks));
    var again = el('button', 'g-again', 'もう1回3連まわす');
    again.type = 'button';
    again.addEventListener('click', spin);
    actions.appendChild(again);
    box.appendChild(actions);
    if (picks.some(isRare)) {
      var h = box.querySelector('.g-hit');
      if (h) h.insertBefore(el('span', 'rare-ribbon', '★レア入り'), h.firstChild);
    }
    $('machine').hidden = true;
    box.hidden = false;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  }

  function finishResult(box, mapUrl, share, entry) {
    if (entry) box.appendChild(visitButton(entry, 'big'));
    var actions = el('div', 'g-actions');
    if (gacha.trio && gacha.trio.length > 1) {
      var back = el('button', 'g-again g-back', '← 3軒にもどる');
      back.type = 'button';
      var trio = gacha.trio;
      back.addEventListener('click', function () { showTrio(trio); });
      actions.appendChild(back);
    }
    var map = el('a', 'g-map');
    map.appendChild(svg('star', 'g-map-icon'));
    map.appendChild(document.createTextNode('Googleマップで口コミを見る'));
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
    var picks = gacha.multi ? pickMany(3) : [pickOne()];
    if (!picks.length || !picks[0]) return;
    var pick = picks[0];
    var color = pick.shop ? genreColor(pick.shop.genre) : '#FFC93C';
    gacha.lastId = (pick.shop || pick.news).id;
    gacha.trio = null;
    gacha.busy = true;
    $('g-spin').disabled = true;

    var m = $('machine');
    var drop = $('drop');
    $('g-result').hidden = true;
    m.hidden = false;
    drop.style.setProperty('--c', color);
    m.classList.remove('spinning', 'dropping', 'opening');
    m.classList.toggle('triple', picks.length > 1);
    var rare = picks.some(isRare);
    m.classList.toggle('rare', rare);
    picks.forEach(function (p, i) {
      var d = i === 0 ? drop : $('drop' + (i + 1));
      if (!d) return;
      if (i > 0) d.style.setProperty('--c', p.shop ? genreColor(p.shop.genre) : '#FFC93C');
      d.classList.toggle('gold', isRare(p));   // レアは金色のカプセル
    });

    var stage = document.querySelector('.gacha-stage');
    var r = stage.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* noop */ }
    var finish = function () {
      gacha.busy = false;
      m.classList.remove('spinning', 'dropping', 'opening', 'rare-flash');
      if (picks.length > 1) showTrio(picks);
      else if (pick.shop) showShop(pick.shop); else showNews(pick.news);
      $('g-spin').disabled = !gacha.pool.length && !gacha.newsPool.length;
    };
    if (reduce) { finish(); return; }

    void m.offsetWidth;
    m.classList.add('spinning');                                      // ハンドルが回る
    setTimeout(function () { m.classList.add('dropping'); }, 1000);  // カプセルが出る
    if (rare) {
      // レア：金色のカプセルが光って「レア確定！」、少し長めにためてから開く
      setTimeout(function () { m.classList.add('rare-flash'); }, 1700);
      setTimeout(function () { m.classList.add('opening'); }, 2600);
      setTimeout(function () { finish(); m.classList.remove('rare', 'rare-flash'); }, 3200);
    } else {
      setTimeout(function () { m.classList.add('opening'); }, 1800);   // カプセルが開く
      setTimeout(finish, 2350);
    }
  }

  function setSpinLabel() {
    $('g-spin').textContent = gacha.multi ? '3連ガチャを回す' : 'ガチャを回す';
  }
  function buildGenrePills() {
    var list = [{ id: 'all', label: 'おまかせ' }];
    if (gacha.moodGenres.length) list.push({ id: 'mood', label: '気分：' + gacha.moodLabel, cls: 'g-pill-mood' });
    list = list.concat(gacha.genreList.map(function (g) { return { id: g, label: g }; }));
    pills('g-genre', list, gacha.genre, function (id) {
      gacha.genre = id;
      if (id !== 'mood') store.set('meshi.gGenre2', id);
    });
  }

  // ---- 気分で選ぶ ----
  var MOOD_QS = [
    { key: 'rich', q: '今日の気分は？', a: [['kotteri', 'こってり'], ['assari', 'あっさり']] },
    { key: 'vol', q: 'おなかの空き具合は？', a: [['gattsuri', 'がっつり食べたい'], ['karume', '軽めでいい']] },
    { key: 'who', q: 'だれと行く？', a: [['hitori', 'ひとりでサクッと'], ['minna', 'みんなでワイワイ']] },
    { key: 'spice', q: '辛いものは？', a: [['suki', '食べたい！'], ['nigate', '今日はやめとく']] }
  ];
  var MOOD_TAGS = {
    kotteri: ['ラーメン', '焼肉', '中華', '洋食', '韓国料理', 'お好み焼き'],
    assari: ['和食', 'カフェ', 'イタリアン', 'エスニック', '居酒屋'],
    gattsuri: ['ラーメン', '焼肉', '中華', '洋食', 'お好み焼き', '韓国料理', '居酒屋'],
    karume: ['カフェ', '和食', 'イタリアン', 'エスニック'],
    hitori: ['ラーメン', 'カフェ', '和食', '洋食', '中華', 'エスニック'],
    minna: ['居酒屋', '焼肉', '韓国料理', 'お好み焼き', 'イタリアン', '中華'],
    suki: ['韓国料理', 'エスニック', '中華', 'ラーメン']
  };
  var MOOD_WORD = { kotteri: 'こってり', assari: 'あっさり', gattsuri: 'がっつり', karume: '軽め', hitori: 'ひとり', minna: 'ワイワイ', suki: '辛いの', nigate: '辛さ控えめ' };
  var mood = { step: 0, ans: {} };

  function moodGenresFrom(ans) {
    var genres = (gacha.genreList || []).slice();
    if (ans.spice === 'nigate') genres = genres.filter(function (g) { return g !== '韓国料理' && g !== 'エスニック'; });
    var score = {};
    genres.forEach(function (g) { score[g] = 0; });
    Object.keys(ans).forEach(function (k) {
      (MOOD_TAGS[ans[k]] || []).forEach(function (g) { if (g in score) score[g]++; });
    });
    // 点数の高い順。同点は毎回ランダムに並べ、最大3ジャンルまでにする
    var rnd = {};
    genres.forEach(function (g) { rnd[g] = Math.random(); });
    var sorted = genres.slice().sort(function (a, b) { return (score[b] - score[a]) || (rnd[a] - rnd[b]); });
    var top = score[sorted[0]];
    var pick = sorted.filter(function (g) { return score[g] === top; });
    if (pick.length < 2) pick = sorted.filter(function (g) { return score[g] >= top - 1; });
    return pick.slice(0, 3);
  }
  var moodCloseTimer = null;
  function openMood() {
    if (gacha.busy) return;
    mood = { step: 0, ans: {} };
    var ov = $('mood');
    clearTimeout(moodCloseTimer);
    ov.hidden = false;
    document.body.classList.add('no-scroll');   // 後ろの画面がスクロールしないように
    void ov.offsetWidth;
    ov.classList.add('open');
    renderMood();
  }
  function closeMood() {
    var ov = $('mood');
    if (ov.hidden) return;
    ov.classList.remove('open');
    document.body.classList.remove('no-scroll');
    clearTimeout(moodCloseTimer);
    moodCloseTimer = setTimeout(function () { ov.hidden = true; }, 250);
    $('g-mood-open').focus({ preventScroll: true });
  }
  function renderMood() {
    var body = $('mood-body');
    body.textContent = '';
    var dots = el('div', 'mood-dots');
    MOOD_QS.forEach(function (_, i) { dots.appendChild(el('span', 'mood-dot' + (i <= mood.step ? ' on' : ''))); });
    body.appendChild(dots);
    if (mood.step < MOOD_QS.length) {
      var q = MOOD_QS[mood.step];
      body.appendChild(el('p', 'mood-q', q.q));
      var row = el('div', 'mood-answers');
      q.a.concat([['any', 'どっちでも']]).forEach(function (a) {
        var b = el('button', 'mood-a' + (a[0] === 'any' ? ' any' : ''), a[1]);
        b.type = 'button';
        b.addEventListener('click', function () {
          if (a[0] !== 'any') mood.ans[q.key] = a[0];
          mood.step++;
          renderMood();
        });
        row.appendChild(b);
      });
      body.appendChild(row);
      row.firstChild.focus({ preventScroll: true });
      return;
    }
    // 結果：ジャンルを決めて回す
    var genres = moodGenresFrom(mood.ans);
    var words = MOOD_QS.map(function (q) { return MOOD_WORD[mood.ans[q.key]]; }).filter(Boolean);
    var label = words.length ? words.slice(0, 2).join('×') : 'おまかせ';
    body.appendChild(el('p', 'mood-q', (words.length ? words.join('・') + 'のあなたには…' : '今日は気分おまかせ！')));
    var g = el('div', 'mood-genres');
    genres.forEach(function (x, i) {
      var c = el('span', 'mood-genre', x);
      c.style.setProperty('--c', genreColor(x));
      c.style.setProperty('--i', i);
      g.appendChild(c);
    });
    body.appendChild(g);
    var go = el('button', 'g-spin mood-go', 'この気分で回す！');
    go.type = 'button';
    go.addEventListener('click', function () {
      gacha.moodGenres = genres;
      gacha.moodLabel = label;
      gacha.genre = 'mood';
      buildGenrePills();
      closeMood();
      Promise.resolve(updatePool()).then(function () {
        if (gacha.pool.length || gacha.newsPool.length) { setTimeout(spin, 300); return; }
        // 条件に合うお店がないときは、理由の文を見せる
        var msg = $('g-pool');
        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msg.classList.remove('flash'); void msg.offsetWidth; msg.classList.add('flash');
      });
    });
    body.appendChild(go);
  }

  function buildGacha() {
    renderStamps();
    $('g-spin').addEventListener('click', spin);
    $('g-spin').disabled = true;
    $('mood-close').addEventListener('click', closeMood);
    $('mood').addEventListener('click', function (e) { if (e.target === $('mood')) closeMood(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMood(); });
    $('g-pool').textContent = 'お店データを読み込み中…';
    $('g-history-clear').addEventListener('click', function () {
      store.set('meshi.gHistory', []);
      renderHistory();
    });
    renderHistory();

    // 話題枠用にニュースも読む（失敗しても続ける）
    var newsP = fetch('data/news.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (r.headers.get('X-Meshi-Offline') === '1') gacha.offline = true;
        return r.ok ? r.json() : { items: [] };
      })
      .then(function (d) { gacha.news = d.items || []; })
      .catch(function () { gacha.news = []; });

    var metaP = fetch('data/shops/meta.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });

    Promise.all([metaP.catch(function (e) { return newsP.then(function () { throw e; }); }), newsP]).then(function (res) {
      var meta = res[0];
      gacha.meta = meta;
      var areas = meta.areas.map(function (a) { return { id: a.id, label: a.label }; });
      areas.push({ id: 'all', label: '東海ぜんぶ' });
      if (navigator.geolocation) areas.unshift({ id: 'near', label: '現在地から', icon: 'pin', cls: 'near' });
      if (!areas.some(function (a) { return a.id === gacha.area; })) gacha.area = 'nagoya';
      gacha.genreList = meta.genres.slice();
      if (gacha.genre === 'mood' || gacha.genreList.indexOf(gacha.genre) < 0) gacha.genre = 'all';
      if (!BUDGETS.some(function (b) { return b.id === gacha.budget; })) gacha.budget = 'any';
      pills('g-area', areas, gacha.area, function (id) {
        gacha.area = id;
        // 現在地は毎回取り直す
        if (id === 'near') gacha.here = null;
        store.set('meshi.gArea2', id);
      });
      pills('g-radius', RADII, gacha.radius, function (id) { gacha.radius = id; store.set('meshi.gRadius', id); });
      buildGenrePills();
      renderStamps();   // ジャンルの一覧がそろったので描き直す
      pills('g-count', [{ id: 'one', label: '1軒' }, { id: 'three', label: '3連（3軒から選ぶ）' }],
        gacha.multi ? 'three' : 'one', function (id) {
          gacha.multi = id === 'three';
          store.set('meshi.gMulti', gacha.multi);
          setSpinLabel();
        });
      setSpinLabel();
      $('g-mood-open').addEventListener('click', openMood);
      pills('g-budget', BUDGETS, gacha.budget, function (id) { gacha.budget = id; store.set('meshi.gBudget', id); });
      pills('g-opts', [
        { id: 'popular', label: '人気上位', on: gacha.popular, icon: 'star' },
        { id: 'lunch', label: 'ランチあり', on: gacha.lunch },
        { id: 'open', label: '今営業中', on: gacha.openNow },
        { id: 'news', label: '話題枠をまぜる', on: gacha.mixNews }
      ], null, function (id, on) {
        if (id === 'lunch') { gacha.lunch = on; store.set('meshi.gLunch', on); }
        if (id === 'popular') { gacha.popular = on; store.set('meshi.gPopular', on); }
        if (id === 'open') { gacha.openNow = on; store.set('meshi.gOpen', on); }
        if (id === 'news') { gacha.mixNews = on; store.set('meshi.gNews', on); }
      }, true);
      updatePool();
    }).catch(function () {
      $('gacha').classList.add('not-ready');
      $('g-pool').textContent = (gacha.offline || navigator.onLine === false)
        ? '電波がないため、飯ガチャは使えません。つながる場所でもう一度開いてください。'
        : 'お店データを準備中です。もうしばらくお待ちください。';
    });
  }

  // テスト用に営業時間の読み取りを外から使えるようにする
  window.__meshiHours = { parseHours: parseHours, isOpenNow: isOpenNow, hasLunch: hasLunch };

  // 「今から行ける」「お出かけプラン」（assets/now.js）から使う共通の部品
  function loadAllShops() {
    if (gacha.meta) return loadShops('near');
    return fetch('data/shops/meta.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (meta) { gacha.meta = meta; return loadShops('near'); });
  }
  window.MESHI = {
    $: function (id) { return $(id); }, el: el, svg: svg, store: store, photo: photo, CAT: CAT,
    todayJst: todayJst, fmtDay: fmtDay, addDays: addDays, eventStatus: eventStatus, eventRange: eventRange,
    groupEvents: groupEvents, eventName: eventName, weekendJst: weekendJst,
    distance: distance, fmtDistance: fmtDistance, isOpenNow: isOpenNow, hasLunch: hasLunch,
    loadAllShops: loadAllShops, loadOsmAt: loadOsmAt, mergeShops: mergeShops, normName: normName,
    locate: locate, GENRE_WORDS: GENRE_WORDS, showOffline: function (on) { showOffline(on); },
    isSaved: isSaved, toggleSaved: toggleSaved
  };

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

  // ---------- 急上昇グルメ（data/trends.json） ----------
  var TR_KIND = { shop: 'お店', chain: 'チェーン', dish: '料理' };
  function sparkline(daily, recentDays) {
    var max = Math.max.apply(null, daily.concat([1]));
    var w = 4, gap = 2, h = 26;
    var bars = daily.map(function (v, i) {
      var bh = Math.max(2, Math.round(v / max * h));
      var hot = i >= daily.length - recentDays;
      return '<rect x="' + (i * (w + gap)) + '" y="' + (h - bh) + '" width="' + w + '" height="' + bh + '" rx="1" fill="' + (hot ? '#D92D20' : '#CFC4AE') + '"/>';
    }).join('');
    var s = el('span', 'tr-spark');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 ' + (daily.length * (w + gap) - gap) + ' ' + h + '" preserveAspectRatio="none">' + bars + '</svg>';
    return s;
  }
  function renderTrends() {
    var sec = $('trends');
    if (!sec) return;
    fetch('data/trends.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var row = $('tr-row');
        row.textContent = '';
        var list = (d && d.items) || [];
        if (!list.length) { sec.hidden = true; return; }
        list.slice(0, 8).forEach(function (t, i) {
          var b = el('button', 'tr-card');
          b.type = 'button';
          b.appendChild(el('span', 'tr-rank', String(i + 1)));
          var top = el('span', 'tr-top');
          top.appendChild(el('span', 'tr-kind ' + t.kind, TR_KIND[t.kind] || ''));
          top.appendChild(el('span', 'tr-badge', t.new ? 'NEW' : (t.ratio >= 2.5 ? 'いつもの' + Math.round(t.ratio) + '倍' : '上昇中')));
          b.appendChild(top);
          b.appendChild(el('span', 'tr-label', t.label));
          b.appendChild(sparkline(t.daily || [], d.recent_days || 3));
          b.appendChild(el('span', 'tr-count', 'ここ3日で記事' + t.recent + '本'));
          b.setAttribute('aria-label', t.label + '：ここ3日で記事' + t.recent + '本。押すとこの言葉で記事を探します');
          b.addEventListener('click', function () {
            $('q').value = t.q || t.label;
            state.query = t.q || t.label;
            state.tab = 'all';
            state.saved = false;
            state.shown = PAGE_SIZE;
            Array.prototype.forEach.call($('tabs').children, function (x) {
              x.setAttribute('aria-pressed', String(x.dataset.id === 'all'));
            });
            syncHash();
            refreshView();
            $('heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          row.appendChild(b);
        });
        sec.hidden = false;
      })
      .catch(function () { sec.hidden = true; });
  }

  // トップページのイベントマップ入口に「今日は○件開催中・今週末は○件」
  function updateEvEntry() {
    var box = document.querySelector('.ev-entry-text');
    if (!box) return;
    var groups = groupEvents(state.items.filter(function (it) { return it.category === 'event'; }));
    var wk = weekendJst();
    var now = groups.filter(function (g) { return eventStatus(g).id === 'now'; }).length;
    var week = groups.filter(function (g) { return onWeekend(g, wk); }).length;
    var old = box.querySelector('.ev-entry-live');
    if (old) old.remove();
    if (!now && !week) return;
    var live = el('span', 'ev-entry-live');
    if (now) live.appendChild(el('em', null, '今日は' + now + '件開催中'));
    if (week) live.appendChild(el('em', null, '今週末は' + week + '件'));
    box.appendChild(live);
  }

  function load(opts) {
    opts = opts || {};
    var btn = $('refresh');
    btn.disabled = true;
    return fetch('data/news.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        showOffline(r.headers.get('X-Meshi-Offline') === '1');
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
        updateEvEntry();
        renderTrends();
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
  // 投票のページ
  if ($('vote')) buildVote();
  // ごはんイベントマップのページ
  if ($('ev-map')) buildEvents();
  // トップページ：行きたいイベントのお知らせ
  (function () {
    var entry = document.querySelector('.ev-entry');
    if (entry && $('grid')) renderNotices(entry.parentNode, entry);
  })();

  function buildEvents() {
    var SPOTS = {
      sakae: { label: '久屋大通・栄', c: [35.1700, 136.9080], z: 16 },
      meieki: { label: '名駅', c: [35.1705, 136.8830], z: 16 },
      osu: { label: '大須・金山', c: [35.1520, 136.9030], z: 15 },
      all: { label: '東海ぜんぶ', c: [35.10, 136.95], z: 9 }
    };
    var ev = { items: [], filter: store.get('meshi.evFilter', 'active'), markers: {}, map: null };
    var hasMap = typeof window.L !== 'undefined';
    if (hasMap) {
      ev.map = L.map('ev-map', { zoomControl: true, scrollWheelZoom: false }).setView(SPOTS.sakae.c, 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(ev.map);
    } else {
      $('ev-map').textContent = '地図を読み込めませんでした。下の一覧をご覧ください。';
      $('ev-map').classList.add('ev-map-failed');
    }
    // 場所のボタン
    var spots = $('ev-spots');
    Object.keys(SPOTS).forEach(function (k) {
      var b = el('button', 'ev-spot' + (k === 'sakae' ? ' is-on' : ''), SPOTS[k].label);
      b.type = 'button';
      b.setAttribute('aria-pressed', k === 'sakae' ? 'true' : 'false');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(spots.children, function (x) {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        if (ev.map) ev.map.flyTo(SPOTS[k].c, SPOTS[k].z, { duration: 0.8 });
        $('ev-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      spots.appendChild(b);
    });
    // 絞り込み
    var FILTERS = [
      { id: 'active', label: '開催中・これから' },
      { id: 'now', label: '開催中だけ' },
      { id: 'indoor', label: '雨でもOK（屋内）' },
      { id: 'saved', label: '行きたいだけ' },
      { id: 'all', label: 'すべて（終了も）' }
    ];
    if (!FILTERS.some(function (f) { return f.id === ev.filter; })) ev.filter = 'active';
    var fbox = $('ev-filters');
    FILTERS.forEach(function (f) {
      var b = el('button', 'g-pill ev-filter', f.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(ev.filter === f.id));
      b.dataset.filter = f.id;
      b.addEventListener('click', function () { setFilter(f.id); });
      fbox.appendChild(b);
    });

    function setFilter(id) {
      ev.filter = id;
      store.set('meshi.evFilter', id);
      Array.prototype.forEach.call(fbox.children, function (x) { x.setAttribute('aria-pressed', String(x.dataset.filter === id)); });
      render();
    }

    var ORDER = { now: 0, soon: 1, unknown: 2, past: 3 };
    function visible(it) {
      var st = eventStatus(it).id;
      if (ev.filter === 'now') return st === 'now';
      if (ev.filter === 'saved') return gSaved(it);
      if (ev.filter === 'indoor') return st !== 'past' && it.place === 'indoor';
      if (ev.filter === 'active') return st !== 'past';
      return true;
    }
    function sorted(list) {
      return list.slice().sort(function (a, b) {
        var sa = eventStatus(a).id, sb = eventStatus(b).id;
        if (ORDER[sa] !== ORDER[sb]) return ORDER[sa] - ORDER[sb];
        if (sa === 'soon') return (a.start || '').localeCompare(b.start || '');
        if (sa === 'now') return (a.end || '9999').localeCompare(b.end || '9999');
        return Date.parse(b.published) - Date.parse(a.published);
      });
    }

    function popupHtml(venue, list) {
      var wrap = document.createElement('div');
      wrap.className = 'ev-pop';
      wrap.appendChild(el('p', 'ev-pop-venue', venue));
      list.forEach(function (it) {
        var st = eventStatus(it);
        var row = el('div', 'ev-pop-row');
        if (it.image) row.appendChild(evPhoto(it, 'ev-photo-pop'));
        row.appendChild(el('span', 'ev-status ' + st.id, st.label));
        var a = el('a', 'ev-pop-title', it.title);
        a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
        row.appendChild(a);
        row.appendChild(el('span', 'ev-pop-when', eventRange(it)));
        wrap.appendChild(row);
      });
      return wrap;
    }

    var EVCAT = CAT.event || { label: 'イベント', color: '#0E7490' };
    function evPhoto(it, cls) {
      var a = el('a', 'ev-photo ' + cls);
      a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-hidden', 'true');
      a.tabIndex = -1;
      a.appendChild(photo(it, EVCAT, false));
      return a;
    }
    function showOnMap(it) {
      if (!ev.map) return;
      $('ev-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      ev.map.flyTo([it.lat, it.lng], 17, { duration: 0.8 });
      var m = ev.markers[it.venue];
      if (m) setTimeout(function () { m.openPopup(); }, 850);
    }
    function gSaved(g) {
      return (g.articles || [g]).some(function (a) { return isSaved(a.id); });
    }
    function saveButton(it) {
      var on = gSaved(it);
      var b = el('button', 'ev-save' + (on ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      b.appendChild(svg('heart', 'ev-save-icon'));
      b.appendChild(document.createTextNode(on ? '行きたい済み' : '行きたい'));
      b.addEventListener('click', function () {
        if (on) (it.articles || [it]).forEach(function (a) { if (isSaved(a.id)) toggleSaved(a); });
        else toggleSaved(it);
        render();
        if (!on) gToastEv(it);
      });
      return b;
    }
    function gToastEv(it) {
      var st = eventStatus(it).id;
      var t = $('ev-toast');
      if (!t) return;
      t.textContent = (it.start || it.end) && st !== 'past'
        ? '保存しました。始まる日や最終日の前日に、このページとトップでお知らせします'
        : '保存しました（日程が分からないため、お知らせはできません）';
      t.hidden = false;
      clearTimeout(gToastEv.timer);
      gToastEv.timer = setTimeout(function () { t.hidden = true; }, 3600);
    }

    function calMenu(it) {
      var d = el('details', 'ev-cal');
      var sm = el('summary', 'ev-cal-btn');
      sm.appendChild(svg('cal', 'ev-onmap-icon'));
      sm.appendChild(document.createTextNode('カレンダーに追加'));
      d.appendChild(sm);
      var menu = el('div', 'ev-cal-menu');
      var a1 = el('a', 'ev-cal-link', 'iPhone・スマホのカレンダー');
      if (it.fromData && it.group) a1.href = 'cal/' + it.group + '.ics';
      else { a1.href = icsDataUrl(it); a1.setAttribute('download', 'event.ics'); }
      var a2 = el('a', 'ev-cal-link', 'Googleカレンダー');
      a2.href = googleCalUrl(it); a2.target = '_blank'; a2.rel = 'noopener';
      menu.appendChild(a1);
      menu.appendChild(a2);
      menu.appendChild(el('p', 'ev-cal-note', calNote(it)));
      d.appendChild(menu);
      return d;
    }
    function calNote(it) {
      if (!it.start) return '開始日がわからないため、今日から' + fmtDay(it.end) + 'までで入れます';
      return eventRange(it) + 'の終日の予定として入れます';
    }
    function moreArticles(it) {
      var d = el('details', 'ev-more');
      d.appendChild(el('summary', null, 'このイベントの記事 ' + it.articles.length + '本'));
      var ul = el('ul', 'ev-more-list');
      it.articles.forEach(function (x) {
        var li = el('li');
        var a = el('a', null, x.title);
        a.href = x.link; a.target = '_blank'; a.rel = 'noopener';
        li.appendChild(a);
        li.appendChild(el('span', 'ev-src', ' ' + (x.source || '')));
        ul.appendChild(li);
      });
      d.appendChild(ul);
      return d;
    }
    function placeTag(it) {
      if (it.place === 'indoor') return el('span', 'ev-place indoor', '屋内');
      if (it.place === 'outdoor') return el('span', 'ev-place outdoor', '屋外');
      return null;
    }

    // ---- 天気（data/weather.json：Open-Meteo の名古屋の予報） ----
    function wxDay(date) {
      var w = ev.weather;
      if (!w || !w.days) return null;
      if (Date.now() - Date.parse(w.updated) > 2 * 86400000) return null; // 古すぎる予報は使わない
      for (var i = 0; i < w.days.length; i++) if (w.days[i].date === date) return w.days[i];
      return null;
    }
    function wxKind(d) {
      var c = d.code;
      if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
      if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return 'rain';
      if (c >= 2) return 'cloud';
      return 'sun';
    }
    var WX = { sun: ['☀️', '晴れ'], cloud: ['☁️', 'くもり'], rain: ['☔', '雨'], snow: ['⛄', '雪'] };
    function isRainy(d) {
      var k = wxKind(d);
      return (d.pop != null && d.pop >= 50) || ((k === 'rain' || k === 'snow') && (d.pop == null || d.pop >= 30)) || (d.rain != null && d.rain >= 2);
    }
    function wxChip(label, d) {
      var k = wxKind(d);
      var c = el('span', 'ev-wx' + (isRainy(d) ? ' rainy' : ''));
      c.appendChild(el('b', null, label));
      c.appendChild(el('span', 'ev-wx-icon', WX[k][0]));
      c.appendChild(el('span', null, WX[k][1]));
      if (d.tmax != null) c.appendChild(el('span', 'ev-wx-temp', Math.round(d.tmax) + '° / ' + Math.round(d.tmin) + '°'));
      if (d.pop != null) c.appendChild(el('span', 'ev-wx-pop', '☂' + d.pop + '%'));
      return c;
    }

    function renderWeekend() {
      var box = $('ev-weekend');
      if (!box) return;
      var wk = weekendJst();
      var list = sorted(ev.items.filter(function (it) { return onWeekend(it, wk); }));
      box.textContent = '';
      var head = el('div', 'ev-wk-head');
      head.appendChild(el('h2', null, '今週末のおすすめ'));
      head.appendChild(el('span', 'ev-wk-days', fmtDay(wk.sat) + '・' + fmtDay(wk.sun)));
      box.appendChild(head);
      // 週末の天気（今日より前の日は出さない）
      var today = todayJst();
      var days = [[wk.sat, '土'], [wk.sun, '日']].filter(function (x) { return x[0] >= today; })
        .map(function (x) { return { date: x[0], label: x[1], d: wxDay(x[0]) }; })
        .filter(function (x) { return x.d; });
      var rainyDays = days.filter(function (x) { return isRainy(x.d); });
      if (days.length) {
        var wx = el('div', 'ev-wx-row');
        days.forEach(function (x) { wx.appendChild(wxChip(x.label + ' ' + fmtDay(x.date).replace(/（.）/, ''), x.d)); });
        wx.appendChild(el('span', 'ev-wx-src', '名古屋の予報'));
        box.appendChild(wx);
      }
      if (rainyDays.length) {
        var indoorN = ev.items.filter(function (it) { return it.place === 'indoor' && eventStatus(it).id !== 'past'; }).length;
        var rain = el('div', 'ev-rain');
        var msg = rainyDays.map(function (x) { return x.label + '曜' + (x.d.pop != null ? '（' + x.d.pop + '%）' : ''); }).join('・');
        rain.appendChild(el('p', null, '☔ ' + msg + 'は雨の予報です。屋内のイベントなら濡れずに楽しめます。'));
        if (indoorN) {
          var go = el('button', 'ev-rain-btn', '屋内のイベントを見る（' + indoorN + '件）');
          go.type = 'button';
          go.addEventListener('click', function () {
            setFilter('indoor');
            $('ev-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          rain.appendChild(go);
        }
        box.appendChild(rain);
        // 雨の週末は屋内を先に
        var rank = { indoor: 0, undefined: 1, outdoor: 2 };
        list = list.slice().sort(function (a, b) { return (rank[a.place] != null ? rank[a.place] : 1) - (rank[b.place] != null ? rank[b.place] : 1); });
      }
      if (!list.length) {
        box.appendChild(el('p', 'ev-wk-empty', '今週末に開催のイベントはまだ見つかっていません。新しいニュースが入ったらここに出ます。'));
        return;
      }
      var row = el('div', 'ev-wk-row');
      list.forEach(function (it) {
        var st = eventStatus(it);
        var c = el('article', 'ev-wk-card');
        c.appendChild(evPhoto(it, 'ev-photo-wk'));
        var top = el('div', 'ev-card-head');
        top.appendChild(el('span', 'ev-status ' + st.id, st.label));
        top.appendChild(el('span', 'ev-when', eventRange(it)));
        var wpt = placeTag(it);
        if (wpt) top.appendChild(wpt);
        if (rainyDays.length && it.place === 'outdoor') top.appendChild(el('span', 'ev-place rainwarn', '雨に注意'));
        c.appendChild(top);
        var a = el('a', 'ev-wk-title', it.title);
        a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
        c.appendChild(a);
        if (it.venue || (it.articles && it.articles.length > 1)) {
          c.appendChild(el('p', 'ev-wk-venue', [it.venue, it.articles && it.articles.length > 1 ? '記事' + it.articles.length + '本' : '']
            .filter(Boolean).join(' ・ ')));
        }
        var foot = el('div', 'ev-wk-foot');
        if (it.venue && ev.map) {
          var go = el('button', 'ev-onmap');
          go.type = 'button';
          go.appendChild(svg('pin', 'ev-onmap-icon'));
          go.appendChild(document.createTextNode('地図'));
          go.addEventListener('click', function () { showOnMap(it); });
          foot.appendChild(go);
        }
        foot.appendChild(saveButton(it));
        c.appendChild(foot);
        row.appendChild(c);
      });
      box.appendChild(row);
    }

    function render() {
      renderWeekend();
      renderNotices($('ev-notice-slot'));
      var list = sorted(ev.items.filter(visible));
      // 地図：会場ごとに1本のピン
      if (ev.map) {
        Object.keys(ev.markers).forEach(function (k) { ev.markers[k].remove(); });
        ev.markers = {};
        var byVenue = {};
        list.forEach(function (it) {
          if (it.lat == null) return;
          (byVenue[it.venue] = byVenue[it.venue] || []).push(it);
        });
        Object.keys(byVenue).forEach(function (v) {
          var items = byVenue[v];
          var best = items.map(function (x) { return eventStatus(x).id; }).sort(function (a, b) { return ORDER[a] - ORDER[b]; })[0];
          var icon = L.divIcon({
            className: 'ev-pin-wrap',
            html: '<span class="ev-pin ' + best + '"><span class="ev-pin-n">' + items.length + '</span></span>',
            iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36]
          });
          var m = L.marker([items[0].lat, items[0].lng], { icon: icon, title: v, keyboard: true }).addTo(ev.map);
          m.bindPopup(popupHtml(v, items), { maxWidth: 280, maxHeight: 360 });
          ev.markers[v] = m;
        });
      }
      // 一覧
      var box = $('ev-list');
      box.textContent = '';
      var withPlace = list.filter(function (it) { return it.venue; });
      var noPlace = list.filter(function (it) { return !it.venue; });
      $('ev-count').textContent = list.length ? '全' + list.length + '件（地図にのせたもの ' + withPlace.length + '件）' : '';
      $('ev-empty').hidden = list.length > 0;
      var addCard = function (it, target) {
        var st = eventStatus(it);
        var c = el('article', 'ev-card ' + st.id);
        c.appendChild(evPhoto(it, 'ev-photo-card'));
        var head = el('div', 'ev-card-head');
        head.appendChild(el('span', 'ev-status ' + st.id, st.label));
        head.appendChild(el('span', 'ev-when', eventRange(it)));
        var pt = placeTag(it);
        if (pt) head.appendChild(pt);
        c.appendChild(head);
        var a = el('a', 'ev-title', it.title);
        a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
        c.appendChild(a);
        if (it.articles && it.articles.length > 1) c.appendChild(moreArticles(it));
        var foot = el('div', 'ev-card-foot');
        if (it.venue) {
          var go = el('button', 'ev-onmap');
          go.type = 'button';
          go.appendChild(svg('pin', 'ev-onmap-icon'));
          go.appendChild(document.createTextNode(it.venue + 'を地図で見る'));
          go.addEventListener('click', function () { showOnMap(it); });
          foot.appendChild(go);
        }
        foot.appendChild(saveButton(it));
        if ((it.start || it.end) && st.id !== 'past') foot.appendChild(calMenu(it));
        foot.appendChild(el('span', 'ev-src', it.source || ''));
        c.appendChild(foot);
        target.appendChild(c);
      };
      withPlace.forEach(function (it) { addCard(it, box); });
      if (noPlace.length) {
        box.appendChild(el('h3', 'ev-sub', '場所は記事で確認'));
        noPlace.forEach(function (it) { addCard(it, box); });
      }
    }

    fetch('data/news.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (r.headers.get('X-Meshi-Offline') === '1') showOffline(true);
        return r.json();
      })
      .then(function (d) {
        ev.items = groupEvents((d.items || []).filter(function (it) { return it.category === 'event'; }));
        ev.items.forEach(function (g) { g.fromData = true; });
        // 記事一覧から消えた「行きたい」イベントも残す
        var owner = {};
        ev.items.forEach(function (g) { g.articles.forEach(function (a) { owner[a.id] = g; }); });
        state.savedItems.forEach(function (it) {
          if (it.category === 'event' && !owner[it.id]) {
            var g = {};
            Object.keys(it).forEach(function (k) { g[k] = it[k]; });
            g.articles = [it];
            ev.items.push(g);
          }
        });
        // 保存してある日程を最新の読み取り結果（まとめた日程）にそろえる
        var changed = false;
        state.savedItems.forEach(function (s) {
          var g = owner[s.id];
          if (g && (g.start !== s.start || g.end !== s.end || g.venue !== s.venue || g.place !== s.place)) {
            s.start = g.start; s.end = g.end; s.venue = g.venue; s.lat = g.lat; s.lng = g.lng; s.place = g.place; changed = true;
          }
        });
        if (changed) store.set('meshi.saved', state.savedItems);
        render();
        fetch('data/weather.json?t=' + Date.now(), { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (w) { if (w) { ev.weather = w; renderWeekend(); } })
          .catch(function () { /* 天気がなくてもイベントは出す */ });
      })
      .catch(function () {
        $('ev-count').textContent = 'イベント情報を読み込めませんでした。';
      });
  }

  function buildVote() {
    var data = null;
    try {
      var m = /[#&]d=([^&]+)/.exec(location.hash);
      data = m ? JSON.parse(b64urlDecode(m[1])) : null;
    } catch (e) { data = null; }
    var list = $('vote-list');
    if (!Array.isArray(data) || !data.length) {
      $('vote-status').textContent = '投票のリンクが読み取れませんでした。送ってくれた人にもう一度リンクを送ってもらってください。';
      return;
    }
    var key = 'meshi.voted.' + location.hash.slice(0, 80);
    var voted = store.get(key, null);
    data.slice(0, 3).forEach(function (x, i) {
      var card = el('article', 'vote-card');
      card.style.setProperty('--i', i);
      var th = el('span', 'vote-thumb');
      if (x.p && /^https?:/.test(x.p)) {
        var img = document.createElement('img');
        img.src = x.p; img.alt = ''; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { img.remove(); });
        th.appendChild(img);
      }
      th.appendChild(el('span', 'vote-num', NUMS[i]));
      card.appendChild(th);
      var body = el('div', 'vote-body');
      body.appendChild(el('span', 'vote-genre', x.g || ''));
      body.appendChild(el('p', 'vote-name', x.n || ''));
      var meta = [x.a, x.b].filter(Boolean).join(' ・ ');
      if (meta) body.appendChild(el('p', 'vote-meta', meta));
      var links = el('div', 'vote-links');
      [[x.u, '詳しく見る'], [x.m, 'Googleで口コミ']].forEach(function (l) {
        if (!l[0] || !/^https?:/.test(l[0])) return;
        var a = el('a', 'vote-link', l[1]);
        a.href = l[0]; a.target = '_blank'; a.rel = 'noopener';
        links.appendChild(a);
      });
      body.appendChild(links);
      var btn = el('a', 'vote-btn' + (voted === i ? ' done' : ''), voted === i ? NUMS[i] + 'に投票しました' : NUMS[i] + 'に1票！（LINEで送る）');
      var text = '【飯ガチャ投票】' + NUMS[i] + '「' + x.n + '」に1票！\n' + location.href;
      btn.href = 'https://line.me/R/share?text=' + encodeURIComponent(text);
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.addEventListener('click', function () {
        store.set(key, i);
        document.querySelectorAll('.vote-btn').forEach(function (o, j) {
          o.classList.toggle('done', j === i);
          o.textContent = j === i ? NUMS[j] + 'に投票しました' : NUMS[j] + 'に1票！（LINEで送る）';
        });
      });
      body.appendChild(btn);
      card.appendChild(body);
      list.appendChild(card);
    });
    $('vote-status').textContent = voted != null ? 'あなたは' + NUMS[voted] + 'に投票済みです（選び直しもできます）' : '';
  }

  // ---------- ホーム画面アプリ ----------
  function showOffline(on) {
    var bar = $('offline-bar');
    if (bar) bar.hidden = !on;
  }
  window.addEventListener('online', function () { showOffline(false); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 使えない環境では何もしない */ });
    });
  }

  // 「ホーム画面に追加」の案内（アプリとして開いているとき・閉じたあとは出さない）
  (function () {
    var bar = $('a2hs');
    if (!bar) return;
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (standalone || store.get('meshi.a2hsDismissed', false)) return;
    var ua = navigator.userAgent;
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var show = function (text, canPrompt) {
      $('a2hs-text').textContent = text;
      $('a2hs-btn').hidden = !canPrompt;
      bar.hidden = false;
      requestAnimationFrame(function () { bar.classList.add('show'); });
    };
    var hide = function () {
      bar.classList.remove('show');
      store.set('meshi.a2hsDismissed', true);
      setTimeout(function () { bar.hidden = true; }, 300);
    };
    $('a2hs-close').addEventListener('click', hide);
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {   // Android の Chrome など
      e.preventDefault();
      deferred = e;
      show('ホーム画面に追加すると、アプリのようにすぐ開けます', true);
    });
    $('a2hs-btn').addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; hide(); });
    });
    window.addEventListener('appinstalled', hide);
    if (ios) {
      setTimeout(function () {
        show('共有ボタン（□↑）→「ホーム画面に追加」で、アプリのように開けます', false);
      }, 4000);
    }
  })();
})();

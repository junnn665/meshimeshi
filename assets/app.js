(function () {
  'use strict';

  var CATEGORIES = [
    { id: 'all', label: 'すべて', color: '#2B2118' },
    { id: 'deka', label: 'デカ盛り', color: '#C2410C', short: '盛' },
    { id: 'wadai', label: '話題・行列', color: '#B91C1C', short: '話' },
    { id: 'shinten', label: '新店', color: '#3F6212', short: '新' },
    { id: 'chain', label: 'チェーン新作', color: '#1D4ED8', short: '作' },
    { id: 'conbini', label: 'コンビニ', color: '#86198F', short: 'コ' },
    { id: 'yasuuma', label: '安うま', color: '#A16207', short: '安' }
  ];
  var CAT = {};
  CATEGORIES.forEach(function (c) { CAT[c.id] = c; });

  // カテゴリのアイコン（線画SVG）
  var ICONS = {
    all: '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M9 8c0-1.5 1-2 1-3.5M14 8c0-1.5 1-2 1-3.5"/>',
    deka: '<path d="M3 13h18a9 9 0 0 1-18 0z"/><path d="M6 13c0-4.5 2.7-8 6-8s6 3.5 6 8"/><path d="M10 9.5h.01M14 8.5h.01M12.5 11h.01"/>',
    wadai: '<path d="M12 3c.8 3.6 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2.6 1.4-3.8 2-5.7.9 1 1.6 1.7 2.6 2C11.9 7.6 11.2 5.3 12 3z"/>',
    shinten: '<path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>',
    chain: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M19 3v3M17.5 4.5h3"/>',
    conbini: '<path d="M12 4C10 4 4 13.5 4 17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3c0-3.5-6-13-8-13z"/><path d="M9 15h6v5H9z"/>',
    yasuuma: '<circle cx="12" cy="12" r="9"/><path d="M9 7l3 4 3-4M12 11v6M9 12.5h6M9 15h6"/>'
  };
  function icon(id) {
    var s = document.createElement('span');
    s.className = 'tab-icon';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[id] + '</svg>';
    return s;
  }

  var PAGE_SIZE = 24;
  var state = { items: [], tab: 'all', shown: PAGE_SIZE };

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // URLのタブ指定（#deka など）を復元
  var hash = location.hash.replace('#', '');
  if (CAT[hash]) state.tab = hash;

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

  function filtered() {
    if (state.tab === 'all') return state.items;
    return state.items.filter(function (it) { return it.category === state.tab; });
  }

  function renderTabs() {
    var nav = $('tabs');
    nav.textContent = '';
    CATEGORIES.forEach(function (c) {
      var n = c.id === 'all'
        ? state.items.length
        : state.items.filter(function (it) { return it.category === c.id; }).length;
      var b = el('button', 'tab');
      b.type = 'button';
      b.style.setProperty('--cat', c.color);
      b.setAttribute('aria-pressed', String(state.tab === c.id));
      b.appendChild(icon(c.id));
      // 1文字ずつ分けておく（お品書き札で縦に積むため）
      var lab = el('span', 'tab-label');
      lab.setAttribute('aria-label', c.label);
      Array.prototype.forEach.call(c.label, function (ch) {
        var s = el('span', ch === 'ー' ? 'ch chouon' : 'ch', ch);
        s.setAttribute('aria-hidden', 'true');
        lab.appendChild(s);
      });
      b.appendChild(lab);
      if (state.items.length) b.appendChild(el('span', 'count', String(n)));
      b.addEventListener('click', function () {
        state.tab = c.id;
        state.shown = PAGE_SIZE;
        history.replaceState(null, '', c.id === 'all' ? location.pathname : '#' + c.id);
        Array.prototype.forEach.call(nav.children, function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        renderList();
        centerActive(true);
      });
      nav.appendChild(b);
    });
    centerActive(false);
  }

  // 横スクロールのときは選んだカテゴリを真ん中に寄せる
  function centerActive(smooth) {
    var nav = $('tabs');
    var act = nav.querySelector('[aria-pressed="true"]');
    if (!act || nav.scrollWidth <= nav.clientWidth) return;
    var left = act.offsetLeft - (nav.clientWidth - act.offsetWidth) / 2;
    nav.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' });
  }

  function photo(it, cat) {
    var box = el('span', 'photo');
    var fallback = function () {
      box.textContent = '';
      box.style.background = cat.color + '1F';
      box.appendChild(el('span', 'photo-fallback', cat.label));
    };
    if (it.image) {
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      // 直接読めない写真（直リンク禁止など）は、画像中継サービス経由でもう一度試す
      var relay = 'https://wsrv.nl/?url=' + encodeURIComponent(it.image) + '&w=720&h=400&fit=cover&a=attention&output=webp';
      var tried = false;
      img.addEventListener('error', function () {
        if (!tried) { tried = true; img.src = relay; }
        else fallback();
      });
      img.addEventListener('load', function () {
        if (img.naturalWidth < 40) fallback(); // 1px画像などのダミー
      });
      img.src = it.image;
      box.appendChild(img);
    } else {
      fallback();
    }
    return box;
  }

  function card(it) {
    var cat = CAT[it.category] || CAT.wadai;
    var a = el('a', 'card');
    a.href = it.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(photo(it, cat));

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
    return a;
  }

  function renderList() {
    var list = filtered();
    var grid = $('grid');
    grid.textContent = '';
    var frag = document.createDocumentFragment();
    list.slice(0, state.shown).forEach(function (it) { frag.appendChild(card(it)); });
    grid.appendChild(frag);
    $('more').hidden = list.length <= state.shown;
    $('heading').textContent = state.tab === 'all' ? 'すべてのニュース' : CAT[state.tab].label + 'のニュース';
    if (state.items.length && !list.length) {
      $('status').textContent = 'このカテゴリの新しいニュースはまだありません。';
    } else if (state.items.length) {
      $('status').textContent = '';
    }
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

  function render() {
    renderTabs();
    renderList();
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
        render();
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

  renderTabs();
  load();
})();

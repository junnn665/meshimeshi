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
      var b = el('button', 'tab', c.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.tab === c.id));
      if (state.items.length) b.appendChild(el('span', 'count', String(n)));
      b.addEventListener('click', function () {
        state.tab = c.id;
        state.shown = PAGE_SIZE;
        history.replaceState(null, '', c.id === 'all' ? location.pathname : '#' + c.id);
        render();
      });
      nav.appendChild(b);
    });
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
      img.src = it.image;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', fallback);
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

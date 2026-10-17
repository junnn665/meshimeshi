/* 今から行ける ／ お出かけプラン（now.html）
 * 記事（話題のお店・イベント）、ホットペッパーと OpenStreetMap のお店、天気、現在地をつないで提案する。
 * 共通の部品は app.js の window.MESHI から使う。 */
(function () {
  'use strict';
  var M = window.MESHI;
  if (!M || !document.getElementById('nw')) return;
  var $ = M.$, el = M.el, svg = M.svg, store = M.store;

  // 出発地のプリセット（現在地を使わないとき）
  var SPOTS = [
    { id: 'sakae', label: '栄・久屋大通', lat: 35.1700, lng: 136.9085 },
    { id: 'meieki', label: '名駅', lat: 35.1709, lng: 136.8816 },
    { id: 'osu', label: '大須', lat: 35.1596, lng: 136.9016 },
    { id: 'kanayama', label: '金山', lat: 35.1428, lng: 136.9010 },
    { id: 'fushimi', label: '伏見', lat: 35.1691, lng: 136.8975 }
  ];
  var WALK = 80;            // 歩く速さ（m/分）
  var NEAR = 1200;          // 「近く」のお店の範囲（m）
  var EVENT_RANGE = 6000;   // 今日のイベントを探す範囲（m）

  // 時間帯ごとのジャンル
  var SLOTS = {
    morning: { label: 'モーニング', genres: ['カフェ'], word: /モーニング|喫茶|珈琲|コーヒー|パン|ベーカリー/ },
    lunch: { label: 'ランチ', genres: ['ラーメン', '和食', '洋食', '中華', 'イタリアン', 'エスニック', '韓国料理', 'お好み焼き'] },
    cafe: { label: 'カフェ・甘いもの', genres: ['カフェ'] },
    dinner: { label: '夜ごはん', genres: ['居酒屋', '焼肉', '和食', '中華', 'イタリアン', '韓国料理', 'ラーメン', '洋食', 'お好み焼き', 'エスニック'] },
    late: { label: '夜食', genres: ['ラーメン', '居酒屋'] },
    second: { label: '2軒目', genres: ['居酒屋', 'カフェ', 'ラーメン'] }
  };
  function slotAt(min) {
    if (min >= 300 && min < 630) return 'morning';
    if (min >= 630 && min < 870) return 'lunch';
    if (min >= 870 && min < 1020) return 'cafe';
    if (min >= 1020 && min < 1320) return 'dinner';
    return 'late';
  }

  // ---------- データの読み込み（1回だけ） ----------
  var data = { news: [], events: [], weather: null, shops: [], trends: null };
  var dataP = null;
  var parts = null;
  function loadParts() {
    if (parts) return parts;
    var news = fetch('data/news.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (r.headers.get('X-Meshi-Offline') === '1') M.showOffline(true); return r.json(); })
      .then(function (d) {
        data.news = d.items || [];
        data.events = M.groupEvents(data.news.filter(function (it) { return it.category === 'event'; }));
      }).catch(function () { /* 記事がなくても続ける */ });
    var wx = fetch('data/weather.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (w) { data.weather = w; }).catch(function () { /* noop */ });
    var shops = M.loadAllShops().then(function (l) { data.shops = l; }).catch(function () { data.shops = []; });
    parts = { news: news, wx: wx, shops: shops };
    return parts;
  }
  function loadData() {
    if (dataP) return dataP;
    var p = loadParts();
    dataP = Promise.all([p.news, p.wx, p.shops]);
    return dataP;
  }
  var osmMemo = {};
  function osmAround(p, radius) {
    var k = p.lat.toFixed(3) + ',' + p.lng.toFixed(3) + ',' + radius;
    if (!osmMemo[k]) osmMemo[k] = M.loadOsmAt(p, radius).catch(function () { return null; });
    return osmMemo[k];
  }
  // 地図データの検索は混んでいると遅いので、待つのは OSM_WAIT ミリ秒まで（「待たずに見る」でも打ち切れる）
  var OSM_WAIT = 6000;
  function osmWithin(p, radius, slip) {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (list, how) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (slip) {
          if (how === 'ok') slip.done('osm', list.length ? list.length + '軒みつかりました' : '');
          else if (how === 'fail') slip.skip('osm', '地図データにつながらなかったので、お店データだけで探します');
          else slip.skip('osm', how === 'skip' ? '待たずに先へ進みました' : '時間がかかっているので、お店データだけで先に進みます');
        }
        resolve(list || []);
      };
      var timer = setTimeout(function () { finish(null, 'timeout'); }, OSM_WAIT);
      if (slip) slip.onSkip('osm', function () { finish(null, 'skip'); });
      osmAround(p, radius).then(function (l) { finish(l || [], l ? 'ok' : 'fail'); });
    });
  }

  // ---------- 進み具合（注文伝票） ----------
  // steps: [{ id, label, icon }]
  function Slip(boxId, title) {
    this.box = $(boxId);
    this.title = title;
    this.rows = {};
    this.order = [];
    this.skipFns = {};
  }
  Slip.prototype.open = function (steps) {
    var self = this, box = this.box;
    box.textContent = '';
    box.hidden = false;
    box.classList.remove('done');
    this.order = steps.map(function (s) { return s.id; });
    this.state = {};
    this.t0 = Date.now();
    var head = el('div', 'slip-head');
    var bowl = el('span', 'slip-bowl');
    bowl.setAttribute('aria-hidden', 'true');
    bowl.innerHTML = '<svg viewBox="0 0 64 56"><defs><clipPath id="' + box.id + '-clip"><path d="M6 26h52a26 22 0 0 1-52 0z"/></clipPath></defs>' +
      '<g class="slip-steam"><path d="M22 14c0-4 3-5 3-9"/><path d="M32 14c0-4 3-5 3-9"/><path d="M42 14c0-4 3-5 3-9"/></g>' +
      '<g clip-path="url(#' + box.id + '-clip)"><rect x="0" y="26" width="64" height="30" fill="#E3D6BC"/>' +
      '<rect class="slip-rice" x="0" y="56" width="64" height="30" fill="#fff"/>' +
      '<g class="slip-grains"><ellipse cx="18" cy="0" rx="2.4" ry="1.4"/><ellipse cx="28" cy="0" rx="2.4" ry="1.4"/><ellipse cx="38" cy="0" rx="2.4" ry="1.4"/><ellipse cx="47" cy="0" rx="2.4" ry="1.4"/></g></g>' +
      '<path d="M6 26h52a26 22 0 0 1-52 0z" fill="none" stroke="#2B2118" stroke-width="3"/>' +
      '<path d="M4 26h56" stroke="#2B2118" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M24 49h16" stroke="#2B2118" stroke-width="3" stroke-linecap="round"/></svg>';
    head.appendChild(bowl);
    var ht = el('div', 'slip-title');
    ht.appendChild(el('span', 'slip-kicker', '伝票'));
    ht.appendChild(el('b', null, this.title));
    this.msg = ht.appendChild(el('span', 'slip-msg', '仕込み中… 0 / ' + steps.length));
    head.appendChild(ht);
    this.stamp = head.appendChild(el('span', 'slip-stamp', 'できあがり'));
    box.appendChild(head);
    var ol = el('ol', 'slip-list');
    steps.forEach(function (s) {
      var li = el('li', 'slip-row wait');
      li.appendChild(el('span', 'slip-mark', ''));
      var tx = el('span', 'slip-text');
      tx.appendChild(el('span', 'slip-label', s.label));
      var note = tx.appendChild(el('span', 'slip-note', ''));
      li.appendChild(tx);
      var btn = el('button', 'slip-skip', '待たずに見る');
      btn.type = 'button';
      btn.hidden = true;
      btn.addEventListener('click', function () { if (self.skipFns[s.id]) self.skipFns[s.id](); });
      li.appendChild(btn);
      ol.appendChild(li);
      self.rows[s.id] = { li: li, note: note, btn: btn, slow: s.slow };
    });
    box.appendChild(ol);
    this.update();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  Slip.prototype.set = function (id, st, note) {
    var r = this.rows[id];
    if (!r) return;
    var prev = this.state[id];
    if (prev === 'done' || prev === 'skip') return;
    this.state[id] = st;
    r.li.className = 'slip-row ' + st;
    if (note != null) r.note.textContent = note;
    clearTimeout(r.slowTimer);
    if (st === 'cook') {
      r.slowTimer = setTimeout(function () {
        r.note.textContent = r.slow || 'ちょっと混んでいます…';
        if (r.canSkip) r.btn.hidden = false;
      }, 3500);
    } else {
      r.btn.hidden = true;
    }
    this.update();
  };
  Slip.prototype.cook = function (id, note) { this.set(id, 'cook', note); };
  Slip.prototype.done = function (id, note) { this.set(id, 'done', note); };
  Slip.prototype.skip = function (id, note) { this.set(id, 'skip', note); };
  Slip.prototype.onSkip = function (id, fn) {
    this.skipFns[id] = fn;
    if (this.rows[id]) this.rows[id].canSkip = true;
  };
  Slip.prototype.track = function (id, promise, noteFn) {
    var self = this;
    this.cook(id);
    return promise.then(function (v) { self.done(id, noteFn ? noteFn(v) : ''); return v; },
      function (e) { self.skip(id, 'うまく読めませんでした'); throw e; });
  };
  Slip.prototype.update = function () {
    var self = this;
    var n = this.order.length;
    var fin = this.order.filter(function (id) { return self.state[id] === 'done' || self.state[id] === 'skip'; }).length;
    var rice = this.box.querySelector('.slip-rice');
    var grains = this.box.querySelector('.slip-grains');
    var y = 56 - 30 * (fin / n);
    if (rice) rice.setAttribute('y', String(y));
    if (grains) grains.setAttribute('transform', 'translate(0 ' + (y + 0.5) + ')');
    if (this.msg) this.msg.textContent = (fin === n ? 'できあがり！ ' : '仕込み中… ') + fin + ' / ' + n;
  };
  // 全部済んだら「できあがり」の判子を見せてから閉じる
  Slip.prototype.finish = function () {
    var self = this;
    this.box.classList.add('done');
    var quick = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise(function (resolve) {
      setTimeout(function () { self.box.hidden = true; resolve(); }, quick ? 150 : 650);
    });
  };
  Slip.prototype.fail = function () { this.box.hidden = true; };

  // ---------- 小さな道具 ----------
  function dist(a, b) { return M.distance({ lat: +a.lat, lng: +a.lng }, { lat: +b.lat, lng: +b.lng }); }
  function walkText(m) {
    if (m > 2500) return M.fmtDistance(m) + '（電車・車で）';
    return '歩いて' + Math.max(1, Math.round(m / WALK)) + '分';
  }
  function hm(min) {
    min = Math.round(min / 5) * 5;
    return Math.floor(min / 60) % 24 + ':' + ('0' + (min % 60)).slice(-2);
  }
  function jstNow() {
    // 端末の時計を日本時間として扱う（営業時間の判定も端末の時刻で行う）
    return new Date();
  }
  function minutesOf(d) { return d.getHours() * 60 + d.getMinutes(); }
  function dateAt(iso, min) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], Math.floor(min / 60), min % 60);
  }
  function mapsDir(p) {
    return 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + encodeURIComponent(p.lat + ',' + p.lng);
  }
  function shopLink(sh) {
    return sh.url || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(sh.name + ' ' + (sh.address || '')));
  }
  function pick(list, n) {
    // 上位 n 件の中からランダムに1つ（「別の案」で変わるように）
    var top = list.slice(0, Math.max(1, n || 4));
    return top[Math.floor(Math.random() * top.length)];
  }
  function shuffleTop(list, n) {
    var top = list.slice(0, n), rest = list.slice(n);
    for (var i = top.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = top[i]; top[i] = top[j]; top[j] = t;
    }
    return top.concat(rest);
  }
  function shopScore(sh, from) {
    var d = dist(sh, from);
    var s = 1 / (1 + d / 350);
    if (sh.photo) s *= 1.25;
    if (sh.rank) s *= 1 + (30 - Math.min(sh.rank, 30)) / 40;
    if (sh._buzz) s *= 1.8;
    return s;
  }

  // ---------- 天気 ----------
  var WX = { sun: '☀️', cloud: '☁️', rain: '☔', snow: '⛄' };
  function wxKind(code) {
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
    if (code >= 2) return 'cloud';
    return 'sun';
  }
  function wetHour(h) { return (h.pop != null && h.pop >= 50) || (h.rain != null && h.rain >= 0.5); }
  function fresh(w) { return w && Date.parse(w.updated) > Date.now() - 2 * 86400000; }
  // これからの天気：{ nowRain, rainFrom: 'HH時', hours: [...] }
  function weatherAhead() {
    var w = data.weather;
    if (!fresh(w) || !w.hours || !w.hours.length) return null;
    var now = jstNow();
    var key = M.todayJst() + 'T' + ('0' + now.getHours()).slice(-2) + ':00';
    var i = 0;
    while (i < w.hours.length && w.hours[i].time < key) i++;
    var next = w.hours.slice(i, i + 4);
    if (!next.length) return null;
    var res = { cur: next[0], nowRain: wetHour(next[0]), rainFrom: null, dryFrom: null };
    if (!res.nowRain) {
      for (var j = 1; j < next.length; j++) if (wetHour(next[j])) { res.rainFrom = +next[j].time.slice(11, 13); break; }
    } else {
      for (var k = 1; k < next.length; k++) if (!wetHour(next[k])) { res.dryFrom = +next[k].time.slice(11, 13); break; }
    }
    return res;
  }
  function dayWeather(iso) {
    var w = data.weather;
    if (!fresh(w) || !w.days) return null;
    for (var i = 0; i < w.days.length; i++) if (w.days[i].date === iso) return w.days[i];
    return null;
  }
  function dayRainy(d) { return d && ((d.pop != null && d.pop >= 50) || (d.rain != null && d.rain >= 2)); }

  // ---------- 候補づくり ----------
  // 今日（または指定日）にやっているイベント
  function eventsOn(iso) {
    return data.events.filter(function (g) {
      if (g.lat == null) return false;
      var s = g.start, e = g.end;
      if (!s && !e) return false;
      if (s && !e) e = M.addDays(s, 14); // 開始日だけわかるもの：2週間は続いているとみなす
      if (!s) s = '0000-00-00';
      return s <= iso && iso <= e;
    });
  }
  // ニュースの「お店の記事」をお店データに結びつける
  function buzzShops(shops) {
    var arts = data.news.filter(function (it) { return it.shop && it.shop_name && it.shop_name.length >= 2; });
    var out = [];
    arts.forEach(function (it) {
      var key = M.normName(it.shop_name);
      if (key.length < 3) return;
      var hit = null;
      for (var i = 0; i < shops.length; i++) {
        var sn = M.normName(shops[i].name);
        if (sn.length >= 3 && (sn.indexOf(key) >= 0 || key.indexOf(sn) >= 0)) { hit = shops[i]; break; }
      }
      if (hit && !out.some(function (x) { return x.shop.id === hit.id; })) {
        hit._buzz = it;
        out.push({ shop: hit, article: it });
      }
    });
    return out;
  }
  function genreMatch(sh, slot) {
    var s = SLOTS[slot];
    if (s.genres.indexOf(sh.genre) >= 0) return true;
    return s.word ? s.word.test(sh.name + ' ' + (sh.catch || '')) : false;
  }
  // 指定の時刻に開いているお店（open=true のみ。allowUnknown なら時間不明も）
  function openShops(list, at, slot, from, maxDist, allowUnknown) {
    return list.filter(function (sh) {
      if (sh.lat == null || sh.lng == null) return false;
      if (slot && !genreMatch(sh, slot)) return false;
      var d = dist(sh, from);
      if (d > maxDist) return false;
      var o = M.isOpenNow(sh, at);
      sh._open = o;
      return o === true || (allowUnknown && o === null);
    }).sort(function (a, b) {
      var oa = a._open === true ? 1 : 0.55, ob = b._open === true ? 1 : 0.55;
      return shopScore(b, from) * ob - shopScore(a, from) * oa;
    });
  }

  // ---------- 表示の部品 ----------
  function thumb(src) {
    var t = el('span', 'nw-thumb');
    if (src) {
      var img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = src;
      img.addEventListener('error', function () { img.remove(); t.classList.add('none'); });
      t.appendChild(img);
    } else {
      t.classList.add('none');
    }
    return t;
  }
  function row(opts) {
    // opts: { img, tag, tagCls, title, href, sub, meta, dir, extra }
    var r = el('article', 'nw-row');
    r.appendChild(thumb(opts.img));
    var b = el('div', 'nw-row-body');
    var top = el('div', 'nw-row-top');
    if (opts.tag) top.appendChild(el('span', 'nw-tag ' + (opts.tagCls || ''), opts.tag));
    if (opts.meta) top.appendChild(el('span', 'nw-meta', opts.meta));
    b.appendChild(top);
    var a = el('a', 'nw-row-title', opts.title);
    a.href = opts.href; a.target = '_blank'; a.rel = 'noopener';
    b.appendChild(a);
    if (opts.sub) b.appendChild(el('p', 'nw-row-sub', opts.sub));
    if (opts.dir) {
      var d = el('a', 'nw-dir', '道順');
      d.href = opts.dir; d.target = '_blank'; d.rel = 'noopener';
      b.appendChild(d);
    }
    r.appendChild(b);
    return r;
  }
  function wxChips(box, w, label) {
    box.textContent = '';
    if (!w) return;
    var c = el('span', 'ev-wx' + (w.rainy ? ' rainy' : ''));
    c.appendChild(el('b', null, label));
    c.appendChild(el('span', 'ev-wx-icon', WX[wxKind(w.code)]));
    if (w.temp != null) c.appendChild(el('span', 'ev-wx-temp', Math.round(w.temp) + '°'));
    if (w.tmax != null) c.appendChild(el('span', 'ev-wx-temp', Math.round(w.tmax) + '° / ' + Math.round(w.tmin) + '°'));
    if (w.pop != null) c.appendChild(el('span', 'ev-wx-pop', '☂' + w.pop + '%'));
    box.appendChild(c);
    if (w.note) box.appendChild(el('span', 'ev-wx-src', w.note));
  }

  // ---------- 地図 ----------
  function makeMap(id) {
    if (typeof window.L === 'undefined') {
      $(id).textContent = '地図を読み込めませんでした。';
      $(id).classList.add('ev-map-failed');
      return null;
    }
    var m = L.map(id, { zoomControl: true, scrollWheelZoom: false }).setView([35.17, 136.90], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(m);
    return { map: m, layer: L.layerGroup().addTo(m) };
  }
  function pin(text, cls) {
    return L.divIcon({
      className: 'ev-pin-wrap',
      html: '<span class="nw-pin ' + (cls || '') + '"><span>' + text + '</span></span>',
      iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36]
    });
  }

  // =====================================================================
  // 今から行ける
  // =====================================================================
  var now = { from: null, fromLabel: '', mapObj: null, genre: 'all', ctx: null };

  var nowSlip = new Slip('nw-slip', '今から行けるごはん');
  function nowSteps(withHere) {
    var st = [];
    if (withHere) st.push({ id: 'here', label: '現在地をたしかめる', slow: '位置情報の返事待ち…（屋内だと時間がかかることがあります）' });
    st.push({ id: 'news', label: '今日のネタ（話題のお店・イベント）を仕入れる' });
    st.push({ id: 'shops', label: 'お店リストを広げる' });
    st.push({ id: 'osm', label: '近所のお店を地図で探す', slow: '地図データの返事待ち…' });
    st.push({ id: 'wx', label: '空模様を見る' });
    st.push({ id: 'cook', label: 'おすすめを盛りつける' });
    return st;
  }
  // 記事・お店・天気の3つ（ページを開いたときから読み込み済みのことも多い）
  function trackParts(slip) {
    var p = loadParts();
    return Promise.all([
      slip.track('news', p.news, function () {
        var ev = data.events.length, sh = data.news.filter(function (x) { return x.shop; }).length;
        return '記事' + data.news.length + '本（イベント' + ev + '・お店の話題' + sh + '）';
      }),
      slip.track('shops', p.shops, function () { return data.shops.length ? data.shops.length + '軒' : 'お店データなし'; }),
      slip.track('wx', p.wx, function () { return data.weather ? '名古屋の予報' : '予報なし'; })
    ]);
  }
  function startNow(from, label, slipOpened) {
    now.from = from; now.fromLabel = label;
    $('nw-status').textContent = '';
    $('nw-go').disabled = true;
    var slip = nowSlip;
    if (!slipOpened) slip.open(nowSteps(false));
    var osmP = (function () { slip.cook('osm'); return osmWithin(from, NEAR, slip); })();
    Promise.all([trackParts(slip), osmP]).then(function (r) {
      slip.cook('cook');
      var shops = M.mergeShops(data.shops, r[1]);
      buildNow(shops);
      slip.done('cook');
      return slip.finish();
    }).then(function () {
      $('nw-result').hidden = false;
      renderNowMap();   // 見えるようになってから地図の大きさを合わせ直す
      $('nw-story').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () {
      slip.fail();
      $('nw-status').textContent = 'データを読み込めませんでした。電波のよい場所でもう一度お試しください。';
    }).then(function () { $('nw-go').disabled = false; });
  }

  function buildNow(shops) {
    var from = now.from;
    var t = jstNow();
    var min = minutesOf(t);
    var slot = slotAt(min);
    var today = M.todayJst();
    var wx = weatherAhead();

    var near = shops.filter(function (sh) { return sh.lat != null && dist(sh, from) <= NEAR * 2.5; });
    var buzz = buzzShops(near).filter(function (b) { return dist(b.shop, from) <= NEAR * 2.5; });
    var evs = eventsOn(today).map(function (g) { g._d = dist(g, from); return g; })
      .filter(function (g) { return g._d <= EVENT_RANGE; })
      .sort(function (a, b) { return a._d - b._d; });
    var openNear = openShops(near, t, null, from, NEAR, false);
    now.ctx = { shops: near, buzz: buzz, evs: evs, open: openNear, slot: slot, wx: wx, t: t };

    $('nw-status').textContent = now.fromLabel + 'から探しました（' + hm(min) + '時点）';
    // 天気
    if (wx) {
      var note = wx.nowRain ? (wx.dryFrom ? wx.dryFrom + '時ごろにやみそう' : 'しばらく雨') :
        (wx.rainFrom ? wx.rainFrom + '時ごろから雨の予報' : 'しばらく雨は降らなさそう');
      wxChips($('nw-wx'), { code: wx.cur.code, temp: wx.cur.temp, pop: wx.cur.pop, rainy: wx.nowRain || !!wx.rainFrom, note: note }, '今の天気');
    } else {
      $('nw-wx').textContent = '';
    }
    renderStory();
    renderLists();
    renderNowMap();
  }

  // 1文の提案を作る
  function makeStory() {
    var c = now.ctx, from = now.from;
    var rain = c.wx && (c.wx.nowRain || c.wx.rainFrom);
    var slot = c.slot;
    var first = null, second = null, text = [];
    // 1) 近くで今日やっているイベント（雨なら屋外は外す）
    // 今まさに雨なら屋外は外す。これから降るだけなら「早めに」と添える
    var nowRain = c.wx && c.wx.nowRain;
    var evs = c.evs.filter(function (g) { return g._d <= 1600 && !(nowRain && g.place === 'outdoor'); });
    if (evs.length) {
      var ev = pick(evs, 2);
      first = { kind: 'event', item: ev, p: ev };
      text.push(walkText(ev._d) + 'の' + ev.venue + 'で「' + M.eventName(ev) + '」' + (M.eventStatus(ev).label === '今日まで' ? 'が今日まで。' : '開催中。'));
      if (c.wx && c.wx.rainFrom && ev.place !== 'indoor') { text.push(c.wx.rainFrom + '時ごろから雨の予報なので、早めに回るのがおすすめ。'); first.rainSaid = true; }
    }
    // 2) 話題のお店（営業中）
    var buzzOpen = c.buzz.filter(function (b) { return M.isOpenNow(b.shop, c.t) === true; })
      .sort(function (a, b) { return dist(a.shop, from) - dist(b.shop, from); });
    var meal = openShops(c.shops, c.t, slot, first ? first.p : from, first ? 900 : NEAR, false);
    if (!first) {
      if (buzzOpen.length && dist(buzzOpen[0].shop, from) <= NEAR * 1.5) {
        var bz = pick(buzzOpen, 2);
        first = { kind: 'shop', item: bz.shop, p: bz.shop, buzz: bz.article };
        text.push(walkText(dist(bz.shop, from)) + 'の「' + bz.shop.name + '」が営業中。ニュースで話題のお店です。');
      } else if (meal.length) {
        var m1 = pick(meal, 4);
        first = { kind: 'shop', item: m1, p: m1 };
        text.push(walkText(dist(m1, from)) + 'の' + m1.genre + '「' + m1.name + '」が営業中' +
          (m1.rank && m1.rank <= 10 ? '（このあたりの人気店）。' : '。'));
      }
    }
    if (!first) return null;
    // 3) 次の1軒（イベントのあとはごはん、ごはんのあとはカフェ・2軒目）
    var nextSlot = first.kind === 'event' ? slot : (slot === 'dinner' || slot === 'late' ? 'second' : 'cafe');
    var nextAt = new Date(c.t.getTime() + (first.kind === 'event' ? 75 : 60) * 60000);
    var maxD = rain ? 400 : 800;
    var cands = openShops(c.shops, nextAt, nextSlot, first.p, maxD, false)
      .filter(function (sh) { return sh.id !== first.item.id; });
    if (first.kind === 'event') {
      var bzNear = c.buzz.filter(function (b) { return dist(b.shop, first.p) <= maxD && M.isOpenNow(b.shop, nextAt) === true; });
      if (bzNear.length) cands = [bzNear[0].shop].concat(cands.filter(function (s) { return s.id !== bzNear[0].shop.id; }));
    }
    if (cands.length) {
      var s2 = pick(cands, 3);
      second = { kind: 'shop', item: s2, p: s2 };
      var lead = '';
      if (first.rainSaid) lead = '';
      else if (c.wx && c.wx.rainFrom) lead = c.wx.rainFrom + '時ごろから雨が降りそうなので、';
      else if (c.wx && c.wx.nowRain) lead = '雨なので、';
      var after = first.kind === 'event' ? (first.rainSaid ? '帰りは雨宿りもかねて' : '帰りは') : (nextSlot === 'second' ? 'そのあとは' : '食後は');
      var how = rain ? '近く（' + walkText(dist(s2, first.p)) + '）の' : '近くの';
      text.push(lead + after + how + s2.genre + '「' + s2.name + '」（営業中）へ。');
    } else if (c.wx && c.wx.rainFrom) {
      text.push(c.wx.rainFrom + '時ごろから雨が降りそうなので、早めの移動がおすすめです。');
    }
    return { first: first, second: second, text: text.join('') };
  }

  function storyCard(step, n) {
    var it = step.item;
    var card = el('div', 'nw-pick');
    card.appendChild(el('span', 'nw-pick-n', String(n)));
    var body = el('div', 'nw-pick-body');
    if (step.kind === 'event') {
      body.appendChild(el('span', 'nw-tag event', 'イベント・' + M.eventStatus(it).label));
      var a = el('a', 'nw-pick-title', M.eventName(it));
      a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
      body.appendChild(a);
      body.appendChild(el('p', 'nw-row-sub', it.venue + ' ・ ' + M.eventRange(it)));
    } else {
      body.appendChild(el('span', 'nw-tag' + (step.buzz || it._buzz ? ' buzz' : ''), (step.buzz || it._buzz ? '話題・' : '') + it.genre + '・営業中'));
      var b = el('a', 'nw-pick-title', it.name);
      b.href = shopLink(it); b.target = '_blank'; b.rel = 'noopener';
      body.appendChild(b);
      var sub = [it.budget, it.access].filter(Boolean).join(' ・ ');
      if (sub) body.appendChild(el('p', 'nw-row-sub', sub));
      var art = step.buzz || it._buzz;
      if (art) {
        var na = el('a', 'nw-news-link', '話題の記事：' + art.title);
        na.href = art.link; na.target = '_blank'; na.rel = 'noopener';
        body.appendChild(na);
      }
    }
    var d = el('a', 'nw-dir', '道順');
    d.href = mapsDir(step.p); d.target = '_blank'; d.rel = 'noopener';
    body.appendChild(d);
    card.appendChild(thumb(step.kind === 'event' ? it.image : (it.photo || (it._buzz && it._buzz.image))));
    card.appendChild(body);
    return card;
  }

  function renderStory() {
    var box = $('nw-story');
    box.textContent = '';
    var st = makeStory();
    now.story = st;
    box.appendChild(el('p', 'nw-story-kicker', 'いまのおすすめ'));
    if (!st) {
      box.appendChild(el('p', 'nw-story-text', '近くで今開いているお店が見つかりませんでした。別の場所から探すか、飯ガチャで東海ぜんぶから選んでみてください。'));
      var g = el('a', 'nw-act', '飯ガチャへ');
      g.href = 'gacha.html';
      box.appendChild(g);
      return;
    }
    box.appendChild(el('p', 'nw-story-text', st.text));
    var picks = el('div', 'nw-picks');
    picks.appendChild(storyCard(st.first, 1));
    if (st.second) picks.appendChild(storyCard(st.second, 2));
    box.appendChild(picks);
    var again = el('button', 'nw-act', '別の案にする');
    again.type = 'button';
    again.addEventListener('click', function () { renderStory(); renderNowMap(); });
    box.appendChild(again);
  }

  function renderLists() {
    var c = now.ctx, from = now.from;
    // イベント
    var eb = $('nw-events');
    eb.textContent = '';
    if (!c.evs.length) eb.appendChild(el('p', 'nw-empty', '近くで今日やっているイベントは見つかりませんでした。'));
    c.evs.slice(0, 6).forEach(function (g) {
      var rainNote = c.wx && (c.wx.nowRain || c.wx.rainFrom) && g.place === 'outdoor' ? ' ・ 屋外（雨に注意）' : (g.place === 'indoor' ? ' ・ 屋内' : '');
      eb.appendChild(row({
        img: g.image, tag: M.eventStatus(g).label, tagCls: 'event', meta: walkText(g._d),
        title: M.eventName(g), href: g.link, sub: g.venue + ' ・ ' + M.eventRange(g) + rainNote, dir: mapsDir(g)
      }));
    });
    // 話題のお店
    var bb = $('nw-buzz');
    bb.textContent = '';
    var bz = c.buzz.slice().sort(function (a, b) { return dist(a.shop, from) - dist(b.shop, from); }).slice(0, 6);
    if (!bz.length) bb.appendChild(el('p', 'nw-empty', '近くにニュースで話題のお店は見つかりませんでした。'));
    bz.forEach(function (b) {
      var o = M.isOpenNow(b.shop, c.t);
      bb.appendChild(row({
        img: b.shop.photo || b.article.image, tag: o === true ? '営業中' : (o === false ? '準備中' : '営業時間は要確認'),
        tagCls: o === true ? 'open' : 'closed', meta: walkText(dist(b.shop, from)),
        title: b.shop.name, href: shopLink(b.shop), sub: '話題：' + b.article.title, dir: mapsDir(b.shop)
      }));
    });
    // 今開いているお店（ジャンルで絞れる）
    var genres = ['all'];
    c.open.forEach(function (sh) { if (genres.indexOf(sh.genre) < 0) genres.push(sh.genre); });
    if (genres.indexOf(now.genre) < 0) now.genre = 'all';
    var gbox = $('nw-genres');
    gbox.textContent = '';
    genres.forEach(function (g) {
      var b = el('button', 'g-pill', g === 'all' ? 'ぜんぶ' : g);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(now.genre === g));
      b.addEventListener('click', function () { now.genre = g; renderLists(); });
      gbox.appendChild(b);
    });
    var ob = $('nw-open');
    ob.textContent = '';
    var list = c.open.filter(function (sh) { return now.genre === 'all' || sh.genre === now.genre; })
      .sort(function (a, b) { return dist(a, from) - dist(b, from); }).slice(0, 12);
    if (!list.length) ob.appendChild(el('p', 'nw-empty', '近くで今開いているお店が見つかりませんでした（営業時間がわかるお店だけを出しています）。'));
    list.forEach(function (sh) {
      ob.appendChild(row({
        img: sh.photo, tag: sh.genre, meta: walkText(dist(sh, from)),
        title: sh.name, href: shopLink(sh), sub: [sh.budget, sh.catch].filter(Boolean).join(' ・ '), dir: mapsDir(sh)
      }));
    });
  }

  function renderNowMap() {
    if (!now.mapObj) now.mapObj = makeMap('nw-map');
    var mo = now.mapObj;
    if (!mo) return;
    mo.layer.clearLayers();
    var pts = [[now.from.lat, now.from.lng]];
    L.marker([now.from.lat, now.from.lng], { icon: pin('今', 'here'), title: now.fromLabel }).addTo(mo.layer)
      .bindPopup(now.fromLabel);
    var st = now.story;
    if (st) {
      [st.first, st.second].forEach(function (s, i) {
        if (!s) return;
        var name = s.kind === 'event' ? M.eventName(s.item) : s.item.name;
        L.marker([+s.p.lat, +s.p.lng], { icon: pin(String(i + 1), s.kind === 'event' ? 'event' : 'shop'), title: name })
          .addTo(mo.layer).bindPopup(name);
        pts.push([+s.p.lat, +s.p.lng]);
      });
      L.polyline(pts, { color: '#D92D20', weight: 4, dashArray: '6 8', opacity: 0.8 }).addTo(mo.layer);
    }
    setTimeout(function () {
      mo.map.invalidateSize();
      mo.map.fitBounds(pts.length > 1 ? pts : [pts[0], pts[0]], { padding: [40, 40], maxZoom: 16 });
    }, 50);
  }

  function initNow() {
    var spots = $('nw-spots');
    SPOTS.forEach(function (s) {
      var b = el('button', 'ev-spot', s.label);
      b.type = 'button';
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(spots.children, function (x) { x.classList.toggle('is-on', x === b); });
        $('nw-result').hidden = true;
        startNow({ lat: s.lat, lng: s.lng }, s.label);
      });
      spots.appendChild(b);
    });
    $('nw-go').addEventListener('click', function () {
      Array.prototype.forEach.call(spots.children, function (x) { x.classList.remove('is-on'); });
      $('nw-status').textContent = '';
      $('nw-result').hidden = true;
      nowSlip.open(nowSteps(true));
      nowSlip.cook('here');
      trackParts(nowSlip).catch(function () { /* 下でまとめて扱う */ });
      M.locate().then(function (p) { nowSlip.done('here', '見つかりました'); startNow(p, '現在地', true); }).catch(function (err) {
        nowSlip.fail();
        $('nw-status').textContent = err && err.code === 1
          ? '位置情報の利用が許可されていません。ブラウザの設定で許可するか、下の場所から選んでください。'
          : '現在地を取得できませんでした。下の場所から選んでください。';
      });
    });
    if (!navigator.geolocation) $('nw-go').hidden = true;
  }

  // =====================================================================
  // お出かけプラン
  // =====================================================================
  var TIMES = [
    { id: 'morning', label: '朝 9:00〜', start: 540,
      steps: [{ kind: 'meal', slot: 'morning', dur: 60 }, { kind: 'event', dur: 90, alt: 'cafe' }, { kind: 'meal', slot: 'lunch', dur: 60, notBefore: 690 }] },
    { id: 'noon', label: '昼 11:30〜', start: 690,
      steps: [{ kind: 'meal', slot: 'lunch', dur: 60 }, { kind: 'event', dur: 90, alt: 'buzz' }, { kind: 'meal', slot: 'cafe', dur: 45 }] },
    { id: 'afternoon', label: '午後 13:30〜', start: 810,
      steps: [{ kind: 'event', dur: 90, alt: 'buzz' }, { kind: 'meal', slot: 'cafe', dur: 45 }, { kind: 'meal', slot: 'dinner', dur: 75, notBefore: 1050 }] },
    { id: 'evening', label: '夜 17:30〜', start: 1050,
      steps: [{ kind: 'event', dur: 60, alt: null }, { kind: 'meal', slot: 'dinner', dur: 75 }, { kind: 'meal', slot: 'second', dur: 60 }] }
  ];
  var plan = { day: null, time: store.get('meshi.plTime', 'afternoon'), area: store.get('meshi.plArea', 'sakae'), here: null, steps: null, mapObj: null };

  function dayOptions() {
    var t = M.todayJst();
    var out = [{ id: t, label: '今日 ' + M.fmtDay(t) }, { id: M.addDays(t, 1), label: '明日 ' + M.fmtDay(M.addDays(t, 1)) }];
    var wk = M.weekendJst();
    [wk.sat, wk.sun].forEach(function (d) {
      if (d > M.addDays(t, 1)) out.push({ id: d, label: M.fmtDay(d) });
    });
    return out;
  }
  function pillsInto(id, list, cur, onPick) {
    var box = $(id);
    box.textContent = '';
    list.forEach(function (x) {
      var b = el('button', 'g-pill', x.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(cur === x.id));
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(box.children, function (y) { y.setAttribute('aria-pressed', String(y === b)); });
        onPick(x.id);
      });
      box.appendChild(b);
    });
  }

  function chooseStep(step, ctx, from, at, used) {
    var iso = ctx.iso;
    var atDate = dateAt(iso, at);
    var maxD = ctx.rainy ? 500 : 900;
    if (step.kind === 'event') {
      var evs = ctx.events.filter(function (g) {
        return !used[g.id] && dist(g, from) <= (ctx.first ? 2500 : 900) && !(ctx.rainy && g.place === 'outdoor');
      }).sort(function (a, b) { return dist(a, from) - dist(b, from); });
      if (evs.length) {
        var ev = ctx.reroll ? pick(evs, 3) : evs[0];
        return { kind: 'event', item: ev, p: ev, name: M.eventName(ev), dur: step.dur };
      }
      if (!step.alt) return null;
      if (step.alt === 'buzz') {
        var bz = ctx.buzz.filter(function (b) {
          return !used[b.shop.id] && dist(b.shop, from) <= maxD * 1.5 && M.isOpenNow(b.shop, atDate) !== false;
        }).sort(function (a, b) { return dist(a.shop, from) - dist(b.shop, from); });
        if (bz.length) {
          var b0 = ctx.reroll ? pick(bz, 3) : bz[0];
          return { kind: 'shop', item: b0.shop, p: b0.shop, name: b0.shop.name, dur: 45, buzz: b0.article, label: '話題のお店' };
        }
      }
      return chooseStep({ kind: 'meal', slot: 'cafe', dur: 45 }, ctx, from, at, used);
    }
    var list = openShops(ctx.shops, atDate, step.slot, from, ctx.first ? 1500 : maxD, true)
      .filter(function (sh) { return !used[sh.id]; });
    if (!list.length) list = openShops(ctx.shops, atDate, step.slot, from, 2000, true).filter(function (sh) { return !used[sh.id]; });
    if (!list.length) return null;
    var sh = ctx.reroll ? pick(shuffleTop(list, 6), 6) : list[0];
    return { kind: 'shop', item: sh, p: sh, name: sh.name, dur: step.dur, label: SLOTS[step.slot].label, unknown: sh._open !== true, buzz: sh._buzz };
  }

  function makePlan(reroll) {
    var t = TIMES.filter(function (x) { return x.id === plan.time; })[0];
    var spot = SPOTS.filter(function (s) { return s.id === plan.area; })[0];
    var center = plan.area === 'here' ? plan.here : { lat: spot.lat, lng: spot.lng };
    var areaLabel = plan.area === 'here' ? '現在地' : spot.label;
    var iso = plan.day;
    var dw = dayWeather(iso);
    var ctx = {
      iso: iso, rainy: dayRainy(dw), reroll: reroll,
      shops: plan.shops.filter(function (sh) { return sh.lat != null && dist(sh, center) <= 3000; }),
      events: eventsOn(iso).filter(function (g) { return dist(g, center) <= 3000; })
    };
    ctx.buzz = buzzShops(ctx.shops);
    var min = t.start;
    // 今日で、もう始まりの時刻を過ぎていたら今から
    if (iso === M.todayJst()) {
      var nm = minutesOf(jstNow());
      if (nm > min) min = Math.ceil((nm + 10) / 15) * 15;
    }
    var used = {}, from = center, steps = [];
    t.steps.forEach(function (st, i) {
      ctx.first = i === 0;
      if (st.notBefore && min < st.notBefore) min = st.notBefore;
      var c = chooseStep(st, ctx, from, min, used);
      if (!c) return;
      var d = dist(c.p, from);
      var walk = i === 0 && plan.area !== 'here' ? 0 : Math.round(d / WALK);
      min += walk;
      c.at = min; c.walk = i === 0 ? null : walk; c.walkM = i === 0 ? null : d;
      c.def = st;
      used[c.item.id] = 1;
      steps.push(c);
      min += c.dur;
      from = c.p;
    });
    return { steps: steps, center: center, areaLabel: areaLabel, iso: iso, dw: dw, rainy: ctx.rainy, ctx: ctx, time: t };
  }

  function retime(pl) {
    var min = pl.steps.length ? pl.steps[0].at : 0;
    var from = pl.steps.length ? pl.steps[0].p : pl.center;
    pl.steps.forEach(function (c, i) {
      if (i > 0) {
        var d = dist(c.p, from);
        c.walk = Math.round(d / WALK); c.walkM = d;
        min += c.walk;
        if (c.def && c.def.notBefore && min < c.def.notBefore) min = c.def.notBefore;
      }
      c.at = min;
      min += c.dur;
      from = c.p;
    });
  }

  function renderPlan() {
    var pl = plan.current;
    $('pl-result').hidden = false;
    $('pl-title').textContent = M.fmtDay(pl.iso) + ' ' + pl.time.label.replace(/\s.*$/, '') + '・' + pl.areaLabel + 'プラン';
    if (pl.dw) {
      wxChips($('pl-wx'), { code: pl.dw.code, tmax: pl.dw.tmax, tmin: pl.dw.tmin, pop: pl.dw.pop, rainy: pl.rainy,
        note: pl.rainy ? '雨の予報なので、屋内と近い場所を中心にしました' : '名古屋の予報' }, '天気');
    } else {
      $('pl-wx').textContent = '';
    }
    var ol = $('pl-steps');
    ol.textContent = '';
    if (!pl.steps.length) {
      $('pl-status').textContent = 'この条件でプランを作れませんでした。場所や時間を変えてみてください。';
      $('pl-result').hidden = true;
      return;
    }
    $('pl-status').textContent = '';
    pl.steps.forEach(function (c, i) {
      if (c.walk != null) {
        var w = el('li', 'nw-walk');
        w.appendChild(el('span', null, c.walkM > 2500 ? M.fmtDistance(c.walkM) + '（電車・車で）' : '歩いて約' + Math.max(1, c.walk) + '分'));
        ol.appendChild(w);
      }
      var li = el('li', 'nw-step');
      li.appendChild(el('span', 'nw-step-time', hm(c.at)));
      var card = el('div', 'nw-step-card');
      card.appendChild(el('span', 'nw-pick-n', String(i + 1)));
      var body = el('div', 'nw-pick-body');
      var it = c.item;
      if (c.kind === 'event') {
        body.appendChild(el('span', 'nw-tag event', 'イベント' + (it.place === 'indoor' ? '・屋内' : it.place === 'outdoor' ? '・屋外' : '')));
        var a = el('a', 'nw-pick-title', c.name);
        a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
        body.appendChild(a);
        body.appendChild(el('p', 'nw-row-sub', it.venue + ' ・ ' + M.eventRange(it) + ' ・ 目安' + c.dur + '分'));
      } else {
        var tagText = [c.label, (c.label || '').indexOf(it.genre) >= 0 ? '' : it.genre, c.buzz ? '話題' : ''].filter(Boolean).join('・');
        body.appendChild(el('span', 'nw-tag' + (c.buzz ? ' buzz' : ''), tagText));
        var b = el('a', 'nw-pick-title', it.name);
        b.href = shopLink(it); b.target = '_blank'; b.rel = 'noopener';
        body.appendChild(b);
        var sub = [it.budget, c.unknown ? '営業時間は要確認' : '営業中の時間', '目安' + c.dur + '分'].filter(Boolean).join(' ・ ');
        body.appendChild(el('p', 'nw-row-sub', sub));
        if (c.buzz) {
          var na = el('a', 'nw-news-link', '話題の記事：' + c.buzz.title);
          na.href = c.buzz.link; na.target = '_blank'; na.rel = 'noopener';
          body.appendChild(na);
        }
      }
      var acts = el('div', 'nw-step-acts');
      var other = el('button', 'nw-mini', 'ほかの候補');
      other.type = 'button';
      other.addEventListener('click', function () { swapStep(i); });
      acts.appendChild(other);
      var dir = el('a', 'nw-dir', '道順');
      dir.href = mapsDir(c.p); dir.target = '_blank'; dir.rel = 'noopener';
      acts.appendChild(dir);
      body.appendChild(acts);
      card.appendChild(thumb(c.kind === 'event' ? it.image : (it.photo || (c.buzz && c.buzz.image))));
      card.appendChild(body);
      li.appendChild(card);
      ol.appendChild(li);
    });
    // Googleマップの道順（出発→経由→到着）
    var pts = pl.steps.map(function (c) { return (+c.p.lat).toFixed(6) + ',' + (+c.p.lng).toFixed(6); });
    var route = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + encodeURIComponent(pts[pts.length - 1]);
    if (plan.area === 'here') route += '&origin=' + encodeURIComponent(pl.center.lat + ',' + pl.center.lng);
    else route += '&origin=' + encodeURIComponent(pts[0]);
    var mid = plan.area === 'here' ? pts.slice(0, -1) : pts.slice(1, -1);
    if (mid.length) route += '&waypoints=' + encodeURIComponent(mid.join('|'));
    $('pl-route').href = route;
    var text = '【飯飯食堂 お出かけプラン】' + $('pl-title').textContent + '\n' +
      pl.steps.map(function (c) { return hm(c.at) + ' ' + c.name + (c.kind === 'event' ? '（' + c.item.venue + '）' : '（' + c.item.genre + '）'); }).join('\n') +
      '\n道順：' + route;
    $('pl-line').href = 'https://line.me/R/share?text=' + encodeURIComponent(text);
    renderPlanMap();
  }

  function swapStep(i) {
    var pl = plan.current;
    var c = pl.steps[i];
    var from = i === 0 ? pl.center : pl.steps[i - 1].p;
    var used = {};
    pl.steps.forEach(function (x) { used[x.item.id] = 1; });
    (c.tried = c.tried || {})[c.item.id] = 1;
    Object.keys(c.tried).forEach(function (k) { used[k] = 1; });
    var ctx = pl.ctx;
    ctx.first = i === 0; ctx.reroll = true;
    var n = chooseStep(c.def, ctx, from, c.at, used);
    if (!n) {
      // 候補がなくなったら最初から
      c.tried = {};
      n = chooseStep(c.def, ctx, from, c.at, (function () { var u = {}; pl.steps.forEach(function (x, j) { if (j !== i) u[x.item.id] = 1; }); return u; })());
    }
    if (!n) return;
    n.def = c.def; n.tried = c.tried;
    pl.steps[i] = n;
    retime(pl);
    renderPlan();
  }

  function renderPlanMap() {
    if (!plan.mapObj) plan.mapObj = makeMap('pl-map');
    var mo = plan.mapObj;
    if (!mo) return;
    mo.layer.clearLayers();
    var pl = plan.current;
    var pts = [];
    if (plan.area === 'here') {
      L.marker([pl.center.lat, pl.center.lng], { icon: pin('今', 'here') }).addTo(mo.layer);
      pts.push([pl.center.lat, pl.center.lng]);
    }
    pl.steps.forEach(function (c, i) {
      L.marker([+c.p.lat, +c.p.lng], { icon: pin(String(i + 1), c.kind === 'event' ? 'event' : 'shop'), title: c.name })
        .addTo(mo.layer).bindPopup(hm(c.at) + ' ' + c.name);
      pts.push([+c.p.lat, +c.p.lng]);
    });
    if (pts.length > 1) L.polyline(pts, { color: '#D92D20', weight: 4, dashArray: '6 8', opacity: 0.8 }).addTo(mo.layer);
    setTimeout(function () {
      mo.map.invalidateSize();
      mo.map.fitBounds(pts.length > 1 ? pts : [pts[0], pts[0]], { padding: [40, 40], maxZoom: 16 });
    }, 50);
  }

  var planSlip = new Slip('pl-slip', 'お出かけプラン');
  function buildPlan(reroll) {
    $('pl-status').textContent = '';
    $('pl-make').disabled = true;
    var needHere = plan.area === 'here' && !plan.here;
    var slip = planSlip;
    var steps = [];
    if (needHere) steps.push({ id: 'here', label: '現在地をたしかめる', slow: '位置情報の返事待ち…' });
    steps.push({ id: 'news', label: 'その日のイベントと話題のお店を仕入れる' });
    steps.push({ id: 'shops', label: 'お店リストを広げる' });
    steps.push({ id: 'osm', label: '近所のお店を地図で探す', slow: '地図データの返事待ち…' });
    steps.push({ id: 'wx', label: 'その日の空模様を見る' });
    steps.push({ id: 'cook', label: '回る順番と時間を組み立てる' });
    slip.open(steps);
    if (!reroll) $('pl-result').hidden = true;
    var partsP = trackParts(slip);
    var hereP = needHere
      ? (slip.cook('here'), M.locate().then(function (p) { plan.here = p; slip.done('here', '見つかりました'); }))
      : Promise.resolve();
    hereP.then(function () {
      var center = plan.area === 'here' ? plan.here : SPOTS.filter(function (s) { return s.id === plan.area; })[0];
      slip.cook('osm');
      return Promise.all([partsP, osmWithin(center, 1500, slip)]);
    }).then(function (r) {
      slip.cook('cook');
      plan.shops = M.mergeShops(data.shops, r[1]);
      plan.current = makePlan(reroll);
      slip.done('cook', plan.current.steps.length + 'か所');
      return slip.finish();
    }).then(function () {
      renderPlan();
      if (!reroll) $('pl-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      slip.fail();
      $('pl-status').textContent = plan.area === 'here' && !plan.here
        ? (err && err.code === 1 ? '位置情報の利用が許可されていません。場所を選んでください。' : '現在地を取得できませんでした。場所を選んでください。')
        : 'データを読み込めませんでした。電波のよい場所でもう一度お試しください。';
    }).then(function () { $('pl-make').disabled = false; });
  }

  function initPlan() {
    var days = dayOptions();
    plan.day = days[0].id;
    // 週末なら土日、平日の夕方以降は明日を最初に選ぶ
    pillsInto('pl-day', days, plan.day, function (id) { plan.day = id; });
    if (!TIMES.some(function (x) { return x.id === plan.time; })) plan.time = 'afternoon';
    pillsInto('pl-time', TIMES, plan.time, function (id) { plan.time = id; store.set('meshi.plTime', id); });
    var areas = SPOTS.map(function (s) { return { id: s.id, label: s.label }; });
    if (navigator.geolocation) areas.push({ id: 'here', label: '現在地' });
    if (!areas.some(function (a) { return a.id === plan.area; })) plan.area = 'sakae';
    pillsInto('pl-area', areas, plan.area, function (id) { plan.area = id; store.set('meshi.plArea', id); if (id === 'here') plan.here = null; });
    $('pl-make').addEventListener('click', function () { buildPlan(false); });
    $('pl-again').addEventListener('click', function () { buildPlan(true); });
  }

  // ---------- タブ ----------
  function showTab(which) {
    var isPlan = which === 'plan';
    $('nw-tab-now').setAttribute('aria-selected', String(!isPlan));
    $('nw-tab-plan').setAttribute('aria-selected', String(isPlan));
    $('nw-now').hidden = isPlan;
    $('nw-plan').hidden = !isPlan;
    if (history.replaceState) history.replaceState(null, '', isPlan ? '#plan' : '#now');
    var mo = isPlan ? plan.mapObj : now.mapObj;
    if (mo) setTimeout(function () { mo.map.invalidateSize(); }, 50);
  }
  $('nw-tab-now').addEventListener('click', function () { showTab('now'); });
  $('nw-tab-plan').addEventListener('click', function () { showTab('plan'); });

  initNow();
  initPlan();
  if (location.hash === '#plan') showTab('plan');
  loadData(); // 先に読み込んでおく

  // テスト用
  window.__meshiNow = { slotAt: slotAt, eventsOn: eventsOn, data: data };
})();

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
  // ---------- シチュエーション（だれと行く？） ----------
  // g: ジャンルごとの倍率（書いてないジャンルは1）、f(sh, n): 設備などでの倍率、word: お店の紹介文で見る言葉
  var MID = ['B002', 'B003', 'B008', 'B004'];          // 2001〜7000円
  var CASUAL = ['B011', 'B001', 'B002', 'B003'];       // 1001〜4000円
  var CHEAPS = ['B009', 'B010', 'B011', 'B001'];       // 〜2000円
  var SITS = [
    { id: 'any', label: 'おまかせ' },
    { id: 'solo', label: 'ひとりで', lead: 'ひとりなら、',
      g: { 'ラーメン': 1.6, '和食': 1.3, 'カフェ': 1.3, 'エスニック': 1.2, '洋食': 1.15, '中華': 1.1, '居酒屋': 0.55, '焼肉': 0.6, '韓国料理': 0.8, 'お好み焼き': 0.8 },
      word: /カウンター|おひとり|一人|ひとり|定食|立ち飲み/,
      f: function (sh) { return CHEAPS.indexOf(sh.budget_code) >= 0 ? 1.2 : 1; },
      why: function (sh) { return [sh.budget_code && CHEAPS.indexOf(sh.budget_code) >= 0 ? '気軽な予算' : '', /カウンター/.test(sh.catch || '') ? 'カウンターあり' : '']; } },
    { id: 'date', label: 'デート', lead: 'デートなら、',
      g: { 'イタリアン': 1.6, 'カフェ': 1.4, '和食': 1.3, '焼肉': 1.2, '洋食': 1.2, 'エスニック': 1.05, '居酒屋': 0.75, '中華': 0.8, 'お好み焼き': 0.8, 'ラーメン': 0.4 },
      word: /おしゃれ|オシャレ|隠れ家|夜景|ワイン|デート|カップル|記念日|個室|雰囲気|大人/,
      f: function (sh) {
        var x = 1;
        if (sh.room) x *= 1.45;
        if (sh.nosmoke) x *= 1.15;
        if (MID.indexOf(sh.budget_code) >= 0) x *= 1.2;
        if (sh.photo) x *= 1.15;
        if (sh.genre === '居酒屋' && sh.room) x *= 1.3;   // 個室の居酒屋ならあり
        return x;
      },
      why: function (sh) { return [sh.room ? '個室あり' : '', sh.nosmoke ? '全面禁煙' : '']; },
      second: ['カフェ', 'イタリアン', '居酒屋'] },
    { id: 'group', label: '友達と', lead: '友達{n}人なら、',
      g: { '居酒屋': 1.6, '焼肉': 1.5, '韓国料理': 1.4, 'お好み焼き': 1.35, '中華': 1.3, 'イタリアン': 1.1, 'エスニック': 1.05, 'カフェ': 0.85 },
      word: /飲み放題|食べ放題|大人数|宴会|ワイワイ|わいわい|女子会|パーティ|貸切/,
      f: function (sh, n) {
        var x = 1;
        if (sh.genre === 'ラーメン') x *= n >= 4 ? 0.3 : 0.85;   // 大人数でラーメンはなし
        if (sh.drink) x *= 1.4;
        if (sh.course) x *= 1.1;
        if (n >= 4 && (sh.room || sh.zashiki)) x *= 1.2;
        if (sh.seats != null) { if (sh.seats < n * 3) x *= 0.5; else if (sh.seats >= n * 8) x *= 1.15; }
        if (CASUAL.indexOf(sh.budget_code) >= 0) x *= 1.1;
        return x;
      },
      why: function (sh, n) { return [sh.drink ? '飲み放題あり' : '', sh.seats ? sh.seats + '席' : '', n >= 4 && sh.room ? '個室あり' : (n >= 4 && sh.zashiki ? '座敷あり' : '')]; },
      second: ['居酒屋', 'カフェ', 'ラーメン', '韓国料理'] },
    { id: 'family', label: '家族・子連れ', lead: '家族なら、',
      g: { 'お好み焼き': 1.4, '洋食': 1.4, '和食': 1.3, '焼肉': 1.25, 'イタリアン': 1.2, 'カフェ': 1.1, '中華': 1.1, 'エスニック': 0.8, '居酒屋': 0.3 },
      word: /お子様|キッズ|ファミリー|座敷|家族|子連れ|ベビーカー/,
      f: function (sh) {
        var x = 1;
        if (sh.kids === true) x *= 1.6;
        if (sh.kids === false) x *= 0.15;
        if (sh.zashiki) x *= 1.3;
        if (sh.nosmoke) x *= 1.2;
        if (sh.room) x *= 1.1;
        return x;
      },
      why: function (sh) { return [sh.kids ? '子ども連れOK' : '', sh.zashiki ? '座敷あり' : '', sh.nosmoke ? '全面禁煙' : '']; },
      second: ['カフェ', '洋食', '和食'] }
  ];
  var PEOPLE = [{ id: 2, label: '2人' }, { id: 3, label: '3人' }, { id: 4, label: '4人' }, { id: 6, label: '5〜6人' }, { id: 8, label: '7人〜' }];
  var sit = { id: store.get('meshi.sit', 'any'), n: store.get('meshi.sitN', 4) };
  function curSit() { return SITS.filter(function (x) { return x.id === sit.id; })[0] || SITS[0]; }
  function sitFactor(sh) {
    var S = curSit();
    if (S.id === 'any') return 1;
    var x = (S.g && S.g[sh.genre]) || 1;
    if (S.word && S.word.test((sh.name || '') + ' ' + (sh.catch || ''))) x *= 1.3;
    if (S.f) x *= S.f(sh, sit.n);
    return x;
  }
  function sitWhy(sh) {
    var S = curSit();
    if (!S.why) return [];
    return S.why(sh, sit.n).filter(Boolean);
  }
  function sitLead() {
    var S = curSit();
    return S.lead ? S.lead.replace('{n}', sit.n >= 8 ? '7' : String(sit.n)).replace('友達7人', '友達7人以上') : '';
  }

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
    return s * sitFactor(sh);
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
    var S = curSit();
    if (S.id !== 'any' && sitFactor(sh) < 0.5) return false;   // シチュエーションに合わない店（席が足りない・子ども不可など）は出さない
    if ((slot === 'second' || slot === 'late') && S.second) return S.second.indexOf(sh.genre) >= 0;
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
      if (o === true && tooLate(sh, at)) return false;
      return o === true || (allowUnknown && o === null);
    }).sort(function (a, b) {
      var oa = a._open === true ? 1 : 0.55, ob = b._open === true ? 1 : 0.55;
      return shopScore(b, from) * ob - shopScore(a, from) * oa;
    });
  }

  // ---------- ラストオーダー・閉店までの残り ----------
  function fmtLeft(m) {
    m = Math.max(0, Math.round(m));
    if (m < 60) return m + '分';
    return Math.floor(m / 60) + '時間' + (m % 60 ? (m % 60) + '分' : '');
  }
  // { text, cls } or null。cls: hot（30分以内）/ warm（1時間以内）/ over（L.O.済み）/ ''（余裕あり）
  function loInfo(sh, at, prefix) {
    var i = M.closingInfo && M.closingInfo(sh, at);
    if (!i) return null;
    var pre = prefix || '';
    if (i.leftLo != null) {
      if (i.leftLo <= 0) return { text: 'L.O.終了・閉店まで' + fmtLeft(i.leftClose), cls: 'over' };
      if (i.leftLo <= 120) return { text: pre + 'L.O.まで' + fmtLeft(i.leftLo), cls: i.leftLo <= 30 ? 'hot' : (i.leftLo <= 60 ? 'warm' : '') };
      return { text: 'L.O. ' + clock(i.lo), cls: '' };
    }
    if (i.leftClose <= 120) return { text: pre + '閉店まで' + fmtLeft(i.leftClose), cls: i.leftClose <= 30 ? 'hot' : (i.leftClose <= 60 ? 'warm' : '') };
    return { text: clock(i.close) + 'まで', cls: '' };
  }
  // 閉店・L.O.の時刻（24:00、翌1:00 のように）
  function clock(min) {
    if (min === 1440) return '24:00';
    if (min > 1440) return '翌' + hm(min - 1440);
    return hm(min);
  }
  function loBadge(sh, at, prefix) {
    var x = loInfo(sh, at, prefix);
    return x ? el('span', 'nw-lo ' + x.cls, x.text) : null;
  }
  // もうすぐ終わる店（L.O.まで20分未満・閉店まで25分未満）は候補にしない
  function tooLate(sh, at) {
    var i = M.closingInfo && M.closingInfo(sh, at);
    return !!i && ((i.leftLo != null && i.leftLo < 20) || i.leftClose < 25);
  }

  // ---------- 予算（1人あたりの目安） ----------
  var PRICE = { B009: 500, B010: 800, B011: 1300, B001: 1800, B002: 2500, B003: 3500, B008: 4500, B004: 6000, B005: 8500, B006: 12500, B012: 17500, B013: 25000, B014: 35000 };
  var GENRE_PRICE = { 'カフェ': 900, 'ラーメン': 1000, '和食': 1800, '洋食': 1500, '中華': 1500, 'イタリアン': 2500, '焼肉': 4000,
    '居酒屋': 3500, '韓国料理': 3000, 'エスニック': 1500, 'お好み焼き': 1800 };
  var EVENT_PRICE = 1000;   // イベントでの食べ歩きの目安
  function priceOf(sh, slot) {
    var base = PRICE[sh.budget_code] || GENRE_PRICE[sh.genre] || 1500;
    if (slot === 'lunch') base = Math.min(base, sh.genre === '焼肉' ? 1800 : 1500);   // ホットペッパーの予算は夜の平均なので、昼は控えめに
    else if (slot === 'cafe' || slot === 'morning') base = Math.min(base, 1300);
    else if (slot === 'second') base = Math.round(base * 0.7);
    return Math.round(base / 100) * 100;
  }
  function yen(n) { return n.toLocaleString('ja-JP') + '円'; }
  var BUDGET_W = { morning: 0.5, lunch: 1.2, cafe: 0.5, dinner: 2.2, second: 1.1, late: 1, event: 0.8 };
  function stepWeight(def) { return def.kind === 'event' ? BUDGET_W.event : (BUDGET_W[def.slot] || 1); }

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
  // お店の設備の札（シチュエーションに関係するもの）
  function feats(sh) {
    var list = [];
    if (sh.room) list.push('個室');
    if (sh.drink) list.push('飲み放題');
    if (sh.kids) list.push('子ども連れOK');
    if (sh.zashiki) list.push('座敷');
    if (sh.nosmoke) list.push('禁煙');
    if (sh.seats) list.push(sh.seats + '席');
    if (!list.length) return null;
    var box = el('span', 'nw-feats');
    var hot = sitWhy(sh).join(' ');
    list.forEach(function (t) { box.appendChild(el('span', 'nw-feat' + (hot.indexOf(t.replace('OK', '')) >= 0 ? ' hot' : ''), t)); });
    return box;
  }
  function row(opts) {
    // opts: { img, tag, tagCls, title, href, sub, meta, dir, extra }
    var r = el('article', 'nw-row');
    r.appendChild(thumb(opts.img));
    var b = el('div', 'nw-row-body');
    var top = el('div', 'nw-row-top');
    if (opts.tag) top.appendChild(el('span', 'nw-tag ' + (opts.tagCls || ''), opts.tag));
    if (opts.meta) top.appendChild(el('span', 'nw-meta', opts.meta));
    if (opts.shop) { var lb = loBadge(opts.shop, opts.at || jstNow()); if (lb) top.appendChild(lb); }
    b.appendChild(top);
    var a = el('a', 'nw-row-title', opts.title);
    a.href = opts.href; a.target = '_blank'; a.rel = 'noopener';
    b.appendChild(a);
    if (opts.sub) b.appendChild(el('p', 'nw-row-sub', opts.sub));
    if (opts.shop) { var fs = feats(opts.shop); if (fs) b.appendChild(fs); }
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
    now.mode = 'free';
    now.from = from; now.fromLabel = label;
    $('nw-status').textContent = '';
    $('nw-go').disabled = true;
    var slip = nowSlip;
    if (!slipOpened) slip.open(nowSteps(false));
    var osmP = (function () { slip.cook('osm'); return osmWithin(from, NEAR, slip); })();
    Promise.all([trackParts(slip), osmP]).then(function (r) {
      slip.cook('cook');
      var shops = M.mergeShops(data.shops, r[1]);
      now.lastShops = shops;
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
    var buzzOpen = c.buzz.filter(function (b) { return M.isOpenNow(b.shop, c.t) === true && sitFactor(b.shop) >= 0.9; })
      .sort(function (a, b) { return dist(a.shop, from) - dist(b.shop, from); });
    var meal = openShops(c.shops, c.t, slot, first ? first.p : from, first ? 900 : NEAR, false);
    if (!first) {
      if (buzzOpen.length && dist(buzzOpen[0].shop, from) <= NEAR * 1.5) {
        var bz = pick(buzzOpen, 2);
        first = { kind: 'shop', item: bz.shop, p: bz.shop, buzz: bz.article };
        text.push(walkText(dist(bz.shop, from)) + 'の「' + bz.shop.name + '」が営業中' + whyText(bz.shop) + '。ニュースで話題のお店です。');
      } else if (meal.length) {
        var m1 = pick(meal, 4);
        first = { kind: 'shop', item: m1, p: m1 };
        var w1 = whyText(m1, m1.rank && m1.rank <= 10 ? 'このあたりの人気店' : '');
        text.push(walkText(dist(m1, from)) + 'の' + m1.genre + '「' + m1.name + '」が営業中' + w1 + '。');
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
      var w2 = sitWhy(s2);
      text.push(lead + after + how + s2.genre + '「' + s2.name + '」（営業中' + (w2.length ? '・' + w2.slice(0, 2).join('・') : '') + '）へ。');
    } else if (c.wx && c.wx.rainFrom) {
      text.push(c.wx.rainFrom + '時ごろから雨が降りそうなので、早めの移動がおすすめです。');
    }
    var lead0 = sitLead();
    return { first: first, second: second, text: lead0 + text.join('') };
  }
  function whyText(sh, extra) {
    var w = sitWhy(sh);
    if (extra) w.unshift(extra);
    return w.length ? '（' + w.slice(0, 2).join('・') + '）' : '';
  }

  function storyCard(step, n) {
    var it = step.item;
    var card = el('div', 'nw-pick');
    card.appendChild(el('span', 'nw-pick-n' + (String(n).length > 1 ? ' word' : ''), String(n)));
    var body = el('div', 'nw-pick-body');
    if (step.kind === 'event') {
      body.appendChild(el('span', 'nw-tag event', 'イベント・' + M.eventStatus(it).label));
      var a = el('a', 'nw-pick-title', M.eventName(it));
      a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
      body.appendChild(a);
      body.appendChild(el('p', 'nw-row-sub', it.venue + ' ・ ' + M.eventRange(it)));
    } else {
      var tagRow = el('span', 'nw-row-top');
      tagRow.appendChild(el('span', 'nw-tag' + (step.buzz || it._buzz ? ' buzz' : ''), (step.buzz || it._buzz ? '話題・' : '') + it.genre + '・営業中'));
      var atD = step.at != null ? minToDate(step.at) : jstNow();
      var lob = loBadge(it, atD, step.at != null ? '着いてから' : '');
      if (lob) tagRow.appendChild(lob);
      body.appendChild(tagRow);
      var b = el('a', 'nw-pick-title', it.name);
      b.href = shopLink(it); b.target = '_blank'; b.rel = 'noopener';
      body.appendChild(b);
      var sub = [it.budget, it.access].filter(Boolean).join(' ・ ');
      if (sub) body.appendChild(el('p', 'nw-row-sub', sub));
      var fs = feats(it);
      if (fs) body.appendChild(fs);
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
    if (now.mode === 'fixed') { renderFixedStory(box); return; }
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
        title: b.shop.name, href: shopLink(b.shop), sub: '話題：' + b.article.title, dir: mapsDir(b.shop), shop: o === true ? b.shop : null
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
    var useSit = curSit().id !== 'any';
    var list = c.open.filter(function (sh) { return (now.genre === 'all' || sh.genre === now.genre) && (!useSit || sitFactor(sh) >= 0.6); })
      .sort(function (a, b) { return useSit ? shopScore(b, from) - shopScore(a, from) : dist(a, from) - dist(b, from); }).slice(0, 12);
    if (!list.length) ob.appendChild(el('p', 'nw-empty', '近くで今開いているお店が見つかりませんでした（営業時間がわかるお店だけを出しています）。'));
    list.forEach(function (sh) {
      ob.appendChild(row({
        img: sh.photo, tag: sh.genre, meta: walkText(dist(sh, from)),
        title: sh.name, href: shopLink(sh), sub: [sh.budget, sh.catch].filter(Boolean).join(' ・ '), dir: mapsDir(sh), shop: sh
      }));
    });
  }

  function renderNowMap() {
    if (!now.mapObj) now.mapObj = makeMap('nw-map');
    var mo = now.mapObj;
    if (!mo) return;
    mo.layer.clearLayers();
    var pts = [];
    var me = now.mode === 'fixed' ? now.here : now.from;
    if (me) {
      pts.push([me.lat, me.lng]);
      L.marker([me.lat, me.lng], { icon: pin('今', 'here'), title: '今いるところ' }).addTo(mo.layer).bindPopup(now.mode === 'fixed' ? '今いるところ' : now.fromLabel);
    }
    var st = now.story;
    if (st) {
      var list = st.steps || [st.first, st.second];
      var n = 0;
      list.forEach(function (s) {
        if (!s) return;
        n++;
        var name = stepName(s);
        var cls = s.fixed ? 'fixed' : (s.kind === 'event' ? 'event' : 'shop');
        L.marker([+s.p.lat, +s.p.lng], { icon: pin(s.fixed ? '★' : String(n), cls), title: name })
          .addTo(mo.layer).bindPopup((s.at != null ? hm(s.at) + ' ' : '') + name);
        pts.push([+s.p.lat, +s.p.lng]);
      });
      L.polyline(pts, { color: '#D92D20', weight: 4, dashArray: '6 8', opacity: 0.8 }).addTo(mo.layer);
    }
    setTimeout(function () {
      mo.map.invalidateSize();
      if (pts.length) mo.map.fitBounds(pts.length > 1 ? pts : [pts[0], pts[0]], { padding: [40, 40], maxZoom: 16 });
    }, 50);
  }

  function stepName(s) {
    if (s.kind === 'event') return M.eventName(s.item);
    return s.item.name;
  }

  // =====================================================================
  // 行き先が決まっているとき：その「前」と「あと」を提案
  // =====================================================================
  var fix = { place: null, at: 'now', time: null, stay: null, stayTouched: false, want: store.get('meshi.fixWant', 'both') };
  var AT_OPTS = [{ id: 'now', label: '今すぐ' }, { id: '30', label: '30分後' }, { id: '60', label: '1時間後' }, { id: '120', label: '2時間後' }, { id: 'time', label: '時刻を指定' }];
  var STAY_OPTS = [{ id: 30, label: '30分' }, { id: 60, label: '1時間' }, { id: 90, label: '1時間半' }, { id: 120, label: '2時間' }, { id: 180, label: '3時間' }];
  var WANT_OPTS = [{ id: 'both', label: '前とあと' }, { id: 'before', label: '前だけ' }, { id: 'after', label: 'あとだけ' }];

  function fixIsFood(p) { return p && p.kind === 'shop' && p.item.genre !== 'カフェ'; }
  function fixIsCafe(p) { return p && p.kind === 'shop' && p.item.genre === 'カフェ'; }
  function defaultStay(p) {
    if (!p) return 90;
    if (p.kind === 'shop') return p.item.genre === 'カフェ' ? 60 : (p.item.genre === '居酒屋' || p.item.genre === '焼肉' ? 120 : 60);
    return 90;
  }
  // 着く時刻（今日の 0:00 からの分。日をまたぐときは 1440 を超える）
  function fixArriveMin() {
    var nowMin = minutesOf(jstNow());
    if (fix.at === 'now') return nowMin + 5;
    if (fix.at === 'time' && fix.time) {
      var p = fix.time.split(':');
      var m = +p[0] * 60 + +p[1];
      if (m < nowMin - 60) m += 1440;   // 1時間より前なら明日の深夜とみなす
      return Math.max(m, nowMin);
    }
    return nowMin + (+fix.at || 0);
  }
  function minToDate(min) {
    var d = new Date(jstNow());
    d.setHours(0, 0, 0, 0);
    return new Date(d.getTime() + min * 60000);
  }

  // 候補探し：手元のお店・イベント・会場から。見つからなければ地図（Nominatim）で
  function localPlaces(q) {
    var qn = M.normName(q);
    if (!qn) return [];
    var out = [];
    data.events.forEach(function (g) {
      if (g.lat == null) return;
      var hay = M.normName(M.eventName(g) + ' ' + (g.venue || ''));
      if (hay.indexOf(qn) >= 0) out.push({ kind: 'event', item: g, name: M.eventName(g), sub: g.venue + ' ・ ' + M.eventRange(g), lat: +g.lat, lng: +g.lng, score: 3 });
    });
    data.shops.forEach(function (sh) {
      if (sh.lat == null) return;
      var nn = M.normName(sh.name);
      var i = nn.indexOf(qn);
      if (i >= 0) out.push({ kind: 'shop', item: sh, name: sh.name, sub: [sh.genre, sh.address].filter(Boolean).join(' ・ '), lat: +sh.lat, lng: +sh.lng, score: i === 0 ? 2 : 1 });
    });
    SPOTS.forEach(function (sp) {
      if (M.normName(sp.label).indexOf(qn) >= 0) out.push({ kind: 'place', item: { name: sp.label }, name: sp.label, sub: '名古屋の街', lat: sp.lat, lng: sp.lng, score: 1 });
    });
    return out.sort(function (a, b) { return b.score - a.score; }).slice(0, 8);
  }
  function geoPlaces(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=jp&accept-language=ja' +
      '&viewbox=136.3,35.7,137.8,34.5&q=' + encodeURIComponent(q);
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        return (list || []).map(function (x) {
          var parts = (x.display_name || '').split(',').map(function (t) { return t.trim(); });
          return { kind: 'place', item: { name: x.name || parts[0], address: parts.slice(1, 4).reverse().join('') }, name: x.name || parts[0],
            sub: parts.slice(1, 4).join('、'), lat: +x.lat, lng: +x.lon };
        });
      });
  }
  function showSugg(list, q, fromMap, P) {
    P = P || NOW_PICKER;
    var box = $(P.pre + '-sugg');
    box.textContent = '';
    list.forEach(function (p) {
      var b = el('button', 'nw-sugg');
      b.type = 'button';
      b.appendChild(el('span', 'nw-sugg-kind ' + p.kind, p.kind === 'event' ? 'イベント' : p.kind === 'shop' ? 'お店' : '場所'));
      var t = el('span', 'nw-sugg-text');
      t.appendChild(el('b', null, p.name));
      if (p.sub) t.appendChild(el('span', null, p.sub));
      b.appendChild(t);
      b.addEventListener('click', function () { chooseFix(p, P); });
      box.appendChild(b);
    });
    if (!fromMap && q) {
      var m = el('button', 'nw-sugg map');
      m.type = 'button';
      m.appendChild(el('span', 'nw-sugg-kind place', '地図'));
      m.appendChild(el('span', 'nw-sugg-text', '「' + q + '」を地図で探す'));
      m.addEventListener('click', function () {
        box.textContent = '';
        box.appendChild(el('p', 'nw-empty', '地図で探しています…'));
        geoPlaces(q).then(function (l) {
          if (!l.length) { box.textContent = ''; box.appendChild(el('p', 'nw-empty', '見つかりませんでした。別の書き方で試してください。')); return; }
          showSugg(l, q, true, P);
        }).catch(function () {
          box.textContent = '';
          box.appendChild(el('p', 'nw-empty', '地図の検索につながりませんでした。少し時間をおいて試してください。'));
        });
      });
      box.appendChild(m);
    }
    if (!list.length && fromMap) box.appendChild(el('p', 'nw-empty', '見つかりませんでした。'));
  }
  function chooseFix(p, P) {
    P = P || NOW_PICKER;
    P.onChoose(p);
    $(P.pre + '-sugg').textContent = '';
    $(P.pre + '-q').value = '';
    var c = $(P.pre + '-chosen');
    c.textContent = '';
    c.hidden = false;
    c.appendChild(el('span', 'nw-sugg-kind ' + p.kind, p.kind === 'event' ? 'イベント' : p.kind === 'shop' ? 'お店' : '場所'));
    var t = el('span', 'nw-sugg-text');
    t.appendChild(el('b', null, p.name));
    if (p.sub) t.appendChild(el('span', null, p.sub));
    c.appendChild(t);
    var x = el('button', 'nw-fix-clear', '×');
    x.type = 'button';
    x.setAttribute('aria-label', '行き先を選び直す');
    x.addEventListener('click', function () { c.hidden = true; P.onClear(); $(P.pre + '-q').focus(); });
    c.appendChild(x);
  }
  var NOW_PICKER = {
    pre: 'nw-fix',
    onChoose: function (p) {
      fix.place = p;
      if (!fix.stayTouched) fix.stay = defaultStay(p);
      $('nw-fix-go').disabled = false;
      renderFixPills();
    },
    onClear: function () { fix.place = null; $('nw-fix-go').disabled = true; }
  };
  function wirePicker(P) {
    var timer = null;
    var q = $(P.pre + '-q');
    var run = function () {
      var v = q.value.trim();
      if (!v) { $(P.pre + '-sugg').textContent = ''; return; }
      loadData().then(function () { showSugg(localPlaces(v), v, false, P); });
    };
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 200); });
    $(P.pre + '-form').addEventListener('submit', function (e) { e.preventDefault(); clearTimeout(timer); run(); q.blur(); });
  }
  function renderFixPills() {
    pillsInto('nw-fix-at', AT_OPTS, fix.at, function (id) {
      fix.at = id;
      $('nw-fix-time').hidden = id !== 'time';
      if (id === 'time') {
        if (!fix.time) {
          var m = Math.ceil((minutesOf(jstNow()) + 60) / 15) * 15;
          fix.time = ('0' + Math.floor(m / 60) % 24).slice(-2) + ':' + ('0' + m % 60).slice(-2);
          $('nw-fix-time').value = fix.time;
        }
        $('nw-fix-time').focus();
      }
    });
    pillsInto('nw-fix-stay', STAY_OPTS, fix.stay || defaultStay(fix.place), function (id) { fix.stay = id; fix.stayTouched = true; });
    pillsInto('nw-fix-want', WANT_OPTS, fix.want, function (id) { fix.want = id; store.set('meshi.fixWant', id); });
  }

  function startFixed() {
    var p = fix.place;
    if (!p) return;
    now.mode = 'fixed';
    now.from = { lat: p.lat, lng: p.lng };
    now.fromLabel = p.name + 'のまわり';
    $('nw-result').hidden = true;
    $('nw-status').textContent = '';
    $('nw-fix-go').disabled = true;
    var slip = nowSlip;
    slip.open([
      { id: 'news', label: '今日のネタ（話題のお店・イベント）を仕入れる' },
      { id: 'shops', label: 'お店リストを広げる' },
      { id: 'osm', label: '「' + p.name + '」のまわりを地図で探す', slow: '地図データの返事待ち…' },
      { id: 'wx', label: '空模様を見る' },
      { id: 'cook', label: '前とあとの寄り道を組み立てる' }
    ]);
    // 今いるところ（わかれば地図に出す。待たない）
    if (navigator.geolocation && !now.here) M.locate().then(function (h) { now.here = h; if (!$('nw-result').hidden) renderNowMap(); }).catch(function () { /* なくてよい */ });
    Promise.all([trackParts(slip), (slip.cook('osm'), osmWithin(now.from, 900, slip))]).then(function (r) {
      slip.cook('cook');
      now.lastShops = M.mergeShops(data.shops, r[1]);
      buildNow(now.lastShops);
      slip.done('cook');
      return slip.finish();
    }).then(function () {
      $('nw-result').hidden = false;
      renderNowMap();
      $('nw-story').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () {
      slip.fail();
      $('nw-status').textContent = 'データを読み込めませんでした。電波のよい場所でもう一度お試しください。';
    }).then(function () { $('nw-fix-go').disabled = false; });
  }

  // 行き先の前とあとを選ぶ
  // opts.keep = { before: 店, after: 店 } はそのまま使う / opts.avoid = { 店id: 1 } は選ばない
  function makeFixedStory(opts) {
    opts = opts || {};
    var keep = opts.keep || {};
    var c = now.ctx, F = fix.place;
    var nowMin = minutesOf(c.t);
    var arrive = fixArriveMin();
    var stay = fix.stay || defaultStay(F);
    var leave = arrive + stay;
    var rainSoon = c.wx && (c.wx.nowRain || c.wx.rainFrom);
    var maxD = rainSoon ? 350 : 650;
    var food = fixIsFood(F), cafe = fixIsCafe(F);
    var used = {};
    Object.keys(opts.avoid || {}).forEach(function (k) { used[k] = 1; });
    if (F.kind === 'shop') used[F.item.id] = 1;
    if (keep.before) used[keep.before.item.id] = 1;
    if (keep.after) used[keep.after.item.id] = 1;
    var steps = [], text = [], notes = [];
    var fixedStep = { kind: F.kind === 'event' ? 'event' : (F.kind === 'shop' ? 'shop' : 'place'), item: F.kind === 'place' ? { name: F.name, address: F.item.address } : F.item,
      p: { lat: F.lat, lng: F.lng }, at: arrive, fixed: true, stay: stay };
    var avoidGenre = null;
    var pickNear = function (atMin, slot, untilMin) {
      var at = minToDate(atMin), until = minToDate(untilMin);
      var list = openShops(c.shops, at, slot, F, maxD, false).filter(function (sh) {
        return !used[sh.id] && M.isOpenNow(sh, until) !== false;
      });
      if (avoidGenre) {   // 前と同じジャンルは、ほかに候補があれば避ける
        var other = list.filter(function (sh) { return sh.genre !== avoidGenre; });
        if (other.length) list = other;
      }
      if (!list.length) list = openShops(c.shops, at, slot, F, maxD * 1.6, false).filter(function (sh) { return !used[sh.id]; });
      return list.length ? pick(list, 3) : null;
    };
    var nameF = '「' + F.name + '」';
    // 前
    if (fix.want !== 'after') {
      var room = arrive - nowMin;
      if (room < 35) {
        text.push(nameF + 'まであと' + Math.max(0, Math.round(room)) + '分なので、前の寄り道はなしでOK。');
      } else {
        var dur = Math.min(room - 10, food ? 45 : 60);
        var bStart = arrive - dur - 5;
        var bSlot = food ? (slotAt(bStart % 1440) === 'morning' ? 'morning' : 'cafe') : (cafe ? slotAt(bStart % 1440) : slotAt(bStart % 1440));
        if (bSlot === 'late' && !food) bSlot = 'dinner';
        var b = keep.before ? keep.before.item : pickNear(bStart, bSlot, arrive - 5);
        if (keep.before) { bStart = keep.before.at; dur = keep.before.dur; }
        if (!b && dur > 35) {   // まだ開いていなければ、着く直前の短い寄り道で探し直す
          dur = 30; bStart = arrive - 35;
          b = pickNear(bStart, food ? 'cafe' : slotAt(bStart % 1440), arrive - 5);
        }
        if (b) {
          used[b.id] = 1;
          avoidGenre = b.genre;
          steps.push({ kind: 'shop', item: b, p: b, at: bStart, role: 'before', dur: dur });
          var why = sitWhy(b);
          text.push(nameF + 'に' + hm(arrive) + 'ごろ行く前に、そこから' + walkText(dist(b, F)) + 'の' + b.genre + '「' + b.name + '」で' +
            (food ? 'ひと息' : (bSlot === 'cafe' || bSlot === 'morning' ? 'ひと息' : '腹ごしらえ')) + (why.length ? '（' + why.slice(0, 2).join('・') + '）' : '') + '。');
        } else {
          text.push(nameF + 'の前に寄れそうな開いているお店は、近くに見つかりませんでした。');
        }
      }
    }
    steps.push(fixedStep);
    // あと
    if (fix.want !== 'before') {
      var aSlot;
      var lm = leave % 1440;
      if (food) aSlot = (lm >= 1020 || lm < 300) ? 'second' : 'cafe';
      else if (cafe) aSlot = slotAt(lm) === 'cafe' ? 'dinner' : slotAt(lm);
      else aSlot = slotAt(lm);
      if (aSlot === 'morning' && avoidGenre === 'カフェ' && lm >= 600) aSlot = 'lunch';   // 朝のカフェのあとは早めのランチ
      if (leave > 1440 + 150) {
        text.push('出るのが遅い時間なので、あとの寄り道はなしにしました。');
      } else {
        var a = keep.after ? keep.after.item : pickNear(leave + 5, aSlot, leave + 50);
        if (!a && !keep.after) {   // その時間帯のお店がまだ開いていなければ、カフェ → 開いている店ならどこでも
          avoidGenre = null;
          a = pickNear(leave + 5, 'cafe', leave + 40);
          if (a) aSlot = 'cafe';
        }
        if (a) {
          used[a.id] = 1;
          steps.push({ kind: 'shop', item: a, p: a, at: leave + Math.round(dist(a, F) / WALK), role: 'after' });
          var whyA = sitWhy(a);
          var word = aSlot === 'second' ? '2軒目に' : (aSlot === 'cafe' || aSlot === 'morning' ? 'ひと息つきに' : 'ごはんに');
          text.push((steps.length > 2 ? 'そのあと' : nameF + 'のあと') + '（' + hm(leave) + 'ごろ）は、' + walkText(dist(a, F)) + 'の' + a.genre + '「' + a.name + '」へ' + word +
            (whyA.length ? '（' + whyA.slice(0, 2).join('・') + '）' : '') + '。');
        } else {
          text.push(hm(leave) + 'ごろに開いているお店は、近くに見つかりませんでした。');
        }
      }
    }
    if (c.wx && c.wx.rainFrom && c.wx.rainFrom * 60 <= leave % 1440 + 60) notes.push(c.wx.rainFrom + '時ごろから雨の予報なので、近いお店を選んでいます。');
    else if (c.wx && c.wx.nowRain) notes.push('雨なので、近いお店を選んでいます。');
    return { steps: steps, text: sitLead() + text.concat(notes).join(''), arrive: arrive, leave: leave };
  }

  function renderFixedStory(box, given) {
    var st = given || makeFixedStory();
    now.story = st;
    box.appendChild(el('p', 'nw-story-kicker', '「' + fix.place.name + '」の前とあと'));
    box.appendChild(el('p', 'nw-story-text', st.text || '近くに寄れそうなお店が見つかりませんでした。'));
    var ol = el('ol', 'nw-steps nw-fix-steps');
    var n = 0;
    st.steps.forEach(function (s, i) {
      if (i > 0) {
        var d = dist(s.p, st.steps[i - 1].p);
        var w = el('li', 'nw-walk');
        w.appendChild(el('span', null, walkText(d)));
        ol.appendChild(w);
      }
      var li = el('li', 'nw-step');
      li.appendChild(el('span', 'nw-step-time', hm(s.at)));
      var card;
      if (s.fixed) {
        card = el('div', 'nw-step-card fixed');
        card.appendChild(el('span', 'nw-pick-n star', '★'));
        var body = el('div', 'nw-pick-body');
        body.appendChild(el('span', 'nw-tag fixed', '決まってる行き先・' + (s.stay >= 60 ? (s.stay / 60) + '時間' : s.stay + '分')));
        var a = el('a', 'nw-pick-title', stepName(s));
        a.href = s.kind === 'event' ? s.item.link : (s.kind === 'shop' ? shopLink(s.item) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.p.lat + ',' + s.p.lng));
        a.target = '_blank'; a.rel = 'noopener';
        body.appendChild(a);
        if (s.kind === 'event') body.appendChild(el('p', 'nw-row-sub', s.item.venue + ' ・ ' + M.eventRange(s.item)));
        else if (s.kind === 'shop') body.appendChild(el('p', 'nw-row-sub', [s.item.genre, s.item.budget].filter(Boolean).join(' ・ ')));
        var dd = el('a', 'nw-dir', '道順');
        dd.href = mapsDir(s.p); dd.target = '_blank'; dd.rel = 'noopener';
        body.appendChild(dd);
        card.appendChild(thumb(s.kind === 'event' ? s.item.image : (s.kind === 'shop' ? s.item.photo : null)));
        card.appendChild(body);
      } else {
        n++;
        card = storyCard(s, s.role === 'before' ? '前' : 'あと');
        card.classList.add('nw-step-card');
        var other = el('button', 'nw-mini', 'ほかの候補');
        other.type = 'button';
        other.addEventListener('click', function () { swapFixed(s.role); });
        card.querySelector('.nw-pick-body').appendChild(other);
      }
      li.appendChild(card);
      ol.appendChild(li);
    });
    box.appendChild(ol);
    var acts = el('div', 'nw-plan-actions');
    var again = el('button', 'nw-act', '別の案にする');
    again.type = 'button';
    again.addEventListener('click', function () { $('nw-story').textContent = ''; renderFixedStory($('nw-story')); renderNowMap(); });
    acts.appendChild(again);
    var pts = st.steps.map(function (s) { return (+s.p.lat).toFixed(6) + ',' + (+s.p.lng).toFixed(6); });
    if (pts.length > 1) {
      var r = el('a', 'nw-act', 'Googleマップで道順');
      r.href = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + encodeURIComponent(pts[0]) +
        '&destination=' + encodeURIComponent(pts[pts.length - 1]) + (pts.length > 2 ? '&waypoints=' + encodeURIComponent(pts.slice(1, -1).join('|')) : '');
      r.target = '_blank'; r.rel = 'noopener';
      acts.appendChild(r);
    }
    box.appendChild(acts);
  }
  // 前（または、あと）だけ選び直す。もう片方はそのまま
  var fixTried = { before: {}, after: {} };
  function swapFixed(role) {
    var keep = {}, avoid = {};
    now.story.steps.forEach(function (s) {
      if (!s.role) return;
      if (s.role === role) fixTried[role][s.item.id] = 1;
      else keep[s.role] = s;
    });
    Object.keys(fixTried[role]).forEach(function (k) { avoid[k] = 1; });
    var next = makeFixedStory({ keep: keep, avoid: avoid });
    if (!next.steps.some(function (s) { return s.role === role; })) {
      fixTried[role] = {};   // 候補を一周したら最初から
      next = makeFixedStory({ keep: keep });
    }
    var box = $('nw-story');
    box.textContent = '';
    renderFixedStory(box, next);
    renderNowMap();
  }

  function initFix() {
    wirePicker(NOW_PICKER);
    $('nw-fix-time').addEventListener('change', function () { fix.time = $('nw-fix-time').value || null; });
    $('nw-fix-go').addEventListener('click', startFixed);
    renderFixPills();
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
  var BUDGETS_PL = [{ id: 0, label: '指定なし' }, { id: 2000, label: '〜2,000円' }, { id: 3000, label: '〜3,000円' },
    { id: 5000, label: '〜5,000円' }, { id: 8000, label: '〜8,000円' }, { id: 12000, label: '〜12,000円' }];
  var plan = { budget: store.get('meshi.plBudget', 0), fix: { place: null, time: '18:00', stay: null, stayTouched: false }, day: null, time: store.get('meshi.plTime', 'afternoon'), area: store.get('meshi.plArea', 'sakae'), here: null, steps: null, mapObj: null };

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
        return { kind: 'event', item: ev, p: ev, name: M.eventName(ev), dur: step.dur, price: EVENT_PRICE };
      }
      if (!step.alt) return null;
      if (step.alt === 'buzz') {
        var bz = ctx.buzz.filter(function (b) {
          return !used[b.shop.id] && dist(b.shop, from) <= maxD * 1.5 && M.isOpenNow(b.shop, atDate) !== false;
        }).sort(function (a, b) { return dist(a.shop, from) - dist(b.shop, from); });
        if (bz.length) {
          var b0 = ctx.reroll ? pick(bz, 3) : bz[0];
          return { kind: 'shop', item: b0.shop, p: b0.shop, name: b0.shop.name, dur: 45, buzz: b0.article, label: '話題のお店', price: priceOf(b0.shop, 'cafe') };
        }
      }
      return chooseStep({ kind: 'meal', slot: 'cafe', dur: 45 }, ctx, from, at, used);
    }
    var list = openShops(ctx.shops, atDate, step.slot, from, ctx.first ? 1500 : maxD, true)
      .filter(function (sh) { return !used[sh.id]; });
    if (!list.length) list = openShops(ctx.shops, atDate, step.slot, from, 2000, true).filter(function (sh) { return !used[sh.id]; });
    if (!list.length) return null;
    var over = false;
    if (ctx.cap) {
      // 予算内のお店だけにする。ひとつもなければ、いちばん安いあたりから
      var inBudget = list.filter(function (sh) { return priceOf(sh, step.slot) <= ctx.cap * 1.1; });
      if (inBudget.length) list = inBudget;
      else { list = list.slice().sort(function (a, b) { return priceOf(a, step.slot) - priceOf(b, step.slot); }).slice(0, 3); over = true; }
    }
    var sh = ctx.reroll ? pick(shuffleTop(list, 6), 6) : list[0];
    return { kind: 'shop', item: sh, p: sh, name: sh.name, dur: step.dur, label: SLOTS[step.slot].label, unknown: sh._open !== true, buzz: sh._buzz,
      price: priceOf(sh, step.slot), over: over };
  }

  // 予算の配り方：選ぶたびに「残りの予算 × この1か所の重み ÷ 残りの重み」を上限にする
  function Budgeter(total, defs, fixedCost) {
    this.total = total;
    this.left = total ? total - (fixedCost || 0) : 0;
    this.wLeft = defs.reduce(function (a, d) { return a + stepWeight(d); }, 0);
  }
  Budgeter.prototype.cap = function (def) {
    if (!this.total) return null;
    return Math.max(500, this.left * stepWeight(def) / Math.max(this.wLeft, 0.01));
  };
  Budgeter.prototype.spend = function (def, price) {
    this.wLeft -= stepWeight(def);
    if (this.total) this.left -= price || 0;
  };
  function fixedCostOf(F) {
    if (!F) return 0;
    if (F.kind === 'shop') return priceOf(F.item, 'dinner');
    if (F.kind === 'event') return EVENT_PRICE;
    return 0;
  }

  // 決まってる予定があるとき：その時刻は動かさず、前とあとをプランで埋める
  function makeFixedPlan(reroll) {
    var t = TIMES.filter(function (x) { return x.id === plan.time; })[0];
    var F = plan.fix.place;
    var center = { lat: F.lat, lng: F.lng };
    var iso = plan.day;
    var dw = dayWeather(iso);
    var ctx = {
      iso: iso, rainy: dayRainy(dw), reroll: reroll,
      shops: plan.shops.filter(function (sh) { return sh.lat != null && dist(sh, center) <= 2500; }),
      events: eventsOn(iso).filter(function (g) { return dist(g, center) <= 2500; })
    };
    ctx.buzz = buzzShops(ctx.shops);
    var hmToMin = function (v) { var a = (v || '18:00').split(':'); return +a[0] * 60 + +a[1]; };
    var fixedAt = hmToMin(plan.fix.time);
    var stay = plan.fix.stay || defaultStay(F);
    var start = t.start;
    if (iso === M.todayJst()) {
      var nm = minutesOf(jstNow());
      if (nm > start) start = Math.ceil((nm + 10) / 15) * 15;
    }
    if (fixedAt < start) start = fixedAt;
    var food = fixIsFood(F);
    var used = {};
    if (F.kind !== 'place') used[F.item.id] = 1;
    var fixedStep = { kind: F.kind === 'event' ? 'event' : (F.kind === 'shop' ? 'shop' : 'place'), fixed: true,
      item: F.kind === 'place' ? { id: 'place', name: F.name, address: F.item.address } : F.item,
      p: center, name: F.name, at: fixedAt, dur: stay, price: fixedCostOf(F) || null };
    // 前：時間に余裕があるだけ（最大2か所）。着く時刻から逆算する
    var room = fixedAt - start;
    var before = [];
    var mealAt = function (m) { var sl = slotAt(m % 1440); return sl === 'late' ? 'dinner' : sl; };
    if (room >= 160) before = food ? [{ kind: 'event', dur: 75, alt: null }, { kind: 'meal', slot: 'cafe', dur: 40 }]
      : [{ kind: 'event', dur: 75, alt: 'buzz' }, { kind: 'meal', slot: mealAt(fixedAt - 70), dur: 60 }];
    else if (room >= 55) before = food ? [{ kind: 'meal', slot: 'cafe', dur: 40 }] : [{ kind: 'meal', slot: mealAt(fixedAt - 70), dur: 60 }];
    // あとの予定も先に決めておき（予算を配るため）、前から順に選ぶ
    var after = [];
    var leave = fixedAt + stay;
    var lm = leave % 1440;
    if (food) after = [{ kind: 'meal', slot: lm >= 1020 || lm < 300 ? 'second' : 'cafe', dur: 60 }];
    else {
      var s1 = lm >= 1260 || lm < 300 ? 'second' : mealAt(lm);
      after = [{ kind: 'meal', slot: s1, dur: s1 === 'cafe' ? 45 : 70 }];
      // 2か所目：夜ごはんのあとは2軒目、昼すぎのカフェのあとは夜ごはん
      if (s1 === 'dinner' && lm + 80 < 1290) after.push({ kind: 'meal', slot: 'second', dur: 60 });
      else if ((s1 === 'cafe' || s1 === 'lunch') && lm + 60 >= 960) after.push({ kind: 'meal', slot: 'dinner', dur: 70, notBefore: 1050 });
    }
    var bud = new Budgeter(plan.budget, before.concat(after), fixedCostOf(F));
    var bSteps = [];
    var cursor = fixedAt - 10;
    for (var i = before.length - 1; i >= 0; i--) {
      var d = before[i];
      var at = cursor - d.dur;
      ctx.first = false;
      ctx.cap = bud.cap(d);
      var c = chooseStep(d, ctx, center, at, used);
      bud.spend(d, c && c.price);
      if (!c) continue;
      // 同じジャンルが続くなら（カフェ→カフェなど）入れない
      if (c.kind === 'shop' && bSteps.some(function (x) { return x.kind === 'shop' && x.item.genre === c.item.genre; })) continue;
      c.at = at; c.def = d; c.dur = c.kind === 'event' ? d.dur : c.dur; used[c.item.id] = 1;
      bSteps.unshift(c);
      cursor = at - 10;
    }
    // あと：その時間帯に合わせて最大2か所（23時半まで）
    var aSteps = [];
    var from = center, m2 = leave;
    after.forEach(function (d) {
      if (d.notBefore && m2 < d.notBefore) m2 = d.notBefore;
      if (m2 > 1410) return;
      ctx.cap = bud.cap(d);
      var c = chooseStep(d, ctx, from, m2 + 5, used);
      bud.spend(d, c && c.price);
      if (!c) return;
      m2 += 5 + Math.round(dist(c.p, from) / WALK);
      c.at = m2; c.def = d; c.dur = d.dur; used[c.item.id] = 1;
      aSteps.push(c);
      m2 += d.dur;
      from = c.p;
    });
    var steps = bSteps.concat([fixedStep], aSteps);
    var pl = { steps: steps, center: center, areaLabel: F.name + 'まわり', iso: iso, dw: dw, rainy: ctx.rainy, ctx: ctx, time: t, fixedPlan: true, fixedAt: fixedAt };
    retime(pl);
    return pl;
  }

  function makePlan(reroll) {
    if (plan.fix && plan.fix.place) return makeFixedPlan(reroll);
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
    var bud = new Budgeter(plan.budget, t.steps, 0);
    t.steps.forEach(function (st, i) {
      ctx.first = i === 0;
      if (st.notBefore && min < st.notBefore) min = st.notBefore;
      ctx.cap = bud.cap(st);
      var c = chooseStep(st, ctx, from, min, used);
      bud.spend(st, c && c.price);
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

  // 決まってる予定を数えない通し番号
  function stopNo(steps, i) {
    var n = 0;
    for (var k = 0; k <= i; k++) if (!steps[k].fixed) n++;
    return n;
  }
  function retime(pl) {
    if (pl.fixedPlan) {
      // 時刻は決まってる予定に合わせてあるので、歩く時間だけ計算し直す
      pl.steps.forEach(function (c, i) {
        if (i === 0) { c.walk = null; c.walkM = null; return; }
        var d = dist(c.p, pl.steps[i - 1].p);
        c.walk = Math.round(d / WALK); c.walkM = d;
      });
      return;
    }
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
    var who = curSit().id === 'any' ? '' : '・' + (curSit().id === 'group' ? '友達' + (sit.n >= 8 ? '7人〜' : sit.n + '人') : curSit().label);
    if (plan.budget) who += '・1人' + yen(plan.budget) + 'まで';
    $('pl-title').textContent = pl.fixedPlan
      ? M.fmtDay(pl.iso) + ' ' + hm(pl.fixedAt) + '「' + plan.fix.place.name + '」の前後' + who + 'プラン'
      : M.fmtDay(pl.iso) + ' ' + pl.time.label.replace(/\s.*$/, '') + '・' + pl.areaLabel + who + 'プラン';
    if (pl.dw) {
      wxChips($('pl-wx'), { code: pl.dw.code, tmax: pl.dw.tmax, tmin: pl.dw.tmin, pop: pl.dw.pop, rainy: pl.rainy,
        note: pl.rainy ? '雨の予報なので、屋内と近い場所を中心にしました' : '名古屋の予報' }, '天気');
    } else {
      $('pl-wx').textContent = '';
    }
    // 合計の目安
    var total = pl.steps.reduce(function (a, c) { return a + (c.price || 0); }, 0);
    var tb = $('pl-total');
    tb.textContent = '';
    tb.className = 'nw-total' + (plan.budget && total > plan.budget ? ' over' : (plan.budget ? ' ok' : ''));
    tb.appendChild(el('span', 'nw-total-label', '合計の目安'));
    tb.appendChild(el('b', null, '1人 約' + yen(total)));
    if (plan.budget) tb.appendChild(el('span', 'nw-total-note', total > plan.budget
      ? '予算' + yen(plan.budget) + 'を約' + yen(total - plan.budget) + 'こえています。「ほかの候補」で入れ替えられます'
      : '予算' + yen(plan.budget) + 'の中に収まっています'));
    tb.appendChild(el('span', 'nw-total-src', 'お店の予算（ホットペッパーの平均）からの目安です'));
    pl.total = total;
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
      var card = el('div', 'nw-step-card' + (c.fixed ? ' fixed' : ''));
      card.appendChild(el('span', 'nw-pick-n' + (c.fixed ? ' star' : ''), c.fixed ? '★' : String(stopNo(pl.steps, i))));
      var body = el('div', 'nw-pick-body');
      var it = c.item;
      if (c.fixed) {
        body.appendChild(el('span', 'nw-tag fixed', '決まってる予定・' + (c.dur >= 60 ? (c.dur / 60) + '時間' : c.dur + '分')));
        var fa = el('a', 'nw-pick-title', c.name);
        fa.href = c.kind === 'event' ? it.link : (c.kind === 'shop' ? shopLink(it) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.p.lat + ',' + c.p.lng));
        fa.target = '_blank'; fa.rel = 'noopener';
        body.appendChild(fa);
        if (c.kind === 'event') body.appendChild(el('p', 'nw-row-sub', it.venue + ' ・ ' + M.eventRange(it)));
        else if (c.kind === 'shop') body.appendChild(el('p', 'nw-row-sub', [it.genre, it.budget].filter(Boolean).join(' ・ ')));
        if (c.price) body.appendChild(el('p', 'nw-price', '1人 約' + yen(c.price)));
      } else if (c.kind === 'event') {
        body.appendChild(el('span', 'nw-tag event', 'イベント' + (it.place === 'indoor' ? '・屋内' : it.place === 'outdoor' ? '・屋外' : '')));
        var a = el('a', 'nw-pick-title', c.name);
        a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
        body.appendChild(a);
        body.appendChild(el('p', 'nw-row-sub', it.venue + ' ・ ' + M.eventRange(it) + ' ・ いる時間の目安' + c.dur + '分'));
        body.appendChild(el('p', 'nw-price', '食べ歩き 1人 約' + yen(c.price || EVENT_PRICE)));
      } else {
        var tagText = [c.label, (c.label || '').indexOf(it.genre) >= 0 ? '' : it.genre, c.buzz ? '話題' : ''].filter(Boolean).join('・');
        body.appendChild(el('span', 'nw-tag' + (c.buzz ? ' buzz' : ''), tagText));
        var b = el('a', 'nw-pick-title', it.name);
        b.href = shopLink(it); b.target = '_blank'; b.rel = 'noopener';
        body.appendChild(b);
        var sub = [c.unknown ? '営業時間は要確認' : '', 'いる時間の目安' + c.dur + '分'].filter(Boolean).join(' ・ ');
        if (c.price) body.appendChild(el('p', 'nw-price' + (c.over ? ' over' : ''), '1人 約' + yen(c.price) + (c.over ? '（予算内のお店が近くになかったので、安めのお店）' : '')));
        body.appendChild(el('p', 'nw-row-sub', sub));
        var plo = loBadge(it, dateAt(pl.iso, c.at), '着いてから');
        if (plo) body.appendChild(plo);
        var pf = feats(it);
        if (pf) body.appendChild(pf);
        if (c.buzz) {
          var na = el('a', 'nw-news-link', '話題の記事：' + c.buzz.title);
          na.href = c.buzz.link; na.target = '_blank'; na.rel = 'noopener';
          body.appendChild(na);
        }
      }
      var acts = el('div', 'nw-step-acts');
      if (!c.fixed) {
        var other = el('button', 'nw-mini', 'ほかの候補');
        other.type = 'button';
        other.addEventListener('click', function () { swapStep(i); });
        acts.appendChild(other);
      }
      var dir = el('a', 'nw-dir', '道順');
      dir.href = mapsDir(c.p); dir.target = '_blank'; dir.rel = 'noopener';
      acts.appendChild(dir);
      body.appendChild(acts);
      card.appendChild(thumb(c.kind === 'event' ? it.image : (c.kind === 'place' ? null : (it.photo || (c.buzz && c.buzz.image)))));
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
      pl.steps.map(function (c) { return hm(c.at) + ' ' + (c.fixed ? '★' : '') + c.name + (c.kind === 'event' ? '（' + c.item.venue + '）' : c.kind === 'place' ? '' : '（' + c.item.genre + '）'); }).join('\n') +
      '\n合計の目安：1人 約' + yen(pl.total) + (plan.budget ? '（予算' + yen(plan.budget) + '）' : '') +
      '\n道順：' + route;
    $('pl-line').href = 'https://line.me/R/share?text=' + encodeURIComponent(text);
    renderPlanMap();
  }

  function swapStep(i) {
    var pl = plan.current;
    var c = pl.steps[i];
    var from = i === 0 ? pl.center : pl.steps[i - 1].p;
    if (pl.fixedPlan) from = pl.center;
    var used = {};
    pl.steps.forEach(function (x) { used[x.item.id] = 1; });
    (c.tried = c.tried || {})[c.item.id] = 1;
    Object.keys(c.tried).forEach(function (k) { used[k] = 1; });
    var ctx = pl.ctx;
    ctx.first = i === 0; ctx.reroll = true;
    var others = pl.steps.reduce(function (a, x, j) { return a + (j === i ? 0 : (x.price || 0)); }, 0);
    ctx.cap = plan.budget ? Math.max(500, plan.budget - others) : null;
    var n = chooseStep(c.def, ctx, from, c.at, used);
    if (!n) {
      // 候補がなくなったら最初から
      c.tried = {};
      n = chooseStep(c.def, ctx, from, c.at, (function () { var u = {}; pl.steps.forEach(function (x, j) { if (j !== i) u[x.item.id] = 1; }); return u; })());
    }
    if (!n) return;
    n.def = c.def; n.tried = c.tried;
    if (pl.fixedPlan) { n.at = c.at; n.dur = c.dur; }
    if (!n.price && c.def && c.def.kind === 'event') n.price = EVENT_PRICE;
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
      L.marker([+c.p.lat, +c.p.lng], { icon: pin(c.fixed ? '★' : String(stopNo(pl.steps, i)), c.fixed ? 'fixed' : (c.kind === 'event' ? 'event' : 'shop')), title: c.name })
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
    var needHere = plan.area === 'here' && !plan.here && !plan.fix.place;
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
      var center = plan.fix.place ? { lat: plan.fix.place.lat, lng: plan.fix.place.lng }
        : (plan.area === 'here' ? plan.here : SPOTS.filter(function (s) { return s.id === plan.area; })[0]);
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

  function renderPlanFix() {
    pillsInto('pl-fix-stay', STAY_OPTS, plan.fix.stay || defaultStay(plan.fix.place), function (id) { plan.fix.stay = id; plan.fix.stayTouched = true; });
    var note = $('pl-fix-note');
    note.hidden = !plan.fix.place;
    if (plan.fix.place) note.textContent = '場所は「' + plan.fix.place.name + '」のまわりで組みます（「どこで」は使いません）。「時間」はプランを始める時刻です。';
    $('pl-area').classList.toggle('is-dim', !!plan.fix.place);
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
    if (!BUDGETS_PL.some(function (x) { return x.id === plan.budget; })) plan.budget = 0;
    pillsInto('pl-budget', BUDGETS_PL, plan.budget, function (id) {
      plan.budget = id;
      store.set('meshi.plBudget', id);
      if (plan.current && !$('pl-result').hidden) { plan.current = makePlan(true); renderPlan(); }
    });
    $('pl-make').addEventListener('click', function () { buildPlan(false); });
    // 決まってる予定（あれば）
    var PLAN_PICKER = {
      pre: 'pl-fix',
      onChoose: function (p) {
        plan.fix.place = p;
        if (!plan.fix.stayTouched) plan.fix.stay = defaultStay(p);
        $('pl-fix-opts').hidden = false;
        renderPlanFix();
      },
      onClear: function () { plan.fix.place = null; $('pl-fix-opts').hidden = true; renderPlanFix(); }
    };
    wirePicker(PLAN_PICKER);
    $('pl-fix-time').value = plan.fix.time;
    $('pl-fix-time').addEventListener('change', function () { plan.fix.time = $('pl-fix-time').value || '18:00'; });
    renderPlanFix();
    $('pl-again').addEventListener('click', function () { buildPlan(true); });
  }

  // ---------- だれと行く？（今から行ける・プラン共通） ----------
  function renderSit() {
    [['nw-sit', 'nw-people'], ['pl-sit', 'pl-people']].forEach(function (ids) {
      var box = $(ids[0]), pbox = $(ids[1]);
      if (!box) return;
      box.textContent = '';
      SITS.forEach(function (x) {
        var b = el('button', 'g-pill nw-sit-pill', x.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(sit.id === x.id));
        b.addEventListener('click', function () { setSit(x.id, sit.n); });
        box.appendChild(b);
      });
      pbox.textContent = '';
      pbox.hidden = sit.id !== 'group';
      PEOPLE.forEach(function (x) {
        var b = el('button', 'g-pill', x.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(sit.n === x.id));
        b.addEventListener('click', function () { setSit('group', x.id); });
        pbox.appendChild(b);
      });
    });
    var h = $('nw-open-h');
    if (h) h.textContent = curSit().id === 'any' ? '今開いてるお店' : '今開いてるお店（' + (curSit().id === 'group' ? '友達' + sit.n + '人' : curSit().label) + '向きの順）';
  }
  function setSit(id, n) {
    sit.id = id; sit.n = n;
    store.set('meshi.sit', id);
    store.set('meshi.sitN', n);
    renderSit();
    // 結果が出ていれば、読み込み直さずに選び直す
    if (now.lastShops && !$('nw-result').hidden) {
      buildNow(now.lastShops);
      renderNowMap();
    }
    if (plan.current && !$('pl-result').hidden) {
      plan.current = makePlan(true);
      renderPlan();
    }
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

  if (!SITS.some(function (x) { return x.id === sit.id; })) sit.id = 'any';
  if (!PEOPLE.some(function (x) { return x.id === sit.n; })) sit.n = 4;
  initNow();
  initFix();
  initPlan();
  renderSit();
  if (location.hash === '#plan') showTab('plan');
  loadData(); // 先に読み込んでおく

  // テスト用
  window.__meshiNow = { slotAt: slotAt, eventsOn: eventsOn, data: data };
})();

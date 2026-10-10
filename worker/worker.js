/**
 * 飯飯食堂：飯ガチャ「現在地から」用の中継プログラム（Cloudflare Workers）
 *
 * ブラウザから緯度・経度を受け取り、ホットペッパーグルメ Webサービスで周辺のお店を検索して返す。
 * APIキーはここ（Cloudflare の Secret）にだけ置き、ページ側には出さない。
 *
 * 必要な設定（Cloudflare の Worker → Settings → Variables and Secrets）
 *   HOTPEPPER_API_KEY : ホットペッパーの APIキー（Secret）
 *   ALLOWED_ORIGINS   : 呼び出しを許すサイト（任意。カンマ区切り。未設定なら下の既定値）
 *
 * 呼び出し方
 *   GET /nearby?lat=35.17&lng=136.90&range=1000&genre=ラーメン
 *     range : 300 / 500 / 1000 / 2000 / 3000（m）
 *     genre : 画面のジャンル名（省略でおまかせ）
 */

const API = 'https://webservice.recruit.co.jp/hotpepper';
const DEFAULT_ORIGINS = 'https://junnn665.github.io,http://localhost:8766';
const RANGE_CODE = { 300: 1, 500: 2, 1000: 3, 2000: 4, 3000: 5 };

// 画面のジャンル名 → ホットペッパーのジャンル名
const GENRES = {
  'ラーメン': 'ラーメン',
  '居酒屋': '居酒屋',
  '和食': '和食',
  '洋食': '洋食',
  'イタリアン': 'イタリアン・フレンチ',
  '中華': '中華',
  '焼肉': '焼肉・ホルモン',
  '韓国料理': '韓国料理',
  'エスニック': 'アジア・エスニック料理',
  'お好み焼き': 'お好み焼き・もんじゃ',
  'カフェ': 'カフェ・スイーツ',
};
const LABEL_OF = Object.fromEntries(Object.entries(GENRES).map(([k, v]) => [v, k]));

let genreCodes = null; // ジャンル名 → コード（起動中は使い回す）

async function hp(path, params, key) {
  const q = new URLSearchParams({ ...params, key, format: 'json' });
  const res = await fetch(`${API}/${path}/v1/?${q}`, { cf: { cacheTtl: 600 } });
  if (!res.ok) throw new Error(`hotpepper ${res.status}`);
  const data = await res.json();
  if (data.results && data.results.error) throw new Error('hotpepper error');
  return data.results || {};
}

async function genreCode(label, key) {
  if (!label || !GENRES[label]) return null;
  if (!genreCodes) {
    const r = await hp('genre', {}, key);
    genreCodes = Object.fromEntries((r.genre || []).map((g) => [g.name, g.code]));
  }
  return genreCodes[GENRES[label]] || null;
}

function budgetText(b) {
  const rng = (b && b.name) || '';
  const avg = ((b && b.average) || '').trim();
  if (avg && avg.includes('円') && avg.length <= 20 && avg !== rng) return rng ? `${rng}（${avg}）` : avg;
  return rng || avg.slice(0, 20);
}

function compact(s) {
  const g = (s.genre && s.genre.name) || '';
  return {
    id: s.id,
    name: s.name || '',
    genre: LABEL_OF[g] || g || 'お店',
    catch: (s.catch || (s.genre && s.genre.catch) || '').slice(0, 80),
    address: s.address || '',
    access: (s.mobile_access || s.access || '').slice(0, 60),
    budget: budgetText(s.budget),
    budget_code: (s.budget && s.budget.code) || '',
    open: (s.open || '').slice(0, 260),
    close: (s.close || '').slice(0, 60),
    lunch: String(s.lunch || '').startsWith('あり'),
    photo: (s.photo && s.photo.pc && s.photo.pc.l) || null,
    url: (s.urls && s.urls.pc) || '',
    lat: s.lat,
    lng: s.lng,
    rank: s._rank || null,
  };
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map((x) => x.trim());
  const h = { 'Vary': 'Origin', 'Content-Type': 'application/json; charset=utf-8' };
  if (allowed.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  return { headers: h, ok: allowed.includes(origin) };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.headers });
    if (!cors.ok) return json({ error: 'forbidden' }, 403, cors.headers);

    const url = new URL(request.url);
    if (url.pathname !== '/nearby') return json({ error: 'not found' }, 404, cors.headers);
    if (!env.HOTPEPPER_API_KEY) return json({ error: 'not configured' }, 500, cors.headers);

    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const range = Number(url.searchParams.get('range') || 1000);
    const label = url.searchParams.get('genre') || '';
    // 日本の範囲だけ受け付ける
    if (!(lat > 20 && lat < 46 && lng > 122 && lng < 154) || !RANGE_CODE[range]) {
      return json({ error: 'bad request' }, 400, cors.headers);
    }

    // 位置は約100m単位に丸めてキャッシュ（ホットペッパーへの問い合わせを減らす）
    const rlat = lat.toFixed(3), rlng = lng.toFixed(3);
    const cacheKey = new Request(`https://cache.local/nearby?lat=${rlat}&lng=${rlng}&range=${range}&genre=${encodeURIComponent(label)}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const res = new Response(hit.body, hit);
      Object.entries(cors.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    try {
      const key = env.HOTPEPPER_API_KEY;
      const params = { lat: rlat, lng: rlng, range: RANGE_CODE[range], count: 100, order: 4 };
      const code = await genreCode(label, key);
      if (code) params.genre = code;
      const first = await hp('gourmet', params, key);
      // おすすめ順の順位（「人気上位」の条件に使う）
      let shops = (first.shop || []).map((s, i) => ({ ...s, _rank: i + 1 }));
      const total = Number(first.results_available || 0);
      // 100軒より多いときは、別のページもランダムに1つ足して顔ぶれを広げる
      if (total > 100) {
        const pages = Math.min(Math.ceil(total / 100), 10);
        const p = 1 + Math.floor(Math.random() * (pages - 1)) + 1; // 2ページ目以降
        const more = await hp('gourmet', { ...params, start: (p - 1) * 100 + 1 }, key);
        shops = shops.concat((more.shop || []).map((s, i) => ({ ...s, _rank: (p - 1) * 100 + i + 1 })));
      }
      const seen = new Set();
      const out = [];
      for (const s of shops) {
        if (!seen.has(s.id)) { seen.add(s.id); out.push(compact(s)); }
      }
      const body = JSON.stringify({ total, shops: out });
      const res = new Response(body, { status: 200, headers: { ...cors.headers, 'Cache-Control': 'public, max-age=1800' } });
      ctx.waitUntil(cache.put(cacheKey, new Response(body, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
      })));
      return res;
    } catch (e) {
      return json({ error: 'upstream' }, 502, cors.headers);
    }
  },
};

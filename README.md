# 飯飯食堂

東海・名古屋のグルメニュース（デカ盛り・話題/行列・新店・チェーン新作・コンビニ・安うま）を
1時間ごとに自動で集めて表示する非公式まとめサイトです。

## しくみ

- `scripts/fetch_news.py` … Bingニュース / Googleニュース のキーワード検索RSSと、PR TIMES の新着RSSから記事を集め、
  カテゴリとエリアを自動で振り分けて `data/news.json` に保存します（標準ライブラリのみ）。
- `.github/workflows/update.yml` … 毎時7分に上のスクリプトを実行し、GitHub Pages に公開します。
- `index.html` / `assets/` … `data/news.json` を読み込んで表示するページです。

## 初回設定

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
2. **Actions** タブ → 「ニュース更新と公開」 → **Run workflow** で1回手動実行する
3. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で表示されます

## 飯ガチャ（ホットペッパーのお店データ）

- `scripts/fetch_shops.py` … ホットペッパーグルメ Webサービスから、名古屋・愛知・岐阜・三重の
  ジャンル別おすすめ店を1日1回取得し、`data/shops/` に書き出します。
- 規約（キャッシュは24時間以内に更新・第三者DBへの複製禁止）に合わせて、お店データはリポジトリに保存せず、
  公開ページにだけ載せています。取り直せないまま24時間を過ぎたデータは消します。
- 使うには APIキー（https://webservice.recruit.co.jp/register で無料登録）を、
  リポジトリの **Settings → Secrets and variables → Actions** に `HOTPEPPER_API_KEY` という名前で登録します。

## 飯ガチャ「現在地から」を全国で使う（Cloudflare Workers）

- `worker/worker.js` … 緯度・経度を受け取り、ホットペッパーで周辺のお店を検索して返す中継プログラム。
  APIキーは Cloudflare の Secret にだけ置き、ページ側には出しません。
- Cloudflare で Worker を作って `worker/worker.js` を貼り付け、Secret `HOTPEPPER_API_KEY` を登録します。
- できた Worker のURLを `assets/config.js` の `nearbyApi` に書くと、全国の「現在地から」が有効になります。
  空のあいだ（または中継が止まっているとき）は、東海のお店データの中から近いお店を探します。

## 飯ガチャ「現在地から」と OpenStreetMap

- 「現在地から」では、ホットペッパーのお店に加えて OpenStreetMap（Overpass API、無料・登録不要）で
  周辺の飲食店（restaurant / cafe / fast_food / pub）を探し、同じお店はホットペッパー側を残してまとめます。
- OpenStreetMap のお店には写真・予算・順位がないため、「予算」「人気上位」で絞ったときは候補に入りません。
- 表示には © OpenStreetMap contributors の表記を入れています。

## ごはんイベントマップ（events.html）

- `scripts/events.py` … ニュースの見出しから、フェス・マルシェ・物産展などのごはんイベントを見分け、
  会場（`VENUES` の一覧）と開催日を読み取ります。お店のキャンペーンやチェーンの新商品はイベントにしません。
- 会場の座標は `VENUES` の値を基本に、公開時に OpenStreetMap の地名検索（Nominatim）で確かめ、
  `data/venues.json` に保存します（1回の実行で数件・1秒に1回まで）。
- 地図は Leaflet（`assets/vendor/leaflet`、BSDライセンス）と OpenStreetMap のタイルで表示します。
- 「今週末のおすすめ」… 次の土日（土日に見ているときはその週末）に開催しているイベントを地図の上にまとめます。
- イベントの「行きたい」… 記事の「行きたい」と同じ保存先（`meshi.saved`）に日程・会場ごと保存し、
  始まる日・最終日・その前日に、イベントマップとトップページでお知らせを出します（×で当日は非表示）。
- 同じイベントの記事 … 見出しの「」『』の中のイベント名と会場が同じ記事に同じ `group` をつけ、1枚のカードにまとめます。
- カレンダーに追加 … 公開のときに `scripts/make_ics.py` が `cal/<group>.ics` を作ります（リポジトリには保存しない）。
  Googleカレンダーへのリンクも出します。
- 雨の日フィルター … `events.py` の `INDOOR_VENUES` / `OUTDOOR_VENUES` と見出しの言葉で、屋内・屋外を判断します。
- 新しい会場を増やすときは `VENUES` に「表示名・見出しで探す言葉・緯度・経度・地名検索の言葉」を足します。

## 調整したいとき

- 集めるキーワード … `scripts/fetch_news.py` の `QUERIES`
- カテゴリの振り分け … 同じファイルの `CATEGORY_RULES`
- 対象エリア … `AREA_RULES`
- 全国チェーンとして拾う店名 … `CHAIN_WORDS`
- カテゴリ名や色 … `assets/app.js` の `CATEGORIES`

## 手元で試す

```sh
python3 scripts/fetch_news.py
python3 -m http.server 8000   # → http://localhost:8000
```

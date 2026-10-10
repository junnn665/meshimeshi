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

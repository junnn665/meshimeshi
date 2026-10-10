#!/usr/bin/env python3
"""飯飯食堂: グルメニュースを集めて data/news.json を更新するスクリプト。

GitHub Actions から1時間ごとに実行される。標準ライブラリだけで動く。

取得元
  - Bing ニュース RSS（キーワード検索。記事への直リンクとサムネイルが取れる）
  - Google ニュース RSS（キーワード検索。件数の補完用）
  - PR TIMES 新着 RSS（チェーン・コンビニの新作など企業の公式発表）
"""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "news.json"

JST = dt.timezone(dt.timedelta(hours=9))
NOW = dt.datetime.now(dt.timezone.utc)

KEEP_DAYS = 30        # この日数より古い記事は消す
INGEST_DAYS = 14      # この日数より古い記事は新しく取り込まない
MAX_ITEMS = 400       # 保存する最大件数
MAX_IMAGE_FETCH = 80  # 1回の実行で写真を探しにいく最大件数

UA = (
    "Mozilla/5.0 (compatible; MeshimeshiShokudoBot/1.0; "
    "+https://github.com/) Python-urllib"
)

# ---------------------------------------------------------------------------
# 検索キーワード（カテゴリの初期値, 東海向けの検索か）
# ここを書き換えれば集めるニュースを調整できる
# ---------------------------------------------------------------------------
QUERIES = [
    # デカ盛り・インパクト系
    ("名古屋 デカ盛り", "deka", True),
    ("愛知 デカ盛り", "deka", True),
    ("岐阜 デカ盛り OR 三重 デカ盛り", "deka", True),
    ("名古屋 大盛り グルメ", "deka", True),
    # 話題・行列
    ("名古屋 行列 グルメ", "wadai", True),
    ("名古屋 話題 グルメ", "wadai", True),
    ("東海 人気店 グルメ", "wadai", True),
    # 新店
    ("名古屋 オープン 飲食店", "shinten", True),
    ("名古屋 新店 ラーメン OR カフェ", "shinten", True),
    ("愛知 オープン グルメ", "shinten", True),
    # チェーン新作
    ("東海限定 新メニュー", "chain", True),
    ("名古屋 期間限定 メニュー", "chain", True),
    # コンビニ
    ("東海限定 コンビニ", "conbini", True),
    ("東海限定 セブンイレブン OR ファミリーマート OR ローソン", "conbini", True),
    # 安うま・コスパ
    ("名古屋 コスパ ランチ", "yasuuma", True),
    ("名古屋 安い グルメ", "yasuuma", True),
    ("名古屋 モーニング", "yasuuma", True),
]

PRTIMES_FEED = "https://prtimes.jp/index.rdf"

# ---------------------------------------------------------------------------
# 判定ルール
# ---------------------------------------------------------------------------
FOOD_WORDS = [
    "グルメ", "飯", "ごはん", "ご飯", "ランチ", "モーニング", "ディナー", "食べ放題",
    "ラーメン", "らーめん", "つけ麺", "まぜそば", "麺", "うどん", "そば", "きしめん",
    "丼", "定食", "食堂", "レストラン", "料理", "飲食", "グルメ", "メニュー",
    "カフェ", "喫茶", "スイーツ", "パフェ", "ケーキ", "パン", "ベーカリー", "ドーナツ",
    "寿司", "すし", "焼肉", "焼き鳥", "焼鳥", "とんかつ", "味噌カツ", "みそかつ",
    "唐揚げ", "からあげ", "カレー", "餃子", "中華", "ピザ", "パスタ", "バーガー",
    "ハンバーグ", "ステーキ", "天むす", "ひつまぶし", "手羽先", "台湾", "おにぎり",
    "弁当", "惣菜", "アイス", "かき氷", "たこ焼き", "お好み焼き", "居酒屋", "ビュッフェ",
    "デカ盛り", "大盛り", "食べ歩き", "食べられる", "味わえる", "グルメ",
]

# 東海以外の地域名（東海の地名が無く、これが入っている記事は除外）
OTHER_REGION_WORDS = [
    "北海道", "札幌", "東北", "仙台", "東京", "関東", "神奈川", "横浜", "川崎", "埼玉", "千葉",
    "池袋", "渋谷", "新宿", "恵比寿", "八重洲", "吉祥寺", "銀座", "表参道", "原宿", "秋葉原",
    "大阪", "関西", "心斎橋", "梅田", "難波", "京都", "神戸", "兵庫", "奈良", "和歌山", "滋賀",
    "中国地方", "広島", "岡山", "山口", "四国", "香川", "愛媛", "九州", "福岡", "博多", "熊本",
    "鹿児島", "沖縄", "長野", "新潟", "北陸", "金沢", "富山", "福井",
    "山梨", "甲府", "栃木", "宇都宮", "小山市", "茨城", "つくば", "群馬", "高崎",
    "品川", "高輪", "汐留", "調布", "船橋", "自由が丘", "五反田", "月島", "浅草", "上野",
    "松山", "北九州", "小倉", "太融寺", "天神", "ロンドン", "ニューヨーク", "パリ", "台北",
]

# 写真ギャラリーなど、本文記事の重複になるページ
JUNK_PATTERNS = [
    re.compile(r"画像\s*\d+\s*/\s*\d+"),
    re.compile(r"ページ\s*\d+\s*/\s*全"),
    re.compile(r"写真\s*\d+\s*/\s*\d+"),
]

# 上から順に判定し、最初に当たったカテゴリにする
CATEGORY_RULES = [
    ("deka", ["デカ盛り", "でか盛り", "メガ盛り", "大盛り", "特盛", "爆盛", "超盛",
              "チャレンジメニュー", "ギガ", "1kg", "１kg", "2kg", "２kg"]),
    ("conbini", ["セブン-イレブン", "セブンイレブン", "ファミリーマート", "ファミマ",
                 "ローソン", "ミニストップ", "コンビニ"]),
    ("shinten", ["オープン", "開店", "新店", "初出店", "1号店", "２号店", "2号店", "グランドオープン"]),
    ("chain", ["期間限定", "新メニュー", "新発売", "発売", "新商品", "季節限定", "東海限定", "販売開始"]),
    ("yasuuma", ["コスパ", "ワンコイン", "安い", "激安", "格安", "円で", "円以下", "モーニング", "お得"]),
    ("wadai", ["行列", "話題", "人気", "バズ", "SNS", "絶品", "名店"]),
]

AREA_RULES = [
    ("名古屋", ["名古屋", "栄", "名駅", "大須", "金山", "今池", "覚王山", "伏見", "矢場町", "久屋大通"]),
    ("愛知", ["愛知", "豊橋", "岡崎", "一宮", "豊田", "春日井", "安城", "刈谷", "豊川", "瀬戸",
              "半田", "小牧", "稲沢", "東海市", "長久手", "日進", "常滑", "犬山", "知多"]),
    ("岐阜", ["岐阜", "大垣", "多治見", "高山", "各務原", "関市", "可児", "中津川"]),
    ("静岡", ["静岡", "浜松", "沼津", "富士市"]),
    ("三重", ["三重", "四日市", "津市", "伊勢", "鈴鹿", "桑名", "松阪", "名張", "伊賀"]),
]
TOKAI_WORDS = [w for _, words in AREA_RULES for w in words] + ["東海", "中部"]

# 企業発表のうち、東海と関係なくても拾う全国チェーンの新作
CHAIN_WORDS = [
    "セブン-イレブン", "ファミリーマート", "ローソン", "ミニストップ", "マクドナルド", "モスバーガー",
    "すき家", "吉野家", "松屋", "ケンタッキー", "スターバックス", "コメダ", "ミスタードーナツ",
    "サイゼリヤ", "ガスト", "CoCo壱", "ココイチ", "丸亀製麺", "はなまるうどん", "スシロー",
    "くら寿司", "はま寿司", "かっぱ寿司", "なか卯", "天下一品", "日高屋", "幸楽苑", "スガキヤ",
    "寿がきや", "世界の山ちゃん", "風来坊", "矢場とん", "ロッテリア", "バーガーキング",
    "フレッシュネス", "ドトール", "タリーズ", "ほっともっと", "オリジン", "大戸屋", "やよい軒",
    "ガスト", "びっくりドンキー", "ドミノ・ピザ", "ピザハット", "ゴンチャ", "銀だこ",
]


# ---------------------------------------------------------------------------
# 共通処理
# ---------------------------------------------------------------------------
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def http_get(url: str, limit: int | None = None, timeout: int = 15,
             browser: bool = False) -> tuple[bytes, str]:
    headers = {"User-Agent": BROWSER_UA if browser else UA, "Accept-Language": "ja,en;q=0.5"}
    if browser:
        headers["Accept"] = "text/html,application/xhtml+xml,*/*;q=0.8"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        body = res.read(limit) if limit else res.read()
        return body, res.geturl()


def clean(text: str | None) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def norm_key(title: str) -> str:
    t = re.sub(r"[\s　「」『』【】()（）\[\]!！?？、。・…:：\-ー〜~|｜/]", "", title)
    return t[:30]


def parse_date(text: str | None) -> dt.datetime | None:
    if not text:
        return None
    text = text.strip()
    try:
        d = email.utils.parsedate_to_datetime(text)
    except (TypeError, ValueError):
        d = None
    if d is None:
        try:
            d = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc)


def child_text(node: ET.Element, suffix: str) -> str | None:
    """名前空間を気にせず、タグ名の末尾で子要素を探す。"""
    for c in node:
        tag = c.tag.split("}")[-1]
        if tag == suffix:
            return c.text
    return None


def child_nodes(node: ET.Element, suffix: str) -> list[ET.Element]:
    return [c for c in node if c.tag.split("}")[-1] == suffix]


def is_food(title: str) -> bool:
    return any(w in title for w in FOOD_WORDS)


# 載せないサイト（転載・スパムサイトや、グルメ記事でないページ）
BLOCKED_LINKS = [
    "unisba.ac.id",           # 他サイトの記事を転載しているスパムサイト
    "goobike.com",            # バイク投稿サイト
    "thetv.jp/program/",      # テレビ番組表
]


def is_blocked(link: str) -> bool:
    return any(b in link for b in BLOCKED_LINKS)


def is_wanted(title: str) -> bool:
    """グルメの話題で、東海以外の地域だけの記事でなく、ギャラリーページでもないか。"""
    if not is_food(title):
        return False
    if any(p.search(title) for p in JUNK_PATTERNS):
        return False
    tokai = any(w in title for w in TOKAI_WORDS)
    other = any(w in title for w in OTHER_REGION_WORDS)
    return tokai or not other


def categorize(title: str, default: str) -> str:
    for cat, words in CATEGORY_RULES:
        if any(w in title for w in words):
            return cat
    return default


def detect_area(title: str, regional: bool) -> str:
    for area, words in AREA_RULES:
        if any(w in title for w in words):
            return area
    return "東海" if regional else "全国"


# ---------------------------------------------------------------------------
# 飯ガチャ用：「東海にある1つのお店」の記事かどうか
# ---------------------------------------------------------------------------
LOCAL_AREAS = {"名古屋", "愛知", "岐阜", "三重", "静岡"}

NOT_SHOP_PATTERNS = [re.compile(p) for p in [
    r"\d+\s*選", r"[０-９]+\s*選", r"\d+軒", r"\d+店", r"まとめ", r"ランキング", r"特集", r"百名店",
    r"フェア", r"フェス", r"祭", r"イベント", r"開催", r"物産展", r"マーケット",
    r"コラボ", r"監修", r"新商品", r"新作", r"発売", r"販売開始", r"販売", r"クーポン", r"セール", r"半額",
    r"工場", r"ホールディングス", r"株式会社", r"大学", r"学生", r"教授", r"入社", r"社長",
    r"閉店", r"休業", r"浸水", r"被害", r"事件", r"逮捕",
    r"モーニング娘", r"番組", r"ドラマ", r"RQ", r"披露", r"ムック", r"Walker",
    r"レシピ", r"作り方", r"旅", r"Collection No", r"\d+/\d+\s*$", r"【画像】",
    r"予定", r"20[2-9][7-9]年",
    r"フロア", r"レストランエリア", r"商店街", r"道の駅", r"避暑地", r"\d+種", r"続々", r"初進出", r"初上陸",
]]
SHOP_WORDS = [
    "店", "食堂", "喫茶", "屋", "亭", "軒", "庵", "レストラン", "カフェ", "ラーメン", "らーめん", "中華そば",
    "寿司", "すし", "うどん", "そば", "ベーカリー", "居酒屋", "酒場", "バル", "ビストロ", "焼肉", "定食",
]


def is_shop_article(it: dict) -> bool:
    title = it["title"]
    if it.get("area") not in LOCAL_AREAS:
        return False
    if it.get("category") in ("chain", "conbini"):
        return False
    if any(p.search(title) for p in NOT_SHOP_PATTERNS):
        return False
    if any(w in title for w in OTHER_REGION_WORDS):  # 他地域のお店の記事
        return False
    named = bool(re.search(r"[「『][^」』]{2,}[」』]", title))
    return named or any(w in title for w in SHOP_WORDS)


def shop_name(title: str) -> str | None:
    """見出しのカギカッコから店名らしいものを取り出す（地図検索用）。"""
    for m in re.finditer(r"[「『]([^」』]{2,30})[」』]", title):
        name = m.group(1)
        if not re.search(r"[！!？?。]|メニュー|フェア|定食$|セット", name):
            return name
    return None


def item_id(link: str) -> str:
    return hashlib.sha1(link.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# 各取得元
# ---------------------------------------------------------------------------
def bing_url(q: str) -> str:
    return "https://www.bing.com/news/search?" + urllib.parse.urlencode(
        {"q": q, "format": "rss", "setlang": "ja", "cc": "JP", "mkt": "ja-JP"}
    )


def google_url(q: str) -> str:
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": q + " when:7d", "hl": "ja", "gl": "JP", "ceid": "JP:ja"}
    )


def unwrap_bing_link(link: str) -> str:
    """Bingの apiclick.aspx?url=... から記事の本当のURLを取り出す。"""
    p = urllib.parse.urlparse(link)
    if "bing.com" in p.netloc:
        qs = urllib.parse.parse_qs(p.query)
        if qs.get("url"):
            return qs["url"][0]
    return link


def parse_rss(xml_bytes: bytes, provider: str) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    out = []
    for it in root.iter():
        if it.tag.split("}")[-1] != "item":
            continue
        title = clean(child_text(it, "title"))
        link = (child_text(it, "link") or "").strip()
        if not title or not link:
            continue
        source = clean(child_text(it, "source") or child_text(it, "Source"))
        image = None
        for img in child_nodes(it, "Image"):  # Bing の <News:Image>
            if img.text and img.text.strip().startswith("http"):
                image = img.text.strip()
        if provider == "bing":
            link = unwrap_bing_link(link)
        if provider == "google" and source and title.endswith(" - " + source):
            title = title[: -len(" - " + source)].strip()
        published = parse_date(child_text(it, "pubDate") or child_text(it, "date"))
        out.append({"title": title, "link": link, "source": source, "image": image, "published": published})
    return out


def parse_prtimes(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    out = []
    for it in root.iter():
        if it.tag.split("}")[-1] != "item":
            continue
        title = clean(child_text(it, "title"))
        link = (child_text(it, "link") or "").strip()
        if not title or not link:
            continue
        published = parse_date(child_text(it, "date") or child_text(it, "pubDate"))
        source = clean(child_text(it, "creator")) or "PR TIMES"
        out.append({"title": title, "link": link, "source": source, "image": None, "published": published})
    return out


def collect() -> list[dict]:
    found: list[dict] = []
    errors = 0

    for q, cat, regional in QUERIES:
        for provider, url in (("bing", bing_url(q)), ("google", google_url(q))):
            try:
                body, _ = http_get(url)
                for r in parse_rss(body, provider):
                    r.update(default_cat=cat, regional=regional, provider=provider)
                    found.append(r)
            except Exception as e:  # 1つの取得元が落ちても続ける
                errors += 1
                print(f"[warn] {provider} '{q}': {e}", file=sys.stderr)

    try:
        body, _ = http_get(PRTIMES_FEED)
        for r in parse_prtimes(body):
            title = r["title"]
            tokai = any(w in title for w in TOKAI_WORDS)
            chain = any(w in title for w in CHAIN_WORDS)
            if not (tokai or chain):
                continue
            r.update(default_cat="chain", regional=tokai, provider="prtimes")
            found.append(r)
    except Exception as e:
        errors += 1
        print(f"[warn] prtimes: {e}", file=sys.stderr)

    print(f"fetched {len(found)} raw items ({errors} source errors)")
    return found


# ---------------------------------------------------------------------------
# 写真（記事ページの og:image）
# ---------------------------------------------------------------------------
OG_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]*>', re.I
)
CONTENT_RE = re.compile(r'content=["\']([^"\']+)["\']', re.I)


DECODE_LOG: list[str] = []
IMAGE_LOG: list[str] = []


def decode_google_link(link: str) -> str | None:
    """Googleニュースの中継リンクを、元記事のURLに変換する。失敗したら None。"""
    m = re.search(r"/articles/([^/?#]+)", link)
    if not m:
        return None
    art_id = m.group(1)
    try:
        sig = ts = None
        page = ""
        for base in ("https://news.google.com/articles/", "https://news.google.com/rss/articles/"):
            body, _ = http_get(base + art_id + "?hl=ja&gl=JP&ceid=JP:ja", timeout=10)
            page = body.decode("utf-8", errors="ignore")
            sig = re.search(r'data-n-a-sg="([^"]+)"', page)
            ts = re.search(r'data-n-a-ts="([^"]+)"', page)
            if sig and ts:
                break
        if not (sig and ts):
            i = page.find("data-n-a")
            DECODE_LOG.append(f"no-params (len={len(page)}, data-n-a at {i}): " + page[-300:].replace("\n", " "))
            return None
        inner = (
            '["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],'
            f'"X","X",1,[1,1,1],1,1,null,0,0,null,0],"{art_id}",{ts.group(1)},"{sig.group(1)}"]'
        )
        data = "f.req=" + urllib.parse.quote(json.dumps([[["Fbv4je", inner]]]))
        req = urllib.request.Request(
            "https://news.google.com/_/DotsSplashUi/data/batchexecute",
            data=data.encode("utf-8"),
            headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            text = res.read().decode("utf-8", errors="ignore")
        parsed = json.loads(text.split("\n\n")[1])[:-2]
        url = json.loads(parsed[0][2])[1]
        if isinstance(url, str) and url.startswith("http"):
            DECODE_LOG.append("ok")
            return url
        DECODE_LOG.append("bad-response: " + text[:300])
        return None
    except Exception as e:
        DECODE_LOG.append(f"error: {type(e).__name__}: {e}")
        return None


def find_og_image(link: str) -> str | None:
    host = urllib.parse.urlparse(link).netloc
    if "news.google.com" in host:
        return None
    try:
        body, final_url = http_get(link, limit=400_000, timeout=10, browser=True)
    except Exception as e:
        IMAGE_LOG.append(f"{host}: {type(e).__name__}: {str(e)[:80]}")
        return None
    text = body.decode("utf-8", errors="ignore")
    for tag in OG_RE.findall(text):
        m = CONTENT_RE.search(tag)
        if m:
            src = html.unescape(m.group(1).strip())
            src = urllib.parse.urljoin(final_url, src)
            if src.startswith(("https://", "http://")):  # http の写真は画面側で中継して表示
                return src
    IMAGE_LOG.append(f"{host}: og:image なし ({len(text)} 文字)")
    return None


def add_images(items: list[dict]) -> None:
    def pending(it: dict) -> bool:
        is_google = "news.google.com" in urllib.parse.urlparse(it["link"]).netloc
        return (not it.get("image_checked")
                or (is_google and not it.get("decode_v2"))
                or (not it.get("image") and not it.get("image_v4")))

    targets = [it for it in items if pending(it)][:MAX_IMAGE_FETCH]

    def work(it: dict) -> str | None:
        if "news.google.com" in urllib.parse.urlparse(it["link"]).netloc:
            it["decode_v2"] = True
            real = decode_google_link(it["link"])
            if real:
                it["link"] = real  # 読者も元記事へ直接飛べるようにする
        return find_og_image(it["link"])

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        results = ex.map(work, targets)
        for it, img in zip(targets, results):
            if img:
                it["image"] = img
            elif it.get("image") and not it["image"].startswith("http"):
                it["image"] = None
            it["image_checked"] = True
            it["image_v4"] = True


# ---------------------------------------------------------------------------
# まとめて保存
# ---------------------------------------------------------------------------
def load_existing() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    try:
        return json.loads(DATA_FILE.read_text("utf-8")).get("items", [])
    except (ValueError, OSError):
        return []


def build(raw: list[dict], existing: list[dict]) -> list[dict]:
    items: dict[str, dict] = {}
    seen_titles: dict[str, str] = {}

    def add(it: dict) -> None:
        key = norm_key(it["title"])
        if it["id"] in items:
            return
        if key in seen_titles:
            # 同じ記事が別の取得元からも来た：写真があれば補う
            prev = items[seen_titles[key]]
            if not prev.get("image") and it.get("image"):
                prev["image"] = it["image"]
            return
        items[it["id"]] = it
        seen_titles[key] = it["id"]

    cutoff_keep = NOW - dt.timedelta(days=KEEP_DAYS)
    for it in existing:
        d = parse_date(it.get("published"))
        if d and d >= cutoff_keep and is_wanted(it["title"]) and not is_blocked(it["link"]):
            it.setdefault("added", it["published"])  # 以前のデータには取り込み日時がない
            add(it)

    cutoff_new = NOW - dt.timedelta(days=INGEST_DAYS)
    # 写真付き（Bing）を先に入れて、重複時に写真付きが残るようにする
    order = {"bing": 0, "prtimes": 1, "google": 2}
    for r in sorted(raw, key=lambda r: order.get(r["provider"], 9)):
        title = r["title"]
        if not is_wanted(title):
            continue
        published = r["published"] or NOW
        if published < cutoff_new or published > NOW + dt.timedelta(hours=1):
            continue
        image = r.get("image")
        add({
            "id": item_id(r["link"]),
            "title": title,
            "link": r["link"],
            "source": r["source"] or ("PR TIMES" if r["provider"] == "prtimes" else ""),
            "image": image if image and image.startswith("http") else None,
            "category": categorize(title, r["default_cat"]),
            "area": detect_area(title, r["regional"]),
            "published": published.astimezone(JST).isoformat(timespec="seconds"),
            "provider": r["provider"],
            "added": NOW.astimezone(JST).isoformat(timespec="seconds"),  # NEWマーク用
        })

    out = sorted(items.values(), key=lambda it: it["published"], reverse=True)
    return out[:MAX_ITEMS]


def main() -> int:
    existing = load_existing()
    raw = collect()
    if not raw and existing:
        print("no items fetched; keeping existing data")
        return 0
    items = build(raw, existing)
    add_images(items)
    # Googleニュースのリンクは変換後に行き先がわかるので、ここで除外する
    items = [it for it in items if not is_blocked(it["link"])]
    for it in items:
        it["shop"] = is_shop_article(it)
        it["shop_name"] = shop_name(it["title"]) if it["shop"] else None
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated": NOW.astimezone(JST).isoformat(timespec="seconds"), "items": items}
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", "utf-8")
    print(f"saved {len(items)} items")
    status = {
        "updated": payload["updated"],
        "items": len(items),
        "with_image": sum(1 for it in items if it.get("image")),
        "google_decode_ok": DECODE_LOG.count("ok"),
        "google_decode_failed": len(DECODE_LOG) - DECODE_LOG.count("ok"),
        "google_decode_samples": [x for x in DECODE_LOG if x != "ok"][:3],
        "image_failures": IMAGE_LOG[:20],
    }
    (DATA_FILE.parent / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=1) + "\n", "utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

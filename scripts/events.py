"""飯飯食堂：ごはんイベント（フェス・マルシェ・物産展など）の会場と日付を見出しから読み取る。

- 会場は下の VENUES の言葉で見つける（長い言葉から順に判定）
- 座標は VENUES の値を基本にし、公開時に OpenStreetMap の地名検索（Nominatim）で確かめた値があればそちらを使う
  （data/venues.json に保存。地名検索は1秒に1回まで、1回の実行で数件だけ）
"""

from __future__ import annotations

import datetime as dt
import json
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENUE_FILE = ROOT / "data" / "venues.json"

# (表示名, 見出しで探す言葉, 緯度, 経度, 地名検索の言葉)
VENUES = [
    ("久屋大通公園", ["久屋大通公園", "久屋大通パーク", "Hisaya-odori Park", "久屋大通", "RAYARD", "レイヤード"], 35.1717, 136.9087, "久屋大通公園 名古屋"),
    ("オアシス21", ["オアシス21", "オアシス２１"], 35.1708, 136.9100, "オアシス21 名古屋"),
    ("中日ビル", ["中日ビル"], 35.1690, 136.9075, "中日ビル 名古屋"),
    ("名古屋三越 栄店", ["三越栄", "栄三越", "名古屋三越", "三越 名古屋栄", "三越名古屋栄", "名古屋栄三越"], 35.1683, 136.9065, "名古屋三越 栄店"),
    ("松坂屋名古屋店", ["松坂屋名古屋", "松坂屋 名古屋"], 35.1636, 136.9069, "松坂屋名古屋店"),
    ("ジェイアール名古屋タカシマヤ", ["タカシマヤ", "高島屋"], 35.1705, 136.8838, "ジェイアール名古屋タカシマヤ"),
    ("名鉄百貨店", ["名鉄百貨店"], 35.1690, 136.8845, "名鉄百貨店 本店"),
    ("名古屋駅", ["名古屋駅", "名駅"], 35.1709, 136.8816, "名古屋駅"),
    ("名古屋城", ["名古屋城"], 35.1856, 136.8991, "名古屋城"),
    ("名城公園", ["名城公園"], 35.1920, 136.9040, "名城公園"),
    ("大須商店街", ["大須"], 35.1596, 136.9016, "大須商店街"),
    ("金山", ["金山"], 35.1428, 136.9010, "金山駅 名古屋"),
    ("白川公園", ["白川公園"], 35.1620, 136.8987, "白川公園 名古屋"),
    ("鶴舞公園", ["鶴舞公園", "鶴舞"], 35.1553, 136.9216, "鶴舞公園"),
    ("ささしまライブ", ["ささしま"], 35.1623, 136.8838, "ささしまライブ"),
    ("ノリタケの森", ["ノリタケの森"], 35.1806, 136.8793, "ノリタケの森"),
    ("円頓寺商店街", ["円頓寺"], 35.1789, 136.8920, "円頓寺商店街"),
    ("大曽根商店街", ["大曽根"], 35.1913, 136.9370, "大曽根駅"),
    ("覚王山日泰寺", ["日泰寺", "覚王山"], 35.1695, 136.9530, "日泰寺"),
    ("熱田神宮", ["熱田神宮"], 35.1278, 136.9087, "熱田神宮"),
    ("東別院", ["東別院"], 35.1555, 136.9025, "真宗大谷派名古屋別院"),
    ("イオンモール熱田", ["イオンモール熱田"], 35.1243, 136.9050, "イオンモール熱田"),
    ("鈴鹿フラワーパーク", ["鈴鹿フラワーパーク"], 34.8840, 136.5650, "鈴鹿フラワーパーク"),
    ("リトルワールド", ["リトルワールド"], 35.3747, 137.0100, "野外民族博物館リトルワールド"),
    ("滝子", ["滝子"], 35.1452, 136.9300, "滝子通 名古屋"),
    ("名古屋テレビ塔", ["テレビ塔", "中部電力 MIRAI TOWER", "MIRAI TOWER"], 35.1723, 136.9086, "中部電力 MIRAI TOWER"),
    ("ナゴヤドーム", ["バンテリンドーム", "ナゴヤドーム"], 35.1856, 136.9475, "バンテリンドーム ナゴヤ"),
    ("吹上ホール", ["吹上ホール"], 35.1592, 136.9315, "名古屋市中小企業振興会館"),
    ("東山動植物園", ["東山動植物園", "東山動物園"], 35.1568, 136.9772, "東山動植物園"),
    ("名古屋港ガーデンふ頭", ["ガーデンふ頭", "名古屋港"], 35.0910, 136.8800, "名古屋港ガーデンふ頭"),
    ("ポートメッセなごや", ["ポートメッセ"], 35.0485, 136.8507, "ポートメッセなごや"),
    ("モリコロパーク", ["モリコロパーク", "愛・地球博記念公園", "愛地球博記念公園"], 35.1745, 137.0880, "愛・地球博記念公園"),
    ("Aichi Sky Expo", ["Aichi Sky Expo", "愛知県国際展示場"], 34.8715, 136.8132, "愛知県国際展示場"),
    ("中部国際空港", ["セントレア", "中部国際空港"], 34.8584, 136.8054, "中部国際空港"),
    ("ららぽーと愛知東郷", ["ららぽーと愛知東郷"], 35.0958, 137.0515, "ららぽーと愛知東郷"),
    ("名古屋PARCO", ["名古屋PARCO", "名古屋パルコ"], 35.1655, 136.9055, "名古屋パルコ"),
    ("栄", ["栄"], 35.1700, 136.9085, "栄駅 名古屋"),
    ("豊橋駅", ["豊橋駅", "豊橋"], 34.7630, 137.3825, "豊橋駅"),
    ("岐阜駅", ["岐阜駅"], 35.4096, 136.7566, "岐阜駅"),
    ("長良川", ["長良川"], 35.4326, 136.7790, "長良川公園"),
    ("四日市", ["四日市"], 34.9650, 136.6250, "近鉄四日市駅"),
    ("伊勢", ["おかげ横丁", "おはらい町", "伊勢神宮"], 34.4620, 136.7240, "おかげ横丁"),
    ("浜松", ["浜松"], 34.7038, 137.7350, "浜松駅"),
    ("静岡", ["静岡駅"], 34.9719, 138.3890, "静岡駅"),
]

# 雨の日フィルター用：屋内の会場 / 屋外の会場（どちらでもない会場は見出しの言葉で判断）
INDOOR_VENUES = {
    "中日ビル", "名古屋三越 栄店", "松坂屋名古屋店", "ジェイアール名古屋タカシマヤ", "名鉄百貨店",
    "名古屋PARCO", "イオンモール熱田", "ナゴヤドーム", "吹上ホール", "ポートメッセなごや",
    "Aichi Sky Expo", "中部国際空港", "ららぽーと愛知東郷",
}
OUTDOOR_VENUES = {
    "久屋大通公園", "オアシス21", "名古屋城", "名城公園", "白川公園", "鶴舞公園", "円頓寺商店街",
    "大曽根商店街", "大須商店街", "覚王山日泰寺", "熱田神宮", "東別院", "鈴鹿フラワーパーク", "リトルワールド",
    "東山動植物園", "名古屋港ガーデンふ頭", "モリコロパーク", "長良川", "名古屋テレビ塔", "ノリタケの森",
}
INDOOR_WORDS = ["物産展", "百貨店", "催事", "展示場", "ホール", "館内", "屋内", "地下街"]
OUTDOOR_WORDS = ["公園", "屋外", "野外", "キッチンカー", "屋台", "ビアガーデン", "河川敷", "広場", "ヒロバ"]


def place_type(title: str, venue) -> str | None:
    """'indoor'（屋内）/ 'outdoor'（屋外）/ None（わからない）"""
    if venue in INDOOR_VENUES:
        return "indoor"
    if venue in OUTDOOR_VENUES:
        return "outdoor"
    if any(w in title for w in INDOOR_WORDS):
        return "indoor"
    if any(w in title for w in OUTDOOR_WORDS):
        return "outdoor"
    return None


EVENT_WORDS = [
    "フェス", "フェスタ", "祭り", "まつり", "祭典", "マルシェ", "物産展", "屋台", "キッチンカー",
    "フードトラック", "ビアガーデン", "オクトーバーフェスト", "グルメイベント", "催事", "収穫祭",
    "食べ歩きイベント", "フードイベント", "グルメフェア",
]


# お店やチェーンのキャンペーン・新商品などはイベントにしない
NOT_EVENT_WORDS = ["期間限定", "コラボ", "キャンペーン", "発売", "新作", "新商品", "オープン", "閉店", "クーポン",
                   "周年", "おせち", "予約", "抽選", "初出店", "出店予定", "セブン", "ファミマ", "ファミリーマート",
                   "ローソン", "監修", "鉱物", "宝石", "実証実験", "情報まとめ", "イベント情報"]
CHAIN_WORDS: list[str] = []  # fetch_news.py から全国チェーンの店名を受け取る


def is_event(title: str) -> bool:
    if any(w in title for w in NOT_EVENT_WORDS) or any(w in title for w in CHAIN_WORDS):
        return False
    if any(w in title for w in EVENT_WORDS):
        return True
    # 「肉グルメが大集結！〜 FEST」「試食体験イベント」のように、食べ物の集まり・催し
    food = any(w in title for w in ("グルメ", "試食", "食べ比べ", "食べ歩き", "屋台"))
    if food and any(w in title for w in ("集結", "大集合", "FEST", "Fest", "イベント")):
        return True
    # 「〇〇公園で△日に開催」のように、会場がわかって「開催」とあるもの
    return "開催" in title and find_venue(title) is not None


def _has_word(title: str, w: str) -> bool:
    if w == "栄":  # 「栄養」「繁栄」などを会場の「栄」と読み違えない
        return re.search(r"(?<![繁光])栄(?![養誉光])", title) is not None
    return w in title


def find_venue(title: str) -> tuple | None:
    best = None
    for v in VENUES:
        for w in v[1]:
            if _has_word(title, w) and (best is None or len(w) > best[1]):
                best = (v, len(w))
    return best[0] if best else None


# ---------------------------------------------------------------------------
# 開催日の読み取り
# ---------------------------------------------------------------------------
SEP = r"\s*(?:[（(][^）)]{0,6}[）)])?\s*(?:～|〜|~|－|-|ー|から|より)\s*"
P_RANGE_MD = re.compile(r"(\d{1,2})月(\d{1,2})日" + SEP + r"(?:(\d{1,2})月)?(\d{1,2})日")
P_RANGE_SLASH = re.compile(r"(\d{1,2})/(\d{1,2})" + SEP + r"(?:(\d{1,2})/)?(\d{1,2})(?!\d)")
P_LIST_MD = re.compile(r"(\d{1,2})月(\d{1,2})日(?:\s*[（(][^）)]{0,6}[）)])?\s*[、,・と]\s*(\d{1,2})日")
P_RANGE_D = re.compile(r"(?<![\d/月])(\d{1,2})日" + SEP + r"(\d{1,2})日")
P_UNTIL_MD = re.compile(r"(\d{1,2})月(\d{1,2})日(?:\s*[（(][^）)]{0,6}[）)])?\s*まで")
P_UNTIL_SLASH = re.compile(r"(\d{1,2})/(\d{1,2})(?:\s*[（(][^）)]{0,6}[）)])?\s*まで")
P_UNTIL_D = re.compile(r"(?<![\d/月])(\d{1,2})日(?:\s*[（(][^）)]{0,6}[）)])?\s*まで")
P_ONE_MD = re.compile(r"(\d{1,2})月(\d{1,2})日")
P_ONE_SLASH = re.compile(r"(?<![\d/])(\d{1,2})/(\d{1,2})(?![\d/])")


def _date(year: int, month: int, day: int, base: dt.date) -> dt.date | None:
    try:
        d = dt.date(year, month, day)
    except ValueError:
        return None
    # 記事の日付より半年以上前になる月日は、翌年のこととみなす
    if (base - d).days > 180:
        try:
            d = dt.date(year + 1, month, day)
        except ValueError:
            return None
    return d


def parse_dates(title: str, published: dt.date) -> tuple[str | None, str | None]:
    t = unicodedata.normalize("NFKC", title)
    y = published.year

    def iso(d):
        return d.isoformat() if d else None

    m = P_RANGE_MD.search(t)
    if m:
        a = _date(y, int(m.group(1)), int(m.group(2)), published)
        b = _date(y, int(m.group(3) or m.group(1)), int(m.group(4)), published)
        if a and b and b < a:  # 年をまたぐ（12月〜1月）
            b = _date(y + 1, b.month, b.day, published)
        return iso(a), iso(b)
    m = P_RANGE_SLASH.search(t)
    if m:
        a = _date(y, int(m.group(1)), int(m.group(2)), published)
        b = _date(y, int(m.group(3) or m.group(1)), int(m.group(4)), published)
        return iso(a), iso(b)
    m = P_LIST_MD.search(t)
    if m:
        a = _date(y, int(m.group(1)), int(m.group(2)), published)
        b = _date(y, int(m.group(1)), int(m.group(3)), published)
        return iso(a), iso(b)
    m = P_RANGE_D.search(t)
    if m:
        a = _date(y, published.month, int(m.group(1)), published)
        b = _date(y, published.month, int(m.group(2)), published)
        return iso(a), iso(b)
    for p, has_month in ((P_UNTIL_MD, True), (P_UNTIL_SLASH, True), (P_UNTIL_D, False)):
        m = p.search(t)
        if m:
            b = _date(y, int(m.group(1)), int(m.group(2)), published) if has_month else \
                _date(y, published.month, int(m.group(1)), published)
            return None, iso(b)
    m = P_ONE_MD.search(t) or P_ONE_SLASH.search(t)
    if m:
        a = _date(y, int(m.group(1)), int(m.group(2)), published)
        return iso(a), iso(a)
    return None, None


# ---------------------------------------------------------------------------
# 会場の座標（地名検索で確かめた値を data/venues.json に保存）
# ---------------------------------------------------------------------------
def _dist_km(a, b) -> float:
    r = math.pi / 180
    h = math.sin((b[0] - a[0]) * r / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin((b[1] - a[1]) * r / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def load_venue_coords() -> dict:
    try:
        return json.loads(VENUE_FILE.read_text("utf-8"))
    except (OSError, ValueError):
        return {}


def refresh_venue_coords(max_lookups: int = 6) -> dict:
    """まだ確かめていない会場を地名検索する。元の座標から3km以上ずれた結果は信用しない。"""
    cache = load_venue_coords()
    done = 0
    for name, _, lat, lng, query in VENUES:
        if name in cache or done >= max_lookups:
            continue
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
            {"q": query, "format": "json", "limit": 1, "countrycodes": "jp", "accept-language": "ja"})
        req = urllib.request.Request(url, headers={"User-Agent": "MeshimeshiShokudo/1.0 (github.com/junnn665/meshimeshi)"})
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                hits = json.loads(res.read().decode("utf-8"))
            done += 1
            if hits:
                g = (float(hits[0]["lat"]), float(hits[0]["lon"]))
                if _dist_km((lat, lng), g) < 3:
                    cache[name] = {"lat": round(g[0], 5), "lng": round(g[1], 5), "source": "nominatim"}
                else:
                    cache[name] = {"lat": lat, "lng": lng, "source": "builtin"}
            else:
                cache[name] = {"lat": lat, "lng": lng, "source": "builtin"}
        except Exception as e:  # つながらなくても一覧の座標で続ける
            print(f"[warn] geocode {name}: {e}")
            break
        time.sleep(1.1)  # 地名検索の利用ルール：1秒に1回まで
    VENUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    VENUE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1) + "\n", "utf-8")
    return cache


def annotate(it: dict, coords: dict) -> None:
    """イベントの記事に、会場・座標・開催日をつける。"""
    for k in ("venue", "lat", "lng", "start", "end", "place"):
        it.pop(k, None)
    if it.get("category") != "event":
        return
    v = find_venue(it["title"])
    if v:
        c = coords.get(v[0]) or {"lat": v[2], "lng": v[3]}
        it["venue"], it["lat"], it["lng"] = v[0], c["lat"], c["lng"]
    try:
        pub = dt.date.fromisoformat(it["published"][:10])
    except (KeyError, ValueError):
        pub = dt.date.today()
    pt = place_type(it["title"], it.get("venue"))
    if pt:
        it["place"] = pt
    s, e = parse_dates(it["title"], pub)
    if s:
        it["start"] = s
    if e:
        it["end"] = e


# ---------------------------------------------------------------------------
# 同じイベントの記事をまとめる
# ---------------------------------------------------------------------------
P_NAME = re.compile(r"[「『]([^」』]{2,40})[」』]")


def event_name(title: str) -> str | None:
    """見出しの「」『』の中をイベント名とみなす（例：「魅惑のパンフェスタ」）。"""
    t = unicodedata.normalize("NFKC", title)
    for m in P_NAME.finditer(t):
        name = m.group(1)
        if any(w in name for w in EVENT_WORDS) or re.search(r"(展|市|祭|FEST|Fest|フェア|マーケット|ストリート)", name):
            return re.sub(r"\s+", "", name).lower()
    return None


def assign_groups(items: list) -> None:
    """同じ会場・同じイベント名の記事に、同じ group をつける。
    会場がわからない記事は、同じ名前の会場つきのまとまりが1つだけならそこに入れる。"""
    import hashlib
    evs = [it for it in items if it.get("category") == "event"]
    for it in items:
        it.pop("group", None)
    by_name_venue = {}
    for it in evs:
        name = event_name(it["title"])
        it["_name"] = name
        if name and it.get("venue"):
            by_name_venue.setdefault(name, set()).add(it["venue"])
    for it in evs:
        name = it.pop("_name")
        venue = it.get("venue")
        if name and not venue and len(by_name_venue.get(name, ())) == 1:
            venue = next(iter(by_name_venue[name]))
        key = f"{name}|{venue or ''}" if name else f"id|{it['id']}"
        it["group"] = hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


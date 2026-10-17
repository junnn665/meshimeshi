"""急上昇グルメ：記事の数が「ここ3日」で急に増えているお店・料理を data/trends.json に書き出す。

- 数えるもの：料理の言葉（DISHES）、チェーン店の名前（fetch_news の CHAIN_WORDS）、記事から読み取った店名（shop_name）
- ここ3日の記事数を、その前の11日間の1日あたりの数とくらべる
- 店名は読み違いが混ざるので、2つ以上のニュースサイトに出ているものだけにする
"""
from __future__ import annotations

import datetime as dt
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEWS = ROOT / "data" / "news.json"
OUT = ROOT / "data" / "trends.json"
JST = dt.timezone(dt.timedelta(hours=9))

RECENT_DAYS = 3
BASE_DAYS = 11

# 表示名: 見出しで探す言葉
DISHES = {
    "ラーメン": ["ラーメン", "らーめん", "らぁ麺", "中華そば", "拉麺"],
    "台湾ラーメン": ["台湾ラーメン", "台湾まぜそば"],
    "まぜそば・油そば": ["まぜそば", "油そば"],
    "つけ麺": ["つけ麺"],
    "担々麺": ["担々麺", "坦々麺", "担担麺"],
    "うどん": ["うどん"],
    "きしめん": ["きしめん"],
    "そば": ["蕎麦", "そば屋", "手打ちそば"],
    "餃子": ["餃子", "ギョーザ", "ぎょうざ"],
    "からあげ": ["からあげ", "唐揚げ", "唐揚", "から揚げ"],
    "手羽先": ["手羽先"],
    "焼肉": ["焼肉", "焼き肉"],
    "ホルモン": ["ホルモン"],
    "ステーキ": ["ステーキ"],
    "ハンバーグ": ["ハンバーグ"],
    "とんかつ": ["とんかつ", "トンカツ", "豚カツ"],
    "味噌カツ": ["味噌カツ", "みそカツ", "みそかつ"],
    "カレー": ["カレー"],
    "寿司": ["寿司", "すし", "鮨"],
    "海鮮丼": ["海鮮丼"],
    "ひつまぶし・うなぎ": ["ひつまぶし", "うなぎ", "鰻"],
    "天ぷら・天むす": ["天ぷら", "天むす"],
    "牛丼": ["牛丼"],
    "定食": ["定食"],
    "ハンバーガー": ["ハンバーガー", "バーガー"],
    "ピザ": ["ピザ"],
    "パスタ": ["パスタ", "あんかけスパ"],
    "韓国グルメ": ["韓国", "サムギョプサル", "ヤンニョム", "トッポギ"],
    "中華": ["町中華", "麻婆", "チャーハン", "炒飯"],
    "パン": ["パン", "ベーカリー"],
    "ドーナツ": ["ドーナツ"],
    "かき氷": ["かき氷"],
    "パフェ": ["パフェ"],
    "プリン": ["プリン"],
    "ケーキ": ["ケーキ", "タルト"],
    "モンブラン・栗": ["モンブラン", "栗"],
    "さつまいも": ["さつまいも", "焼き芋", "焼芋", "芋"],
    "いちご": ["いちご", "苺", "イチゴ"],
    "チョコ": ["チョコ"],
    "抹茶": ["抹茶"],
    "クレープ": ["クレープ"],
    "モーニング": ["モーニング"],
    "おにぎり": ["おにぎり"],
    "弁当": ["弁当"],
    "鍋": ["鍋"],
    "おでん": ["おでん"],
    "ビール": ["ビール"],
}

# 店名として数えない言葉（記事から店名を読み違えたもの）
NOT_SHOP = re.compile(r"(ありえない|絶対|行くべき|職員|公開空地|ランキング|まとめ|フェス|マルシェ|祭|名古屋市|愛知県|^\d+$)")


def norm(s: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", s)).lower()


def jst_date(iso: str) -> dt.date | None:
    try:
        return dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(JST).date()
    except (ValueError, AttributeError):
        return None


def main() -> None:
    import fetch_news  # 同じフォルダ（チェーン名の一覧を使う）
    items = json.loads(NEWS.read_text(encoding="utf-8")).get("items", [])
    today = dt.datetime.now(JST).date()
    days = [today - dt.timedelta(days=i) for i in range(RECENT_DAYS + BASE_DAYS - 1, -1, -1)]
    index = {d: i for i, d in enumerate(days)}

    # 言葉 → 記事のリスト
    buckets: dict[tuple, list] = {}

    def add(kind: str, label: str, it: dict) -> None:
        buckets.setdefault((kind, label), []).append(it)

    for it in items:
        d = jst_date(it.get("published", ""))
        if d not in index:
            continue
        it["_d"] = d
        t = unicodedata.normalize("NFKC", it["title"])
        for label, words in DISHES.items():
            if any(w in t for w in words):
                add("dish", label, it)
        seen_chain = set()
        for w in fetch_news.CHAIN_WORDS:
            if w in t:
                label = {"ココイチ": "CoCo壱", "寿がきや": "スガキヤ", "セブン-イレブン": "セブン-イレブン"}.get(w, w)
                if label not in seen_chain:
                    seen_chain.add(label)
                    add("chain", label, it)
        name = it.get("shop_name")
        if it.get("shop") and name and len(name) >= 2 and not NOT_SHOP.search(name):
            add("shop", name, it)

    out = []
    for (kind, label), its in buckets.items():
        # 同じ見出し（別サイトの転載）は1本として数える
        uniq = {}
        for it in its:
            uniq.setdefault(norm(it["title"])[:30], it)
        its = list(uniq.values())
        daily = [0] * len(days)
        for it in its:
            daily[index[it["_d"]]] += 1
        recent = sum(daily[-RECENT_DAYS:])
        base = sum(daily[:-RECENT_DAYS])
        sources = {it.get("source") for it in its if it["_d"] >= days[-RECENT_DAYS]}
        if recent < 2:
            continue
        if kind == "shop" and len(sources) < 2:
            continue
        expected = base / BASE_DAYS * RECENT_DAYS
        ratio = (recent + 0.5) / (expected + 1)
        if ratio < 1.6:
            continue
        top = sorted((it for it in its if it["_d"] >= days[-RECENT_DAYS]),
                     key=lambda x: x.get("published", ""), reverse=True)[:3]
        q = DISHES[label][0] if kind == "dish" else label
        out.append({
            "label": label,
            "q": q,
            "kind": kind,
            "recent": recent,
            "base_per_day": round(base / BASE_DAYS, 2),
            "ratio": round(ratio, 2),
            "new": base == 0,
            "daily": daily,
            "articles": [{"id": x["id"], "title": x["title"], "link": x["link"], "source": x.get("source"),
                          "image": x.get("image")} for x in top],
        })
    # お店を少し優先しつつ、増え方の大きい順
    weight = {"shop": 1.3, "chain": 1.1, "dish": 1.0}
    out.sort(key=lambda x: (x["ratio"] * weight[x["kind"]], x["recent"]), reverse=True)
    for it in items:
        it.pop("_d", None)
    OUT.write_text(json.dumps({
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "days": [d.isoformat() for d in days],
        "recent_days": RECENT_DAYS,
        "items": out[:12],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"急上昇 {len(out)} 件（上位 {min(12, len(out))} 件を保存）")
    for x in out[:12]:
        print(f"  {x['kind']:5} {x['label']:12} ここ3日 {x['recent']} / 1日平均 {x['base_per_day']} → x{x['ratio']}")


if __name__ == "__main__":
    main()

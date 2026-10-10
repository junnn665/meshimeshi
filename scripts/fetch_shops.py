#!/usr/bin/env python3
"""飯飯食堂: 飯ガチャ用に、ホットペッパーグルメ Webサービスからお店を集める。

- 環境変数 HOTPEPPER_API_KEY が必要（GitHub の Secrets に登録する）
- 1日1回だけ取得する（規約：キャッシュは24時間以内に更新）
- 出力先 data/shops/ はリポジトリには保存せず、公開ページにだけ載せる
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "shops"
API = "https://webservice.recruit.co.jp/hotpepper"
JST = dt.timezone(dt.timedelta(hours=9))
NOW = dt.datetime.now(JST)
MAX_AGE_HOURS = 20   # これより新しければ取り直さない
PER_QUERY = 100      # 1回の検索で取る件数（APIの上限）
SCHEMA = 4           # 出力の形を変えたら上げる（上げると次の実行で取り直す）

# 画面に出すエリア。keyword は住所などの部分一致（名古屋は名古屋市内に絞る）
AREAS = [
    # pages: ジャンルごとに何ページ（100軒ずつ）取るか。現在地ガチャ用に都市部は多めに取る
    {"id": "nagoya", "label": "名古屋", "pref": "愛知", "keyword": "名古屋市", "pages": 3},
    {"id": "aichi", "label": "愛知", "pref": "愛知", "keyword": None, "pages": 2},
    {"id": "gifu", "label": "岐阜", "pref": "岐阜", "keyword": None, "pages": 1},
    {"id": "mie", "label": "三重", "pref": "三重", "keyword": None, "pages": 1},
]

# 使うジャンル（ホットペッパーのジャンル名 → 画面の表示名）
GENRES = [
    ("ラーメン", "ラーメン"),
    ("居酒屋", "居酒屋"),
    ("和食", "和食"),
    ("洋食", "洋食"),
    ("イタリアン・フレンチ", "イタリアン"),
    ("中華", "中華"),
    ("焼肉・ホルモン", "焼肉"),
    ("韓国料理", "韓国料理"),
    ("アジア・エスニック料理", "エスニック"),
    ("お好み焼き・もんじゃ", "お好み焼き"),
    ("カフェ・スイーツ", "カフェ"),
]


def get(path: str, **params) -> dict:
    params.update(key=os.environ["HOTPEPPER_API_KEY"], format="json")
    url = f"{API}/{path}/v1/?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "MeshimeshiShokudo/1.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode("utf-8"))
    results = data.get("results", {})
    if "error" in results:
        raise RuntimeError(results["error"])
    return results


def fresh_enough() -> bool:
    meta = OUT / "meta.json"
    if not meta.exists():
        return False
    try:
        m = json.loads(meta.read_text("utf-8"))
        updated = dt.datetime.fromisoformat(m["updated"])
    except (ValueError, KeyError, OSError):
        return False
    if m.get("schema") != SCHEMA:
        return False
    return NOW - updated < dt.timedelta(hours=MAX_AGE_HOURS)


def remove_stale() -> None:
    """取り直せず24時間を超えたデータは消す（古いお店情報を出さないため）。"""
    meta = OUT / "meta.json"
    try:
        updated = dt.datetime.fromisoformat(json.loads(meta.read_text("utf-8"))["updated"])
        if NOW - updated < dt.timedelta(hours=24):
            return
    except (ValueError, KeyError, OSError):
        pass
    for f in OUT.glob("*.json"):
        f.unlink()
    print("removed stale shop data")


def budget_text(budget: dict) -> str:
    """予算の表示。目安の範囲（例: 501～1000円）を基本にし、平均が短い金額ならそれも添える。"""
    rng = budget.get("name") or ""
    avg = (budget.get("average") or "").strip()
    if avg and "円" in avg and len(avg) <= 20 and avg != rng:
        return f"{rng}（{avg}）" if rng else avg
    return rng or avg[:20]


def compact(shop: dict, genre_label: str) -> dict:
    budget = shop.get("budget") or {}
    photo = ((shop.get("photo") or {}).get("pc") or {}).get("l")
    return {
        "id": shop["id"],
        "name": shop.get("name", ""),
        "genre": genre_label,
        "catch": (shop.get("catch") or (shop.get("genre") or {}).get("catch") or "")[:80],
        "address": shop.get("address", ""),
        "access": (shop.get("mobile_access") or shop.get("access") or "")[:60],
        "budget": budget_text(budget),
        "budget_code": budget.get("code") or "",
        "open": (shop.get("open") or "")[:260],
        "close": (shop.get("close") or "")[:60],
        "lunch": str(shop.get("lunch") or "").startswith("あり"),
        "photo": photo,
        "url": (shop.get("urls") or {}).get("pc", ""),
        "lat": shop.get("lat"),
        "lng": shop.get("lng"),
    }


def main() -> int:
    if not os.environ.get("HOTPEPPER_API_KEY"):
        print("HOTPEPPER_API_KEY が未設定のため、お店データは取得しません")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    if fresh_enough():
        print("shop data is fresh; skip")
        return 0

    try:
        large = {a["name"]: a["code"] for a in get("large_area").get("large_area", [])}
        genre_master = {g["name"]: g["code"] for g in get("genre").get("genre", [])}
    except Exception as e:
        print(f"[warn] master fetch failed: {e}", file=sys.stderr)
        remove_stale()
        return 0

    genres = [(genre_master[n], label) for n, label in GENRES if n in genre_master]
    missing = [n for n, _ in GENRES if n not in genre_master]
    if missing:
        print(f"[warn] genres not found: {missing}", file=sys.stderr)

    meta_areas = []
    errors = 0
    for area in AREAS:
        code = large.get(area["pref"])
        if not code:
            print(f"[warn] large area not found: {area['pref']}", file=sys.stderr)
            continue
        shops: dict[str, dict] = {}
        for gcode, glabel in genres:
            for page in range(area["pages"]):
                params = {"large_area": code, "genre": gcode, "count": PER_QUERY, "order": 4,
                          "start": 1 + page * PER_QUERY}
                if area["keyword"]:
                    params["keyword"] = area["keyword"]
                try:
                    res = get("gourmet", **params)
                except Exception as e:
                    errors += 1
                    print(f"[warn] {area['id']} {glabel} p{page + 1}: {e}", file=sys.stderr)
                    break
                for i, s in enumerate(res.get("shop", [])):
                    if s["id"] not in shops:
                        item = compact(s, glabel)
                        # ホットペッパーのおすすめ順で、このエリア×ジャンルの何位か（「人気上位」の条件に使う）
                        item["rank"] = page * PER_QUERY + i + 1
                        shops[s["id"]] = item
                time.sleep(0.3)  # 相手のサーバーに負担をかけない
                if int(res.get("results_available", 0)) <= (page + 1) * PER_QUERY:
                    break
        if shops:
            (OUT / f"{area['id']}.json").write_text(
                json.dumps(list(shops.values()), ensure_ascii=False, separators=(",", ":")), "utf-8"
            )
            meta_areas.append({"id": area["id"], "label": area["label"], "count": len(shops)})
            print(f"{area['id']}: {len(shops)} shops")

    if not meta_areas:
        remove_stale()
        return 0
    meta = {
        "updated": NOW.isoformat(timespec="seconds"),
        "schema": SCHEMA,
        "areas": meta_areas,
        "genres": [label for _, label in genres],
        "errors": errors,
        "missing_genres": missing,
        "lunch_flag_count": sum(1 for f in OUT.glob("*.json") if f.name != "meta.json"
                                for sh in json.loads(f.read_text("utf-8")) if sh.get("lunch")),
    }
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

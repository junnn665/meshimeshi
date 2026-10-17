"""名古屋の天気予報（日ごと）を Open-Meteo から取って data/weather.json に保存する。

Open-Meteo は無料・登録不要（https://open-meteo.com/）。取れなかったときは前回のファイルをそのまま残す。
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "weather.json"
PLACE = {"name": "名古屋", "lat": 35.17, "lng": 136.91}


def main() -> int:
    q = urllib.parse.urlencode({
        "latitude": PLACE["lat"], "longitude": PLACE["lng"], "timezone": "Asia/Tokyo", "forecast_days": 8,
        "daily": "weather_code,precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min",
        "hourly": "weather_code,precipitation_probability,precipitation,temperature_2m",
    })
    url = "https://api.open-meteo.com/v1/forecast?" + q
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MeshimeshiShokudo/1.0 (github.com/junnn665/meshimeshi)"})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = json.load(r)
            d = raw["daily"]
            h = raw.get("hourly") or {}
    except Exception as e:  # noqa: BLE001
        print("天気を取れませんでした（前回の予報を残します）:", e, file=sys.stderr)
        return 0
    days = []
    for i, date in enumerate(d["time"]):
        days.append({
            "date": date,
            "code": d["weather_code"][i],
            "pop": d["precipitation_probability_max"][i],
            "rain": d["precipitation_sum"][i],
            "tmax": d["temperature_2m_max"][i],
            "tmin": d["temperature_2m_min"][i],
        })
    # 1時間ごと（今日と明日の分）：「今から行ける」で「◯時ごろから雨」を出すため
    hours = []
    for i, t in enumerate(h.get("time", [])[:48]):
        hours.append({
            "time": t,
            "code": h["weather_code"][i],
            "pop": h["precipitation_probability"][i],
            "rain": h["precipitation"][i],
            "temp": h["temperature_2m"][i],
        })
    OUT.write_text(json.dumps({
        "place": PLACE["name"],
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "Open-Meteo",
        "days": days,
        "hours": hours,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"天気 {len(days)} 日分")
    return 0


if __name__ == "__main__":
    sys.exit(main())

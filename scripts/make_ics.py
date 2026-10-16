"""ごはんイベントの「カレンダーに追加」用ファイル（cal/<group>.ics）を作る。

公開のときに data/news.json から作り、リポジトリには保存しない（.gitignore）。
同じイベントの記事（group が同じ）は1つにまとめ、日程はいちばん早い開始〜いちばん遅い終了にする。
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "cal"
NAME = re.compile(r"[「『]([^」』]{2,40})[」』]")


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line: str) -> str:
    # 75バイトごとに折り返す（RFC 5545）
    out, cur = [], b""
    for ch in line:
        b = ch.encode("utf-8")
        if len(cur) + len(b) > 73:
            out.append(cur.decode("utf-8"))
            cur = b" " + b
        else:
            cur += b
    out.append(cur.decode("utf-8"))
    return "\r\n".join(out)


def main() -> None:
    data = json.loads((ROOT / "data" / "news.json").read_text(encoding="utf-8"))
    groups: dict[str, list] = {}
    for it in data.get("items", []):
        if it.get("category") == "event" and it.get("group") and (it.get("start") or it.get("end")):
            groups.setdefault(it["group"], []).append(it)
    OUT.mkdir(exist_ok=True)
    for f in OUT.glob("*.ics"):
        f.unlink()
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for gid, its in groups.items():
        starts = [x["start"] for x in its if x.get("start")]
        ends = [x.get("end") or x.get("start") for x in its if x.get("end") or x.get("start")]
        start = min(starts) if starts else today
        end = max(ends + [start])
        last = dt.date.fromisoformat(end) + dt.timedelta(days=1)
        rep = sorted(its, key=lambda x: x.get("published", ""), reverse=True)[0]
        m = NAME.search(rep["title"])
        summary = m.group(1) if m else rep["title"]
        lines = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//meshimeshi//events//JA", "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            f"UID:{gid}@meshimeshi",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{start.replace('-', '')}",
            f"DTEND;VALUE=DATE:{last.strftime('%Y%m%d')}",
            "SUMMARY:" + esc(summary),
            "DESCRIPTION:" + esc(rep["title"] + "\n" + rep["link"] + "\n（飯飯食堂 ごはんイベントマップより。日程は記事でご確認ください）"),
            "URL:" + rep["link"],
        ]
        if rep.get("venue"):
            lines.append("LOCATION:" + esc(rep["venue"]))
        lines += ["END:VEVENT", "END:VCALENDAR"]
        (OUT / f"{gid}.ics").write_text("\r\n".join(fold(l) for l in lines) + "\r\n", encoding="utf-8", newline="")
    print(f"カレンダーファイル {len(groups)} 件")


if __name__ == "__main__":
    main()

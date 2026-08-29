# -*- coding: utf-8 -*-
"""
WebJump 数据管道：从 lkssite.vip 的开源仓库 (xiangjianan/lks, MIT) 拉取网站数据，
清洗后生成插件内置种子数据 extension/data/sites.json。

用法: python scripts/fetch_data.py
以后 LKs 出新一期时重跑本脚本，再在 Edge 扩展页点「重新加载」即可。
"""
import html
import json
import re
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "extension" / "data" / "sites.json"
LOCAL_FALLBACK = ROOT / "lks-data-sample.json"

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebJump/1.0"}
RAW_BASE = "https://raw.githubusercontent.com/xiangjianan/lks/master/"
KNOWN_DATA_FILE = "static/site/js/web.v12.2.json"


def fetch(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8")


def discover_data_file() -> str:
    """从仓库 index.html 里发现最新版本的数据文件名，失败则回退到已知版本。"""
    try:
        page = fetch(RAW_BASE + "index.html", timeout=15)
        matches = re.findall(r"static/site/js/(web\.v[\d.]+\.json)", page)
        if matches:
            # 去重保序，取最后一次出现的版本
            latest = sorted(set(matches), key=lambda m: [int(x) for x in re.findall(r"\d+", m)])
            return "static/site/js/" + latest[-1]
    except Exception as e:
        print(f"[warn] 自动发现数据文件失败（{e}），使用已知路径 {KNOWN_DATA_FILE}")
    return KNOWN_DATA_FILE


TAG_RE = re.compile(r"<[^>]*>")
WS_RE = re.compile(r"\s+")


def clean_title(raw: str) -> str:
    """标题里混着 iconfont 的 <span>&#xe64b;</span> 之类，去掉标签和解码实体。"""
    text = html.unescape(raw or "")
    text = TAG_RE.sub("", text)
    return WS_RE.sub(" ", text).strip()


def split_categories(kind_name: str) -> list:
    cats = []
    for part in (kind_name or "").split("&"):
        part = part.strip()
        if part and part not in cats:
            cats.append(part)
    return cats or ["未分类"]


def kind_number(kind: str) -> int:
    m = re.search(r"(\d+)", kind or "")
    return int(m.group(1)) if m else 0


def build(raw_items: list) -> dict:
    sites, seen_href, cleaned, dropped = [], set(), 0, 0
    for item in raw_items:
        href = (item.get("href") or "").strip()
        title = clean_title(item.get("title"))
        if not href or not title:
            dropped += 1
            continue
        if TAG_RE.search(item.get("title") or ""):
            cleaned += 1
        if href in seen_href:  # 跨期重复收录的站点只保留最早一期
            dropped += 1
            continue
        seen_href.add(href)
        sites.append(
            {
                "id": f"{item.get('kind')}-{item.get('id')}",
                "title": title,
                "href": href,
                "slogan": (item.get("slogan") or "").strip(),
                "kind": item.get("kind") or "web_0",
                "categories": split_categories(item.get("kind_name")),
            }
        )
    # 期数新的排前面，同期内按原始顺序
    sites.sort(key=lambda s: (-kind_number(s["kind"]), int(re.search(r"(\d+)", s["id"]).group(1))))
    return {
        "meta": {
            "source": "https://github.com/xiangjianan/lks (MIT License)",
            "origin": "https://lkssite.vip/",
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "count": len(sites),
        },
        "sites": sites,
    }


def report(data: dict) -> None:
    sites = data["sites"]
    kinds, cats = {}, {}
    for s in sites:
        kinds[s["kind"]] = kinds.get(s["kind"], 0) + 1
        for c in s["categories"]:
            cats[c] = cats.get(c, 0) + 1
    print(f"[ok] 共 {len(sites)} 条站点，写入 {OUT_FILE.relative_to(ROOT)}")
    print(f"     期数分布: {dict(sorted(kinds.items(), key=lambda kv: -kind_number(kv[0])))}")
    print(f"     分类分布: {dict(sorted(cats.items(), key=lambda kv: -kv[1]))}")


def main() -> int:
    raw_items = None
    data_file = discover_data_file()
    try:
        print(f"[..] 拉取 {RAW_BASE + data_file}")
        raw_items = json.loads(fetch(RAW_BASE + data_file))
        print(f"[ok] 已从 GitHub 拉取 {data_file}")
    except Exception as e:
        print(f"[warn] 网络拉取失败（{e}），尝试本地回退文件 {LOCAL_FALLBACK.name}")
        if LOCAL_FALLBACK.exists():
            raw_items = json.loads(LOCAL_FALLBACK.read_text(encoding="utf-8"))

    if not raw_items:
        print("[error] 没有任何数据源可用")
        return 1

    data = build(raw_items)
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    report(data)
    return 0


if __name__ == "__main__":
    sys.exit(main())

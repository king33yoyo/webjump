# -*- coding: utf-8 -*-
"""
生成 Edge Add-ons 商店发布包 webjump-v{version}.zip。

用 Python zipfile（正斜杠路径）打包，避免 PowerShell Compress-Archive
生成反斜杠路径条目导致商店解包异常的已知问题。

用法: python scripts/package.py
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"


def main() -> None:
    manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    out = ROOT / f"webjump-v{version}.zip"
    if out.exists():
        out.unlink()

    files = sorted(p for p in EXT.rglob("*") if p.is_file())
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for p in files:
            zf.write(p, p.relative_to(EXT).as_posix())

    # 自检：manifest.json 必须位于压缩包根，且路径全部使用正斜杠
    with zipfile.ZipFile(out) as zf:
        names = zf.namelist()
        assert "manifest.json" in names, "manifest.json 不在压缩包根目录"
        assert all("\\" not in n for n in names), "存在反斜杠路径条目"
        bad = zf.testzip()
        assert bad is None, f"损坏条目: {bad}"

    print(f"[ok] {out.name}  {out.stat().st_size} bytes, {len(files)} 个文件")


if __name__ == "__main__":
    main()

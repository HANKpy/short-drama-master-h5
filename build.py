#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把多文件源码打包成单个自包含 HTML 文件（内联全部 CSS/JS）。

用法：
    python3 build.py

输出：
    dist/short-drama-master-h5.html   双击即可用，不依赖任何外部文件

说明：
    内联标记按「文件路径」匹配整条标签，而不是按标签字面匹配。
    原因：index.html 可能被上游平台重新序列化（属性顺序变化、插入
    data-page-node-id、<!--pnid:...--> 等），整段字面 match 会静默
    匹配失败，产出只有几 KB 的「空壳」单文件却仍报 OK。
    因此本脚本对每一处内联都做「必须真的替换掉」的断言。
"""
import pathlib
import re

BASE = pathlib.Path(__file__).resolve().parent

# 内联顺序：CSS 先，JS 必须保持 data -> templates -> app 的依赖顺序
INLINES = [
    ("css/style.css", "style"),
    ("js/data.js", "script"),
    ("js/templates.js", "script"),
    ("js/app.js", "script"),
]

# 平台/工具注入物：不属于应用本体，会破坏「单文件自包含」，构建前剔除
_NOISE_PATTERNS = [
    re.compile(r'\s*data-page-node-id="[^"]*"'),                                        # 空间平台节点标记
    re.compile(r"<!--pnid:[a-zA-Z0-9]{6,}-->"),                                         # 空间平台节点注释
    re.compile(r'[ \t]*<script[^>]*src="/page/page_comm/inject\.js"[^>]*>\s*</script>\n?'),  # 平台注入脚本
]

_TAG_PATTERNS = {
    "style": re.compile(r'<link\b[^>]*href="[^"]*style\.css"[^>]*>'),
    "script": re.compile(r'<script\b[^>]*src="([^"]+)"[^>]*>\s*</script>'),
}


def clean(html: str) -> str:
    """剔除非应用注入物，避免它们影响内联匹配与自包含性。"""
    for pat in _NOISE_PATTERNS:
        html = pat.sub("", html)
    return html


def main():
    html = clean((BASE / "index.html").read_text(encoding="utf-8"))

    for rel, tag in INLINES:
        src = (BASE / rel).read_text(encoding="utf-8")
        short = rel.split("/")[-1]

        # 防止内联内容里出现结束标签导致 HTML 提前截断
        end_tag = "</style>" if tag == "style" else "</script>"
        if end_tag.lower() in src.lower():
            raise SystemExit(f"[错误] {rel} 中含有 {end_tag}，内联会破坏 HTML 结构")

        pattern = _TAG_PATTERNS[tag]
        found = pattern.findall(html)
        hit = [f for f in found if short in f]
        if not hit:
            raise SystemExit(
                f"[错误] index.html 里找不到引用 {rel} 的 <{tag}> 标签。\n"
                f"       实际找到: {found or '（无）'}\n"
                f"       请检查 index.html 是否保留了外部引用标签。"
            )

        def repl(_m, _t=tag, _c=src):
            return f"<{_t}>\n{_c}\n</{_t}>"

        html, n = pattern.subn(repl, html, count=len(hit))
        if n != len(hit):
            raise SystemExit(f"[错误] {rel} 内联替换数量异常（期望 {len(hit)}，实际 {n}）")
        print(f"[内联] {BASE.name}/{rel} -> <{tag}>, {len(src):,} 字符")

    # 断言：外部引用已彻底消失，且内联内容确实进去了
    leftovers = re.findall(r'<link[^>]*href="[^"]*\.(?:css)"[^>]*>', html)
    leftovers += re.findall(r'<script[^>]*src="([^"]+)"[^>]*>', html)
    if leftovers:
        raise SystemExit(f"[错误] 仍有外部引用未内联: {leftovers}")
    if "<script" not in html or "<style" not in html:
        raise SystemExit("[错误] 内联后 HTML 里没有 <script>/<style>，构建产物异常")

    out = BASE / "dist" / "short-drama-master-h5.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    size = out.stat().st_size
    print(f"[OK] 已生成 {out.relative_to(BASE)}  ({size:,} 字节)")
    if size < 50_000:
        raise SystemExit(
            f"[错误] 产物仅 {size:,} 字节，远小于预期 —— 疑似内联未生效，请检查 index.html。"
        )


if __name__ == "__main__":
    main()

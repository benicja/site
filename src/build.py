#!/usr/bin/env python3
"""
build.py — Converts CV.md → CV.pdf

Usage:
    python src/build.py

Reads:   CV.md          (in repo root)
Writes:  CV.pdf         (in repo root)
Temp:    src/_build.html  (intermediate HTML, safe to delete)
"""

import re
import sys
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright

# ── Paths ─────────────────────────────────────────────────────────────────────
SRC_DIR   = Path(__file__).parent
REPO_ROOT = SRC_DIR.parent
CV_MD     = REPO_ROOT / "CV.md"
CV_PDF    = REPO_ROOT / "CV.pdf"
TMP_HTML  = SRC_DIR / "_build.html"


# ── Inline Markdown → HTML ────────────────────────────────────────────────────
def inline(text: str) -> str:
    """Convert inline markdown to HTML, safely escaping HTML entities first."""
    # 1. Escape HTML special characters
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # 2. Protect backslash-escaped characters before processing markup
    text = text.replace(r"\*", "\x00STAR\x00")
    text = text.replace(r"\[", "\x00LBRAK\x00")
    text = text.replace(r"\]", "\x00RBRAK\x00")

    # 3. Bold + italic (must come before bold and italic individually)
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"<strong><em>\1</em></strong>", text)
    # 4. Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # 5. Italic
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)

    # 6. Markdown links [text](url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)

    # 7. Restore escaped characters
    text = text.replace("\x00STAR\x00", "*")
    text = text.replace("\x00LBRAK\x00", "[")
    text = text.replace("\x00RBRAK\x00", "]")

    return text


# ── Block parser ──────────────────────────────────────────────────────────────
def parse_cv(source: str) -> tuple[dict, str]:
    """Parse CV.md into (frontmatter_dict, html_body_string)."""

    # Extract YAML frontmatter between --- delimiters
    fm_match = re.match(r"^---\n(.*?)\n---\n", source, re.DOTALL)
    if fm_match:
        meta = yaml.safe_load(fm_match.group(1))
        body = source[fm_match.end():]
    else:
        meta = {}
        body = source

    html_parts: list[str] = []
    pending_list: list[str] = []

    def flush_list() -> None:
        if pending_list:
            items_html = "".join(f"<li>{inline(item)}</li>" for item in pending_list)
            html_parts.append(f"<ul>{items_html}</ul>")
            pending_list.clear()

    lines = body.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # ── Blank line ────────────────────────────────────────
        if not line.strip():
            flush_list()
            i += 1
            continue

        # ── Manual page break ─────────────────────────────────
        if line.strip() == "---pagebreak---":
            flush_list()
            html_parts.append('<div class="page-break"></div>')
            i += 1
            continue

        # ── ## Section heading ────────────────────────────────
        if line.startswith("## "):
            flush_list()
            text = line[3:].strip()
            html_parts.append(f'<div class="section-heading">{inline(text)}</div>')
            i += 1
            continue

        # ── ### Entry row (bold: company name or degree) ───────
        if line.startswith("### "):
            flush_list()
            text = line[4:].strip()
            if " | " in text:
                left, right = text.split(" | ", 1)
                html_parts.append(
                    f'<div class="date-row h3-row">'
                    f'<strong class="dr-left">{inline(left)}</strong>'
                    f'<span class="dr-right">{inline(right)}</span>'
                    f"</div>"
                )
            else:
                html_parts.append(
                    f'<div class="h3-row">'
                    f"<strong>{inline(text)}</strong>"
                    f"</div>"
                )
            i += 1
            continue

        # ── #### Sub-entry row (italic: job title) ─────────────
        if line.startswith("#### "):
            flush_list()
            text = line[5:].strip()
            if " | " in text:
                left, right = text.split(" | ", 1)
                html_parts.append(
                    f'<div class="date-row h4-row">'
                    f'<em class="dr-left">{inline(left)}</em>'
                    f'<span class="dr-right">{inline(right)}</span>'
                    f"</div>"
                )
            else:
                html_parts.append(
                    f'<div class="h4-row">'
                    f"<em>{inline(text)}</em>"
                    f"</div>"
                )
            i += 1
            continue

        # ── Bullet list item ──────────────────────────────────
        if line.startswith("- "):
            pending_list.append(line[2:].strip())
            i += 1
            continue

        # ── Regular paragraph ─────────────────────────────────
        # Collect all contiguous non-empty, non-heading, non-bullet lines
        flush_list()
        para_lines: list[str] = []
        while (
            i < len(lines)
            and lines[i].strip()
            and not lines[i].startswith(("## ", "### ", "#### ", "- "))
        ):
            para_lines.append(lines[i].strip())
            i += 1
        if para_lines:
            html_parts.append(f'<p>{inline(" ".join(para_lines))}</p>')

    flush_list()
    return meta, "\n".join(html_parts)


# ── Playwright PDF renderer ───────────────────────────────────────────────────
def render_pdf(html_path: Path, pdf_path: Path, footer_name: str) -> None:
    footer_template = (
        '<div style="'
        "font-family: Arial, Helvetica, sans-serif;"
        "font-size: 10pt;"
        "width: 100%;"
        "text-align: right;"
        "padding: 0 0.5in;"
        "box-sizing: border-box;"
        'color: #000;">'
        f"{footer_name}<br>"
        'Page <span class="pageNumber"></span>'
        ' of <span class="totalPages"></span>'
        "</div>"
    )

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(html_path.as_uri())
        page.pdf(
            path=str(pdf_path),
            format="Letter",
            margin={
                "top": "0.6in",
                "bottom": "0.75in",
                "left": "0.5in",
                "right": "0.5in",
            },
            display_header_footer=True,
            header_template="<div></div>",
            footer_template=footer_template,
            print_background=True,
        )
        browser.close()


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    if not CV_MD.exists():
        print(f"Error: {CV_MD} not found.", file=sys.stderr)
        sys.exit(1)

    source = CV_MD.read_text(encoding="utf-8")
    meta, body_html = parse_cv(source)

    env = Environment(loader=FileSystemLoader(str(SRC_DIR)), autoescape=False)
    template = env.get_template("template.html")
    html = template.render(body=body_html, **meta)

    TMP_HTML.write_text(html, encoding="utf-8")
    print(f"  HTML written → {TMP_HTML.relative_to(REPO_ROOT)}")

    render_pdf(TMP_HTML, CV_PDF, footer_name=meta.get("footer_name", ""))
    print(f"  PDF written  → {CV_PDF.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()

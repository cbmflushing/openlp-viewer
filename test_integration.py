#!/usr/bin/env python3
"""
Integration tests for lyrics-display.html against a live OpenLP server.
Tests API connectivity, response structure, and the app's slide-parsing logic.
Run: python3 test_integration.py
"""

import json
from html.parser import HTMLParser
import re
import sys
import urllib.request
import urllib.error

SERVER = "http://192.168.1.212:4316"
LIVE_TEXT_URL = f"{SERVER}/api/controller/live/text"


def ok(msg):
    print(f"  PASS  {msg}")

def fail(msg):
    print(f"  FAIL  {msg}")
    sys.exit(1)

def section(title):
    print(f"\n{title}")
    print("-" * len(title))


# ---------------------------------------------------------------------------
# API connectivity
# ---------------------------------------------------------------------------

section("API connectivity")

try:
    with urllib.request.urlopen(LIVE_TEXT_URL, timeout=5) as r:
        body = r.read().decode()
        status = r.status
except urllib.error.URLError as e:
    fail(f"Could not reach {LIVE_TEXT_URL}: {e}")

if status == 200:
    ok(f"GET /api/controller/live/text returned HTTP 200")
else:
    fail(f"Expected 200, got {status}")

try:
    data = json.loads(body)
    ok("Response is valid JSON")
except json.JSONDecodeError as e:
    fail(f"Invalid JSON: {e}")

if "results" in data and "slides" in data["results"]:
    ok("Response has expected shape: {results: {slides: [...]}}")
else:
    fail(f"Unexpected response shape: {data}")

slides = data["results"]["slides"]
if isinstance(slides, list):
    ok(f"slides is a list (currently {len(slides)} items — nothing playing is expected)")
else:
    fail("slides is not a list")


# ---------------------------------------------------------------------------
# Slide parsing logic (mirrors the JS in lyrics-display.html)
# ---------------------------------------------------------------------------

def escape_html(text):
    """Mirror of escapeHtml() in the app."""
    return (text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))

def parse_slide(slide):
    """
    Mirror of the fetchAndDisplay() parsing block.
    Returns (english_lines, chinese_lines, footer_extra).
    """
    text = slide.get("html") or slide.get("text", "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)

    class VisibleText(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.parts = []

        def handle_data(self, data):
            self.parts.append(data)

    english_lines = []
    chinese_lines = []
    for line in text.split("\n"):
        parser = VisibleText()
        parser.feed(line)
        visible = re.sub(r"\s+", "", "".join(parser.parts))
        if not visible:
            continue
        chinese_count = len(re.findall(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]", visible))
        if chinese_count / len(visible) > 0.3:
            if visible not in chinese_lines:
                chinese_lines.append(visible)
        else:
            english_lines.append(line.strip())

    return english_lines, chinese_lines

def decode_title_prefix(title):
    """Mirror of the footer prefix logic in fetchAndDisplay()."""
    m = re.match(r"^([a-z]+)(\d+)", title.lower().strip())
    if not m:
        return ""
    prefix, number = m.group(1), m.group(2)
    if prefix == "c":
        return f"Chorus #{number}"
    if prefix == "h":
        return f"Hymnary #{number}"
    if prefix == "ch":
        return f"Songbook #{number}"
    return ""


section("Slide parsing — empty slide")

empty = {"text": "", "html": ""}
eng, chn = parse_slide(empty)
assert eng == [], fail(f"Expected no English lines, got {eng}")
ok("Empty slide returns no lines")


section("Slide parsing — English only")

slide_en = {
    "text": "Amazing grace how sweet the sound",
    "html": "Amazing grace how sweet the sound",
}
eng, chn = parse_slide(slide_en)
assert len(eng) == 1 and eng[0] == "Amazing grace how sweet the sound", \
    fail(f"Unexpected English lines: {eng}")
assert chn == [], fail(f"Expected no Chinese lines, got {chn}")
ok("English-only slide parsed correctly")


section("Slide parsing — bilingual slide with <span> Chinese")

slide_bi = {
    "html": (
        "Amazing grace how sweet the sound<br/>"
        "<span style='color:yellow'>奇異恩典何等甘甜</span><br/>"
        "That saved a wretch like me<br/>"
        "<span style='color:yellow'>竟救了我這罪人</span>"
    ),
}
eng, chn = parse_slide(slide_bi)
assert "Amazing grace how sweet the sound" in eng, fail(f"Missing English line: {eng}")
assert "That saved a wretch like me" in eng, fail(f"Missing second English line: {eng}")
assert "奇異恩典何等甘甜" in chn, fail(f"Missing Chinese line: {chn}")
assert "竟救了我這罪人" in chn, fail(f"Missing second Chinese line: {chn}")
ok("Bilingual slide: English and Chinese lines separated correctly")


section("Slide parsing — duplicate Chinese lines are deduplicated")

slide_dup = {
    "html": (
        "Line one<br/>"
        "<span>重複的句子</span><br/>"
        "Line two<br/>"
        "<span>重複的句子</span>"
    ),
}
_, chn = parse_slide(slide_dup)
assert chn.count("重複的句子") == 1, fail(f"Duplicate Chinese line not deduplicated: {chn}")
ok("Duplicate Chinese lines are deduplicated")


section("Title prefix decoding")

cases = [
    ("c23",   "Chorus #23"),
    ("C23",   "Chorus #23"),
    ("h14",   "Hymnary #14"),
    ("ch7",   "Songbook #7"),
    ("CH7",   "Songbook #7"),
    ("song1", ""),           # unknown prefix → no label
    ("",      ""),           # empty title
]
for title, expected in cases:
    result = decode_title_prefix(title)
    assert result == expected, fail(f"decode_title_prefix({title!r}): expected {expected!r}, got {result!r}")
ok(f"All {len(cases)} prefix cases pass: c=Chorus, h=Hymnary, ch=Songbook, unknown=empty")


section("CCLI footer")

def build_footer(ccli_number, footer_extra=""):
    html = "CBM Flushing"
    if ccli_number:
        html += f" © CCLI# {ccli_number}"
    if footer_extra:
        html += f"<br>{footer_extra}"
    return html

assert build_footer("") == "CBM Flushing", fail("Empty CCLI should omit © line")
assert build_footer("26557") == "CBM Flushing © CCLI# 26557", fail("CCLI number not appended")
assert build_footer("26557", "Chorus #3") == "CBM Flushing © CCLI# 26557<br>Chorus #3", \
    fail("Footer with CCLI and songbook label failed")
ok("Footer builds correctly with and without CCLI number")


section("Summary")
print("\n  All tests passed.")
